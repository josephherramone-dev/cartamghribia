/* 8-ball pool physics. Shared by the server (authoritative result) and the
 * browser (animation), so both run exactly the same simulation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PoolPhysics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 1000;            // playing surface width (cushion to cushion)
  const H = 500;             // playing surface height
  const R = 11.5;            // ball radius
  const POCKET_R = 23;       // capture radius around a pocket centre
  const CORNER_MOUTH = 30;   // no cushion this close to a corner (pocket opening)
  const SIDE_MOUTH = 24;     // half-width of side pocket openings
  const MAX_SPEED = 2300;    // units/second at full power
  const FRICTION = 260;      // rolling deceleration, units/s²
  const CUSHION_E = 0.78;    // cushion restitution
  const BALL_E = 0.96;       // ball-ball restitution
  const DT = 1 / 240;
  const MAX_STEPS = 240 * 25;

  const POCKETS = [
    { x: 2, y: 2 }, { x: W / 2, y: -8 }, { x: W - 2, y: 2 },
    { x: 2, y: H - 2 }, { x: W / 2, y: H + 8 }, { x: W - 2, y: H - 2 },
  ];
  const HEAD_X = W * 0.25;   // "kitchen" line for the break
  const FOOT = { x: W * 0.72, y: H / 2 };

  function rack() {
    // Standard-ish 8-ball rack: 8 in the centre, a solid and a stripe in the back corners
    const order = [1, 9, 2, 10, 8, 3, 11, 7, 14, 4, 5, 13, 15, 6, 12];
    const balls = [{ id: 0, x: HEAD_X, y: H / 2, vx: 0, vy: 0, in: false }];
    const dx = R * 2 * Math.cos(Math.PI / 6) + 0.2;
    let k = 0;
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i <= row; i++) {
        balls.push({
          id: order[k++], x: FOOT.x + row * dx, y: H / 2 + (i - row / 2) * (2 * R + 0.2),
          vx: 0, vy: 0, in: false,
        });
      }
    }
    return balls;
  }

  const clone = (balls) => balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, in: b.in }));

  /** Step-by-step simulation so the browser can animate it. */
  function createSim(balls, shot) {
    const bs = clone(balls);
    const cue = bs.find((b) => b.id === 0);
    const power = Math.max(0.02, Math.min(1, shot.power));
    cue.vx = Math.cos(shot.angle) * power * MAX_SPEED;
    cue.vy = Math.sin(shot.angle) * power * MAX_SPEED;
    const events = { firstHit: null, pocketed: [], cushionHits: 0, railAfterContact: false };
    let steps = 0;
    let done = false;

    function step() {
      if (done) return false;
      steps++;
      let moving = false;
      for (const b of bs) {
        if (b.in) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp === 0) continue;
        const ns = Math.max(0, sp - FRICTION * DT);
        if (ns < 3) { b.vx = 0; b.vy = 0; continue; }
        b.vx *= ns / sp; b.vy *= ns / sp;
        b.x += b.vx * DT; b.y += b.vy * DT;
        moving = true;
      }
      // ball-ball collisions
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (a.in) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j];
          if (b.in) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 4 * R * R || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          const overlap = 2 * R - d;
          a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2; b.y += ny * overlap / 2;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          const imp = rel * (1 + BALL_E) / 2;
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
          if (events.firstHit === null && (a.id === 0 || b.id === 0)) events.firstHit = a.id === 0 ? b.id : a.id;
        }
      }
      // cushions and pockets
      for (const b of bs) {
        if (b.in) continue;
        for (const p of POCKETS) {
          if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < POCKET_R * POCKET_R) {
            b.in = true; b.vx = 0; b.vy = 0; events.pocketed.push(b.id); break;
          }
        }
        if (b.in) continue;
        const nearCornerY = b.y < CORNER_MOUTH || b.y > H - CORNER_MOUTH;
        const nearCornerX = b.x < CORNER_MOUTH || b.x > W - CORNER_MOUTH;
        const nearSide = Math.abs(b.x - W / 2) < SIDE_MOUTH;
        let hit = false;
        if (!nearCornerY) {
          if (b.x < R && b.vx < 0) { b.x = R; b.vx = -b.vx * CUSHION_E; b.vy *= 0.97; hit = true; }
          if (b.x > W - R && b.vx > 0) { b.x = W - R; b.vx = -b.vx * CUSHION_E; b.vy *= 0.97; hit = true; }
        }
        if (!nearCornerX && !nearSide) {
          if (b.y < R && b.vy < 0) { b.y = R; b.vy = -b.vy * CUSHION_E; b.vx *= 0.97; hit = true; }
          if (b.y > H - R && b.vy > 0) { b.y = H - R; b.vy = -b.vy * CUSHION_E; b.vx *= 0.97; hit = true; }
        }
        if (hit) {
          events.cushionHits++;
          if (events.firstHit !== null) events.railAfterContact = true;
        }
        // escaped through a pocket mouth without touching the capture circle: count as pocketed
        if (b.x < -R * 2 || b.x > W + R * 2 || b.y < -R * 2 || b.y > H + R * 2) {
          b.in = true; b.vx = 0; b.vy = 0; events.pocketed.push(b.id);
        }
      }
      if (!moving || steps >= MAX_STEPS) {
        done = true;
        for (const b of bs) { b.vx = 0; b.vy = 0; }
      }
      return !done;
    }
    return { balls: bs, events, step, isDone: () => done };
  }

  function simulate(balls, shot) {
    const sim = createSim(balls, shot);
    while (sim.step()) { /* run to rest */ }
    return { balls: sim.balls, events: sim.events };
  }

  /** Is (x, y) a legal place for the cue ball? */
  function canPlace(balls, x, y, kitchenOnly) {
    if (x < R || x > W - R || y < R || y > H - R) return false;
    if (kitchenOnly && x > HEAD_X) return false;
    return balls.every((b) => b.in || b.id === 0 || (b.x - x) ** 2 + (b.y - y) ** 2 >= (2 * R + 1) ** 2);
  }

  return { W, H, R, POCKETS, HEAD_X, FOOT, MAX_SPEED, rack, createSim, simulate, canPlace, clone };
});
