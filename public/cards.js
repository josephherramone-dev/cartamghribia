/* Card artwork, avatars and sounds — shared by the client. */
(function () {
  const SUITS = {
    dheb:   { label: 'Dheb',   ar: 'ذهب',   color: '#a87510' },
    kass:   { label: 'Kass',   ar: 'كاس',   color: '#b3202a' },
    syouf:  { label: 'Syouf',  ar: 'سيوف',  color: '#1f4e8c' },
    zrawet: { label: 'Zrawet', ar: 'زرواط', color: '#2f6b2f' },
  };
  const FACES = {
    10: { label: 'SOTA', ar: 'صوطة' },
    11: { label: 'CABALLO', ar: 'عود' },
    12: { label: 'REY', ar: 'ري' },
  };

  // Pip positions (x, y) in the 100×150 card for ranks 1–7
  const PIPS = {
    1: [[50, 75]],
    2: [[50, 46], [50, 104]],
    3: [[50, 40], [50, 75], [50, 110]],
    4: [[33, 48], [67, 48], [33, 102], [67, 102]],
    5: [[33, 45], [67, 45], [50, 75], [33, 105], [67, 105]],
    6: [[33, 42], [67, 42], [33, 75], [67, 75], [33, 108], [67, 108]],
    7: [[33, 40], [67, 40], [50, 58], [33, 80], [67, 80], [33, 110], [67, 110]],
  };

  const use = (id, x, y, size) =>
    `<use href="#${id}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"/>`;

  function faceArt(rank, suit, color) {
    const arch = `<path d="M24 128 V62 Q24 40 50 30 Q76 40 76 62 V128 Z" fill="${color}" fill-opacity=".09" stroke="${color}" stroke-width="1.4"/>
      <path d="M29 128 V64 Q29 45 50 36 Q71 45 71 64 V128" fill="none" stroke="#d6a93a" stroke-width=".9" stroke-dasharray="3 2"/>`;
    let figure = '';
    if (rank === 12) {
      figure = `<path d="M36 58 L39 44 L45 52 L50 40 L55 52 L61 44 L64 58 Z" fill="url(#g-gold)" stroke="#7a5a0c" stroke-width="1"/>
        <rect x="36" y="58" width="28" height="4" rx="1" fill="url(#g-gold)" stroke="#7a5a0c" stroke-width=".8"/>
        <circle cx="50" cy="51" r="2" fill="${color}"/>`;
    } else if (rank === 11) {
      figure = `<text x="50" y="66" text-anchor="middle" font-size="30" fill="${color}" font-family="serif">♞</text>`;
    } else {
      figure = `<circle cx="50" cy="45" r="6" fill="${color}" fill-opacity=".85"/>
        <path d="M38 66 Q50 50 62 66 Z" fill="${color}" fill-opacity=".85"/>
        <path d="M43 40 Q50 33 57 40" stroke="url(#g-gold)" stroke-width="2.5" fill="none"/>`;
    }
    const f = FACES[rank];
    return `${arch}${figure}${use('s-' + suit, 50, 92, 34)}
      <text x="50" y="121" text-anchor="middle" font-size="${f.label.length > 5 ? 6.6 : 8.5}" font-family="Reem Kufi, sans-serif" fill="${color}" letter-spacing="${f.label.length > 5 ? .4 : 1}">${f.label}</text>`;
  }

  /** Face-up card as an SVG string. */
  function cardSVG(card) {
    const s = SUITS[card.suit];
    const c = s.color;
    let center;
    if (card.rank >= 10) center = faceArt(card.rank, card.suit, c);
    else {
      const size = card.rank === 1 ? 52 : card.rank <= 3 ? 30 : 24;
      center = PIPS[card.rank].map(([x, y]) => use('s-' + card.suit, x, y, size)).join('');
      if (card.rank === 1) {
        center = `<circle cx="50" cy="75" r="34" fill="${c}" fill-opacity=".07" stroke="${c}" stroke-opacity=".35" stroke-dasharray="2 3"/>` + center;
      }
    }
    const corner = `<text x="12" y="23" text-anchor="middle" font-family="Reem Kufi, sans-serif" font-weight="700" font-size="17" fill="${c}">${card.rank}</text>
      ${use('s-' + card.suit, 12, 33, 11)}`;
    return `<svg class="card-svg" viewBox="0 0 100 150" role="img" aria-label="${card.rank} of ${s.label}">
      <rect x="1" y="1" width="98" height="148" rx="9" fill="#fffaf0" stroke="#d9c9a3" stroke-width="1.2"/>
      <rect x="5.5" y="5.5" width="89" height="139" rx="6" fill="none" stroke="${c}" stroke-opacity=".45" stroke-width="1"/>
      ${center}
      <g>${corner}</g>
      <g transform="rotate(180 50 75)">${corner}</g>
    </svg>`;
  }

  /** Face-down card back (zellige). */
  function backSVG() {
    return `<svg class="card-svg" viewBox="0 0 100 150" aria-hidden="true">
      <rect x="1" y="1" width="98" height="148" rx="9" fill="#fffaf0" stroke="#d9c9a3"/>
      <rect x="6" y="6" width="88" height="138" rx="6" fill="url(#zellige)" stroke="#e2b54a" stroke-width="2"/>
      <circle cx="50" cy="75" r="17" fill="#fffaf0" stroke="#e2b54a" stroke-width="2"/>
      <g fill="#c1272d" stroke="#0f5132" stroke-width=".8" transform="translate(50 75)">
        <rect x="-8" y="-8" width="16" height="16"/><rect x="-8" y="-8" width="16" height="16" transform="rotate(45)"/>
      </g>
      <circle cx="50" cy="75" r="3" fill="#e2b54a"/>
    </svg>`;
  }

  function makeCard(card, extra = '') {
    const el = document.createElement('div');
    el.className = `card ${card ? 'suit-' + card.suit : 'back'} ${extra}`;
    el.innerHTML = card ? cardSVG(card) : backSVG();
    if (card) el.dataset.id = card.id;
    return el;
  }

  // ---------- avatars ----------
  const AVATAR_COLORS = ['#b3202a', '#0f5132', '#1f4e8c', '#a8641c', '#6b2d5c', '#2f6b2f'];
  function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
  function avatarHTML(player) {
    if (player.bot) return `<div class="avatar bot"><svg viewBox="0 0 40 40"><use href="#fez"/></svg></div>`;
    const initials = player.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const color = AVATAR_COLORS[hash(player.name) % AVATAR_COLORS.length];
    return `<div class="avatar" style="--av:${color}"><span>${escapeHTML(initials)}</span></div>`;
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- sounds (synthesised, no files) ----------
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('muted') === '1'; } catch {}
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(dur, freq, gain) {
    const a = audio(); if (!a) return;
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  // Plucked, oud-like note
  function pluck(freq, when = 0, dur = .6, vol = .18) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    const g2 = a.createGain(); g2.gain.value = .3;
    o.connect(g); o2.connect(g2).connect(g); g.connect(a.destination);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }
  // Hijaz maqam on D: D Eb F# G A Bb C D
  const HIJAZ = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];
  const sounds = {
    play: () => noise(.12, 1800, .5),
    draw: () => noise(.09, 900, .35),
    turn: () => { pluck(HIJAZ[0], 0, .5); pluck(HIJAZ[2], .12, .7); },
    hezz: () => { pluck(HIJAZ[1] / 2, 0, .4, .22); pluck(HIJAZ[0] / 2, .1, .6, .22); },
    win: () => [0, 1, 2, 3, 4, 3, 2, 4, 7].forEach((n, i) => pluck(HIJAZ[n], i * .13, .7)),
    lose: () => [4, 3, 2, 1, 0].forEach((n, i) => pluck(HIJAZ[n] / 2, i * .16, .8)),
  };
  function sound(name) { if (!muted && sounds[name]) sounds[name](); }
  function setMuted(m) { muted = m; try { localStorage.setItem('muted', m ? '1' : '0'); } catch {} }

  // Standalone card back (data URI) for CSS backgrounds: draw pile and opponents' cards
  const standaloneBack = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><defs>
    <pattern id="z" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#8e1b22"/>
    <g transform="translate(12 12)" fill="#0f5132" stroke="#e2b54a" stroke-width=".8"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g>
    <circle cx="12" cy="12" r="2.2" fill="#f4e7c8"/></pattern></defs>
    <rect x="1" y="1" width="98" height="148" rx="9" fill="#fffaf0" stroke="#d9c9a3"/>
    <rect x="6" y="6" width="88" height="138" rx="6" fill="url(#z)" stroke="#e2b54a" stroke-width="2"/>
    <circle cx="50" cy="75" r="17" fill="#fffaf0" stroke="#e2b54a" stroke-width="2"/>
    <g fill="#c1272d" stroke="#0f5132" stroke-width=".8" transform="translate(50 75)"><rect x="-8" y="-8" width="16" height="16"/><rect x="-8" y="-8" width="16" height="16" transform="rotate(45)"/></g>
    <circle cx="50" cy="75" r="3" fill="#e2b54a"/></svg>`;
  document.documentElement.style.setProperty('--back-img', `url("data:image/svg+xml,${encodeURIComponent(standaloneBack)}")`);

  window.Carta = { SUITS, FACES, cardSVG, backSVG, makeCard, avatarHTML, escapeHTML, sound, setMuted, isMuted: () => muted, unlockAudio: audio };
})();
