// Solmar Heat — audio.js
// All sound is synthesized with WebAudio — no audio assets exist.
// Short envelope blips for shots, pickups, crashes and the near-miss
// whoosh. Everything is best-effort: if audio is unavailable the game
// simply plays silent.

export function createAudio() {
  let ctx = null;
  let muted = false;
  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function blip(freq, dur, type, gain, slide) {
    const ac = ensure();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.05, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  }
  function noise(dur, gain, freq) {
    const ac = ensure();
    if (!ac || muted) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const src = ac.createBufferSource(); src.buffer = buffer;
    const filter = ac.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq || 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    src.connect(filter); filter.connect(g); g.connect(ac.destination);
    src.start();
  }
  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shot() { noise(0.09, 0.10, 1400); blip(160, 0.08, 'square', 0.05, -90); },
    punch() { noise(0.06, 0.08, 500); },
    crash() { noise(0.22, 0.14, 300); blip(70, 0.2, 'sawtooth', 0.07, -40); },
    whoosh() { noise(0.28, 0.06, 1800); },
    coin() { blip(880, 0.09, 'sine', 0.07); setTimeout(() => blip(1320, 0.12, 'sine', 0.06), 55); },
    cash() { blip(660, 0.08, 'triangle', 0.07); setTimeout(() => blip(990, 0.1, 'triangle', 0.06), 60); },
    siren() { blip(720, 0.16, 'triangle', 0.02, 160); },
    levelup() { blip(523, 0.1, 'triangle', 0.07); setTimeout(() => blip(784, 0.14, 'triangle', 0.07), 90); },
  };
}
