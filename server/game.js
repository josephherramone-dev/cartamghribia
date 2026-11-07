// Pure game engine for Hezz2 (Carta Beldia shedding game).
// No networking here — the server calls these functions and broadcasts the result.

const SUITS = ['dheb', 'syouf', 'kass', 'zrawet'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const HAND_SIZE = 4;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ id: `${rank}-${suit}`, rank, suit });
  }
  return deck;
}

function shuffle(cards, rng = Math.random) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class GameError extends Error {}

/**
 * players: array of { id, name }
 * returns a fresh game state
 */
function newGame(players, rng = Math.random) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new GameError(`Need ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }
  const deck = shuffle(createDeck(), rng);
  const state = {
    players: players.map((p) => ({ id: p.id, name: p.name, hand: [] })),
    drawPile: deck,
    discard: [],
    currentSuit: null, // suit to follow (differs from top card after a 7)
    turn: 0,
    pendingDraw: 0, // accumulated cards from stacked 2s
    winner: null,
    log: [],
  };
  for (let r = 0; r < HAND_SIZE; r++) {
    for (const p of state.players) p.hand.push(state.drawPile.pop());
  }
  const first = state.drawPile.pop();
  state.discard.push(first);
  state.currentSuit = first.suit; // starting card has no special effect
  state.turn = Math.floor(rng() * state.players.length);
  state.log.push(`Game started. ${state.players[state.turn].name} plays first.`);
  return state;
}

function topCard(state) {
  return state.discard[state.discard.length - 1];
}

function nextIndex(state, steps = 1) {
  return (state.turn + steps) % state.players.length;
}

function canPlay(state, card) {
  const top = topCard(state);
  if (state.pendingDraw > 0) return card.rank === 2;
  if (card.rank === 7) return true;
  return card.suit === state.currentSuit || card.rank === top.rank;
}

function refillDrawPile(state, rng = Math.random) {
  if (state.drawPile.length > 0 || state.discard.length <= 1) return;
  const top = state.discard.pop();
  state.drawPile = shuffle(state.discard, rng);
  state.discard = [top];
  state.log.push('Draw pile reshuffled.');
}

function drawCards(state, player, count, rng) {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    refillDrawPile(state, rng);
    if (state.drawPile.length === 0) break; // every card is in someone's hand
    player.hand.push(state.drawPile.pop());
    drawn++;
  }
  return drawn;
}

function assertTurn(state, playerId) {
  if (state.winner) throw new GameError('Game is over');
  const current = state.players[state.turn];
  if (current.id !== playerId) throw new GameError('Not your turn');
  return current;
}

function playCard(state, playerId, cardId, chosenSuit) {
  const player = assertTurn(state, playerId);
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) throw new GameError('You do not have that card');
  const card = player.hand[idx];
  if (!canPlay(state, card)) throw new GameError('You cannot play that card now');
  if (card.rank === 7 && !SUITS.includes(chosenSuit)) {
    throw new GameError('Choose a suit for the 7');
  }

  player.hand.splice(idx, 1);
  state.discard.push(card);
  state.currentSuit = card.rank === 7 ? chosenSuit : card.suit;

  let msg = `${player.name} played ${card.rank} of ${card.suit}`;
  let steps = 1;
  if (card.rank === 2) {
    state.pendingDraw += 2;
    msg += ` — next player draws ${state.pendingDraw} or plays a 2`;
  } else if (card.rank === 1) {
    steps = 2;
    msg += ` — ${state.players[nextIndex(state)].name} is skipped`;
  } else if (card.rank === 7) {
    msg += ` and changed the suit to ${chosenSuit}`;
  }
  state.log.push(msg + '.');

  if (player.hand.length === 0) {
    state.winner = player.id;
    state.log.push(`${player.name} wins!`);
    return state;
  }
  state.turn = nextIndex(state, steps);
  return state;
}

function drawCard(state, playerId, rng = Math.random) {
  const player = assertTurn(state, playerId);
  if (state.pendingDraw > 0) {
    const n = drawCards(state, player, state.pendingDraw, rng);
    state.log.push(`${player.name} drew ${n} cards.`);
    state.pendingDraw = 0;
  } else {
    const n = drawCards(state, player, 1, rng);
    state.log.push(n ? `${player.name} drew a card.` : `${player.name} passed (no cards left to draw).`);
  }
  state.turn = nextIndex(state);
  return state;
}

/** What one player is allowed to see. */
function viewFor(state, playerId) {
  const me = state.players.find((p) => p.id === playerId);
  return {
    you: playerId,
    hand: me ? me.hand : [],
    playable: me && state.players[state.turn].id === playerId && !state.winner
      ? me.hand.filter((c) => canPlay(state, c)).map((c) => c.id)
      : [],
    players: state.players.map((p) => ({ id: p.id, name: p.name, cards: p.hand.length })),
    topCard: topCard(state),
    currentSuit: state.currentSuit,
    turn: state.players[state.turn].id,
    pendingDraw: state.pendingDraw,
    drawPileCount: state.drawPile.length,
    winner: state.winner,
    log: state.log.slice(-12),
  };
}

module.exports = {
  SUITS, RANKS, HAND_SIZE, MIN_PLAYERS, MAX_PLAYERS,
  GameError, createDeck, shuffle, newGame, canPlay, playCard, drawCard, viewFor, topCard,
};
