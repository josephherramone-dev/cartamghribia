// Chess adapter: rules via chess.js, computer player via alpha-beta search.
const { Chess } = require('chess.js');

class GameError extends Error {}

const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Piece-square tables from White's point of view (a8..h1, row by row)
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

/** Static evaluation from the point of view of the side to move. */
function evaluate(chess) {
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const idx = sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      const v = VALUES[sq.type] + PST[sq.type][idx];
      score += sq.color === 'w' ? v : -v;
    }
  }
  return chess.turn() === 'w' ? score : -score;
}

function orderMoves(moves) {
  // captures and promotions first (MVV/LVA-ish) for better pruning
  return moves.sort((a, b) => moveScore(b) - moveScore(a));
}
function moveScore(m) {
  let s = 0;
  if (m.captured) s += 10 * VALUES[m.captured] - VALUES[m.piece];
  if (m.promotion) s += VALUES[m.promotion];
  return s;
}

function search(chess, depth, alpha, beta, deadline) {
  if (chess.isCheckmate()) return -100000 - depth; // prefer faster mates
  if (chess.isDraw() || chess.isStalemate()) return 0;
  if (depth === 0 || Date.now() > deadline) return evaluate(chess);
  const moves = orderMoves(chess.moves({ verbose: true }));
  for (const m of moves) {
    chess.move(m);
    const score = -search(chess, depth - 1, -beta, -alpha, deadline);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function bestMove(fen, level) {
  const chess = new Chess(fen);
  const moves = orderMoves(chess.moves({ verbose: true }));
  if (level === 'easy') {
    // shallow look with plenty of randomness
    const scored = moves.map((m) => {
      chess.move(m);
      const s = -evaluate(chess) + Math.random() * 180;
      chess.undo();
      return { m, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].m;
  }
  const deadline = Date.now() + 2500;
  // shuffle before ordering so equal moves vary from game to game
  for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
  orderMoves(moves);
  let best = moves[0];
  let alpha = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const score = -search(chess, 2, -Infinity, -alpha, deadline);
    chess.undo();
    if (score > alpha) { alpha = score; best = m; }
  }
  return best;
}

function colorOf(state, playerId) {
  if (state.white === playerId) return 'w';
  if (state.black === playerId) return 'b';
  return null;
}

module.exports = {
  id: 'chess',
  name: 'Chess',
  minPlayers: 2,
  maxPlayers: 2,
  GameError,

  create(players) {
    const [a, b] = Math.random() < 0.5 ? players : [players[1], players[0]];
    return {
      fen: new Chess().fen(),
      pgnMoves: [],
      white: a.id,
      black: b.id,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      lastMove: null,
      result: null,
    };
  },

  turnOf(state) {
    if (state.result) return null;
    return new Chess(state.fen).turn() === 'w' ? state.white : state.black;
  },

  isOver(state) {
    return !!state.result;
  },

  view(state, playerId) {
    const chess = new Chess(state.fen);
    const turn = this.turnOf(state);
    const legal = turn === playerId
      ? chess.moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to, promotion: m.promotion || null }))
      : [];
    let checkSquare = null;
    if (chess.inCheck()) {
      const board = chess.board();
      for (const row of board) for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === chess.turn()) checkSquare = sq.square;
      }
    }
    return {
      board: chess.board().map((row) => row.map((sq) => (sq ? sq.color + sq.type : null))),
      you: playerId,
      color: colorOf(state, playerId),
      white: state.white,
      black: state.black,
      turn,
      legal,
      lastMove: state.lastMove,
      checkSquare,
      moves: state.pgnMoves,
      result: state.result,
    };
  },

  act(state, playerId, action) {
    if (state.result) throw new GameError('Game is over');
    if (action.type === 'resign') return this.forfeit(state, playerId, 'resigned');
    if (action.type !== 'move') throw new GameError('Unknown action');
    if (this.turnOf(state) !== playerId) throw new GameError('Not your turn');
    const chess = new Chess(state.fen);
    let m;
    try {
      m = chess.move({ from: action.from, to: action.to, promotion: action.promotion || 'q' });
    } catch {
      throw new GameError('Illegal move');
    }
    state.fen = chess.fen();
    state.pgnMoves.push(m.san);
    state.lastMove = { from: m.from, to: m.to };

    if (chess.isCheckmate()) {
      state.result = { winners: [playerId], text: 'Checkmate' };
    } else if (chess.isDraw()) {
      const why = chess.isStalemate() ? 'Stalemate' : chess.isThreefoldRepetition() ? 'Draw by repetition'
        : chess.isInsufficientMaterial() ? 'Draw — insufficient material' : 'Draw';
      state.result = { winners: [], text: why };
    }
  },

  botAct(state, botId, level) {
    const m = bestMove(state.fen, level);
    return { type: 'move', from: m.from, to: m.to, promotion: m.promotion };
  },

  forfeit(state, playerId, why = 'left the game') {
    if (state.result) return;
    const other = state.white === playerId ? state.black : state.white;
    state.result = { winners: [other], text: `${state.names[playerId]} ${why}` };
  },
  onIdle(state, playerId) { this.forfeit(state, playerId, 'ran out of time (disconnected)'); },
  onLeave(state, playerId) { this.forfeit(state, playerId); },

  botDelay: () => 500 + Math.random() * 700,
};
