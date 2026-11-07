const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const game = require('./game');

const PORT = process.env.PORT || 3000;
const DISCONNECTED_TURN_MS = 20000; // auto-draw for a disconnected player after this

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server);

/** code -> { code, hostId, players: [{id, name, socketId, connected}], game, timer } */
const rooms = new Map();

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || '').trim().slice(0, 16);
  return n || 'Player';
}

function broadcast(room) {
  for (const p of room.players) {
    if (!p.connected) continue;
    io.to(p.socketId).emit('room', {
      code: room.code,
      hostId: room.hostId,
      players: room.players.map(({ id, name, connected }) => ({ id, name, connected })),
      game: room.game ? game.viewFor(room.game, p.id) : null,
    });
  }
  scheduleDisconnectedTurn(room);
}

function scheduleDisconnectedTurn(room) {
  clearTimeout(room.timer);
  const g = room.game;
  if (!g || g.winner) return;
  const current = room.players.find((p) => p.id === g.players[g.turn].id);
  if (current && current.connected) return;
  room.timer = setTimeout(() => {
    if (room.game !== g || g.winner) return;
    const stillCurrent = g.players[g.turn].id;
    const p = room.players.find((x) => x.id === stillCurrent);
    if (p && !p.connected) {
      game.drawCard(g, stillCurrent);
      g.log.push(`(${p.name} is disconnected — auto-drew)`);
      broadcast(room);
    }
  }, DISCONNECTED_TURN_MS);
}

function deleteRoomIfEmpty(room) {
  if (room.players.every((p) => !p.connected)) {
    clearTimeout(room.timer);
    rooms.delete(room.code);
  }
}

io.on('connection', (socket) => {
  let room = null;
  let playerId = null;

  const fail = (message) => socket.emit('error_msg', message);

  function attach(r, p) {
    room = r;
    playerId = p.id;
    p.socketId = socket.id;
    p.connected = true;
    socket.join(r.code);
    socket.emit('joined', { code: r.code, playerId: p.id });
    broadcast(r);
  }

  socket.on('create_room', ({ name } = {}) => {
    if (room) return fail('Already in a room');
    const r = { code: makeCode(), hostId: null, players: [], game: null, timer: null };
    const p = { id: crypto.randomUUID(), name: cleanName(name), socketId: socket.id, connected: true };
    r.hostId = p.id;
    r.players.push(p);
    rooms.set(r.code, r);
    attach(r, p);
  });

  socket.on('join_room', ({ code, name, playerId: token } = {}) => {
    if (room) return fail('Already in a room');
    const r = rooms.get(String(code || '').trim().toUpperCase());
    if (!r) return fail('Room not found');

    // Reconnect with a saved player token
    const existing = token && r.players.find((p) => p.id === token);
    if (existing) {
      if (existing.connected) return fail('That player is already connected');
      return attach(r, existing);
    }
    if (r.game && !r.game.winner) return fail('Game already in progress');
    if (r.players.length >= game.MAX_PLAYERS) return fail('Room is full');
    const p = { id: crypto.randomUUID(), name: cleanName(name), socketId: socket.id, connected: true };
    r.players.push(p);
    attach(r, p);
  });

  socket.on('start_game', () => {
    if (!room) return;
    if (room.hostId !== playerId) return fail('Only the host can start');
    if (room.game && !room.game.winner) return fail('Game already running');
    const active = room.players.filter((p) => p.connected);
    if (active.length < game.MIN_PLAYERS) return fail(`Need at least ${game.MIN_PLAYERS} players`);
    room.players = active; // drop players who left before a new round
    room.game = game.newGame(active.map(({ id, name }) => ({ id, name })));
    broadcast(room);
  });

  socket.on('play_card', ({ cardId, suit } = {}) => {
    if (!room || !room.game) return;
    try {
      game.playCard(room.game, playerId, cardId, suit);
      broadcast(room);
    } catch (e) {
      if (e instanceof game.GameError) fail(e.message); else throw e;
    }
  });

  socket.on('draw_card', () => {
    if (!room || !room.game) return;
    try {
      game.drawCard(room.game, playerId);
      broadcast(room);
    } catch (e) {
      if (e instanceof game.GameError) fail(e.message); else throw e;
    }
  });

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
      const next = r.players.find((x) => x.connected);
      if (next) r.hostId = next.id;
    }
    deleteRoomIfEmpty(r);
    if (rooms.has(r.code)) broadcast(r);
  }

  socket.on('leave_room', leave);
  socket.on('disconnect', leave);
});

server.listen(PORT, () => console.log(`Carta Mghribia running on http://localhost:${PORT}`));
