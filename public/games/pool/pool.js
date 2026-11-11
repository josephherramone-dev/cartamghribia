/* 8-Ball Pool — browser module for the Divoxe platform. */
(function () {
  const P = window.PoolPhysics;
  const esc = window.Divoxe.esc;
  const COLORS = { 1: '#f5c518', 2: '#1d4ed8', 3: '#dc2626', 4: '#7c3aed', 5: '#f97316', 6: '#16a34a', 7: '#7f1d1d', 8: '#111111' };
  const colorOf = (id) => (id === 0 ? '#f8f6ef' : COLORS[id > 8 ? id - 8 : id]);
  const RAIL = 46; // rail width in table units

  function ballSVG(id, cx, cy, r) {
    const c = colorOf(id);
    const stripe = id > 8;
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${stripe ? '#f8f6ef' : c}"/>
      ${stripe ? `<clipPath id="cl${id}${cx}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><rect x="${cx - r}" y="${cy - r * 0.55}" width="${2 * r}" height="${r * 1.1}" fill="${c}" clip-path="url(#cl${id}${cx})"/>` : ''}
      ${id ? `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#fff"/><text x="${cx}" y="${cy + r * 0.2}" font-size="${r * 0.55}" text-anchor="middle" font-weight="800" font-family="Outfit, sans-serif" fill="#111">${id}</text>` : ''}
      <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.4}" r="${r * 0.28}" fill="#fff" opacity=".55"/>
    </g>`;
  }

  function art() {
    const balls = [[1, 190, 150], [9, 214, 136], [2, 214, 164], [8, 238, 150], [10, 238, 122], [3, 238, 178], [0, 80, 150]];
    return `<svg class="art" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice">
      <rect x="10" y="60" width="280" height="180" rx="22" fill="#5b3418"/>
      <rect x="24" y="74" width="252" height="152" rx="8" fill="#0f766e"/>
      <rect x="24" y="74" width="252" height="152" rx="8" fill="url(#pgl)"/>
      <defs><radialGradient id="pgl"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>
      ${[[26, 76], [150, 72], [274, 76], [26, 224], [150, 228], [274, 224]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#0a0a0a"/>`).join('')}
      <line x1="-20" y1="210" x2="68" y2="156" stroke="#e8c9a0" stroke-width="5" stroke-linecap="round"/>
      <line x1="-20" y1="210" x2="10" y2="192" stroke="#3b1f0e" stroke-width="5.5" stroke-linecap="round"/>
      ${balls.map(([id, x, y]) => ballSVG(id, x, y, 12)).join('')}
    </svg>`;
  }

  window.Divoxe.registerGame({
    id: 'pool',
    name: '8-Ball Pool',
    tagline: 'Line up the shot and sink the 8',
    description: 'Real physics 8-ball: pot all your solids or stripes, then the black. Aim, pull back and shoot.',
    playersLabel: '2 players',
    maxBots: 1,
    accent: 'linear-gradient(135deg, #065f46 0%, #0f766e 50%, #0e7490 100%)',
    icon: `<svg viewBox="0 0 40 40" style="background:#0f766e">${ballSVG(8, 20, 20, 13)}</svg>`,
    art,
    playerBadge(view, p) {
      const g = view.groups && view.groups[p.id];
      if (!g) return '';
      const ids = g === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      const left = ids.filter((id) => !view.balls.find((b) => b.id === id).in).length;
      return `${g === 'solids' ? 'Solids' : 'Stripes'} · ${left}`;
    },
    mount,
  });

  function mount(root, api) {
    root.innerHTML = `
      <div class="pl">
        <div class="pl-hud">
          <div class="pl-player" data-side="0"></div>
          <div class="pl-vs">VS</div>
          <div class="pl-player right" data-side="1"></div>
        </div>
        <div class="pl-table-wrap"><canvas class="pl-canvas"></canvas><div class="pl-hint"></div></div>
        <div class="pl-controls">
          <div class="pl-msg"></div>
          <div class="pl-power"><span>Power</span><input type="range" min="5" max="100" value="55" class="pl-range" aria-label="Shot power"><b class="pl-pct">55%</b></div>
          <div class="pl-btns"><button class="btn-ghost pl-place">✋ Move cue ball</button><button class="btn pl-shoot">Shoot</button><button class="btn-ghost pl-resign" title="Resign">🏳</button></div>
        </div>
      </div>`;
    const q = (s) => root.querySelector(s);
    const canvas = q('.pl-canvas');
    const ctx = canvas.getContext('2d');
    let view = null;
    let balls = [];              // what we draw
    let anim = null;             // running shot animation
    let lastShotSeen = null;
    let aim = Math.PI;           // radians
    let power = 0.55;
    let placing = false;         // dragging the cue ball (ball in hand)
    let placedCue = null;        // my chosen cue position for this shot
    let pull = null;             // drag-to-shoot state
    let oppAim = null;           // opponent's live aim (from signals)
    let scale = 1, ox = 0, oy = 0, dpr = 1;
    let raf = 0;
    let lastSignal = 0;

    const me = () => api.me();
    const myTurn = () => view && !view.result && view.turn === me() && !anim;
    const cueBall = () => balls.find((b) => b.id === 0);

    function resize() {
      const wrap = q('.pl-table-wrap');
      const w = wrap.clientWidth;
      const h = Math.min(wrap.clientHeight || w, w * 0.62);
      const tw = P.W + RAIL * 2, th = P.H + RAIL * 2;
      scale = Math.min(w / tw, h / th);
      dpr = window.devicePixelRatio || 1;
      canvas.style.width = tw * scale + 'px';
      canvas.style.height = th * scale + 'px';
      canvas.width = Math.round(tw * scale * dpr);
      canvas.height = Math.round(th * scale * dpr);
      ox = RAIL; oy = RAIL;
    }
    const toTable = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale - ox, y: (e.clientY - r.top) / scale - oy };
    };

    // ---------- drawing ----------
    function drawTable() {
      const tw = P.W + RAIL * 2, th = P.H + RAIL * 2;
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.clearRect(0, 0, tw, th);
      // wooden rail
      const wood = ctx.createLinearGradient(0, 0, 0, th);
      wood.addColorStop(0, '#6b3e1f'); wood.addColorStop(0.5, '#4a2812'); wood.addColorStop(1, '#6b3e1f');
      roundRect(0, 0, tw, th, 34); ctx.fillStyle = wood; ctx.fill();
      // cushions
      ctx.fillStyle = '#0b5d55';
      roundRect(RAIL - 14, RAIL - 14, P.W + 28, P.H + 28, 16); ctx.fill();
      // felt
      const felt = ctx.createRadialGradient(ox + P.W / 2, oy + P.H / 2, 40, ox + P.W / 2, oy + P.H / 2, P.W * 0.7);
      felt.addColorStop(0, '#16a394'); felt.addColorStop(1, '#0c6b62');
      ctx.fillStyle = felt; ctx.fillRect(ox, oy, P.W, P.H);
      // diamonds
      ctx.fillStyle = '#f1dfb8';
      for (let i = 1; i < 8; i++) {
        if (i === 4) continue;
        const x = ox + (P.W / 8) * i;
        diamond(x, RAIL / 2); diamond(x, th - RAIL / 2);
      }
      for (let i = 1; i < 4; i++) { const y = oy + (P.H / 4) * i; diamond(RAIL / 2, y); diamond(tw - RAIL / 2, y); }
      // kitchen line & foot spot
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox + P.HEAD_X, oy); ctx.lineTo(ox + P.HEAD_X, oy + P.H); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(ox + P.FOOT.x, oy + P.FOOT.y, 3, 0, 7); ctx.fill();
      // pockets
      for (const p of P.POCKETS) {
        const g = ctx.createRadialGradient(ox + p.x, oy + p.y, 4, ox + p.x, oy + p.y, 25);
        g.addColorStop(0, '#000'); g.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox + p.x, oy + p.y, 24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2b1709'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    function diamond(x, y) { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill(); }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function drawBall(b, alpha = 1) {
      const x = ox + b.x, y = oy + b.y, r = P.R;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 4, r, r * 0.9, 0, 0, 7); ctx.fill();
      const c = colorOf(b.id);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = b.id > 8 ? '#f8f6ef' : c; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      if (b.id > 8) { ctx.fillStyle = c; ctx.fillRect(x - r, y - r * 0.55, 2 * r, r * 1.1); }
      if (b.id) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.47, 0, 7); ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = `800 ${r * 0.62}px Outfit, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(b.id), x, y + 0.5);
      }
      const shade = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.1);
      shade.addColorStop(0, 'rgba(255,255,255,.55)'); shade.addColorStop(0.35, 'rgba(255,255,255,0)'); shade.addColorStop(1, 'rgba(0,0,0,.4)');
      ctx.fillStyle = shade; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // first ball the aim line would hit (for the guide)
    function traceAim(cx, cy, ang) {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let best = null;
      for (const b of balls) {
        if (b.in || b.id === 0) continue;
        const fx = b.x - cx, fy = b.y - cy;
        const t = fx * dx + fy * dy;
        if (t <= 0) continue;
        const d2 = fx * fx + fy * fy - t * t;
        const rr = 4 * P.R * P.R;
        if (d2 > rr) continue;
        const tt = t - Math.sqrt(rr - d2);
        if (!best || tt < best.t) best = { t: tt, ball: b };
      }
      // wall distance
      const tx = dx > 0 ? (P.W - P.R - cx) / dx : dx < 0 ? (P.R - cx) / dx : Infinity;
      const ty = dy > 0 ? (P.H - P.R - cy) / dy : dy < 0 ? (P.R - cy) / dy : Infinity;
      const wall = Math.min(tx, ty);
      if (best && best.t < wall) {
        const gx = cx + dx * best.t, gy = cy + dy * best.t;
        const nx = best.ball.x - gx, ny = best.ball.y - gy, nl = Math.hypot(nx, ny);
        return { gx, gy, ball: best.ball, nx: nx / nl, ny: ny / nl };
      }
      return { gx: cx + dx * wall, gy: cy + dy * wall, ball: null };
    }

    function drawAim(cue, ang, pw, ghostAlpha = 1) {
      const t = traceAim(cue.x, cue.y, ang);
      ctx.globalAlpha = ghostAlpha;
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox + cue.x, oy + cue.y); ctx.lineTo(ox + t.gx, oy + t.gy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(ox + t.gx, oy + t.gy, P.R, 0, 7); ctx.stroke();
      if (t.ball) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ox + t.ball.x, oy + t.ball.y); ctx.lineTo(ox + t.ball.x + t.nx * 90, oy + t.ball.y + t.ny * 90); ctx.stroke();
      }
      // cue stick
      const back = 18 + pw * 90;
      const sx = cue.x - Math.cos(ang) * (P.R + back), sy = cue.y - Math.sin(ang) * (P.R + back);
      const ex = sx - Math.cos(ang) * 420, ey = sy - Math.sin(ang) * 420;
      const grad = ctx.createLinearGradient(ox + sx, oy + sy, ox + ex, oy + ey);
      grad.addColorStop(0, '#f3f0e6'); grad.addColorStop(0.03, '#3b82f6'); grad.addColorStop(0.05, '#e8c9a0'); grad.addColorStop(0.65, '#c08a54'); grad.addColorStop(0.7, '#1f2937'); grad.addColorStop(1, '#111827');
      ctx.strokeStyle = grad; ctx.lineCap = 'round'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(ox + sx, oy + sy); ctx.lineTo(ox + ex, oy + ey); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!view) return;
      if (anim) stepAnim();
      drawTable();
      for (const b of balls) if (!b.in) drawBall(b);
      const cue = cueBall();
      if (!cue || cue.in || anim || view.result) return;
      if (myTurn()) {
        if (placing) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(ox + cue.x, oy + cue.y, P.R + 6, 0, 7); ctx.stroke(); ctx.setLineDash([]); return; }
        drawAim(cue, aim, pull ? pull.power : power);
      } else if (oppAim && Date.now() - oppAim.t < 3000) {
        if (oppAim.cue) { cue.x = oppAim.cue.x; cue.y = oppAim.cue.y; }
        drawAim(cue, oppAim.angle, oppAim.power, 0.55);
      }
    }

    // ---------- shot animation ----------
    function startAnim(shot) {
      anim = { sim: P.createSim(shot.before, shot.shot), last: performance.now(), acc: 0, potted: 0, hit: false };
      balls = anim.sim.balls;
      api.sound('cue');
    }
    function stepAnim() {
      const now = performance.now();
      anim.acc += Math.min(0.05, (now - anim.last) / 1000);
      anim.last = now;
      const DT = 1 / 240;
      while (anim.acc >= DT && !anim.sim.isDone()) { anim.sim.step(); anim.acc -= DT; }
      const ev = anim.sim.events;
      if (!anim.hit && ev.firstHit !== null) { anim.hit = true; api.sound('clack'); }
      if (ev.pocketed.length > anim.potted) { anim.potted = ev.pocketed.length; api.sound('pocket'); }
      if (anim.sim.isDone()) {
        anim = null;
        balls = view.balls.map((b) => ({ ...b }));   // snap to the server's result
        afterUpdate();
      }
    }

    // ---------- input ----------
    canvas.addEventListener('pointermove', (e) => {
      if (!myTurn()) return;
      const p = toTable(e);
      const cue = cueBall();
      if (placing) {
        const x = Math.max(P.R, Math.min((view.kitchenOnly ? P.HEAD_X : P.W - P.R), p.x));
        const y = Math.max(P.R, Math.min(P.H - P.R, p.y));
        if (P.canPlace(balls, x, y, view.kitchenOnly)) { cue.x = x; cue.y = y; cue.in = false; }
        sendSignal();
        return;
      }
      if (pull) {
        const dist = Math.hypot(p.x - pull.x, p.y - pull.y);
        pull.power = Math.max(0.05, Math.min(1, dist / 260));
        q('.pl-range').value = Math.round(pull.power * 100); q('.pl-pct').textContent = Math.round(pull.power * 100) + '%';
      } else if (e.pointerType === 'mouse') {
        aim = Math.atan2(p.y - cue.y, p.x - cue.x);
      }
      sendSignal();
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!myTurn()) return;
      window.Sound.unlock();
      const p = toTable(e);
      const cue = cueBall();
      if (placing) {
        if (P.canPlace(balls, cue.x, cue.y, view.kitchenOnly)) { placing = false; placedCue = { x: cue.x, y: cue.y }; updateControls(); }
        else api.toast('The cue ball cannot go there');
        return;
      }
      if (view.ballInHand && Math.hypot(p.x - cue.x, p.y - cue.y) < P.R * 2.2) { placing = true; updateControls(); return; }
      if (e.pointerType !== 'mouse' || !pull) aim = Math.atan2(p.y - cue.y, p.x - cue.x);
      pull = { x: p.x, y: p.y, power: 0 };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointerup', () => {
      if (!pull) return;
      const pw = pull.power;
      pull = null;
      if (pw >= 0.08) { power = pw; shoot(); }
    });
    q('.pl-range').addEventListener('input', (e) => {
      power = e.target.value / 100;
      q('.pl-pct').textContent = e.target.value + '%';
      sendSignal();
    });
    q('.pl-shoot').onclick = () => { if (myTurn() && !placing) shoot(); };
    q('.pl-place').onclick = () => { if (myTurn() && view.ballInHand) { placing = true; updateControls(); } };
    q('.pl-resign').onclick = () => {
      if (!view || view.result || !view.order.includes(me())) return;
      if (confirm('Resign this game?')) api.send({ type: 'resign' });
    };
    // keyboard fine-tuning
    function onKey(e) {
      if (!myTurn() || placing || /input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowLeft') { aim -= e.shiftKey ? 0.002 : 0.012; e.preventDefault(); }
      if (e.key === 'ArrowRight') { aim += e.shiftKey ? 0.002 : 0.012; e.preventDefault(); }
      if (e.key === ' ' || e.key === 'Enter') { shoot(); e.preventDefault(); }
      sendSignal();
    }
    window.addEventListener('keydown', onKey);

    function shoot() {
      const cue = cueBall();
      const action = { type: 'shoot', angle: aim, power };
      if (view.ballInHand) action.cue = placedCue || { x: cue.x, y: cue.y };
      api.send(action);
      api.sound('cue');
    }
    function sendSignal() {
      if (Date.now() - lastSignal < 60) return;
      lastSignal = Date.now();
      const cue = cueBall();
      api.signal({ angle: aim, power: pull ? pull.power : power, cue: view.ballInHand && cue ? { x: Math.round(cue.x), y: Math.round(cue.y) } : null });
    }

    // ---------- HUD ----------
    function updateControls() {
      const mine = myTurn();
      q('.pl-controls').classList.toggle('off', !mine);
      q('.pl-place').classList.toggle('hidden', !(mine && view.ballInHand));
      q('.pl-place').textContent = placing ? 'Click the table to place' : '✋ Move cue ball';
      q('.pl-shoot').disabled = !mine || placing;
      q('.pl-resign').disabled = !!view.result || !view.order.includes(me());
      let hint = '';
      if (mine && placing) hint = view.kitchenOnly ? 'Place the cue ball behind the line, then click' : 'Ball in hand — place the cue ball anywhere, then click';
      else if (mine) hint = window.matchMedia('(pointer: coarse)').matches ? 'Tap to aim · drag back and release to shoot' : 'Move to aim · press and drag back to shoot · ←/→ fine-tune';
      q('.pl-hint').textContent = hint;
      q('.pl-hint').classList.toggle('show', !!hint);
    }
    function renderHud() {
      view.order.forEach((id, i) => {
        const p = api.player(id);
        const g = view.groups[id];
        const ids = g === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : g === 'stripes' ? [9, 10, 11, 12, 13, 14, 15] : [];
        const rack = ids.map((bid) => {
          const gone = view.balls.find((b) => b.id === bid).in;
          return `<svg viewBox="0 0 24 24" class="${gone ? 'gone' : ''}">${ballSVG(bid, 12, 12, 11)}</svg>`;
        }).join('');
        const active = view.turn === id && !view.result;
        q(`.pl-player[data-side="${i}"]`).className = `pl-player${i ? ' right' : ''}${active ? ' active' : ''}`;
        q(`.pl-player[data-side="${i}"]`).innerHTML = `
          <span class="av">${esc(p.avatar || '🙂')}</span>
          <div class="pl-pinfo"><b>${esc(p.name)}${id === me() ? ' <em>(you)</em>' : ''}</b>
          <div class="pl-rack">${rack || `<small>${g ? '' : 'Table open'}</small>`}</div></div>`;
      });
      q('.pl-msg').textContent = view.message || '';
    }

    function afterUpdate() {
      renderHud();
      updateControls();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(q('.pl-table-wrap'));
    frame();

    return {
      update(room) {
        const prev = view;
        view = room.game;
        const shot = view.lastShot;
        if (shot && shot.n !== lastShotSeen) {
          const first = lastShotSeen === null && !prev;
          lastShotSeen = shot.n;
          placing = false; placedCue = null; oppAim = null;
          if (!first) startAnim(shot);
        }
        if (!anim) balls = view.balls.map((b) => ({ ...b }));
        if (myTurn() && view.ballInHand && !placedCue && (!prev || prev.turn !== view.turn || prev.ballInHand !== view.ballInHand)) placing = true;
        if (myTurn() && prev && prev.turn !== view.turn) api.sound('turn');
        if (!anim) afterUpdate();   // otherwise the HUD updates when the shot animation ends
      },
      onSignal(from, data) {
        if (!view || from !== view.turn || from === me()) return;
        oppAim = { ...data, t: Date.now() };
      },
      busy: () => !!anim,
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onKey); },
    };
  }
})();
