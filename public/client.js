const socket = io();

const SUITS = {
  dheb: { label: 'Dheb', icon: '🪙', cls: 'dheb' },
  syouf: { label: 'Syouf', icon: '🗡️', cls: 'syouf' },
  kass: { label: 'Kass', icon: '🏆', cls: 'kass' },
  zrawet: { label: 'Zrawet', icon: '🪵', cls: 'zrawet' },
};

const $ = (id) => document.getElementById(id);
let state = null; // latest room payload
let pendingSeven = null; // card id waiting for suit choice

// ---------- helpers ----------
function show(screen) {
  for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  $(screen).classList.remove('hidden');
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function savedName() {
  try { return localStorage.getItem('name') || ''; } catch { return ''; }
}
function saveName(n) { try { localStorage.setItem('name', n); } catch {} }
function getToken(code) { try { return localStorage.getItem('player:' + code); } catch { return null; } }
function setToken(code, id) { try { localStorage.setItem('player:' + code, id); } catch {} }

function cardEl(card, extraClass = '') {
  const s = SUITS[card.suit];
  const el = document.createElement('div');
  el.className = `card ${s.cls} ${extraClass}`;
  el.innerHTML = `<span class="corner">${card.rank}</span><span class="icon">${s.icon}</span><span class="corner br">${card.rank}</span>`;
  el.title = `${card.rank} of ${s.label}`;
  return el;
}

// ---------- home ----------
$('name').value = savedName();
const params = new URLSearchParams(location.search);
if (params.get('room')) $('code').value = params.get('room').toUpperCase();

function myName() {
  const n = $('name').value.trim();
  saveName(n);
  return n;
}

$('create').onclick = () => socket.emit('create_room', { name: myName() });
$('join').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (!code) return toast('Enter a room code');
  socket.emit('join_room', { code, name: myName(), playerId: getToken(code) });
};
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('join').click(); });

// Auto-rejoin after a refresh if we have a token for the room in the URL
socket.on('connect', () => {
  const code = params.get('room');
  if (code && getToken(code.toUpperCase()) && !state) {
    socket.emit('join_room', { code: code.toUpperCase(), name: myName(), playerId: getToken(code.toUpperCase()) });
  }
});

// ---------- lobby ----------
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('invite').value); toast('Link copied'); }
  catch { $('invite').select(); }
};
$('start').onclick = () => socket.emit('start_game');
$('rematch').onclick = () => socket.emit('start_game');
$('leave').onclick = () => {
  socket.emit('leave_room');
  state = null;
  history.replaceState(null, '', location.pathname);
  show('home');
};

// ---------- game actions ----------
$('draw-pile').onclick = () => {
  const g = state && state.game;
  if (!g || g.turn !== g.you || g.winner) return;
  socket.emit('draw_card');
};

function onCardClick(card) {
  const g = state.game;
  if (g.turn !== g.you) return toast('Wait for your turn');
  if (!g.playable.includes(card.id)) {
    return toast(g.pendingDraw ? `Play a 2 or draw ${g.pendingDraw}` : 'That card does not match');
  }
  if (card.rank === 7) {
    pendingSeven = card.id;
    $('suit-picker').classList.remove('hidden');
    return;
  }
  socket.emit('play_card', { cardId: card.id });
}

for (const [key, s] of Object.entries(SUITS)) {
  const b = document.createElement('button');
  b.className = `suit-btn ${s.cls}`;
  b.innerHTML = `<span>${s.icon}</span>${s.label}`;
  b.onclick = () => {
    socket.emit('play_card', { cardId: pendingSeven, suit: key });
    pendingSeven = null;
    $('suit-picker').classList.add('hidden');
  };
  $('suit-options').appendChild(b);
}
$('suit-cancel').onclick = () => { pendingSeven = null; $('suit-picker').classList.add('hidden'); };

$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  const v = $('chat-input').value.trim();
  if (v) socket.emit('chat', v);
  $('chat-input').value = '';
};

// ---------- server events ----------
socket.on('error_msg', toast);

socket.on('joined', ({ code, playerId }) => {
  setToken(code, playerId);
  history.replaceState(null, '', `?room=${code}`);
});

socket.on('chat', ({ name, text }) => {
  const li = document.createElement('li');
  li.innerHTML = '<b></b> ';
  li.querySelector('b').textContent = name + ':';
  li.append(text);
  $('chat').appendChild(li);
  $('chat').scrollTop = $('chat').scrollHeight;
});

socket.on('room', (room) => {
  state = room;
  if (!room.game) return renderLobby(room);
  renderGame(room);
});

function renderLobby(room) {
  show('lobby');
  $('winner').classList.add('hidden');
  $('lobby-code').textContent = room.code;
  $('invite').value = `${location.origin}${location.pathname}?room=${room.code}`;
  const ul = $('lobby-players');
  ul.innerHTML = '';
  for (const p of room.players) {
    const li = document.createElement('li');
    li.textContent = p.name + (p.id === room.hostId ? ' 👑' : '');
    ul.appendChild(li);
  }
  const me = getToken(room.code);
  const isHost = me === room.hostId;
  $('start').classList.toggle('hidden', !isHost);
  $('start').disabled = room.players.length < 2;
  $('start').textContent = room.players.length < 2 ? 'Need 2+ players' : 'Start game';
  $('lobby-wait').classList.toggle('hidden', isHost);
}

function renderGame(room) {
  show('game');
  const g = room.game;
  const myTurn = g.turn === g.you && !g.winner;
  const nameOf = (id) => (g.players.find((p) => p.id === id) || {}).name;

  // opponents
  const opp = $('opponents');
  opp.innerHTML = '';
  for (const p of g.players) {
    if (p.id === g.you) continue;
    const conn = (room.players.find((x) => x.id === p.id) || {}).connected;
    const div = document.createElement('div');
    div.className = 'opponent' + (g.turn === p.id ? ' active' : '') + (conn ? '' : ' offline');
    div.innerHTML = `<div class="opp-name"></div><div class="opp-cards">${'<span class="mini back"></span>'.repeat(p.cards)}</div><div class="opp-count">${p.cards} cards</div>`;
    div.querySelector('.opp-name').textContent = p.name + (conn ? '' : ' (offline)');
    opp.appendChild(div);
  }

  // table
  $('top-card').innerHTML = '';
  $('top-card').appendChild(cardEl(g.topCard));
  $('draw-count').textContent = g.drawPileCount;
  $('draw-pile').classList.toggle('clickable', myTurn);
  $('turn-label').textContent = myTurn ? 'Your turn!' : `${nameOf(g.turn)}'s turn`;
  $('turn-label').classList.toggle('mine', myTurn);
  const s = SUITS[g.currentSuit];
  $('suit-label').innerHTML = `Suit: <span class="${s.cls}">${s.icon} ${s.label}</span>`;
  $('pending-label').textContent = g.pendingDraw ? `+${g.pendingDraw} pending!` : '';

  // hand
  const hand = $('hand');
  hand.innerHTML = '';
  for (const c of g.hand) {
    const el = cardEl(c, myTurn && g.playable.includes(c.id) ? 'playable' : (myTurn ? 'dim' : ''));
    el.onclick = () => onCardClick(c);
    hand.appendChild(el);
  }

  // log
  $('log').innerHTML = '';
  for (const line of g.log) {
    const li = document.createElement('li');
    li.textContent = line;
    $('log').appendChild(li);
  }
  $('log').scrollTop = $('log').scrollHeight;

  // winner
  if (g.winner) {
    $('winner-text').textContent = g.winner === g.you ? '🎉 You win!' : `${nameOf(g.winner)} wins!`;
    const isHost = g.you === room.hostId;
    $('rematch').classList.toggle('hidden', !isHost);
    $('rematch-wait').classList.toggle('hidden', isHost);
    $('winner').classList.remove('hidden');
  } else {
    $('winner').classList.add('hidden');
  }
}
