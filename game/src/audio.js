// Solmar Heat — audio.js
// All sound is synthesized with WebAudio — no audio files, no network.
// A whoosh for near misses, a crack for shots, a thud for crashes, a
// chime for coins, and a low siren wail while the police are close.
// Everything is guarded so the game runs silently (and fine) where
// AudioContext does not exist, and M toggles mute.

let ctx = null;
let muted = false;

function audio() {
  if (muted) return null;
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  try {
    if (!ctx) ctx = new window.AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

// One short oscillator blip: frequency slides from f0 to f1 over dur.
function blip(f0, f1, dur, type, gain) {
  const ac = audio();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), ac.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.08, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  } catch {
    // Sound must never break the game.
  }
}

// Filtered noise burst: the whoosh and the crash.
function noise(dur, filterFreq, gain) {
  const ac = audio();
  if (!ac) return;
  try {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = ac.createGain();
    g.gain.value = gain || 0.12;
    src.connect(filter);
    filter.connect(g);
    g.connect(ac.destination);
    src.start();
  } catch {
    // Sound must never break the game.
  }
}

export const sfx = {
  shot() {
    blip(900, 120, 0.09, 'square', 0.09);
    noise(0.06, 2400, 0.06);
  },
  punch() {
    noise(0.08, 300, 0.14);
  },
  crash() {
    noise(0.22, 180, 0.2);
    blip(140, 40, 0.2, 'sawtooth', 0.1);
  },
  whoosh() {
    noise(0.35, 900, 0.12);
  },
  coin() {
    blip(880, 880, 0.07, 'sine', 0.1);
    setTimeout(() => blip(1320, 1320, 0.12, 'sine', 0.1), 70);
  },
  pickup() {
    blip(520, 780, 0.1, 'sine', 0.1);
  },
  success() {
    blip(523, 523, 0.1, 'sine', 0.1);
    setTimeout(() => blip(659, 659, 0.1, 'sine', 0.1), 90);
    setTimeout(() => blip(784, 784, 0.18, 'sine', 0.12), 180);
  },
  fail() {
    blip(300, 150, 0.35, 'sawtooth', 0.08);
  },
  siren() {
    blip(700, 950, 0.4, 'sine', 0.04);
  },
  click() {
    blip(600, 600, 0.04, 'square', 0.05);
  },
};
