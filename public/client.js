(function () {
  const { SUITS, makeCard, avatarHTML, escapeHTML, sound } = window.Carta;
  const socket = io();
  const $ = (id) => document.getElementById(id);

  let room = null;       // latest room payload from the server
  let myId = null;
  let pendingSeven = null;
  let lastSeq = -1;      // last game event we animated
  let prevHandIds = new Set();
  let prevSuit = null;
  let wasMyTurn = false;
  let shownWinner = null;

  // ---------- small utils ----------
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    $(id).classList.remove('hidden');
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  function segValue(id) { return $(id).querySelector('.on').dataset.v; }
  for (const seg of document.querySelectorAll('.seg')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      store.set('seg:' + seg.id, b.dataset.v);
    });
    const saved = store.get('seg:' + seg.id);
    const btn = saved && seg.querySelector(`[data-v="${saved}"]`);
    if (btn) seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === btn));
  }
  const suitIcon = (suit, cls = '') => `<svg class="${cls}" viewBox="-20 -20 40 40"><use href="#s-${suit}" x="-20" y="-20" width="40" height="40"/></svg>`;

  // ---------- home ----------
  $('name').value = store.get('name') || '';
  const params = new URLSearchParams(location.search);
  if (params.get('room')) $('code').value = params.get('room').toUpperCase();

  function myName() {
    const n = $('name').value.trim();
    store.set('name', n);
    return n;
  }

  // Decorative cards
  const fan = [{ rank: 1, suit: 'dheb' }, { rank: 7, suit: 'kass' }, { rank: 12, suit: 'syouf' }, { rank: 2, suit: 'zrawet' }, { rank: 11, suit: 'dheb' }];
  fan.forEach((c, i) => {
    const el = makeCard(c);
    const k = i - 2;
    el.style.transform = `translateX(calc(-50% + ${k * 34}px)) translateY(${Math.abs(k) * 8}px) rotate(${k * 12}deg)`;
    el.style.animationDelay = `${i * 80}ms`;
    $('hero-fan').appendChild(el);
  });
  for (const box of document.querySelectorAll('.rule-cards')) {
    for (const id of box.dataset.cards.split(',')) {
      const [rank, suit] = id.split('-');
      box.appendChild(makeCard({ rank: +rank, suit }));
    }
  }

  $('play-cpu').onclick = () => {
    window.Carta.unlockAudio();
    socket.emit('play_computer', { name: myName(), bots: +segValue('seg-bots'), level: segValue('seg-level') });
  };
  $('create').onclick = () => { window.Carta.unlockAudio(); socket.emit('create_room', { name: myName() }); };
  $('join').onclick = () => {
    window.Carta.unlockAudio();
    const code = $('code').value.trim().toUpperCase();
    if (code.length !== 5) return toast('Enter the 5-letter room code');
    socket.emit('join_room', { code, name: myName(), playerId: store.get('player:' + code) });
  };
  $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('join').click(); });

  // Rejoin automatically after a refresh
  socket.on('connect', () => {
    const code = (params.get('room') || '').toUpperCase();
    const token = code && store.get('player:' + code);
    if (token && !room) socket.emit('join_room', { code, name: myName(), playerId: token });
  });

  function goHome() {
    socket.emit('leave_room');
    room = null; myId = null; lastSeq = -1; shownWinner = null;
    history.replaceState(null, '', location.pathname);
    $('winner').classList.add('hidden');
    show('home');
  }

  // ---------- lobby ----------
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('invite').value); toast('Invite link copied'); }
    catch { $('invite').select(); }
  };
  if (navigator.share) {
    $('share').classList.remove('hidden');
    $('share').onclick = () => navigator.share({ title: 'Hezz 2 — Carta Mghribia', text: 'Come play Hezz 2 with me!', url: $('invite').value }).catch(() => {});
  }
  $('start').onclick = () => socket.emit('start_game');
  $('leave-lobby').onclick = goHome;

  function renderLobby() {
    show('lobby');
    $('winner').classList.add('hidden');
    $('lobby-code').textContent = room.code;
    $('invite').value = `${location.origin}${location.pathname}?room=${room.code}`;
    const isHost = myId === room.hostId;
    const seats = $('lobby-seats');
    seats.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const p = room.players[i];
      const div = document.createElement('div');
      if (p) {
        div.className = 'seat-slot';
        const role = p.bot ? `Computer · ${p.level === 'easy' ? 'Easy' : 'Hard'}` : p.id === room.hostId ? 'Host' : 'Player';
        div.innerHTML = `${avatarHTML(p)}<div class="who"><b>${escapeHTML(p.name)}${p.id === myId ? ' (you)' : ''}</b><small>${role}</small></div>`;
        if (p.bot && isHost) {
          const x = document.createElement('button');
          x.className = 'x'; x.textContent = '✕'; x.title = 'Remove';
          x.onclick = () => socket.emit('remove_bot', { id: p.id });
          div.appendChild(x);
        }
      } else {
        div.className = 'seat-slot empty';
        if (isHost) {
          const b = document.createElement('button');
          b.textContent = '+ Add computer';
          b.onclick = () => socket.emit('add_bot', { level: segValue('seg-lobby-level') });
          div.appendChild(b);
        } else div.textContent = 'Waiting for a player…';
      }
      seats.appendChild(div);
    }
    $('start').classList.toggle('hidden', !isHost);
    $('bot-level-wrap').classList.toggle('hidden', !isHost);
    $('start').disabled = room.players.length < 2;
    $('start').textContent = room.players.length < 2 ? 'Need at least 2 players' : 'Start game';
    $('lobby-wait').classList.toggle('hidden', isHost);
  }

  // ---------- game controls ----------
  $('draw-pile').onclick = () => {
    const g = room && room.game;
    if (!g || g.turn !== myId || g.winner) return;
    socket.emit('draw_card');
  };
  function onCardClick(card) {
    const g = room.game;
    if (g.winner) return;
    if (g.turn !== myId) return toast('Wait for your turn');
    if (!g.playable.includes(card.id)) {
      return toast(g.pendingDraw ? `Answer with a 2, or draw ${g.pendingDraw}` : 'That card does not match');
    }
    if (card.rank === 7) return openSuitPicker(card.id);
    socket.emit('play_card', { cardId: card.id });
  }
  function openSuitPicker(cardId) {
    pendingSeven = cardId;
    const hand = room.game.hand.filter((c) => c.id !== cardId);
    const box = $('suit-options');
    box.innerHTML = '';
    for (const [key, s] of Object.entries(SUITS)) {
      const n = hand.filter((c) => c.suit === key).length;
      const b = document.createElement('button');
      b.className = 'suit-btn';
      b.style.setProperty('--c', s.color);
      b.innerHTML = `${suitIcon(key)}<span>${s.label}</span><span lang="ar">${s.ar}</span><span class="have">${n} in hand</span>`;
      b.onclick = () => {
        socket.emit('play_card', { cardId: pendingSeven, suit: key });
        pendingSeven = null;
        $('suit-picker').classList.add('hidden');
      };
      box.appendChild(b);
    }
    $('suit-picker').classList.remove('hidden');
  }
  $('suit-cancel').onclick = () => { pendingSeven = null; $('suit-picker').classList.add('hidden'); };

  // Top bar
  function syncSoundBtn() { $('btn-sound').textContent = window.Carta.isMuted() ? '🔇' : '🔊'; }
  syncSoundBtn();
  $('btn-sound').onclick = () => { window.Carta.setMuted(!window.Carta.isMuted()); syncSoundBtn(); };
  const side = $('side');
  if (window.innerWidth < 1100) side.classList.add('closed');
  $('btn-panel').onclick = () => { side.classList.toggle('closed'); $('chat-dot').classList.add('hidden'); };
  $('btn-leave').onclick = () => {
    if (room && room.game && !room.game.winner && !confirm('Leave this game?')) return;
    goHome();
  };
  for (const tab of document.querySelectorAll('.side-tabs button')) {
    tab.onclick = () => {
      document.querySelectorAll('.side-tabs button').forEach((t) => t.classList.toggle('on', t === tab));
      $('log').classList.toggle('hidden', tab.dataset.tab !== 'log');
      $('chat-wrap').classList.toggle('hidden', tab.dataset.tab !== 'chat');
      if (tab.dataset.tab === 'chat') $('chat-dot').classList.add('hidden');
    };
  }
  // Quick Darija phrases
  ['Salam 👋', 'Mzyan! 👏', 'Hezz! 😂', 'Yallah ⏳', 'Mabrouk 🎉', 'Safi 😅'].forEach((t) => {
    const b = document.createElement('button');
    b.textContent = t;
    b.onclick = () => socket.emit('chat', t);
    $('quick').appendChild(b);
  });
  $('chat-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('chat-input').value.trim();
    if (v) socket.emit('chat', v);
    $('chat-input').value = '';
  };

  // Winner modal
  $('rematch').onclick = () => socket.emit('start_game');
  $('to-menu').onclick = goHome;

  // ---------- server events ----------
  socket.on('error_msg', toast);
  socket.on('joined', ({ code, playerId }) => {
    myId = playerId;
    store.set('player:' + code, playerId);
    history.replaceState(null, '', `?room=${code}`);
  });
  socket.on('chat', ({ name, text }) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${escapeHTML(name)}:</b> ${escapeHTML(text)}`;
    $('chat').appendChild(li);
    $('chat').scrollTop = $('chat').scrollHeight;
    const chatOpen = !side.classList.contains('closed') && !$('chat-wrap').classList.contains('hidden');
    if (!chatOpen) { $('chat-dot').classList.remove('hidden'); toast(`${name}: ${text}`); }
  });
  socket.on('room', (r) => {
    room = r;
    if (!myId && r.game) myId = r.game.you;
    if (!r.game) { lastSeq = -1; shownWinner = null; return renderLobby(); }
    renderGame();
  });

  // ---------- rendering the table ----------
  const POSITIONS = { 1: ['top'], 2: ['top-left', 'top-right'], 3: ['left', 'top', 'right'] };

  function seatOrder(g) {
    const i = g.players.findIndex((p) => p.id === myId);
    return g.players.slice(i + 1).concat(g.players.slice(0, i));
  }
  const infoOf = (id) => room.players.find((p) => p.id === id) || {};

  function renderGame() {
    show('game');
    const g = room.game;
    const myTurn = g.turn === myId && !g.winner;
    $('room-chip').textContent = room.solo ? 'vs Computer' : `Room ${room.code}`;

    // Opponent seats
    const others = seatOrder(g);
    const pos = POSITIONS[others.length] || [];
    const layer = $('seats');
    layer.innerHTML = '';
    others.forEach((p, i) => {
      const info = infoOf(p.id);
      const active = g.turn === p.id && !g.winner;
      const el = document.createElement('div');
      el.id = 'seat-' + p.id;
      el.className = `seat pos-${pos[i]}${active ? ' active' : ''}${info.connected === false && !info.bot ? ' offline' : ''}${p.cards === 1 ? ' last-card' : ''}`;
      const tag = info.bot ? (active ? '<span class="thinking"><i></i><i></i><i></i></span>' : 'Computer')
        : info.connected === false ? 'Away' : active ? 'Playing…' : '';
      const minis = '<span class="mini"></span>'.repeat(Math.min(p.cards, 10));
      el.innerHTML = `<div class="row">${avatarHTML({ ...p, bot: info.bot })}<div><div class="nm">${escapeHTML(p.name)}</div><div class="tag">${tag}</div></div></div>
        <div class="fan">${minis}</div><div class="count">${p.cards === 1 ? 'Last card!' : p.cards + ' cards'}</div>`;
      layer.appendChild(el);
    });

    // Center
    const discard = $('discard');
    const prevTop = discard.querySelector('.card.top');
    if (!prevTop || prevTop.dataset.id !== g.topCard.id) {
      discard.querySelectorAll('.card.under').forEach((c) => c.remove());
      if (prevTop) { prevTop.classList.remove('top'); prevTop.classList.add('under'); }
      const top = makeCard(g.topCard, 'top');
      top.style.transform = `rotate(${(hashId(g.topCard.id) % 15) - 7}deg)`;
      discard.appendChild(top);
    }
    $('draw-count').textContent = g.drawPileCount;
    $('draw-pile').classList.toggle('active', myTurn);
    $('draw-label').textContent = g.pendingDraw && myTurn ? `Draw ${g.pendingDraw}` : 'Draw';

    const nameOf = (id) => (g.players.find((p) => p.id === id) || {}).name;
    const banner = $('turn-label');
    banner.textContent = g.winner ? 'Game over' : myTurn ? 'Your turn!' : `${nameOf(g.turn)}'s turn`;
    banner.classList.toggle('mine', myTurn);
    const s = SUITS[g.currentSuit];
    const chip = $('suit-chip');
    chip.innerHTML = `${suitIcon(g.currentSuit)}<span>${s.label}</span><span lang="ar">${s.ar}</span>`;
    if (prevSuit && prevSuit !== g.currentSuit && g.topCard.rank === 7) {
      chip.classList.remove('changed'); void chip.offsetWidth; chip.classList.add('changed');
    }
    prevSuit = g.currentSuit;
    $('pending-label').textContent = g.pendingDraw ? `+${g.pendingDraw}` : '';

    // My info + hand
    const me = g.players.find((p) => p.id === myId) || { name: '' };
    $('me-info').className = 'me-info' + (myTurn ? ' active' : '');
    $('me-info').innerHTML = `${avatarHTML(me)}<b>${escapeHTML(me.name)}</b><span class="muted" style="color:var(--sand)">${g.hand.length === 1 ? 'Last card!' : g.hand.length + ' cards'}</span>`;
    const hand = $('hand');
    hand.innerHTML = '';
    const sorted = g.hand.slice().sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank);
    hand.style.setProperty('--overlap', handOverlap(sorted.length));
    for (const c of sorted) {
      const cls = myTurn ? (g.playable.includes(c.id) ? 'playable' : 'dim') : '';
      const el = makeCard(c, cls + (prevHandIds.size && !prevHandIds.has(c.id) ? ' enter' : ''));
      el.onclick = () => onCardClick(c);
      hand.appendChild(el);
    }
    prevHandIds = new Set(g.hand.map((c) => c.id));

    // Log
    const log = $('log');
    log.innerHTML = g.log.map((l) => `<li>${escapeHTML(l)}</li>`).join('');
    log.scrollTop = log.scrollHeight;

    animateLastAction(g);
    if (myTurn && !wasMyTurn && !g.winner) sound(g.pendingDraw ? 'hezz' : 'turn');
    wasMyTurn = myTurn;

    renderWinner(g);
  }

  // Overlap cards just enough to fit the screen width
  function handOverlap(n) {
    if (n < 2) return 0;
    const cardW = $('discard').offsetWidth || 70; // same size as hand cards
    const avail = Math.min(window.innerWidth, 1000) - 40;
    const fit = (avail - n * cardW) / ((n - 1) * cardW);
    return Math.max(-0.72, Math.min(-0.06, fit));
  }
  window.addEventListener('resize', () => { if (room && room.game) $('hand').style.setProperty('--overlap', handOverlap(room.game.hand.length)); });

  function hashId(s) { let h = 0; for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h; }

  function animateLastAction(g) {
    if (g.seq === lastSeq) return;
    const first = lastSeq === -1;
    lastSeq = g.seq;
    const a = g.lastAction;
    if (first || !a) return;
    const srcEl = a.playerId === myId ? $('hand') : $('seat-' + a.playerId);
    if (!srcEl) return;
    if (a.type === 'play') {
      sound(g.topCard.rank === 2 ? 'hezz' : 'play');
      const top = $('discard').querySelector('.card.top');
      if (top) flyFrom(top, srcEl);
    } else if (a.type === 'draw' && a.count) {
      sound('draw');
      const n = Math.min(a.count, 6);
      for (let i = 0; i < n; i++) setTimeout(() => flyBack($('draw-pile'), srcEl), i * 110);
    }
  }

  // Animate an element from another element's position into its own place
  function flyFrom(el, fromEl) {
    const to = el.getBoundingClientRect();
    const from = fromEl.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const final = el.style.transform;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(.7) rotate(-25deg)`;
    void el.offsetWidth;
    el.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
    el.style.transform = final;
  }
  // A face-down card flying from the pile to a player
  function flyBack(pileEl, toEl) {
    const from = pileEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const card = makeCard(null, 'fly');
    card.style.left = from.left + 'px';
    card.style.top = from.top + 'px';
    card.style.width = from.width + 'px';
    document.body.appendChild(card);
    void card.offsetWidth;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    card.style.transform = `translate(${dx}px, ${dy}px) scale(.5) rotate(15deg)`;
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 500);
  }

  function renderWinner(g) {
    if (!g.winner) { $('winner').classList.add('hidden'); shownWinner = null; return; }
    if (shownWinner === g.seq) return;
    shownWinner = g.seq;
    const won = g.winner === myId;
    const winnerName = (g.players.find((p) => p.id === g.winner) || {}).name;
    setTimeout(() => {
      $('winner-ar').textContent = won ? 'مبروك!' : 'حظ أوفر';
      $('winner-text').textContent = won ? 'You win! Mabrouk 🎉' : `${winnerName} wins this round`;
      const ranked = g.players.slice().sort((a, b) => a.cards - b.cards);
      $('winner-standings').innerHTML = ranked.map((p) =>
        `<li class="${p.id === g.winner ? 'win' : ''}">${avatarHTML({ ...p, bot: infoOf(p.id).bot })}<span>${escapeHTML(p.name)}${p.id === myId ? ' (you)' : ''}</span><small>${p.id === g.winner ? 'Winner' : p.cards + ' cards left'}</small></li>`).join('');
      const isHost = myId === room.hostId;
      $('rematch').classList.toggle('hidden', !isHost);
      $('rematch-wait').classList.toggle('hidden', isHost);
      $('winner').classList.remove('hidden');
      sound(won ? 'win' : 'lose');
      if (won) confetti();
    }, 700);
  }

  function confetti() {
    const box = $('confetti');
    box.innerHTML = '';
    const colors = ['#c1272d', '#0f5132', '#e2b54a', '#fbf3e2'];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2 + Math.random() * 2.5 + 's';
      p.style.animationDelay = Math.random() * .8 + 's';
      p.style.clipPath = i % 3 ? 'none' : 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)';
      box.appendChild(p);
    }
    setTimeout(() => { box.innerHTML = ''; }, 6000);
  }
})();
