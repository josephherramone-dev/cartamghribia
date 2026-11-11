// Carta Beldia (Hezz 2) adapter for the platform room system.
const engine = require('./carta-engine');

module.exports = {
  id: 'carta',
  name: 'Carta Beldia',
  minPlayers: engine.MIN_PLAYERS,
  maxPlayers: engine.MAX_PLAYERS,
  GameError: engine.GameError,

  create(players) {
    return engine.newGame(players);
  },

  view(state, playerId) {
    const v = engine.viewFor(state, playerId);
    v.result = state.winner ? { winners: [state.winner] } : null;
    return v;
  },

  turnOf(state) {
    return state.winner ? null : state.players[state.turn].id;
  },

  isOver(state) {
    return !!state.winner;
  },

  act(state, playerId, action) {
    if (action.type === 'play') return engine.playCard(state, playerId, action.cardId, action.suit);
    if (action.type === 'draw') return engine.drawCard(state, playerId);
    throw new engine.GameError('Unknown action');
  },

  botAct(state, botId, level) {
    const m = engine.chooseBotMove(state, botId, level);
    return m.action === 'play' ? { type: 'play', cardId: m.cardId, suit: m.suit } : { type: 'draw' };
  },

  // A disconnected player's turn: draw a card so the table keeps moving.
  onIdle(state, playerId) {
    engine.drawCard(state, playerId);
    state.log.push('(player away — auto-drew)');
  },
};
