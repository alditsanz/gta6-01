// audio.js — synthesized sound effects with WebAudio. No audio
// assets exist in the repo; every blip is an oscillator envelope.
// Safe to construct outside a browser: it stays silent until a
// real AudioContext is available.

export function createAudio() {
  let ctx = null; let muted = false;
  function ensure() {
    if (!ctx && typeof window !== 'undefined' && window.AudioContext) {
      try { ctx = new window.AudioContext(); } catch { ctx = null; }
    }
    return ctx;
  }
  function tone(freq, dur, type, gain, slide) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.05, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  return {
    shot() { tone(720, 0.09, 'square', 0.07, -500); },
    crash() { tone(90, 0.22, 'sawtooth', 0.09, -40); },
    coin() { tone(1180, 0.12, 'sine', 0.06, 500); },
    whoosh() { tone(300, 0.16, 'sine', 0.04, 600); },
    siren(t) { if (Math.floor(t * 2) % 2) tone(660, 0.08, 'triangle', 0.015); else tone(520, 0.08, 'triangle', 0.015); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
  };
}
