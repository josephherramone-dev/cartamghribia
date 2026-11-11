// 8-ball pool adapter. Physics is shared with the browser (public/games/pool/physics.js).
const P = require('../../public/games/pool/physics');

class GameError extends Error {}

const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const groupBalls = (g) => (g === 'solids' ? SOLIDS : g === 'stripes' ? STRIPES : []);
const groupOf = (id) => (id >= 1 && id <= 7 ? 'solids' : id >= 9 ? 'stripes' : null);

function onTable(state, ids) {
  return ids.filter((id) => !state.balls.find((b) => b.id === id).in);
}
function cleared(state, pid) {
  const g = state.groups[pid];
  return !!g && onTable(state, groupBalls(g)).length === 0;
}
function other(state, pid) {
  return state.order[0] === pid ? state.order[1] : state.order[0];
}

// Put a ball back on the table near the foot spot (used for the cue ball and an 8 potted on the break)
function respot(state, id, x, y) {
  const b = state.balls.find((bb) => bb.id === id);
  b.in = false;
  for (let k = 0; k < 200; k++) {
    const tx = x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (P.R * 2 + 1);
    if (P.canPlace(state.balls.filter((bb) => bb.id !== id), tx, y, false)) { b.x = tx; b.y = y; return; }
  }
  b.x = x; b.y = y;
}

module.exports = {
  id: 'pool',
  name: '8-Ball Pool',
  minPlayers: 2,
  maxPlayers: 2,
  GameError,

  create(players) {
    const order = Math.random() < 0.5 ? [players[0].id, players[1].id] : [players[1].id, players[0].id];
    return {
      order,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      balls: P.rack(),
      turn: order[0],
      groups: { [order[0]]: null, [order[1]]: null },
      ballInHand: true,     // the breaker places the cue ball in the kitchen
      isBreak: true,
      shotNo: 0,
      lastShot: null,
      message: `${players.find((p) => p.id === order[0]).name} breaks`,
      result: null,
    };
  },

  turnOf(state) { return state.result ? null : state.turn; },
  isOver(state) { return !!state.result; },

  view(state, playerId) {
    return {
      you: playerId,
      order: state.order,
      balls: state.balls.map(({ id, x, y, in: pocketed }) => ({ id, x, y, in: pocketed })),
      turn: this.turnOf(state),
      groups: state.groups,
      ballInHand: state.ballInHand,
      kitchenOnly: state.isBreak,
      lastShot: state.lastShot,
      message: state.message,
      result: state.result,
    };
  },

  act(state, pid, action) {
    if (state.result) throw new GameError('Game is over');
    if (action.type === 'resign') return this.forfeit(state, pid, 'resigned');
    if (action.type !== 'shoot') throw new GameError('Unknown action');
    if (state.turn !== pid) throw new GameError('Not your turn');
    const angle = Number(action.angle);
    const power = Number(action.power);
    if (!Number.isFinite(angle) || !Number.isFinite(power)) throw new GameError('Bad shot');

    const cue = state.balls.find((b) => b.id === 0);
    if (state.ballInHand && action.cue) {
      const { x, y } = action.cue;
      if (!P.canPlace(state.balls, x, y, state.isBreak)) throw new GameError('You cannot place the cue ball there');
      cue.x = x; cue.y = y; cue.in = false;
    }

    const before = P.clone(state.balls);
    const shot = { angle, power: Math.max(0.02, Math.min(1, power)) };
    const { balls, events } = P.simulate(before, shot);
    state.balls = balls.map(({ id, x, y, in: pocketed }) => ({ id, x, y, in: pocketed }));
    state.shotNo++;
    state.lastShot = { n: state.shotNo, by: pid, before: before.map(({ id, x, y, in: i }) => ({ id, x, y, in: i })), shot };

    const name = state.names[pid];
    const opp = other(state, pid);
    const potted = events.pocketed;
    const cuePotted = potted.includes(0);
    const eightPotted = potted.includes(8);
    const objectPotted = potted.filter((id) => id !== 0 && id !== 8);
    const myGroup = state.groups[pid];
    const wasCleared = myGroup && groupBalls(myGroup).every((id) => before.find((b) => b.id === id).in);

    // --- fouls ---
    let foul = null;
    if (cuePotted) foul = 'scratched (cue ball potted)';
    else if (events.firstHit === null) foul = 'missed every ball';
    else if (myGroup && !wasCleared && groupOf(events.firstHit) !== myGroup) foul = 'hit the wrong ball first';
    else if (myGroup && wasCleared && events.firstHit !== 8) foul = 'had to hit the 8 first';
    else if (!myGroup && events.firstHit === 8 && !state.isBreak) foul = 'hit the 8 first';
    else if (potted.length === 0 && !events.railAfterContact && !state.isBreak) foul = 'no ball reached a cushion';

    // --- the 8-ball ---
    if (eightPotted) {
      if (state.isBreak) {
        respot(state, 8, P.FOOT.x, P.FOOT.y);
        state.message = `${name} potted the 8 on the break — it is re-spotted`;
      } else if (wasCleared && !foul) {
        state.result = { winners: [pid], text: `${name} potted the 8-ball` };
        return;
      } else {
        state.result = { winners: [opp], text: `${name} potted the 8-ball too early` };
        return;
      }
    }

    // --- groups (decided by the first legal pot after the break) ---
    if (!myGroup && !state.isBreak && !foul && objectPotted.length) {
      const g = groupOf(objectPotted[0]);
      state.groups[pid] = g;
      state.groups[opp] = g === 'solids' ? 'stripes' : 'solids';
    }
    const groupNow = state.groups[pid];

    let keepTurn = false;
    if (!foul) {
      if (state.isBreak) keepTurn = objectPotted.length > 0;
      else if (groupNow) keepTurn = objectPotted.some((id) => groupOf(id) === groupNow);
      else keepTurn = objectPotted.length > 0;
    }

    state.isBreak = false;
    if (cuePotted) respot(state, 0, P.HEAD_X, P.H / 2);

    if (foul) {
      state.turn = opp;
      state.ballInHand = true;
      state.message = `Foul: ${name} ${foul}. ${state.names[opp]} has ball in hand`;
    } else if (keepTurn) {
      state.ballInHand = false;
      if (!state.message.includes('re-spotted')) state.message = `${name} potted ${objectPotted.length > 1 ? objectPotted.length + ' balls' : 'a ball'} and shoots again`;
    } else {
      state.turn = opp;
      state.ballInHand = false;
      state.message = `${state.names[opp]} to shoot`;
    }
  },

  botAct(state, botId, level) {
    return botShot(state, botId, level);
  },

  forfeit(state, pid, why = 'left the game') {
    if (state.result) return;
    state.result = { winners: [other(state, pid)], text: `${state.names[pid]} ${why}` };
  },
  onIdle(state, pid) { this.forfeit(state, pid, 'ran out of time (disconnected)'); },
  onLeave(state, pid) { this.forfeit(state, pid); },

  botDelay: () => 1100 + Math.random() * 800,
};

// ---------------- computer player ----------------

function segmentClear(balls, ax, ay, bx, by, ignore) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  for (const b of balls) {
    if (b.in || ignore.includes(b.id)) continue;
    const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / len2));
    const px = ax + t * dx, py = ay + t * dy;
    if ((b.x - px) ** 2 + (b.y - py) ** 2 < (2 * P.R) ** 2) return false;
  }
  return true;
}

function candidateShots(balls, cue, targets) {
  const out = [];
  for (const t of targets) {
    for (const p of P.POCKETS) {
      const tx = p.x - t.x, ty = p.y - t.y;
      const td = Math.hypot(tx, ty);
      const gx = t.x - (tx / td) * 2 * P.R, gy = t.y - (ty / td) * 2 * P.R; // ghost ball
      const ax = gx - cue.x, ay = gy - cue.y;
      const ad = Math.hypot(ax, ay);
      const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (ad * td))));
      if (cut > 1.3) continue;
      const clear = segmentClear(balls, cue.x, cue.y, gx, gy, [0, t.id]) && segmentClear(balls, t.x, t.y, p.x, p.y, [0, t.id]);
      const power = Math.min(1, 0.25 + (ad + td) / 1500 + cut * 0.15);
      out.push({ angle: Math.atan2(ay, ax), power, score: (clear ? 0 : -500) - cut * 120 - (ad + td) * 0.08, target: t.id });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

function botShot(state, pid, level) {
  const balls = state.balls.map((b) => ({ ...b }));
  let cue = balls.find((b) => b.id === 0);
  let place = null;
  const g = state.groups[pid];
  const done = g && groupBalls(g).every((id) => balls.find((b) => b.id === id).in);
  const targets = balls.filter((b) => !b.in && b.id !== 0 && (done ? b.id === 8 : g ? groupOf(b.id) === g : b.id !== 8));

  if (state.ballInHand) {
    // try a few spots and keep the one with the easiest shot
    let best = null;
    const spots = [];
    for (let x = 60; x <= (state.isBreak ? P.HEAD_X : P.W - 60); x += 70) {
      for (let y = 60; y <= P.H - 60; y += 70) spots.push({ x, y });
    }
    for (const s of spots) {
      if (!P.canPlace(balls, s.x, s.y, state.isBreak)) continue;
      const c = candidateShots(balls, { x: s.x, y: s.y }, targets)[0];
      if (c && (!best || c.score > best.score)) best = { ...c, spot: s };
    }
    place = best ? best.spot : { x: P.HEAD_X, y: P.H / 2 };
    if (!P.canPlace(balls, place.x, place.y, state.isBreak)) place = { x: P.HEAD_X - 40, y: P.H / 2 + 37 };
    cue = { ...cue, x: place.x, y: place.y, in: false };
    balls.forEach((b) => { if (b.id === 0) Object.assign(b, cue); });
  }

  if (state.isBreak) {
    const head = balls.find((b) => b.id !== 0 && Math.abs(b.x - P.FOOT.x) < 1);
    const ang = Math.atan2((head ? head.y : P.H / 2) - cue.y, (head ? head.x : P.FOOT.x) - cue.x);
    return { type: 'shoot', angle: ang + (Math.random() - 0.5) * 0.01, power: 0.95, cue: place };
  }

  let shots = candidateShots(balls, cue, targets);
  if (shots.length === 0) {
    // nothing pottable: just hit the nearest legal ball softly
    const t = targets.sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
    const ang = t ? Math.atan2(t.y - cue.y, t.x - cue.x) : Math.random() * Math.PI * 2;
    return { type: 'shoot', angle: ang, power: 0.45, cue: place };
  }

  if (level === 'easy') {
    const pick = shots[Math.floor(Math.random() * Math.min(3, shots.length))];
    return { type: 'shoot', angle: pick.angle + (Math.random() - 0.5) * 0.09, power: pick.power, cue: place };
  }

  // Hard: try the best candidates (with small variations) in the simulator and keep the best outcome
  let best = null;
  for (const c of shots.slice(0, 8)) {
    for (const da of [0, -0.004, 0.004, -0.01, 0.01]) {
      for (const dp of [0, 0.12]) {
        const shot = { angle: c.angle + da, power: Math.min(1, c.power + dp) };
        const { events } = P.simulate(balls, shot);
        let s = 0;
        const pot = events.pocketed;
        if (pot.includes(0)) s -= 60;
        if (pot.includes(8)) s += done && !pot.includes(0) ? 200 : -300;
        for (const id of pot) if (id !== 0 && id !== 8) s += (g ? groupOf(id) === g : true) ? 25 : -8;
        if (events.firstHit === null) s -= 40;
        else if (g && !done && groupOf(events.firstHit) !== g) s -= 40;
        if (!best || s > best.s) best = { s, shot };
      }
    }
  }
  const noise = (Math.random() - 0.5) * 0.006;
  return { type: 'shoot', angle: best.shot.angle + noise, power: best.shot.power, cue: place };
}
