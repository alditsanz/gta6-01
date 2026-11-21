// audio.js — synthesized sound effects with WebAudio. No assets,
// no network: every sound is an oscillator/noise burst shaped in
// code. Safe no-op outside the browser (logic tests import this).

let ctx = null;
let muted = false;

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function tone(freq, dur, type, gain, slideTo) {
  const a = ac(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}

function noise(dur, gain, freq) {
  const a = ac(); if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (i * 2654435761 % 1000) / 500 - 1; // deterministic hash noise
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export function sfx(name) {
  if (muted) return;
  switch (name) {
    case 'shot': noise(0.09, 0.25, 900); tone(160, 0.07, 'square', 0.12, 60); break;
    case 'coin': tone(880, 0.09, 'sine', 0.16); setTimeout(() => tone(1320, 0.14, 'sine', 0.14), 60); break;
    case 'crash': noise(0.22, 0.3, 300); break;
    case 'whoosh': noise(0.16, 0.12, 1800); break;
    case 'pickup': tone(520, 0.08, 'triangle', 0.15, 760); break;
    case 'win': tone(523, 0.12, 'triangle', 0.16); setTimeout(() => tone(784, 0.2, 'triangle', 0.16), 110); break;
    case 'fail': tone(220, 0.25, 'sawtooth', 0.1, 110); break;
    case 'siren': tone(660, 0.16, 'sine', 0.05, 880); break;
    default: break;
  }
}
