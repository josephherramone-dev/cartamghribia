const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const games = require('./games');

const PORT = process.env.PORT || 3000;
const IDLE_TURN_MS = 30000;          // a disconnected player's turn is handled after this
const EMPTY_ROOM_GRACE_MS = 60000;   // keep an empty room so a refresh can rejoin
const QUICK_FILL_MS = 6000;          // multi-seat games wait this long for more players
const BOT_NAMES = ['Hajj Driss', 'Lalla Fatima', 'Si Mohamed', 'Khalti Zineb', 'Ba Hmad', 'Mi Aicha', 'Ammi Larbi', 'Nadia', 'Youssef'];
const BOT_AVATARS = ['🤖', '🦉', '🐫', '🦊'];
const LEVELS = ['easy', 'hard'];

const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.use(express.static(PUBLIC));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/api/games', (_req, res) => res.json(Object.values(games).map(({ id, name, minPlayers, maxPlayers }) => ({ id, name, minPlayers, maxPlayers }))));
app.get('/api/online', (_req, res) => res.json(onlineStats()));
app.get('/card-images.json', (_req, res) => res.json(scanCardImages()));

/* ---------- optional real card images for Carta (public/cards) ---------- */
const CARDS_DIR = path.join(PUBLIC, 'cards');
const SUIT_ALIASES = {
  dheb: 'dheb', oros: 'dheb', oro: 'dheb', coins: 'dheb',
  kass: 'kass', copas: 'kass', copa: 'kass', cups: 'kass',
  syouf: 'syouf', espadas: 'syouf', espada: 'syouf', swords: 'syouf',
  zrawet: 'zrawet', bastos: 'zrawet', basto: 'zrawet', clubs: 'zrawet',
};
function scanCardImages() {
  const out = { cards: {}, back: null };
  let files = [];
  try { files = fs.readdirSync(CARDS_DIR); } catch { return out; }
  for (const f of files) {
    const url = 'cards/' + encodeURIComponent(f);
    if (/^back\.(png|jpe?g|webp|svg|gif)$/i.test(f)) { out.back = url; continue; }
    const m = f.toLowerCase().match(/^([a-z]+|\d+)[-_ ]([a-z]+|\d+)\.(png|jpe?g|webp|svg|gif)$/);
    if (!m) continue;
    const num = /^\d+$/.test(m[1]) ? +m[1] : +m[2];
    const suit = SUIT_ALIASES[/^\d+$/.test(m[1]) ? m[2] : m[1]];
    if (suit && [1, 2, 3, 4, 5, 6, 7, 10, 11, 12].includes(num)) out.cards[`${num}-${suit}`] = url;
  }
  return out;
}

const server = http.createServer(app);
const io = new Server(server);

/**
 * Room: { code, gameId, hostId, kind: 'private'|'solo'|'quick',
 *         players: [{ id, name, avatar, socketId, connected, bot?, level? }],
 *         state, timer, cleanup }
 */
const rooms = new Map();
const queues = {}; // gameId -> [{ socket, name, avatar }]

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  while (rooms.has(code));
  return code;
}
const cleanName = (n) => String(n || '').trim().slice(0, 16) || `Guest${crypto.randomInt(1000, 9999)}`;
const cleanAvatar = (a) => (typeof a === 'string' && a.length <= 8 && a.trim() ? a : '🙂');
const cleanLevel = (l) => (LEVELS.includes(l) ? l : 'hard');
const hasHumans = (room) => room.players.some((p) => !p.bot && p.connected);
const isPresent = (p) => p.bot || p.connected;

function onlineStats() {
  const perGame = {};
  for (const g of Object.keys(games)) perGame[g] = 0;
  let total = 0;
  for (const r of rooms.values()) {
    const n = r.players.filter((p) => !p.bot && p.connected).length;
    perGame[r.gameId] += n; total += n;
  }
  for (const [g, q] of Object.entries(queues)) { perGame[g] += q.length; total += q.length; }
  return { total, perGame };
}

function makeBot(room, level) {
  const used = new Set(room.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.players.length + 1}`;
  return { id: `bot-${crypto.randomUUID()}`, name, avatar: BOT_AVATARS[room.players.length % BOT_AVATARS.length], bot: true, level: cleanLevel(level), connected: true };
}

function payloadFor(room, p) {
  const game = games[room.gameId];
  return {
    code: room.code,
    gameId: room.gameId,
    kind: room.kind,
    hostId: room.hostId,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    players: room.players.map(({ id, name, avatar, connected, bot, level }) => ({ id, name, avatar, connected, bot: !!bot, level })),
    game: room.state ? game.view(room.state, p.id) : null,
  };
}

function broadcast(room) {
  for (const p of room.players) {
    if (!p.bot && p.connected) io.to(p.socketId).emit('room', payloadFor(room, p));
  }
  scheduleAuto(room);
}

/** Bots act after a short delay; a disconnected human's turn is resolved after a longer one. */
function scheduleAuto(room) {
  clearTimeout(room.timer);
  const game = games[room.gameId];
  const st = room.state;
  if (!st || game.isOver(st) || !hasHumans(room)) return;
  const turnId = game.turnOf(st);
  const current = room.players.find((p) => p.id === turnId);
  if (!current || (!current.bot && current.connected)) return;
  const delay = current.bot ? (game.botDelay ? game.botDelay(st) : 900 + Math.random() * 800) : IDLE_TURN_MS;
  room.timer = setTimeout(() => {
    if (room.state !== st || game.isOver(st) || game.turnOf(st) !== turnId) return;
    try {
      if (current.bot) game.act(st, turnId, game.botAct(st, turnId, current.level));
      else if (!current.connected && game.onIdle) game.onIdle(st, turnId);
    } catch (e) {
      console.error('auto move failed', room.gameId, e.message);
    }
    broadcast(room);
  }, delay);
}

function scheduleCleanup(room) {
  clearTimeout(room.cleanup);
  if (hasHumans(room)) return;
  clearTimeout(room.timer);
  room.cleanup = setTimeout(() => { if (!hasHumans(room)) rooms.delete(room.code); }, EMPTY_ROOM_GRACE_MS);
}

function startGame(room) {
  const game = games[room.gameId];
  room.players = room.players.filter(isPresent);
  room.state = game.create(room.players.map(({ id, name }) => ({ id, name })));
}

function newRoom(gameId, kind) {
  const room = { code: makeCode(), gameId, kind, hostId: null, players: [], state: null, timer: null, cleanup: null };
  rooms.set(room.code, room);
  return room;
}

/* ---------- quick match ---------- */
function removeFromQueues(socket) {
  for (const [g, q] of Object.entries(queues)) {
    const i = q.findIndex((x) => x.socket === socket);
    if (i !== -1) { q.splice(i, 1); notifyQueue(g); }
  }
}
function notifyQueue(gameId) {
  const q = queues[gameId] || [];
  for (const x of q) x.socket.emit('queue', { gameId, waiting: q.length });
  const game = games[gameId];
  clearTimeout(queues[gameId + ':timer']);
  if (q.length >= game.maxPlayers) return matchQueue(gameId);
  if (q.length >= game.minPlayers) {
    // two-player games start at once; bigger tables wait a little for more people
    if (game.maxPlayers === game.minPlayers) return matchQueue(gameId);
    queues[gameId + ':timer'] = setTimeout(() => matchQueue(gameId), QUICK_FILL_MS);
  }
}
function matchQueue(gameId) {
  const game = games[gameId];
  const q = queues[gameId];
  if (!q || q.length < game.minPlayers) return;
  const group = q.splice(0, game.maxPlayers);
  const room = newRoom(gameId, 'quick');
  for (const x of group) {
    const p = { id: crypto.randomUUID(), name: x.name, avatar: x.avatar, socketId: x.socket.id, connected: true };
    room.players.push(p);
    x.attach(room, p);
  }
  room.hostId = room.players[0].id;
  startGame(room);
  broadcast(room);
  if (q.length) notifyQueue(gameId);
}

/* ---------- sockets ---------- */
io.on('connection', (socket) => {
  let room = null;
  let playerId = null;
  const fail = (message) => socket.emit('error_msg', message);
  const isHost = () => room && room.hostId === playerId;
  const me = () => room && room.players.find((p) => p.id === playerId);

  function attach(r, p) {
    room = r;
    playerId = p.id;
    p.socketId = socket.id;
    p.connected = true;
    clearTimeout(r.cleanup);
    socket.join(r.code);
    socket.emit('joined', { code: r.code, playerId: p.id, gameId: r.gameId });
  }

  function guard(fn) {
    return (data = {}) => {
      try { fn(data || {}); } catch (e) {
        if (e && e.constructor && e.constructor.name === 'GameError') fail(e.message);
        else { console.error(e); fail('Something went wrong'); }
      }
    };
  }

  socket.on('room:create', guard(({ gameId, name, avatar, solo, bots, level }) => {
    const game = games[gameId];
    if (!game) return fail('Unknown game');
    if (room) leave();
    removeFromQueues(socket);
    const r = newRoom(gameId, solo ? 'solo' : 'private');
    const p = { id: crypto.randomUUID(), name: cleanName(name), avatar: cleanAvatar(avatar), socketId: socket.id, connected: true };
    r.hostId = p.id;
    r.players.push(p);
    if (solo) {
      const count = Math.min(Math.max(parseInt(bots, 10) || 1, 1), game.maxPlayers - 1);
      for (let i = 0; i < count; i++) r.players.push(makeBot(r, level));
      startGame(r);
    }
    attach(r, p);
    broadcast(r);
  }));

  socket.on('room:join', guard(({ code, name, avatar, playerId: token }) => {
    const r = rooms.get(String(code || '').trim().toUpperCase());
    if (!r) return fail('Room not found — it may have ended');
    if (room === r) return broadcast(r);
    if (room) leave();
    removeFromQueues(socket);
    const game = games[r.gameId];
    const existing = token && r.players.find((p) => p.id === token && !p.bot);
    if (existing) {
      if (existing.connected) io.sockets.sockets.get(existing.socketId)?.emit('error_msg', 'Opened in another tab');
      attach(r, existing);
      return broadcast(r);
    }
    if (r.kind === 'solo') return fail('That is a private game against the computer');
    if (r.state && !game.isOver(r.state)) return fail('This game has already started');
    if (r.players.length >= game.maxPlayers) return fail('Room is full');
    const p = { id: crypto.randomUUID(), name: cleanName(name), avatar: cleanAvatar(avatar), socketId: socket.id, connected: true };
    r.players.push(p);
    attach(r, p);
    broadcast(r);
  }));

  socket.on('quick:join', guard(({ gameId, name, avatar }) => {
    if (!games[gameId]) return fail('Unknown game');
    if (room) leave();
    removeFromQueues(socket);
    (queues[gameId] = queues[gameId] || []).push({ socket, name: cleanName(name), avatar: cleanAvatar(avatar), attach });
    notifyQueue(gameId);
  }));
  socket.on('quick:cancel', () => removeFromQueues(socket));

  socket.on('room:addBot', guard(({ level }) => {
    if (!room || !isHost()) return;
    const game = games[room.gameId];
    if (room.state && !game.isOver(room.state)) return fail('Game already running');
    if (room.players.length >= game.maxPlayers) return fail('Room is full');
    room.players.push(makeBot(room, level));
    broadcast(room);
  }));

  socket.on('room:removeBot', guard(({ id }) => {
    if (!room || !isHost()) return;
    if (room.state && !games[room.gameId].isOver(room.state)) return;
    room.players = room.players.filter((p) => !(p.bot && p.id === id));
    broadcast(room);
  }));

  socket.on('room:start', guard(() => {
    if (!room) return;
    const game = games[room.gameId];
    if (!isHost()) return fail('Only the host can start');
    if (room.state && !game.isOver(room.state)) return fail('Game already running');
    if (room.players.filter(isPresent).length < game.minPlayers) return fail(`Need at least ${game.minPlayers} players`);
    startGame(room);
    broadcast(room);
  }));

  socket.on('game:action', guard((action) => {
    if (!room || !room.state) return;
    games[room.gameId].act(room.state, playerId, action);
    broadcast(room);
  }));

  // Live, non-authoritative hints between players (e.g. where the opponent is aiming)
  let lastSignal = 0;
  socket.on('room:signal', (data) => {
    if (!room || Date.now() - lastSignal < 40) return;
    lastSignal = Date.now();
    const json = JSON.stringify(data || null);
    if (json.length > 500) return;
    socket.to(room.code).volatile.emit('signal', { from: playerId, data });
  });

  socket.on('chat', (text) => {
    if (!room) return;
    const msg = String(text || '').trim().slice(0, 200);
    if (!msg) return;
    const p = me();
    io.to(room.code).emit('chat', { id: playerId, name: p ? p.name : '?', avatar: p ? p.avatar : '', text: msg });
  });

  function leave(explicit = false) {
    if (!room) return;
    const r = room;
    const game = games[r.gameId];
    const p = me();
    socket.leave(r.code);
    room = null;
    if (!p) return;
    p.connected = false;
    const running = r.state && !game.isOver(r.state);
    if (running && explicit && game.onLeave) game.onLeave(r.state, p.id);
    if (!running) r.players = r.players.filter((x) => x !== p);
    if (r.hostId === p.id) {
      const next = r.players.find((x) => !x.bot && x.connected);
      if (next) r.hostId = next.id;
    }
    scheduleCleanup(r);
    if (hasHumans(r)) broadcast(r);
  }

  socket.on('room:leave', () => leave(true));
  socket.on('disconnect', () => { removeFromQueues(socket); leave(false); });
});

server.listen(PORT, () => console.log(`Divoxe Games running on http://localhost:${PORT}`));
