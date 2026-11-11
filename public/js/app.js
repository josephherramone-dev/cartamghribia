/* Divoxe Games — platform shell: routing, profile, matchmaking, lobby, chat, results.
 * Each game is a plug-in that calls Divoxe.registerGame(...) (see public/games/README.md). */
(function () {
  // Games to load. Add a new entry here (plus its server adapter) to add a game.
  const MANIFEST = [
    { id: 'carta', files: ['games/carta/art.js', 'games/carta/carta.css', 'games/carta/carta.js'] },
    { id: 'chess', files: ['games/chess/chess.css', 'games/chess/chess.js'] },
    { id: 'pool', files: ['games/pool/physics.js', 'games/pool/pool.css', 'games/pool/pool.js'] },
  ];
  const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐵', '🐨', '🐧', '🦉', '🐢', '🐬', '🐝', '🦋', '🐲', '😎', '🤠', '🥷', '👽', '🤖', '👑', '🔥', '⚡'];
  const REACTIONS = ['👍', '😂', '🔥', '😮', '😡', 'GG', 'Salam 👋', 'Yallah!'];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  const registry = {};
  const socket = io();
  let room = null;
  let myId = null;
  let instance = null;       // mounted game UI
  let mountedFor = null;     // `${code}:${gameId}`
  let resultShownFor = null;
  let queueGame = null;
  let unread = 0;

  // ---------------- public API for game modules ----------------
  window.Divoxe = {
    registerGame(def) { registry[def.id] = def; },
    esc,
    sound: (n) => window.Sound.play(n),
    toast,
  };

  // ---------------- profile ----------------
  const profile = {
    name: store.get('name') || `Guest${Math.floor(1000 + Math.random() * 9000)}`,
    avatar: store.get('avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)],
  };
  store.set('name', profile.name); store.set('avatar', profile.avatar);
  function renderProfile() {
    $('profile-av').textContent = profile.avatar;
    $('profile-name').textContent = profile.name;
  }
  renderProfile();
  $('profile-chip').onclick = () => {
    $('profile-input').value = profile.name;
    $('avatar-grid').innerHTML = AVATARS.map((a) => `<button type="button" class="${a === profile.avatar ? 'on' : ''}" data-a="${a}">${a}</button>`).join('');
    openModal('profile-modal');
    setTimeout(() => $('profile-input').focus(), 50);
  };
  $('avatar-grid').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('avatar-grid').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  };
  $('profile-save').onclick = () => {
    profile.name = $('profile-input').value.trim().slice(0, 16) || profile.name;
    profile.avatar = ($('avatar-grid').querySelector('.on') || {}).dataset?.a || profile.avatar;
    store.set('name', profile.name); store.set('avatar', profile.avatar);
    renderProfile();
    closeModal('profile-modal');
    toast('Profile saved');
  };
  $('profile-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('profile-save').click(); });

  // ---------------- helpers ----------------
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.add('hidden'), 2800);
  }
  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }
  for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('click', (e) => {
      if ((e.target === m && m.id !== 'result-modal') || e.target.closest('[data-close]')) {
        if (m.id === 'game-sheet') closeSheet(); else closeModal(m.id);
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('game-sheet').classList.contains('hidden')) closeSheet();
    ['profile-modal', 'code-modal'].forEach(closeModal);
  });
  $('year').textContent = new Date().getFullYear();

  function loadFile(src) {
    return new Promise((resolve) => {
      if (src.endsWith('.css')) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = src; l.onload = resolve; l.onerror = resolve;
        document.head.appendChild(l);
      } else {
        const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = resolve;
        document.body.appendChild(s);
      }
    });
  }

  // ---------------- home ----------------
  function renderGrid() {
    const games = MANIFEST.map((m) => registry[m.id]).filter(Boolean);
    $('games-count').textContent = `${games.length} games`;
    $('game-grid').innerHTML = games.map((g) => `
      <a class="game-tile" href="#/g/${g.id}" style="--accent:${g.accent}">
        <div class="tile-art">${g.art ? g.art() : ''}</div>
        <div class="tile-info">
          <div><h3>${esc(g.name)}</h3><p>${esc(g.tagline || '')}</p></div>
          <div class="tile-meta"><span class="chip">${esc(g.playersLabel || '')}</span><span class="chip live" data-online="${g.id}">● 0 playing</span></div>
        </div>
      </a>`).join('') + `
      <div class="game-tile soon"><div class="tile-art soon-art">＋</div><div class="tile-info"><div><h3>More games soon</h3><p>New games are added regularly.</p></div></div></div>`;
    refreshOnline();
  }

  async function refreshOnline() {
    try {
      const r = await fetch('/api/online').then((x) => x.json());
      $('online-count').textContent = r.total;
      for (const [g, n] of Object.entries(r.perGame)) {
        const el = document.querySelector(`[data-online="${g}"]`);
        if (el) el.textContent = `● ${n} playing`;
      }
    } catch {}
  }
  setInterval(refreshOnline, 15000);

  // ---------------- game sheet: choose how to play ----------------
  const sheetOpts = { bots: 1, level: store.get('level') || 'hard' };
  function openSheet(id) {
    const g = registry[id];
    if (!g) return;
    queueGame = null;
    const maxBots = g.maxBots || 1;
    sheetOpts.bots = Math.min(sheetOpts.bots, maxBots);
    $('sheet-content').innerHTML = `
      <button class="sheet-close" data-close aria-label="Close">✕</button>
      <div class="sheet-hero" style="--accent:${g.accent}">
        <div class="sheet-art">${g.art ? g.art() : ''}</div>
        <div><h2>${esc(g.name)}</h2><p>${esc(g.description || g.tagline || '')}</p><span class="chip">${esc(g.playersLabel || '')}</span></div>
      </div>
      <div class="sheet-body" id="sheet-body">
        <button class="mode-card" id="mode-quick">
          <span class="mode-ico">⚡</span>
          <span><b>Quick match</b><small>Play with people online right now</small></span>
          <span class="arrow">›</span>
        </button>
        <div class="mode-card static">
          <span class="mode-ico">🤖</span>
          <span class="grow"><b>Play vs computer</b><small>Practice against the computer</small>
            <span class="mode-opts">
              ${maxBots > 1 ? `<span class="seg" id="seg-bots">${[1, 2, 3].slice(0, maxBots).map((n) => `<button data-v="${n}" class="${n === sheetOpts.bots ? 'on' : ''}">${n} bot${n > 1 ? 's' : ''}</button>`).join('')}</span>` : ''}
              <span class="seg" id="seg-level">${['easy', 'hard'].map((l) => `<button data-v="${l}" class="${l === sheetOpts.level ? 'on' : ''}">${l === 'easy' ? 'Easy' : 'Hard'}</button>`).join('')}</span>
            </span>
          </span>
          <button class="btn" id="mode-cpu">Play</button>
        </div>
        <button class="mode-card" id="mode-private">
          <span class="mode-ico">👥</span>
          <span><b>Play with friends</b><small>Create a private room and share the link</small></span>
          <span class="arrow">›</span>
        </button>
      </div>`;
    $('game-sheet').classList.remove('hidden');
    const seg = (sid, key) => {
      const el = $(sid); if (!el) return;
      el.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        sheetOpts[key] = key === 'bots' ? +b.dataset.v : b.dataset.v;
        if (key === 'level') store.set('level', b.dataset.v);
      };
    };
    seg('seg-bots', 'bots'); seg('seg-level', 'level');
    $('mode-cpu').onclick = () => { window.Sound.unlock(); socket.emit('room:create', { gameId: id, ...profile, solo: true, bots: sheetOpts.bots, level: sheetOpts.level }); };
    $('mode-private').onclick = () => { window.Sound.unlock(); socket.emit('room:create', { gameId: id, ...profile }); };
    $('mode-quick').onclick = () => { window.Sound.unlock(); startQuick(id); };
  }
  function closeSheet() {
    if (queueGame) socket.emit('quick:cancel');
    queueGame = null;
    $('game-sheet').classList.add('hidden');
    if (location.hash.startsWith('#/g/')) history.replaceState(null, '', '#/');
  }

  function startQuick(id) {
    queueGame = id;
    socket.emit('quick:join', { gameId: id, ...profile });
    $('sheet-body').innerHTML = `
      <div class="searching">
        <div class="radar"><i></i><i></i><span>${profile.avatar}</span></div>
        <h3>Finding players…</h3>
        <p class="muted" id="queue-text">Looking for opponents online</p>
        <div class="row-actions">
          <button class="btn-ghost" id="q-cancel">Cancel</button>
          <button class="btn" id="q-bot">Play vs computer instead</button>
        </div>
      </div>`;
    $('q-cancel').onclick = () => { socket.emit('quick:cancel'); openSheet(id); };
    $('q-bot').onclick = () => { socket.emit('quick:cancel'); queueGame = null; socket.emit('room:create', { gameId: id, ...profile, solo: true, bots: 1, level: sheetOpts.level }); };
  }
  socket.on('queue', ({ gameId, waiting }) => {
    if (gameId !== queueGame || !$('queue-text')) return;
    $('queue-text').textContent = waiting > 1 ? `${waiting} players found — starting soon…` : 'Waiting for another player… share the site with a friend!';
  });

  // ---------------- join with code ----------------
  $('btn-join-code').onclick = () => { $('code-input').value = ''; openModal('code-modal'); setTimeout(() => $('code-input').focus(), 50); };
  $('code-go').onclick = () => {
    const code = $('code-input').value.trim().toUpperCase();
    if (code.length !== 5) return toast('Room codes have 5 characters');
    closeModal('code-modal');
    location.hash = `#/r/${code}`;
  };
  $('code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('code-go').click(); });

  // ---------------- routing ----------------
  function show(view) {
    $('view-home').classList.toggle('hidden', view !== 'home');
    $('view-room').classList.toggle('hidden', view !== 'room');
    document.body.classList.toggle('in-room', view === 'room');
  }
  function route() {
    const h = location.hash || '#/';
    let m;
    if ((m = h.match(/^#\/r\/([A-Za-z0-9]{5})/))) {
      const code = m[1].toUpperCase();
      $('game-sheet').classList.add('hidden');
      if (!room || room.code !== code) {
        show('room');
        $('stage').innerHTML = '<div class="stage-loading"><div class="spinner"></div>Joining room…</div>';
        socket.emit('room:join', { code, ...profile, playerId: store.get('player:' + code) });
      }
      return;
    }
    if (room) leaveRoom(false);
    show('home');
    if ((m = h.match(/^#\/g\/(\w+)/))) openSheet(m[1]);
    else $('game-sheet').classList.add('hidden');
  }
  window.addEventListener('hashchange', route);

  function leaveRoom(navigate = true) {
    socket.emit('room:leave');
    unmountGame();
    room = null; myId = null; resultShownFor = null;
    $('chat-list').innerHTML = '';
    closeModal('result-modal');
    if (navigate) location.hash = '#/';
  }
  $('room-back').onclick = () => {
    const g = room && room.game;
    if (g && !g.result && room.kind !== 'solo' && !confirm('Leave this game? In 2-player games this counts as a loss.')) return;
    leaveRoom();
  };

  // ---------------- room ----------------
  socket.on('joined', ({ code, playerId }) => {
    myId = playerId;
    store.set('player:' + code, playerId);
    $('game-sheet').classList.add('hidden');
    queueGame = null;
    if (location.hash !== `#/r/${code}`) history.pushState(null, '', `#/r/${code}`);
    show('room');
    window.Sound.play('join');
  });

  socket.on('room', (r) => {
    const fresh = !room || room.code !== r.code;
    room = r;
    if (fresh) { resultShownFor = null; $('chat-list').innerHTML = ''; }
    show('room');
    const g = registry[r.gameId];
    $('room-game-name').textContent = g ? g.name : r.gameId;
    $('room-game-icon').innerHTML = g && g.icon ? g.icon : '🎮';
    $('room-sub').textContent = r.kind === 'solo' ? 'vs Computer' : r.kind === 'quick' ? 'Quick match' : `Room ${r.code}`;
    renderPlayers();
    if (!r.game) {
      unmountGame();
      renderLobby();
      closeModal('result-modal');
      return;
    }
    mountGame();
    instance.update(r);
    maybeShowResult();
  });

  function mountGame() {
    const key = `${room.code}:${room.gameId}`;
    if (instance && mountedFor === key) return;
    unmountGame();
    const g = registry[room.gameId];
    $('stage').innerHTML = '';
    const el = document.createElement('div');
    el.className = `game-root game-${room.gameId}`;
    $('stage').appendChild(el);
    instance = g.mount(el, {
      send: (action) => socket.emit('game:action', action),
      signal: (data) => socket.volatile.emit('room:signal', data),
      me: () => myId,
      room: () => room,
      toast,
      sound: (n) => window.Sound.play(n),
      playerName: (id) => (room.players.find((p) => p.id === id) || {}).name || '?',
      player: (id) => room.players.find((p) => p.id === id) || { name: '?', avatar: '❔' },
    });
    mountedFor = key;
  }
  function unmountGame() {
    if (instance && instance.destroy) instance.destroy();
    instance = null; mountedFor = null;
  }
  socket.on('signal', ({ from, data }) => { if (instance && instance.onSignal) instance.onSignal(from, data); });

  function renderPlayers() {
    const g = room.game;
    const reg = registry[room.gameId];
    $('player-list').innerHTML = room.players.map((p) => {
      const turn = g && !g.result && g.turn === p.id;
      const badge = g && reg && reg.playerBadge ? reg.playerBadge(g, p) : '';
      return `<li class="${turn ? 'turn' : ''} ${p.connected || p.bot ? '' : 'offline'}">
        <span class="av">${esc(p.avatar || '🙂')}</span>
        <span class="pname"><b>${esc(p.name)}</b>${p.id === myId ? ' <em>(you)</em>' : ''}
          <small>${p.bot ? `Computer · ${p.level === 'easy' ? 'Easy' : 'Hard'}` : p.id === room.hostId ? 'Host' : p.connected ? 'Online' : 'Away'}</small></span>
        ${badge ? `<span class="pbadge">${badge}</span>` : ''}
        ${turn ? '<span class="turn-dot" title="Their turn"></span>' : ''}
      </li>`;
    }).join('');
  }

  function renderLobby() {
    const g = registry[room.gameId];
    const isHost = myId === room.hostId;
    const link = `${location.origin}${location.pathname}#/r/${room.code}`;
    const seats = [];
    for (let i = 0; i < room.maxPlayers; i++) {
      const p = room.players[i];
      if (p) {
        seats.push(`<div class="seat-card"><span class="av big">${esc(p.avatar)}</span><b>${esc(p.name)}${p.id === myId ? ' (you)' : ''}</b>
          <small>${p.bot ? 'Computer · ' + (p.level === 'easy' ? 'Easy' : 'Hard') : p.id === room.hostId ? 'Host' : 'Ready'}</small>
          ${p.bot && isHost ? `<button class="seat-x" data-rm="${p.id}" aria-label="Remove">✕</button>` : ''}</div>`);
      } else {
        seats.push(`<div class="seat-card empty">${isHost ? '<button class="add-bot">＋ Add computer</button>' : '<span class="waiting-dots">Waiting<i>.</i><i>.</i><i>.</i></span>'}</div>`);
      }
    }
    const enough = room.players.length >= room.minPlayers;
    $('stage').innerHTML = `
      <div class="lobby" style="--accent:${g ? g.accent : '#7c3aed'}">
        <div class="lobby-head">
          <div class="lobby-art">${g && g.art ? g.art() : ''}</div>
          <p class="eyebrow">Invite friends with this code</p>
          <div class="room-code">${room.code}</div>
          <div class="invite"><input readonly value="${link}" id="invite-link"><button class="btn" id="copy-link">Copy link</button>${navigator.share ? '<button class="btn-ghost" id="share-link">Share</button>' : ''}</div>
        </div>
        <div class="seat-grid">${seats.join('')}</div>
        ${isHost ? `
          <div class="lobby-foot">
            <span class="seg" id="lobby-level"><button data-v="easy">Easy bots</button><button data-v="hard" class="on">Hard bots</button></span>
            <button class="btn big" id="start-game" ${enough ? '' : 'disabled'}>${enough ? 'Start game' : `Waiting for players (${room.players.length}/${room.minPlayers})`}</button>
          </div>` : '<p class="muted center">The host will start the game when everyone is here.</p>'}
      </div>`;
    $('copy-link').onclick = async () => {
      try { await navigator.clipboard.writeText(link); toast('Invite link copied'); } catch { $('invite-link').select(); }
    };
    if ($('share-link')) $('share-link').onclick = () => navigator.share({ title: `Play ${g ? g.name : ''} on Divoxe Games`, url: link }).catch(() => {});
    let level = 'hard';
    if ($('lobby-level')) $('lobby-level').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      level = b.dataset.v;
      $('lobby-level').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    };
    $('stage').querySelectorAll('.add-bot').forEach((b) => (b.onclick = () => socket.emit('room:addBot', { level })));
    $('stage').querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => socket.emit('room:removeBot', { id: b.dataset.rm })));
    if ($('start-game')) $('start-game').onclick = () => socket.emit('room:start');
  }

  // ---------------- results ----------------
  function maybeShowResult() {
    const g = room.game;
    if (!g.result) { closeModal('result-modal'); resultShownFor = null; return; }
    const key = room.code + ':' + JSON.stringify(g.result) + ':' + (g.seq || g.moves?.length || g.lastShot?.n || '');
    if (resultShownFor === key) return;
    resultShownFor = key;
    const waitIdle = () => {
      if (instance && instance.busy && instance.busy()) return setTimeout(waitIdle, 200);
      setTimeout(showResult, 600);
    };
    waitIdle();
  }
  function showResult() {
    if (!room || !room.game || !room.game.result) return;
    const res = room.game.result;
    const won = res.winners.includes(myId);
    const draw = res.winners.length === 0;
    const names = res.winners.map((id) => (room.players.find((p) => p.id === id) || {}).name || '?');
    $('result-emoji').textContent = draw ? '🤝' : won ? '🏆' : '😔';
    $('result-title').textContent = draw ? "It's a draw" : won ? 'You win!' : `${names.join(' & ')} wins`;
    $('result-text').textContent = res.text || '';
    $('result-standings').innerHTML = room.players.map((p) => `
      <li class="${res.winners.includes(p.id) ? 'win' : ''}"><span class="av">${esc(p.avatar)}</span><span>${esc(p.name)}${p.id === myId ? ' (you)' : ''}</span>
      <small>${res.winners.includes(p.id) ? 'Winner' : ''}</small></li>`).join('');
    const isHost = myId === room.hostId;
    $('result-again').classList.toggle('hidden', !isHost);
    $('result-wait').classList.toggle('hidden', isHost);
    openModal('result-modal');
    window.Sound.play(draw ? 'turn' : won ? 'win' : 'lose');
    if (won) confetti();
  }
  $('result-again').onclick = () => socket.emit('room:start');
  $('result-close').onclick = () => closeModal('result-modal');
  $('result-leave').onclick = () => leaveRoom();

  function confetti() {
    const box = $('confetti');
    const colors = ['#8b5cf6', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#fff'];
    box.innerHTML = Array.from({ length: 100 }, (_, i) =>
      `<i style="left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-duration:${2 + Math.random() * 2.5}s;animation-delay:${Math.random() * 0.7}s;${i % 3 ? '' : 'border-radius:50%;'}"></i>`).join('');
    setTimeout(() => (box.innerHTML = ''), 6000);
  }

  // ---------------- chat ----------------
  $('reactions').innerHTML = REACTIONS.map((r) => `<button type="button">${r}</button>`).join('');
  $('reactions').onclick = (e) => { const b = e.target.closest('button'); if (b) socket.emit('chat', b.textContent); };
  $('chat-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('chat-input').value.trim();
    if (v) socket.emit('chat', v);
    $('chat-input').value = '';
  };
  socket.on('chat', ({ id, name, avatar, text }) => {
    const li = document.createElement('li');
    li.className = id === myId ? 'mine' : '';
    li.innerHTML = `<span class="av sm">${esc(avatar || '🙂')}</span><div><b>${esc(name)}</b><p>${esc(text)}</p></div>`;
    $('chat-list').appendChild(li);
    $('chat-list').scrollTop = $('chat-list').scrollHeight;
    if (id !== myId) {
      window.Sound.play('chat');
      if (document.body.classList.contains('side-closed') || window.innerWidth < 1000 && !document.body.classList.contains('side-open')) {
        $('chat-dot').classList.remove('hidden');
        toast(`${name}: ${text}`);
      }
      if (instance && instance.onChat) instance.onChat(id, text);
    }
  });

  $('btn-side').onclick = () => {
    if (window.innerWidth < 1000) document.body.classList.toggle('side-open');
    else document.body.classList.toggle('side-closed');
    $('chat-dot').classList.add('hidden');
  };
  function syncSound() { $('btn-sound').textContent = window.Sound.isMuted() ? '🔇' : '🔊'; }
  $('btn-sound').onclick = () => { window.Sound.setMuted(!window.Sound.isMuted()); syncSound(); };
  syncSound();

  socket.on('error_msg', (m) => {
    toast(m);
    if (/not found|already started|full|private game/i.test(m) && location.hash.startsWith('#/r/') && !room) {
      setTimeout(() => { location.hash = '#/'; }, 300);
    }
  });
  socket.on('connect', () => {
    // Re-attach to our room after a dropped connection
    if (room) socket.emit('room:join', { code: room.code, ...profile, playerId: store.get('player:' + room.code) });
  });

  // ---------------- boot ----------------
  (async () => {
    for (const m of MANIFEST) for (const f of m.files) await loadFile(f);
    renderGrid();
    route();
  })();
})();
