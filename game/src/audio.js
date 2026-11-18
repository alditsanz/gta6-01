// audio.js — synthesized sound effects via WebAudio. No audio files, no network.

let audioCtx = null;

function ensureAudio() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, vol, slideTo) {
  if (G.muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch (e) { /* audio is best-effort */ }
}

function noiseBurst(dur, vol) {
  if (G.muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  } catch (e) { /* best-effort */ }
}

function playSound(name) {
  if (G.muted) return;
  switch (name) {
    case 'shot': noiseBurst(0.09, 0.16); tone(180, 0.08, 'square', 0.06, 60); break;
    case 'empty': tone(140, 0.06, 'square', 0.05); break;
    case 'punch': noiseBurst(0.07, 0.1); break;
    case 'hurt': tone(220, 0.15, 'sawtooth', 0.08, 110); break;
    case 'crash': noiseBurst(0.22, 0.2); tone(90, 0.2, 'sawtooth', 0.1, 40); break;
    case 'coin': tone(880, 0.1, 'sine', 0.09); setTimeout(() => tone(1320, 0.14, 'sine', 0.09), 90); break;
    case 'cash': tone(660, 0.09, 'sine', 0.09); setTimeout(() => tone(990, 0.16, 'sine', 0.09), 90); break;
    case 'nearMiss': noiseBurst(0.3, 0.1); tone(500, 0.3, 'sine', 0.05, 1200); break;
    case 'wasted': tone(330, 0.5, 'sawtooth', 0.1, 55); break;
    case 'paint': tone(440, 0.12, 'sine', 0.08); setTimeout(() => tone(660, 0.12, 'sine', 0.08), 120); break;
    case 'fare': tone(520, 0.1, 'sine', 0.08); break;
    case 'pickup': tone(700, 0.1, 'sine', 0.08); break;
    case 'race': tone(440, 0.12, 'square', 0.08, 880); break;
    case 'checkpoint': tone(760, 0.1, 'sine', 0.09); setTimeout(() => tone(1140, 0.1, 'sine', 0.08), 80); break;
    case 'fail': tone(300, 0.4, 'sawtooth', 0.08, 120); break;
    case 'turf': tone(200, 0.2, 'square', 0.08, 400); break;
    case 'turfwin': tone(523, 0.12, 'sine', 0.09); setTimeout(() => tone(784, 0.2, 'sine', 0.09), 120); break;
    case 'heli': tone(120, 0.4, 'sawtooth', 0.06, 90); break;
    case 'siren': tone(700, 0.35, 'sine', 0.04, 950); break;
    case 'steal': noiseBurst(0.12, 0.1); tone(300, 0.15, 'square', 0.06, 500); break;
    default: tone(440, 0.08, 'sine', 0.05); break;
  }
}
