// SOLMAR HEAT — audio.js
// All sound is synthesised live with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshots, pickups, mission jingles and a slow
// sun-soaked bass-and-pad loop that plays under the whole game.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  // Called from the first user gesture (start button / keypress).
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!started) {
      started = true;
      startEngine();
      startMusic();
    }
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(low);
    low.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(speed01, driving) {
    if (!engineGain || !engineOsc) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
  }

  function startSiren() {
    if (sirenOsc || !ctx) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    lfo.start();
    sirenOsc._lfo = lfo;
  }

  function setSiren(on) {
    if (!sirenGain) {
      if (on) startSiren();
      return;
    }
    sirenGain.gain.setTargetAtTime(on ? 0.035 : 0.0, ctx.currentTime, 0.3);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.4;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  // A slow Am — F — C — G pad with a walking bass, one step per 220 ms.
  const CHORDS = [
    [110.0, 220.0, 261.6, 329.6],
    [87.3, 174.6, 220.0, 261.6],
    [130.8, 196.0, 261.6, 329.6],
    [98.0, 196.0, 246.9, 293.7],
  ];
  const BASS = [55.0, 43.65, 65.4, 49.0];

  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const chord = CHORDS[Math.floor(musicStep / 8) % 4];
      const bass = BASS[Math.floor(musicStep / 8) % 4];
      if (musicStep % 8 === 0) {
        chord.forEach((f) => {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 0.4);
          g.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 1.9);
          o.connect(g);
          g.connect(master);
          o.start();
          o.stop(ctx.currentTime + 2.0);
        });
      }
      if (musicStep % 2 === 0) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = bass * (musicStep % 8 === 4 ? 1.5 : 1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.07, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.connect(g);
        g.connect(master);
        o.start();
        o.stop(ctx.currentTime + 0.45);
      }
      musicStep++;
    }, 220);
  }

  return {
    unlock,
    setEngine,
    setSiren,
    shoot() { noiseBurst(0.12, 0.5, 2600); blip(180, 0.08, 'square', 0.12, 60); },
    punch() { noiseBurst(0.08, 0.3, 900); },
    pickup() { blip(660, 0.09, 'sine', 0.18); setTimeout(() => blip(990, 0.12, 'sine', 0.18), 70); },
    cash() { blip(880, 0.08, 'triangle', 0.16); setTimeout(() => blip(1320, 0.14, 'triangle', 0.16), 80); },
    hurt() { blip(140, 0.18, 'sawtooth', 0.22, 70); },
    bust() { blip(520, 0.5, 'square', 0.15, 260); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.18), i * 130)); },
    door() { blip(300, 0.1, 'square', 0.12, 180); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
