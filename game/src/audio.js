// Solmar Heat — synthesized sound. No audio files exist; every effect
// is a tiny oscillator blip or a burst of filtered noise, and the whole
// rig fails silent when WebAudio is unavailable.

export function createAudio() {
  let ctx = null;
  let isMuted = false;

  function ensureCtx() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = AC ? new AC() : null;
      } catch (err) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, slideTo) {
    const ac = ensureCtx();
    if (!ac || isMuted) return;
    try {
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(28, slideTo), ac.currentTime + dur);
      }
      amp.gain.setValueAtTime(gain || 0.05, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(amp);
      amp.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch (err) { /* stay silent */ }
  }

  function noiseBurst(dur, gain, freq) {
    const ac = ensureCtx();
    if (!ac || isMuted) return;
    try {
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buffer = ac.createBuffer(1, len, ac.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        data[i] = (seed / 2147483648) * 2 - 1;
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 900;
      const amp = ac.createGain();
      amp.gain.setValueAtTime(gain, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(ac.destination);
      src.start();
    } catch (err) { /* stay silent */ }
  }

  return {
    unlock() { ensureCtx(); },
    toggleMute() { isMuted = !isMuted; return isMuted; },
    get muted() { return isMuted; },
    shot() { noiseBurst(0.09, 0.1, 1500); tone(170, 0.08, 'square', 0.05, 80); },
    punch() { noiseBurst(0.06, 0.08, 480); },
    crash() { noiseBurst(0.22, 0.14, 300); tone(72, 0.2, 'sawtooth', 0.07, 34); },
    whoosh() { noiseBurst(0.28, 0.06, 1900); },
    coin() { tone(880, 0.09, 'sine', 0.07); setTimeout(() => tone(1318, 0.12, 'sine', 0.06), 55); },
    cash() { tone(660, 0.08, 'triangle', 0.07); setTimeout(() => tone(990, 0.1, 'triangle', 0.06), 60); },
    siren() { tone(720, 0.16, 'triangle', 0.02, 880); },
    levelup() { tone(523, 0.1, 'triangle', 0.07); setTimeout(() => tone(784, 0.14, 'triangle', 0.07), 90); },
  };
}
