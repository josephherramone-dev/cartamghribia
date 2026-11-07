const test = require('node:test');
const assert = require('node:assert');
const g = require('../server/game');

const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
const card = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit });

// Build a deterministic state for rule tests
function setup({ top, hands, turn = 0 }) {
  const s = g.newGame(players);
  s.players.forEach((p, i) => { p.hand = hands[i] || [card(12, 'zrawet')]; });
  s.discard = [top];
  s.currentSuit = top.suit;
  s.turn = turn;
  s.pendingDraw = 0;
  return s;
}

test('deck has 40 unique cards', () => {
  const d = g.createDeck();
  assert.strictEqual(d.length, 40);
  assert.strictEqual(new Set(d.map((c) => c.id)).size, 40);
});

test('new game deals 4 cards each and keeps 40 total', () => {
  const s = g.newGame(players);
  for (const p of s.players) assert.strictEqual(p.hand.length, 4);
  const total = s.drawPile.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0);
  assert.strictEqual(total, 40);
});

test('must match suit or rank', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[card(3, 'kass'), card(5, 'dheb'), card(4, 'syouf')]] });
  assert.ok(g.canPlay(s, card(3, 'kass')));
  assert.ok(g.canPlay(s, card(5, 'dheb')));
  assert.ok(!g.canPlay(s, card(4, 'syouf')));
  assert.throws(() => g.playCard(s, 'a', '4-syouf'), /cannot play/);
});

test('cannot play out of turn', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[], [card(3, 'kass')]] });
  assert.throws(() => g.playCard(s, 'b', '3-kass'), /Not your turn/);
});

test('7 is wild and changes suit', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[card(7, 'dheb'), card(1, 'dheb')]] });
  assert.throws(() => g.playCard(s, 'a', '7-dheb'), /Choose a suit/);
  g.playCard(s, 'a', '7-dheb', 'syouf');
  assert.strictEqual(s.currentSuit, 'syouf');
  assert.strictEqual(s.turn, 1);
});

test('1 skips the next player', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[card(1, 'kass'), card(3, 'dheb')]] });
  g.playCard(s, 'a', '1-kass');
  assert.strictEqual(s.turn, 2);
});

test('2s stack and the next player draws the total', () => {
  const s = setup({
    top: card(5, 'kass'),
    hands: [[card(2, 'kass'), card(3, 'dheb')], [card(2, 'syouf'), card(6, 'syouf')], [card(4, 'zrawet')]],
  });
  g.playCard(s, 'a', '2-kass');
  assert.strictEqual(s.pendingDraw, 2);
  assert.ok(!g.canPlay(s, card(6, 'kass')), 'only a 2 can answer');
  g.playCard(s, 'b', '2-syouf');
  assert.strictEqual(s.pendingDraw, 4);
  const before = s.players[2].hand.length;
  g.drawCard(s, 'c');
  assert.strictEqual(s.players[2].hand.length, before + 4);
  assert.strictEqual(s.pendingDraw, 0);
  assert.strictEqual(s.turn, 0);
});

test('drawing ends the turn', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[card(4, 'syouf')]] });
  g.drawCard(s, 'a');
  assert.strictEqual(s.players[0].hand.length, 2);
  assert.strictEqual(s.turn, 1);
});

test('emptying your hand wins', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[card(5, 'dheb')]] });
  g.playCard(s, 'a', '5-dheb');
  assert.strictEqual(s.winner, 'a');
  assert.throws(() => g.drawCard(s, 'b'), /over/);
});

test('discard is reshuffled into an empty draw pile', () => {
  const s = setup({ top: card(5, 'kass'), hands: [[card(4, 'syouf')]] });
  s.discard = [card(3, 'dheb'), card(6, 'dheb'), card(5, 'kass')];
  s.drawPile = [];
  g.drawCard(s, 'a');
  assert.strictEqual(s.discard.length, 1);
  assert.strictEqual(s.discard[0].id, '5-kass');
  assert.strictEqual(s.drawPile.length, 1);
});

test('view hides other hands', () => {
  const s = g.newGame(players);
  const v = g.viewFor(s, 'a');
  assert.strictEqual(v.hand.length, 4);
  assert.ok(v.players.every((p) => !('hand' in p)));
});
