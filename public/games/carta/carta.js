/* Carta Beldia (Hezz 2) — browser module for the Divoxe platform. */
(function () {
  const { SUITS, makeCard } = window.Carta;
  const esc = window.Divoxe.esc;
  let imagesLoaded = false;

  function loadImages() {
    if (imagesLoaded) return Promise.resolve();
    imagesLoaded = true;
    return fetch('card-images.json').then((r) => r.json()).then(window.Carta.setImages).catch(() => {});
  }
  loadImages();

  const suitIcon = (suit) => `<svg viewBox="-20 -20 40 40"><use href="#s-${suit}" x="-20" y="-20" width="40" height="40"/></svg>`;

  function art() {
    const cards = [{ rank: 1, suit: 'dheb' }, { rank: 7, suit: 'kass' }, { rank: 12, suit: 'syouf' }, { rank: 2, suit: 'zrawet' }, { rank: 11, suit: 'dheb' }];
    const fan = cards.map((c, i) => {
      const k = i - 2;
      const el = makeCard(c);
      el.style.cssText = `position:absolute;left:50%;bottom:8%;width:26%;transform:translateX(calc(-50% + ${k * 30}%)) translateY(${Math.abs(k) * 4}%) rotate(${k * 11}deg);transform-origin:50% 120%`;
      return el.outerHTML;
    }).join('');
    return `<div class="art carta-art">${fan}<span class="carta-art-title" lang="ar">الكارطة</span></div>`;
  }

  window.Divoxe.registerGame({
    id: 'carta',
    name: 'Carta Beldia',
    tagline: 'Hezz 2 — the classic Moroccan card game',
    description: 'Match the suit or number, stack the 2s, skip with the 1 and change suit with the 7. First to empty their hand wins.',
    playersLabel: '2–4 players',
    maxBots: 3,
    accent: 'linear-gradient(135deg, #0f5132 0%, #146b42 45%, #8e1b22 100%)',
    icon: '<svg viewBox="-12 -12 24 24" style="background:#0f5132"><g fill="#c1272d" stroke="#e2b54a" stroke-width="1"><rect x="-6.5" y="-6.5" width="13" height="13"/><rect x="-6.5" y="-6.5" width="13" height="13" transform="rotate(45)"/></g></svg>',
    art,
    playerBadge(view, p) {
      const pl = view.players && view.players.find((x) => x.id === p.id);
      return pl ? `${pl.cards} 🂠` : '';
    },
    mount,
  });

  function mount(root, api) {
    root.innerHTML = `
      <div class="carta">
        <div class="ct-table-wrap"><div class="ct-table">
          <div class="ct-seats"></div>
          <div class="ct-center">
            <button class="ct-pile" aria-label="Draw a card"><span class="ct-pile-stack"></span><span class="ct-pile-count"></span><span class="ct-pile-label">Draw</span></button>
            <div class="ct-discard"></div>
            <div class="ct-status">
              <div class="ct-turn"></div>
              <div class="ct-suit"></div>
              <div class="ct-pending"></div>
              <div class="ct-last"></div>
            </div>
          </div>
        </div></div>
        <div class="ct-me"><div class="ct-me-info"></div><div class="ct-hand"></div></div>
        <div class="ct-modal hidden">
          <div class="ct-modal-card">
            <h3>Choose the suit <span lang="ar">ختار النوع</span></h3>
            <div class="ct-suit-options"></div>
            <button class="btn-ghost ct-cancel">Cancel</button>
          </div>
        </div>
      </div>`;
    const q = (s) => root.querySelector(s);
    let view = null;
    let lastSeq = -1;
    let prevHand = new Set();
    let prevSuit = null;
    let wasMyTurn = false;
    let pendingSeven = null;
    const myId = () => api.me();

    q('.ct-pile').onclick = () => {
      if (!view || view.turn !== myId() || view.winner) return;
      api.send({ type: 'draw' });
    };
    q('.ct-cancel').onclick = () => { pendingSeven = null; q('.ct-modal').classList.add('hidden'); };

    function onCard(card) {
      if (view.winner) return;
      if (view.turn !== myId()) return api.toast('Wait for your turn');
      if (!view.playable.includes(card.id)) return api.toast(view.pendingDraw ? `Answer with a 2, or draw ${view.pendingDraw}` : 'That card does not match');
      if (card.rank === 7) return openSuitPicker(card.id);
      api.send({ type: 'play', cardId: card.id });
    }

    function openSuitPicker(cardId) {
      pendingSeven = cardId;
      const rest = view.hand.filter((c) => c.id !== cardId);
      q('.ct-suit-options').innerHTML = Object.entries(SUITS).map(([key, s]) => `
        <button class="ct-suit-btn" data-suit="${key}" style="--c:${s.color}">${suitIcon(key)}<span>${s.label}</span><span lang="ar">${s.ar}</span>
        <small>${rest.filter((c) => c.suit === key).length} in hand</small></button>`).join('');
      q('.ct-suit-options').onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        api.send({ type: 'play', cardId: pendingSeven, suit: b.dataset.suit });
        pendingSeven = null;
        q('.ct-modal').classList.add('hidden');
      };
      q('.ct-modal').classList.remove('hidden');
    }

    const POSITIONS = { 1: ['top'], 2: ['top-left', 'top-right'], 3: ['left', 'top', 'right'] };
    const hashId = (s) => { let h = 0; for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h; };

    function handOverlap(n) {
      if (n < 2) return 0;
      const cardW = q('.ct-discard').offsetWidth || 70;
      const avail = Math.min(root.clientWidth, 1000) - 40;
      return Math.max(-0.72, Math.min(-0.06, (avail - n * cardW) / ((n - 1) * cardW)));
    }

    function update(room) {
      view = room.game;
      const me = myId();
      const myTurn = view.turn === me && !view.winner;

      // seats
      const i = view.players.findIndex((p) => p.id === me);
      const others = view.players.slice(i + 1).concat(view.players.slice(0, Math.max(i, 0)));
      const pos = POSITIONS[others.length] || [];
      q('.ct-seats').innerHTML = others.map((p, k) => {
        const info = api.player(p.id);
        const active = view.turn === p.id && !view.winner;
        const tag = info.bot ? (active ? '<span class="ct-thinking"><i></i><i></i><i></i></span>' : 'Computer') : info.connected === false ? 'Away' : active ? 'Playing…' : '';
        return `<div class="ct-seat pos-${pos[k]}${active ? ' active' : ''}${info.connected === false && !info.bot ? ' offline' : ''}${p.cards === 1 ? ' last-card' : ''}" data-seat="${p.id}">
          <div class="ct-row"><span class="av">${esc(info.avatar || '🙂')}</span><div><div class="ct-nm">${esc(p.name)}</div><div class="ct-tag">${tag}</div></div></div>
          <div class="ct-fan">${'<span class="ct-mini"></span>'.repeat(Math.min(p.cards, 10))}</div>
          <div class="ct-count">${p.cards === 1 ? 'Last card!' : p.cards + ' cards'}</div></div>`;
      }).join('');

      // discard
      const discard = q('.ct-discard');
      const prevTop = discard.querySelector('.card.top');
      if (!prevTop || prevTop.dataset.id !== view.topCard.id) {
        discard.querySelectorAll('.card.under').forEach((c) => c.remove());
        if (prevTop) { prevTop.classList.remove('top'); prevTop.classList.add('under'); }
        const top = makeCard(view.topCard, 'top');
        top.style.transform = `rotate(${(hashId(view.topCard.id) % 15) - 7}deg)`;
        discard.appendChild(top);
      }
      q('.ct-pile-count').textContent = view.drawPileCount;
      q('.ct-pile').classList.toggle('active', myTurn);
      q('.ct-pile-label').textContent = view.pendingDraw && myTurn ? `Draw ${view.pendingDraw}` : 'Draw';

      const nameOf = (id) => (view.players.find((p) => p.id === id) || {}).name;
      const turn = q('.ct-turn');
      turn.textContent = view.winner ? 'Game over' : myTurn ? 'Your turn!' : `${nameOf(view.turn)}'s turn`;
      turn.classList.toggle('mine', myTurn);
      const s = SUITS[view.currentSuit];
      const chip = q('.ct-suit');
      chip.innerHTML = `${suitIcon(view.currentSuit)}<span>${s.label}</span><span lang="ar">${s.ar}</span>`;
      if (prevSuit && prevSuit !== view.currentSuit && view.topCard.rank === 7) {
        chip.classList.remove('changed'); void chip.offsetWidth; chip.classList.add('changed');
      }
      prevSuit = view.currentSuit;
      q('.ct-pending').textContent = view.pendingDraw ? `+${view.pendingDraw}` : '';
      q('.ct-last').textContent = view.log[view.log.length - 1] || '';

      // my hand
      const mine = view.players.find((p) => p.id === me) || { name: '' };
      const meInfo = api.player(me);
      q('.ct-me-info').className = 'ct-me-info' + (myTurn ? ' active' : '');
      q('.ct-me-info').innerHTML = `<span class="av">${esc(meInfo.avatar || '🙂')}</span><b>${esc(mine.name)}</b><span>${view.hand.length === 1 ? 'Last card!' : view.hand.length + ' cards'}</span>`;
      const hand = q('.ct-hand');
      hand.innerHTML = '';
      const sorted = view.hand.slice().sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank);
      hand.style.setProperty('--overlap', handOverlap(sorted.length));
      for (const c of sorted) {
        const cls = myTurn ? (view.playable.includes(c.id) ? 'playable' : 'dim') : '';
        const el = makeCard(c, cls + (prevHand.size && !prevHand.has(c.id) ? ' enter' : ''));
        el.onclick = () => onCard(c);
        hand.appendChild(el);
      }
      prevHand = new Set(view.hand.map((c) => c.id));

      animate();
      if (myTurn && !wasMyTurn) api.sound(view.pendingDraw ? 'check' : 'turn');
      wasMyTurn = myTurn;
    }

    function animate() {
      if (view.seq === lastSeq) return;
      const first = lastSeq === -1;
      lastSeq = view.seq;
      const a = view.lastAction;
      if (first || !a) return;
      const src = a.playerId === myId() ? q('.ct-hand') : q(`[data-seat="${a.playerId}"]`);
      if (!src) return;
      if (a.type === 'play') {
        api.sound('card');
        const top = q('.ct-discard .card.top');
        if (top) flyFrom(top, src);
      } else if (a.type === 'draw' && a.count) {
        api.sound('draw');
        for (let k = 0; k < Math.min(a.count, 6); k++) setTimeout(() => flyBack(q('.ct-pile'), src), k * 110);
      }
    }
    function flyFrom(el, fromEl) {
      const to = el.getBoundingClientRect();
      const from = fromEl.getBoundingClientRect();
      const final = el.style.transform;
      el.style.transition = 'none';
      el.style.transform = `translate(${from.left + from.width / 2 - to.left - to.width / 2}px, ${from.top + from.height / 2 - to.top - to.height / 2}px) scale(.7) rotate(-25deg)`;
      void el.offsetWidth;
      el.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
      el.style.transform = final;
    }
    function flyBack(pileEl, toEl) {
      const from = pileEl.getBoundingClientRect();
      const to = toEl.getBoundingClientRect();
      const card = makeCard(null, 'ct-fly');
      Object.assign(card.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px' });
      document.body.appendChild(card);
      void card.offsetWidth;
      card.style.transform = `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top + to.height / 2 - from.top - from.height / 2}px) scale(.5) rotate(15deg)`;
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 500);
    }

    const onResize = () => { if (view) q('.ct-hand').style.setProperty('--overlap', handOverlap(view.hand.length)); };
    window.addEventListener('resize', onResize);
    return {
      update,
      destroy() { window.removeEventListener('resize', onResize); },
    };
  }
})();
