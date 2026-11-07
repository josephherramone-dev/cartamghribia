const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const game = require('./game');

const PORT = process.env.PORT || 3000;
const DISCONNECTED_TURN_MS = 20000; // auto-draw for a disconnected player after this
const EMPTY_ROOM_GRACE_MS = 60000;  // keep an empty room this long so a refresh can rejoin
const BOT_DELAY_MS = [900, 1700];   // bots "think" for a random time in this range
const BOT_NAMES = ['Hajj Driss', 'Lalla Fatima', 'Si Mohamed', 'Khalti Zineb', 'Ba Hmad', 'Mi Aicha', 'Ammi Larbi'];
const LEVELS = ['easy', 'hard'];

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server);

/**
 * code -> { code, hostId, solo, players: [{ id, name, socketId, connected, bot?, level? }], game, timer }
 * `solo` rooms are "vs computer" games: private and not joinable.
 */
const rooms = new Map();

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const cleanName = (name) => String(name || '').trim().slice(0, 16) || 'Player';
const cleanLevel = (level) => (LEVELS.includes(level) ? level : 'hard');
const isPresent = (p) => p.bot || p.connected;

function makeBot(room, level) {
  const used = new Set(room.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.players.length + 1}`;
  return { id: `bot-${crypto.randomUUID()}`, name, bot: true, level: cleanLevel(level), connected: true };
}

function publicPlayers(room) {
  return room.players.map(({ id, name, connected, bot, level }) => ({ id, name, connected, bot: !!bot, level }));
}

function broadcast(room) {
  for (const p of room.players) {
    if (p.bot || !p.connected) continue;
    io.to(p.socketId).emit('room', {
      code: room.code,
      hostId: room.hostId,
      solo: room.solo,
      players: publicPlayers(room),
      game: room.game ? game.viewFor(room.game, p.id) : null,
    });
  }
  scheduleAutoMove(room);
}

/** Bots move after a short delay; disconnected humans auto-draw after a longer one. */
function scheduleAutoMove(room) {
  clearTimeout(room.timer);
  const g = room.game;
  if (!g || g.winner) return;
  if (!hasHumans(room)) return; // nobody watching: pause
  const currentId = g.players[g.turn].id;
  const current = room.players.find((p) => p.id === currentId);
  if (!current || (!current.bot && current.connected)) return;

  const delay = current.bot
    ? BOT_DELAY_MS[0] + Math.random() * (BOT_DELAY_MS[1] - BOT_DELAY_MS[0])
    : DISCONNECTED_TURN_MS;

  room.timer = setTimeout(() => {
    if (room.game !== g || g.winner || g.players[g.turn].id !== currentId) return;
    if (current.bot) {
      const move = game.chooseBotMove(g, currentId, current.level);
      if (move.action === 'play') game.playCard(g, currentId, move.cardId, move.suit);
      else game.drawCard(g, currentId);
    } else if (!current.connected) {
      game.drawCard(g, currentId);
      g.log.push(`(${current.name} is away — auto-drew)`);
    }
    broadcast(room);
  }, delay);
}

const hasHumans = (room) => room.players.some((p) => !p.bot && p.connected);

function scheduleCleanup(room) {
  clearTimeout(room.cleanup);
  if (hasHumans(room)) return;
  clearTimeout(room.timer);
  room.cleanup = setTimeout(() => {
    if (!hasHumans(room)) rooms.delete(room.code);
  }, EMPTY_ROOM_GRACE_MS);
}

io.on('connection', (socket) => {
  let room = null;
  let playerId = null;

  const fail = (message) => socket.emit('error_msg', message);
  const isHost = () => room && room.hostId === playerId;

  function attach(r, p) {
    room = r;
    playerId = p.id;
    p.socketId = socket.id;
    p.connected = true;
    clearTimeout(r.cleanup);
    socket.join(r.code);
    socket.emit('joined', { code: r.code, playerId: p.id, solo: r.solo });
    broadcast(r);
  }

  function createRoom(name, solo) {
    const r = { code: makeCode(), hostId: null, solo, players: [], game: null, timer: null };
    const p = { id: crypto.randomUUID(), name: cleanName(name), socketId: socket.id, connected: true };
    r.hostId = p.id;
    r.players.push(p);
    rooms.set(r.code, r);
    return { r, p };
  }

  socket.on('create_room', ({ name } = {}) => {
    if (room) return fail('Already in a room');
    const { r, p } = createRoom(name, false);
    attach(r, p);
  });

  // Single player: a private room filled with bots, started right away
  socket.on('play_computer', ({ name, bots = 1, level } = {}) => {
    if (room) return fail('Already in a room');
    const count = Math.min(Math.max(parseInt(bots, 10) || 1, 1), game.MAX_PLAYERS - 1);
    const { r, p } = createRoom(name, true);
    for (let i = 0; i < count; i++) r.players.push(makeBot(r, level));
    r.game = game.newGame(r.players.map(({ id, name: n }) => ({ id, name: n })));
    attach(r, p);
  });

  socket.on('join_room', ({ code, name, playerId: token } = {}) => {
    if (room) return fail('Already in a room');
    const r = rooms.get(String(code || '').trim().toUpperCase());
    if (!r) return fail('Room not found');

    // Reconnect with a saved player token
    const existing = token && r.players.find((p) => p.id === token && !p.bot);
    if (existing) {
      if (existing.connected) return fail('That player is already connected');
      return attach(r, existing);
    }
    if (r.solo) return fail('That is a private game');
    if (r.game && !r.game.winner) return fail('Game already in progress');
    if (r.players.length >= game.MAX_PLAYERS) return fail('Room is full');
    const p = { id: crypto.randomUUID(), name: cleanName(name), socketId: socket.id, connected: true };
    r.players.push(p);
    attach(r, p);
  });

  socket.on('add_bot', ({ level } = {}) => {
    if (!room) return;
    if (!isHost()) return fail('Only the host can add computer players');
    if (room.game && !room.game.winner) return fail('Game already running');
    if (room.players.length >= game.MAX_PLAYERS) return fail('Room is full');
    room.players.push(makeBot(room, level));
    broadcast(room);
  });

  socket.on('remove_bot', ({ id } = {}) => {
    if (!room || !isHost()) return;
    if (room.game && !room.game.winner) return;
    room.players = room.players.filter((p) => !(p.bot && p.id === id));
    broadcast(room);
  });

  socket.on('start_game', () => {
    if (!room) return;
    if (!isHost()) return fail('Only the host can start');
    if (room.game && !room.game.winner) return fail('Game already running');
    const active = room.players.filter(isPresent);
    if (active.length < game.MIN_PLAYERS) return fail(`Need at least ${game.MIN_PLAYERS} players`);
    room.players = active; // drop players who left before a new round
    room.game = game.newGame(active.map(({ id, name }) => ({ id, name })));
    broadcast(room);
  });

  function act(fn) {
    if (!room || !room.game) return;
    try {
      fn();
      broadcast(room);
    } catch (e) {
      if (e instanceof game.GameError) fail(e.message); else throw e;
    }
  }

  socket.on('play_card', ({ cardId, suit } = {}) => act(() => game.playCard(room.game, playerId, cardId, suit)));
  socket.on('draw_card', () => act(() => game.drawCard(room.game, playerId)));

  socket.on('chat', (text) => {
    if (!room) return;
    const msg = String(text || '').trim().slice(0, 200);
    if (!msg) return;
    const p = room.players.find((x) => x.id === playerId);
    io.to(room.code).emit('chat', { name: p ? p.name : '?', text: msg });
  });

  function leave() {
    if (!room) return;
    const r = room;
    const p = r.players.find((x) => x.id === playerId);
    socket.leave(r.code);
    room = null;
    if (!p) return;
    p.connected = false;
    // During a running game the seat is kept so the player can reconnect
    // (their turns are auto-drawn meanwhile); otherwise they are removed.
    if (!r.game || r.game.winner) r.players = r.players.filter((x) => x !== p);
    if (r.hostId === p.id) {
      const next = r.players.find((x) => !x.bot && x.connected);
      if (next) r.hostId = next.id;
    }
    scheduleCleanup(r);
    if (hasHumans(r)) broadcast(r);
  }

  socket.on('leave_room', leave);
  socket.on('disconnect', leave);
});

server.listen(PORT, () => console.log(`Carta Mghribia running on http://localhost:${PORT}`));
