/* Small synthesised sound kit shared by all games (no audio files). */
(function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('muted') === '1'; } catch {}

  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(dur, freq, gain, q = 0.8) {
    const a = audio(); if (!a) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function tone(freq, when = 0, dur = 0.5, vol = 0.16, type = 'triangle') {
    const a = audio(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  const N = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, A4: 440, F4: 349.23, D4: 293.66 };
  const kit = {
    tap: () => noise(0.05, 2500, 0.25),
    card: () => noise(0.12, 1800, 0.5),
    draw: () => noise(0.09, 900, 0.35),
    move: () => noise(0.07, 1200, 0.6, 2),
    capture: () => { noise(0.1, 700, 0.8, 2); noise(0.06, 2400, 0.3); },
    check: () => { tone(N.A4, 0, 0.25, 0.14, 'square'); tone(N.A4, 0.12, 0.25, 0.1, 'square'); },
    cue: () => noise(0.06, 3200, 0.6, 3),
    clack: () => noise(0.04, 4200, 0.4, 4),
    pocket: () => { noise(0.18, 300, 0.7, 1); tone(110, 0, 0.25, 0.12, 'sine'); },
    turn: () => { tone(N.E5, 0, 0.25, 0.1); tone(N.G5, 0.09, 0.35, 0.1); },
    join: () => { tone(N.C5, 0, 0.2, 0.08); tone(N.G5, 0.08, 0.3, 0.08); },
    win: () => [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * 0.12, 0.6, 0.13)),
    lose: () => [N.A4, N.F4, N.D4].forEach((f, i) => tone(f, i * 0.16, 0.7, 0.12)),
    chat: () => tone(N.G5, 0, 0.15, 0.05, 'sine'),
  };
  window.Sound = {
    play(name) { if (!muted && kit[name]) try { kit[name](); } catch {} },
    unlock: audio,
    isMuted: () => muted,
    setMuted(m) { muted = m; try { localStorage.setItem('muted', m ? '1' : '0'); } catch {} },
  };
})();
