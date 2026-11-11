/* Card artwork, avatars and sounds — shared by the client. */
(function () {
  // SVG definitions used by the card art (suits, zellige pattern, star, fez)
  const DEFS = `<defs>
      <linearGradient id="g-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f7dc7a"/><stop offset=".55" stop-color="#d9ab2e"/><stop offset="1" stop-color="#a87510"/>
      </linearGradient>
      <linearGradient id="g-steel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e9f0f8"/><stop offset=".5" stop-color="#a9bdd4"/><stop offset="1" stop-color="#6f8db0"/>
      </linearGradient>
      <linearGradient id="g-cup" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#d63a3f"/><stop offset=".6" stop-color="#b3202a"/><stop offset="1" stop-color="#7f121a"/>
      </linearGradient>
      <linearGradient id="g-wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#b47a43"/><stop offset=".6" stop-color="#8b5a2b"/><stop offset="1" stop-color="#5e3a18"/>
      </linearGradient>

      <!-- 8-pointed Moroccan star (khatam) centred on 0,0 with radius ~10 -->
      <symbol id="star8" viewBox="-10 -10 20 20" overflow="visible">
        <rect x="-7" y="-7" width="14" height="14"/>
        <rect x="-7" y="-7" width="14" height="14" transform="rotate(45)"/>
      </symbol>

      <!-- Zellige tile pattern for card backs -->
      <pattern id="zellige" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#8e1b22"/>
        <g transform="translate(12 12)" fill="#0f5132" stroke="#e2b54a" stroke-width=".8">
          <rect x="-6" y="-6" width="12" height="12"/>
          <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/>
        </g>
        <circle cx="12" cy="12" r="2.2" fill="#f4e7c8"/>
        <g fill="#f4e7c8">
          <path d="M0 -3 L3 0 L0 3 L-3 0Z"/><path d="M24 -3 L27 0 L24 3 L21 0Z"/>
          <path d="M0 21 L3 24 L0 27 L-3 24Z"/><path d="M24 21 L27 24 L24 27 L21 24Z"/>
        </g>
      </pattern>

      <!-- Suits in the traditional Spanish-deck style (flat red / blue / yellow / green) -->
      <symbol id="s-dheb" viewBox="-20 -20 40 40">
        <circle r="18.5" fill="#f4c20d" stroke="#1a1a1a" stroke-width="1.2"/>
        <circle r="15.5" fill="none" stroke="#d4231c" stroke-width="1.4"/>
        <circle r="13" fill="#f7d54a" stroke="#1a1a1a" stroke-width=".6"/>
        <g fill="#f4c20d" stroke="#d4231c" stroke-width=".9">
          <ellipse cx="0" cy="-7" rx="3.2" ry="5.6"/><ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(45)"/>
          <ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(90)"/><ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(135)"/>
          <ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(180)"/><ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(225)"/>
          <ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(270)"/><ellipse cx="0" cy="-7" rx="3.2" ry="5.6" transform="rotate(315)"/>
        </g>
        <circle r="3.6" fill="#d4231c" stroke="#1a1a1a" stroke-width=".6"/>
        <circle r="1.3" fill="#f4c20d"/>
      </symbol>
      <symbol id="s-kass" viewBox="-20 -20 40 40">
        <path d="M-14 -13 Q-14 3 -3 5.5 L-3 9 Q-10 11 -11.5 18 L11.5 18 Q10 11 3 9 L3 5.5 Q14 3 14 -13Z" fill="#f4c20d" stroke="#1a1a1a" stroke-width="1.1"/>
        <path d="M-13.8 -8 L13.8 -8 Q13.6 -4.5 12.8 -2.5 L-12.8 -2.5 Q-13.6 -4.5 -13.8 -8Z" fill="#d4231c"/>
        <path d="M-10 1.6 L10 1.6 Q7 4.5 3 5.5 L-3 5.5 Q-7 4.5 -10 1.6Z" fill="#1d5bb5"/>
        <ellipse cx="0" cy="-13" rx="14" ry="3.4" fill="#1d5bb5" stroke="#1a1a1a" stroke-width="1"/>
        <ellipse cx="0" cy="-13" rx="10" ry="1.6" fill="#0f3d80"/>
        <ellipse cx="0" cy="7.4" rx="5" ry="2" fill="#d4231c" stroke="#1a1a1a" stroke-width=".7"/>
        <path d="M-10.6 14.5 L10.6 14.5 L11.5 18 L-11.5 18Z" fill="#1d5bb5" stroke="#1a1a1a" stroke-width=".7"/>
      </symbol>
      <symbol id="s-syouf" viewBox="-8 -26 16 52">
        <path d="M0 -25.5 L2.7 -19 L2.7 11.5 L-2.7 11.5 L-2.7 -19Z" fill="#1d5bb5" stroke="#1a1a1a" stroke-width=".8"/>
        <path d="M0 -22 L0 10.5" stroke="#8fb5e8" stroke-width="1"/>
        <path d="M-7.6 11.3 Q0 14.6 7.6 11.3 L7.6 14.4 Q0 17.6 -7.6 14.4Z" fill="#f4c20d" stroke="#1a1a1a" stroke-width=".7"/>
        <rect x="-1.9" y="15.8" width="3.8" height="6" fill="#d4231c" stroke="#1a1a1a" stroke-width=".5"/>
        <circle cy="23.2" r="2.4" fill="#f4c20d" stroke="#1a1a1a" stroke-width=".6"/>
      </symbol>
      <symbol id="s-zrawet" viewBox="-8 -26 16 52">
        <g stroke="#1a1a1a" stroke-width=".6">
          <path d="M-4.6 -6 L-7.2 -8.4 L-6 -4.4Z M4.4 2 L7.2 0 L5.8 4.2Z M-4 11 L-6.8 9.4 L-5.4 13.2Z" fill="#f4c20d"/>
          <ellipse cx="-7.3" cy="-10" rx="1.2" ry="2.2" fill="#2f8f3e" transform="rotate(-25 -7.3 -10)"/>
          <ellipse cx="7.4" cy="-1.8" rx="1.2" ry="2.2" fill="#2f8f3e" transform="rotate(25 7.4 -1.8)"/>
        </g>
        <path d="M-2.6 25 L-4.4 -14 Q-7 -22 0 -25.6 Q7 -22 4.4 -14 L2.6 25Z" style="fill: var(--club, #2f8f3e)" stroke="#1a1a1a" stroke-width=".9"/>
        <path d="M-3.9 -14.5 Q0 -12.6 3.9 -14.5 M-3.5 -1 Q0 1 3.5 -1 M-3 12 Q0 13.8 3 12" stroke="#1a1a1a" stroke-width=".6" fill="none"/>
        <path d="M-1.4 -22 Q-2.6 -10 -1.2 22" stroke="#fff" stroke-opacity=".45" stroke-width="1" fill="none"/>
      </symbol>

      <!-- Fez (tarbouch) for computer players -->
      <symbol id="fez" viewBox="0 0 40 40">
        <path d="M11 30 L14 10 Q20 7 26 10 L29 30 Q20 33 11 30Z" fill="#b3202a" stroke="#6e1016" stroke-width="1.2"/>
        <ellipse cx="20" cy="10" rx="6" ry="1.8" fill="#8e1b22"/>
        <path d="M20 9 Q25 12 26 22" stroke="#1b1b1b" stroke-width="1.4" fill="none"/>
        <path d="M24.5 20 L27.5 20 L28 26 L24 26Z" fill="#1b1b1b"/>
      </symbol>
    </defs>`;
  if (!document.getElementById('carta-defs')) {
    const holder = document.createElement('div');
    holder.innerHTML = `<svg id="carta-defs" class="svg-defs" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">${DEFS}</svg>`;
    document.body.prepend(holder.firstChild);
  }

  const SUITS = {
    dheb:   { label: 'Dheb',   ar: 'ذهب',   color: '#b8860b', gaps: 0 },
    kass:   { label: 'Kass',   ar: 'كاس',   color: '#d4231c', gaps: 1 },
    syouf:  { label: 'Syouf',  ar: 'سيوف',  color: '#1d5bb5', gaps: 2 },
    zrawet: { label: 'Zrawet', ar: 'زرواط', color: '#2f8f3e', gaps: 3 },
  };
  const FACES = {
    10: { label: 'SOTA', ar: 'صوطة' },
    11: { label: 'CABALLO', ar: 'عود' },
    12: { label: 'REY', ar: 'ري' },
  };

  // Flat traditional palette
  const R = '#d4231c', B = '#1d5bb5', Y = '#f4c20d', G = '#2f8f3e', K = '#1a1a1a', S = '#f7d2b0', W = '#ffffff', BR = '#8a5a2b';
  const CLUB_COLORS = [R, B, G];
  const LONG = { syouf: true, zrawet: true };

  // Coins and cups: pip centres (x, y) and size, 100×150 card
  const PIPS = {
    1: { size: 62, at: [[50, 76]] },
    2: { size: 36, at: [[50, 44], [50, 108]] },
    3: { size: 32, at: [[50, 38], [50, 76], [50, 114]] },
    4: { size: 30, at: [[32, 46], [68, 46], [32, 106], [68, 106]] },
    5: { size: 29, at: [[32, 42], [68, 42], [50, 76], [32, 110], [68, 110]] },
    6: { size: 27, at: [[32, 40], [68, 40], [32, 76], [68, 76], [32, 112], [68, 112]] },
    7: { size: 26, at: [[32, 38], [68, 38], [50, 57], [32, 76], [68, 76], [32, 114], [68, 114]] },
  };

  const use = (id, x, y, size) =>
    `<use href="#${id}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"/>`;
  // Swords and clubs are tall (16:52); placed by centre, height and angle
  function long(suit, x, y, h, angle = 0, i = 0) {
    const w = h * 16 / 52;
    // short clubs are drawn chunkier, like the printed deck
    const widen = suit === 'zrawet' && h < 60 ? ' scale(1.55 1)' : '';
    const club = suit === 'zrawet' ? ` style="--club:${CLUB_COLORS[i % 3]}"` : '';
    return `<use href="#s-${suit}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" transform="translate(${x} ${y}) rotate(${angle})${widen}"${club}/>`;
  }

  // Swords and clubs, arranged as on the Spanish deck
  function longPips(suit, n) {
    if (n === 1) return long(suit, 50, 76, 122, -24, 0);
    const X = (x, y, h, a, i) => long(suit, x, y, h, a, i) + long(suit, x, y, h, -a, i + 1);
    if (n === 2) return suit === 'syouf' ? long(suit, 38, 76, 112, 0) + long(suit, 62, 76, 112, 0) : X(50, 76, 112, 22, 0);
    if (n === 3) return suit === 'syouf'
      ? long(suit, 30, 76, 110, 0) + long(suit, 50, 76, 110, 0) + long(suit, 70, 76, 110, 0)
      : X(50, 76, 112, 22, 0) + long(suit, 50, 76, 112, 0, 2);

    if (suit === 'syouf') {
      // crossed pair in the middle with straight swords around it
      const xs = { 4: [24, 76], 5: [22, 50, 78], 6: [17, 31, 69, 83], 7: [17, 31, 50, 69, 83] }[n];
      return X(50, 76, 104, n >= 6 ? 12 : 16, 0) + xs.map((x) => long(suit, x, 76, n >= 6 ? 98 : 104, 0)).join('');
    }
    // clubs: short ones in rows
    if (n === 4) return [[34, 46, 14], [66, 46, -14], [34, 106, -14], [66, 106, 14]].map(([x, y, a], i) => long(suit, x, y, 52, a, i)).join('');
    if (n === 5) return [[32, 44, 14], [68, 44, -14], [32, 108, -14], [68, 108, 14]].map(([x, y, a], i) => long(suit, x, y, 50, a, i)).join('')
      + long(suit, 50, 76, 50, 90, 4);
    const pos = n === 6
      ? [[32, 38], [68, 38], [32, 76], [68, 76], [32, 114], [68, 114]]
      : [[28, 38], [72, 38], [28, 76], [72, 76], [28, 114], [72, 114], [50, 76]];
    return pos.map(([x, y], i) => long(suit, x, y, 40, 0, i)).join('');
  }

  function shortPips(suit, n) {
    const p = PIPS[n];
    let extra = '';
    if (n === 1 && suit === 'dheb') {
      // ribbon behind the ace of coins
      extra = `<path d="M10 70 L90 70 L86 76 L90 82 L10 82 L14 76Z" fill="${B}" stroke="${K}" stroke-width=".8"/>
        <path d="M10 70 L90 70" stroke="${W}" stroke-opacity=".5"/>`;
    }
    return extra + p.at.map(([x, y]) => use('s-' + suit, x, y, p.size)).join('');
  }

  // What a figure holds: coins/cups in the hand, swords/clubs over the shoulder
  function held(suit, short, longArgs) {
    return LONG[suit] ? long(suit, ...longArgs) : use('s-' + suit, ...short);
  }

  const face = (cx, cy, hair = Y) => `
    <ellipse cx="${cx}" cy="${cy}" rx="7.5" ry="8.5" fill="${S}"/>
    <circle cx="${cx - 2.8}" cy="${cy - .5}" r=".9" fill="${K}" stroke="none"/><circle cx="${cx + 2.8}" cy="${cy - .5}" r=".9" fill="${K}" stroke="none"/>
    <path d="M${cx} ${cy} L${cx - .8} ${cy + 3} L${cx + .6} ${cy + 3}" fill="none" stroke-width=".6"/>
    <path d="M${cx - 2} ${cy + 5} Q${cx} ${cy + 6} ${cx + 2} ${cy + 5}" fill="none" stroke="${R}" stroke-width=".8"/>
    <path d="M${cx - 7.6} ${cy - 1} Q${cx - 8} ${cy - 10} ${cx} ${cy - 10} Q${cx + 8} ${cy - 10} ${cx + 7.6} ${cy - 1} Q${cx + 6} ${cy - 6} ${cx} ${cy - 6} Q${cx - 6} ${cy - 6} ${cx - 7.6} ${cy - 1}Z" fill="${hair}"/>
    <path d="M${cx - 7.4} ${cy - 2} Q${cx - 9.5} ${cy + 6} ${cx - 5.5} ${cy + 9} L${cx - 5} ${cy + 1}Z" fill="${hair}"/>
    <path d="M${cx + 7.4} ${cy - 2} Q${cx + 9.5} ${cy + 6} ${cx + 5.5} ${cy + 9} L${cx + 5} ${cy + 1}Z" fill="${hair}"/>`;

  function sota(suit) {
    return `<g stroke="${K}" stroke-width=".9" stroke-linejoin="round">
      ${LONG[suit] ? held(suit, null, [70, 58, 82, 16, 1]) : ''}
      <path d="M43 111 L42 135 L48 135 L49 111Z" fill="${R}"/>
      <path d="M51 111 L52 135 L58 135 L57 111Z" fill="${Y}"/>
      <path d="M41 135 L49 135 L49 139 L37 139 Q37 136 41 135Z" fill="${K}"/>
      <path d="M51 135 L59 135 Q63 136 63 139 L51 139Z" fill="${K}"/>
      <path d="M38 64 Q50 60 62 64 L67 111 Q50 116 33 111Z" fill="${B}"/>
      <path d="M33.6 106 Q50 111 66.4 106 L67 111 Q50 116 33 111Z" fill="${Y}"/>
      <path d="M50 63 L50 108" stroke="${Y}" stroke-width="2.2"/>
      <path d="M36.6 87 Q50 90.5 63.4 87 L63.8 91.5 Q50 95 36.2 91.5Z" fill="${Y}"/>
      <path d="M38.5 65 Q30 78 33 91 L38.5 90 Q36.5 80 41 71Z" fill="${R}"/>
      <circle cx="35.5" cy="92" r="3" fill="${S}"/>
      <path d="M61.5 65 Q71 69 72 80 L66.5 82 Q65.5 74 59 71Z" fill="${R}"/>
      <circle cx="70" cy="83" r="3.2" fill="${S}"/>
      <rect x="47" y="55" width="6" height="7" fill="${S}"/>
      <path d="M42 62 Q50 68 58 62 L56 59.5 Q50 64 44 59.5Z" fill="${W}"/>
      ${face(50, 47)}
      <path d="M37 39 Q50 32 63 37 L61 40.5 Q50 36.5 39 41.5Z" fill="${R}"/>
      <path d="M43 37.5 Q44 27 52 28 Q58 29 57.5 36 Q50 34.5 43 37.5Z" fill="${R}"/>
      <path d="M56 31 Q66 21 71 25 Q64 26.5 58.5 34Z" fill="${Y}"/>
      ${LONG[suit] ? '' : held(suit, [72, 80, 24])}
    </g>`;
  }

  function caballo(suit) {
    return `<g stroke="${K}" stroke-width=".9" stroke-linejoin="round">
      ${LONG[suit] ? held(suit, null, [34, 40, 70, -22, 2]) : ''}
      <path d="M83 92 Q93 97 90 118 Q86 105 81 100Z" fill="${Y}"/>
      <path d="M66 106 L63 132 L68.5 132 L71 106Z" fill="${B}"/>
      <path d="M74 104 L79 129 L84.5 128 L79 102Z" fill="${B}"/>
      <path d="M28 95 Q30 83 46 83 L70 83 Q85 85 85 97 Q85 110 72 110 L40 110 Q28 108 28 95Z" fill="${B}"/>
      <path d="M36 107 L33 132 L38.5 132 L41.5 107Z" fill="${B}"/>
      <path d="M44 108 L46 132 L51.5 132 L49.5 108Z" fill="${B}"/>
      <path d="M32.5 132 L39 132 L39 135 L32 135Z M45.5 132 L52 132 L52 135 L45.5 135Z M63 132 L69 132 L69 135 L62.5 135Z M79 129 L85 128 L85.5 131 L79.5 132Z" fill="${K}"/>
      <path d="M35 93 Q29 79 27 67 Q25 58 18.5 60 Q12 62 13 68.5 Q14 73 20 73 Q24 75 26 85 Q28 93 34 99Z" fill="${B}"/>
      <path d="M26.5 60.5 Q33 67 35 80 L31 83 Q29 71 24.5 62.5Z" fill="${Y}"/>
      <circle cx="19" cy="64.5" r="1" fill="${K}"/>
      <path d="M14 68 L18 69" stroke-width=".6"/>
      <path d="M17 70 Q23 72 26 66" fill="none" stroke="${R}" stroke-width="1.4"/>
      <path d="M45 83 L71 83 L73 104 Q58 108 43 104Z" fill="${R}"/>
      <path d="M43.6 100 Q58 104 72.6 100 L73 104 Q58 108 43 104Z" fill="${Y}"/>
      <path d="M54 87 L52 103 L57.5 105 L60.5 89Z" fill="${Y}"/>
      <path d="M50 102 L58 104 L57 108 L48.5 107Z" fill="${K}"/>
      <path d="M48 61 Q56 57 64 61 L65 88 Q56 91 47 88Z" fill="${R}"/>
      <path d="M47.4 80 Q56 83 64.6 80 L64.8 84 Q56 87 47.2 84Z" fill="${Y}"/>
      <path d="M62 63 Q69 70 66 80 L62 78 Q64 71 59 67Z" fill="${Y}"/>
      <path d="M50 63 Q42 65 38 57 L42.5 54.5 Q46 60.5 52 59.5Z" fill="${Y}"/>
      <circle cx="39.5" cy="55" r="3" fill="${S}"/>
      <rect x="53" y="53" width="6" height="6" fill="${S}"/>
      ${face(56, 46)}
      <path d="M45 41 Q56 31 67 41 Q56 37.5 45 41Z" fill="${B}"/>
      <path d="M44 41 L68 41 L66 43.5 L46 43.5Z" fill="${B}"/>
      ${LONG[suit] ? '' : held(suit, [38, 47, 22])}
    </g>`;
  }

  function rey(suit) {
    return `<g stroke="${K}" stroke-width=".9" stroke-linejoin="round">
      ${LONG[suit] ? held(suit, null, [30, 62, 74, 0, 0]) : ''}
      <path d="M34 66 Q50 58 66 66 L75 138 L25 138Z" fill="${R}"/>
      <path d="M25.5 133 L74.5 133 L75 138 L25 138Z" fill="${Y}"/>
      <path d="M44.5 66 L55.5 66 L60.5 133 L39.5 133Z" fill="${B}"/>
      <path d="M44.5 66 L39.5 133 M55.5 66 L60.5 133" stroke="${Y}" stroke-width="2.6"/>
      <path d="M42 92 L58 92 L58.4 96.5 L41.6 96.5Z" fill="${Y}"/>
      <path d="M36 68 Q27 80 29 95 L35.5 95 Q34 83 40 74Z" fill="${R}"/>
      <path d="M29 92 L35.6 92" stroke="${Y}" stroke-width="2"/>
      <circle cx="32" cy="97.5" r="3.2" fill="${S}"/>
      <path d="M64 68 Q71 82 63 91 L58.5 87 Q63 80 60 72Z" fill="${R}"/>
      <circle cx="58.5" cy="89" r="3" fill="${S}"/>
      <rect x="47" y="55" width="6" height="7" fill="${S}"/>
      <path d="M39 64 Q50 73 61 64 L58.5 60.5 Q50 67 41.5 60.5Z" fill="${Y}"/>
      ${face(50, 47, BR)}
      <path d="M42.5 49 Q43 62 50 63.5 Q57 62 57.5 49 Q55 55.5 50 55.5 Q45 55.5 42.5 49Z" fill="${BR}"/>
      <path d="M47 53 Q50 51.5 53 53" fill="none" stroke-width=".7"/>
      <path d="M41 39.5 L40.5 28 L45 33.5 L50 25 L55 33.5 L59.5 28 L59 39.5Z" fill="${Y}"/>
      <rect x="40.5" y="37" width="19" height="4.2" fill="${Y}"/>
      <circle cx="45" cy="39.1" r="1.2" fill="${R}" stroke="none"/><circle cx="50" cy="39.1" r="1.2" fill="${B}" stroke="none"/><circle cx="55" cy="39.1" r="1.2" fill="${R}" stroke="none"/>
      <circle cx="50" cy="25" r="1.4" fill="${R}"/>
      ${LONG[suit] ? '' : held(suit, [31, 104, 24])}
    </g>`;
  }

  /** Face-up card as an SVG string, drawn in the Spanish-deck style. */
  function cardSVG(card) {
    const s = SUITS[card.suit];
    let art;
    if (card.rank === 10) art = sota(card.suit);
    else if (card.rank === 11) art = caballo(card.suit);
    else if (card.rank === 12) art = rey(card.suit);
    else art = LONG[card.suit] ? longPips(card.suit, card.rank) : shortPips(card.suit, card.rank);

    // Gaps ("pausas") in the frame line tell the suit: coins 0, cups 1, swords 2, clubs 3
    const gapX = { 0: [], 1: [50], 2: [42, 58], 3: [36, 50, 64] }[s.gaps];
    const gaps = gapX.map((x) => `<rect x="${x - 3.5}" y="4" width="7" height="4" fill="${W}"/><rect x="${x - 3.5}" y="142" width="7" height="4" fill="${W}"/>`).join('');
    const idx = (x, y) => `<rect x="${x - 7}" y="${y - 12}" width="14" height="15" fill="${W}"/>
      <text x="${x}" y="${y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="12" fill="${K}">${card.rank}</text>`;
    return `<svg class="card-svg" viewBox="0 0 100 150" role="img" aria-label="${card.rank} of ${s.label}">
      <rect x="1" y="1" width="98" height="148" rx="8" fill="${W}" stroke="#cfcfcf" stroke-width="1"/>
      <rect x="6" y="6" width="88" height="138" rx="2" fill="none" stroke="${K}" stroke-width=".9"/>
      ${gaps}
      ${art}
      ${idx(13, 17)}${idx(87, 143)}
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

  // Real card images (public/cards/), when provided, replace the drawn artwork
  let images = { cards: {}, back: null };
  function setImages(manifest) {
    images = { cards: (manifest && manifest.cards) || {}, back: (manifest && manifest.back) || null };
    if (images.back) document.documentElement.style.setProperty('--back-img', `url("${images.back}")`);
  }

  function makeCard(card, extra = '') {
    const el = document.createElement('div');
    el.className = `card ${card ? 'suit-' + card.suit : 'back'} ${extra}`;
    const img = card ? images.cards[card.id] : images.back;
    if (img) {
      el.classList.add('photo');
      el.innerHTML = `<img src="${img}" alt="${card ? card.rank + ' of ' + SUITS[card.suit].label : 'Card back'}" draggable="false">`;
    } else {
      el.innerHTML = card ? cardSVG(card) : backSVG();
    }
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

  window.Carta = { setImages, SUITS, FACES, cardSVG, backSVG, makeCard, avatarHTML, escapeHTML, sound, setMuted, isMuted: () => muted, unlockAudio: audio };
})();
