/* Chess — browser module for the Divoxe platform. */
(function () {
  const esc = window.Divoxe.esc;

  // Flat, original piece designs (viewBox 0 0 45 45). {F} = fill, {S} = stroke, {D} = detail colour
  const BASE = '<path d="M11.5 38.5h22a1.5 1.5 0 0 1 1.5 1.5v1.5h-25V40a1.5 1.5 0 0 1 1.5-1.5z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>';
  const PIECES = {
    p: `<circle cx="22.5" cy="13" r="5" fill="{F}" stroke="{S}" stroke-width="1.5"/>
        <path d="M18.5 20h8l-1.5 1.8c3 3 4.5 8 5 16.7h-15c.5-8.7 2-13.7 5-16.7z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M17 20h11" stroke="{S}" stroke-width="1.5" stroke-linecap="round"/>${BASE}`,
    r: `<path d="M12 9h4.2v3.2h3.4V9h5.8v3.2h3.4V9H33v7.5l-3 2.5v14l3 5.5H12l3-5.5V19l-3-2.5z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M15 19h15M15 33h15" stroke="{D}" stroke-width="1.3"/>${BASE}`,
    n: `<path d="M13 38.5c0-7 4-10.5 7.5-14-3.6 1-7 1.8-8.6.2-1.2-1.2-.9-3 .7-5.2l6.5-8.6c.9-2.6 2.5-4.6 4.6-5.5l1 2.6 1.9-2.9c6.3 1.7 10.6 7.8 10.6 15.9 0 6.2-1.4 11.5-3.2 17.5z"
        fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="21.2" cy="14.6" r="1.4" fill="{S}"/><path d="M14.4 21.4l2.1-1.2" stroke="{S}" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M27.3 9.8c3.8 2.9 5.6 8.2 5 16" fill="none" stroke="{D}" stroke-width="1.3" stroke-linecap="round"/>${BASE}`,
    b: `<circle cx="22.5" cy="7.5" r="2.4" fill="{F}" stroke="{S}" stroke-width="1.4"/>
        <path d="M22.5 10.2c-5.6 4.2-8.4 9-7.6 13.6.4 2.4 2.2 3.9 3.9 4.4h7.4c1.7-.5 3.5-2 3.9-4.4.8-4.6-2-9.4-7.6-13.6z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M25.6 14.5l-4.4 5.6" stroke="{D}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M17.5 28.2h10l1.5 10.3h-13z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M16.5 28.2h12" stroke="{S}" stroke-width="1.5" stroke-linecap="round"/>${BASE}`,
    q: `<g fill="{F}" stroke="{S}" stroke-width="1.4"><circle cx="9" cy="12" r="2.3"/><circle cx="16" cy="8.8" r="2.3"/><circle cx="22.5" cy="7.5" r="2.3"/><circle cx="29" cy="8.8" r="2.3"/><circle cx="36" cy="12" r="2.3"/></g>
        <path d="M9.6 14.2l4.3 14.3h17.2l4.3-14.3-6.4 8.3-.7-11.5-5.8 10.5-5.8-10.5-.7 11.5z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M13.9 28.5h17.2l1.4 10H12.5z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M14.5 32.6h16" stroke="{D}" stroke-width="1.3"/>${BASE}`,
    k: `<path d="M22.5 4.5v7M19 8h7" stroke="{S}" stroke-width="2" stroke-linecap="round"/>
        <path d="M22.5 13.2c3.4 0 5 2.4 4.5 5.6l-1 4.2h-7l-1-4.2c-.5-3.2 1.1-5.6 4.5-5.6z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M11 22.2c0-2.6 2.4-4 5-3 2.2.8 3.9 2.7 4.8 3.8h3.4c.9-1.1 2.6-3 4.8-3.8 2.6-1 5 .4 5 3 0 3.5-2.8 6-4.6 7.3l1.1 9H14.5l1.1-9C13.8 28.2 11 25.7 11 22.2z" fill="{F}" stroke="{S}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M15.6 29.5h13.8" stroke="{D}" stroke-width="1.3"/>${BASE}`,
  };
  function pieceSVG(code) {
    const white = code[0] === 'w';
    const F = white ? '#fbf8f1' : '#2b2d42';
    const S = white ? '#2b2d42' : '#0f1020';
    const D = white ? '#b8b3a7' : '#6b6f8f';
    return `<svg viewBox="0 0 45 45" class="cz-piece-svg">${PIECES[code[1]].replace(/\{F\}/g, F).replace(/\{S\}/g, S).replace(/\{D\}/g, D)}</svg>`;
  }

  function art() {
    let squares = '';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      if ((r + c) % 2) squares += `<rect x="${c * 50}" y="${80 + r * 50}" width="50" height="50" fill="rgba(255,255,255,.12)"/>`;
    }
    const big = (code, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${pieceSVG(code).replace(/<\/?svg[^>]*>/g, '')}</g>`;
    return `<svg class="art" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="300" fill="transparent"/>${squares}
      <g>${big('bn', 120, 70, 3.6)}${big('wk', 30, 120, 2.8)}${big('wp', 200, 175, 2)}</g></svg>`;
  }

  const FILES = 'abcdefgh';
  const sqName = (r, c) => FILES[c] + (8 - r);
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const START = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

  window.Divoxe.registerGame({
    id: 'chess',
    name: 'Chess',
    tagline: 'The timeless game of strategy',
    description: 'Classic chess with full rules: castling, en passant, promotion, checkmate and draws. Play friends or the computer.',
    playersLabel: '2 players',
    maxBots: 1,
    accent: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #1e3a8a 100%)',
    icon: `<span style="display:grid;place-items:center;width:100%;height:100%;background:#4c1d95">${pieceSVG('wn')}</span>`,
    art,
    playerBadge(view, p) { return view.white === p.id ? '♔ White' : view.black === p.id ? '♚ Black' : ''; },
    mount,
  });

  function mount(root, api) {
    root.innerHTML = `
      <div class="cz">
        <div class="cz-main">
          <div class="cz-bar cz-top"></div>
          <div class="cz-board-wrap"><div class="cz-board"></div><div class="cz-promo hidden"></div></div>
          <div class="cz-bar cz-bottom"></div>
        </div>
        <div class="cz-panel">
          <div class="cz-status"></div>
          <ol class="cz-moves"></ol>
          <div class="cz-actions"><button class="btn-ghost cz-flip">⇅ Flip board</button><button class="btn-ghost cz-resign">🏳 Resign</button></div>
        </div>
      </div>`;
    const q = (s) => root.querySelector(s);
    const board = q('.cz-board');
    let view = null;
    let selected = null;
    let flipped = false;
    let lastMoveKey = null;
    let drag = null;

    q('.cz-flip').onclick = () => { flipped = !flipped; render(); };
    q('.cz-resign').onclick = () => {
      if (!view || view.result || !view.color) return;
      if (confirm('Resign this game?')) api.send({ type: 'resign' });
    };

    // Build 64 squares once
    for (let i = 0; i < 64; i++) {
      const d = document.createElement('div');
      d.className = 'cz-sq';
      board.appendChild(d);
    }

    const orient = () => (view && view.color === 'b') !== flipped; // true = black at bottom
    const squareAt = (idx) => {
      const r = orient() ? 7 - Math.floor(idx / 8) : Math.floor(idx / 8);
      const c = orient() ? 7 - (idx % 8) : idx % 8;
      return { r, c, name: sqName(r, c) };
    };
    const elFor = (name) => {
      const c = FILES.indexOf(name[0]); const r = 8 - +name[1];
      const idx = orient() ? (7 - r) * 8 + (7 - c) : r * 8 + c;
      return board.children[idx];
    };
    const myTurn = () => view && !view.result && view.turn === api.me();
    const targetsFrom = (from) => view.legal.filter((m) => m.from === from);

    function render() {
      if (!view) return;
      const targets = selected ? targetsFrom(selected) : [];
      for (let i = 0; i < 64; i++) {
        const { r, c, name } = squareAt(i);
        const el = board.children[i];
        const code = view.board[r][c];
        const light = (r + c) % 2 === 0;
        const isTarget = targets.some((m) => m.to === name);
        el.className = `cz-sq ${light ? 'light' : 'dark'}`
          + (view.lastMove && (view.lastMove.from === name || view.lastMove.to === name) ? ' last' : '')
          + (selected === name ? ' sel' : '')
          + (isTarget ? (code ? ' cap' : ' dot') : '')
          + (view.checkSquare === name ? ' check' : '');
        el.dataset.sq = name;
        const coordFile = i >= 56 ? `<span class="cz-file">${name[0]}</span>` : '';
        const coordRank = i % 8 === 0 ? `<span class="cz-rank">${name[1]}</span>` : '';
        el.innerHTML = coordRank + coordFile + (code ? `<div class="cz-piece${code[0] === (view.color || 'w') && myTurn() ? ' mine' : ''}" data-code="${code}">${pieceSVG(code)}</div>` : '');
      }
      renderBars();
      renderPanel();
    }

    function captured() {
      const left = { w: { ...START }, b: { ...START } };
      for (const row of view.board) for (const code of row) if (code) left[code[0]][code[1]]--;
      return left; // pieces missing per colour
    }

    function renderBars() {
      const missing = captured();
      const bottomColor = orient() ? 'b' : 'w';
      const topColor = bottomColor === 'w' ? 'b' : 'w';
      const material = (col) => Object.entries(missing[col === 'w' ? 'b' : 'w']).reduce((s, [t, n]) => s + VAL[t] * n, 0);
      const bar = (col) => {
        const id = col === 'w' ? view.white : view.black;
        const p = api.player(id);
        const takenOpp = missing[col === 'w' ? 'b' : 'w'];
        const icons = Object.entries(takenOpp).filter(([, n]) => n > 0)
          .map(([t, n]) => Array(n).fill(`<span class="cz-cap">${pieceSVG((col === 'w' ? 'b' : 'w') + t)}</span>`).join('')).join('');
        const diff = material(col) - material(col === 'w' ? 'b' : 'w');
        const active = view.turn === id && !view.result;
        return `<span class="av">${esc(p.avatar || '🙂')}</span>
          <div class="cz-who"><b>${esc(p.name)}${id === api.me() ? ' <em>(you)</em>' : ''}</b><div class="cz-caps">${icons}${diff > 0 ? `<span class="cz-plus">+${diff}</span>` : ''}</div></div>
          <span class="cz-turn ${active ? 'on' : ''}">${active ? (p.bot ? 'Thinking…' : id === api.me() ? 'Your move' : 'To move') : ''}</span>`;
      };
      q('.cz-top').innerHTML = bar(topColor);
      q('.cz-bottom').innerHTML = bar(bottomColor);
    }

    function renderPanel() {
      let status;
      if (view.result) status = view.result.text;
      else if (myTurn()) status = view.checkSquare ? '⚠️ You are in check!' : 'Your move';
      else status = `${api.playerName(view.turn)} to move${view.checkSquare ? ' — check!' : ''}`;
      q('.cz-status').textContent = status;
      q('.cz-status').classList.toggle('mine', myTurn());
      const pairs = [];
      for (let i = 0; i < view.moves.length; i += 2) pairs.push(`<li><span>${esc(view.moves[i])}</span><span>${esc(view.moves[i + 1] || '')}</span></li>`);
      q('.cz-moves').innerHTML = pairs.join('');
      q('.cz-moves').scrollTop = q('.cz-moves').scrollHeight;
      q('.cz-resign').disabled = !!view.result || !view.color;
    }

    function tryMove(from, to) {
      const options = view.legal.filter((m) => m.from === from && m.to === to);
      if (!options.length) return false;
      if (options.some((m) => m.promotion)) {
        askPromotion(from, to);
      } else {
        api.send({ type: 'move', from, to });
      }
      selected = null;
      return true;
    }

    function askPromotion(from, to) {
      const col = view.color;
      const box = q('.cz-promo');
      box.innerHTML = `<div class="cz-promo-card"><b>Promote to</b><div>${['q', 'r', 'b', 'n'].map((t) => `<button data-t="${t}">${pieceSVG(col + t)}</button>`).join('')}</div></div>`;
      box.classList.remove('hidden');
      box.onclick = (e) => {
        const b = e.target.closest('button');
        if (b) api.send({ type: 'move', from, to, promotion: b.dataset.t });
        box.classList.add('hidden');
      };
    }

    // ---- input: click or drag ----
    board.addEventListener('pointerdown', (e) => {
      const sqEl = e.target.closest('.cz-sq');
      if (!sqEl || !view || !myTurn()) return;
      const name = sqEl.dataset.sq;
      if (selected && selected !== name && tryMove(selected, name)) { render(); return; }
      const pieceEl = sqEl.querySelector('.cz-piece');
      if (pieceEl && pieceEl.dataset.code[0] === view.color && targetsFrom(name).length) {
        selected = name;
        render();
        const p = elFor(name).querySelector('.cz-piece');
        const rect = p.getBoundingClientRect();
        drag = { from: name, el: p, startX: e.clientX, startY: e.clientY, moved: false, w: rect.width };
        board.setPointerCapture(e.pointerId);
      } else {
        selected = null;
        render();
      }
    });
    board.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      drag.el.classList.add('dragging');
      drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
    });
    board.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      d.el.classList.remove('dragging');
      d.el.style.transform = '';
      if (!d.moved) return;
      const under = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList && x.classList.contains('cz-sq'));
      if (under && under.dataset.sq !== d.from && tryMove(d.from, under.dataset.sq)) { render(); return; }
      render();
    });

    function animateLastMove() {
      if (!view.lastMove) return;
      const key = view.moves.length + view.lastMove.from + view.lastMove.to;
      if (key === lastMoveKey) return;
      const first = lastMoveKey === null;
      lastMoveKey = key;
      if (first) return;
      const san = view.moves[view.moves.length - 1] || '';
      api.sound(san.includes('+') || san.includes('#') ? 'check' : san.includes('x') ? 'capture' : 'move');
      const fromEl = elFor(view.lastMove.from), toEl = elFor(view.lastMove.to);
      const piece = toEl.querySelector('.cz-piece');
      if (!piece) return;
      const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      piece.style.transition = 'none';
      piece.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
      void piece.offsetWidth;
      piece.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      piece.style.transform = '';
    }

    return {
      update(room) {
        const wasMine = myTurn();
        view = room.game;
        if (!myTurn()) selected = null;
        render();
        animateLastMove();
        if (myTurn() && !wasMine && view.moves.length) api.sound('turn');
      },
      destroy() {},
    };
  }
})();
