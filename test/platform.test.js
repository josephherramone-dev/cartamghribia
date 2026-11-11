const test = require('node:test');
const assert = require('node:assert');
const games = require('../server/games');
const P = require('../public/games/pool/physics');

const two = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

function playOut(game, players, level, maxTurns = 600) {
  const st = game.create(players);
  let n = 0;
  while (!game.isOver(st) && n++ < maxTurns) {
    const pid = game.turnOf(st);
    game.act(st, pid, game.botAct(st, pid, level));
  }
  return { st, n };
}

test('every adapter implements the interface', () => {
  for (const g of Object.values(games)) {
    for (const fn of ['create', 'view', 'act', 'botAct', 'turnOf', 'isOver']) assert.strictEqual(typeof g[fn], 'function', `${g.id}.${fn}`);
    assert.ok(g.minPlayers >= 1 && g.maxPlayers >= g.minPlayers);
  }
});

test('chess: rejects illegal moves and out-of-turn moves', () => {
  const c = games.chess;
  const st = c.create(two);
  const w = st.white, b = st.black;
  assert.throws(() => c.act(st, b, { type: 'move', from: 'e7', to: 'e5' }), /Not your turn/);
  assert.throws(() => c.act(st, w, { type: 'move', from: 'e2', to: 'e5' }), /Illegal/);
  c.act(st, w, { type: 'move', from: 'e2', to: 'e4' });
  assert.strictEqual(c.turnOf(st), b);
  assert.strictEqual(c.view(st, b).legal.length, 20);
});

test("chess: fool's mate ends the game", () => {
  const c = games.chess;
  const st = c.create(two);
  const w = st.white, b = st.black;
  for (const [p, from, to] of [[w, 'f2', 'f3'], [b, 'e7', 'e5'], [w, 'g2', 'g4'], [b, 'd8', 'h4']]) c.act(st, p, { type: 'move', from, to });
  assert.deepStrictEqual(st.result.winners, [b]);
});

test('chess: hard bot finds mate in one', () => {
  const c = games.chess;
  const st = c.create(two);
  st.fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  const m = c.botAct(st, st.white, 'hard');
  assert.deepStrictEqual([m.from, m.to], ['a1', 'a8']);
});

test('chess: bots finish games without illegal moves', () => {
  const { st } = playOut(games.chess, two, 'easy', 400);
  assert.ok(st.pgnMoves.length > 0);
});

test('pool: rack has 16 balls with no overlaps', () => {
  const balls = P.rack();
  assert.strictEqual(balls.length, 16);
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    assert.ok(Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y) >= 2 * P.R);
  }
});

test('pool: simulation is deterministic and balls stay on the table', () => {
  const balls = P.rack();
  const a = P.simulate(balls, { angle: 0.01, power: 1 });
  const b = P.simulate(balls, { angle: 0.01, power: 1 });
  assert.deepStrictEqual(a.balls, b.balls);
  for (const ball of a.balls) if (!ball.in) {
    assert.ok(ball.x >= 0 && ball.x <= P.W && ball.y >= 0 && ball.y <= P.H);
  }
  assert.ok(a.events.firstHit !== null);
});

test('pool: scratch gives the opponent ball in hand', () => {
  const g = games.pool;
  const st = g.create(two);
  st.isBreak = false;
  st.ballInHand = false;
  // only the cue ball, aimed straight into the top-left corner pocket
  st.balls.forEach((b) => { if (b.id !== 0 && b.id !== 8) b.in = true; });
  const cue = st.balls.find((b) => b.id === 0);
  cue.x = 100; cue.y = 100;
  const shooter = st.turn;
  g.act(st, shooter, { type: 'shoot', angle: Math.atan2(2 - 100, 2 - 100), power: 0.6 });
  assert.notStrictEqual(st.turn, shooter);
  assert.ok(st.ballInHand);
});

test('pool: bots can play full games', () => {
  for (const level of ['easy', 'hard']) {
    const { st, n } = playOut(games.pool, two, level, 300);
    assert.ok(n > 1);
    assert.ok(st.balls.length === 16);
  }
});

test('carta adapter plays through', () => {
  const { st } = playOut(games.carta, [...two, { id: 'c', name: 'C' }], 'hard', 2000);
  assert.ok(st.winner);
});
