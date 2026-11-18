// Solmar Heat — audio: synthesized effects via WebAudio, no assets.
// A whoosh for near-misses, shots, crashes, cash, coins and sirens.
// M mutes. Nothing plays until the first user gesture creates the context.

const AudioSys = {
  ctx: null,
  muted: false,

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  },

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shot': this.noise(0.12, 0.3, 900); this.tone(180, 0.1, 'square', 0.12, 60); break;
      case 'dryfire': this.tone(900, 0.05, 'square', 0.06); break;
      case 'reload': this.tone(500, 0.08, 'square', 0.08); setTimeout(() => this.tone(700, 0.08, 'square', 0.08), 120); break;
      case 'punch': this.noise(0.1, 0.25, 300); break;
      case 'crash': this.noise(0.25, 0.35, 220); this.tone(90, 0.25, 'sawtooth', 0.15, 40); break;
      case 'whoosh': this.noise(0.35, 0.22, 2400); break;
      case 'coin': this.tone(880, 0.1, 'sine', 0.15); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.15), 90); break;
      case 'cash': this.tone(660, 0.1, 'sine', 0.15); setTimeout(() => this.tone(990, 0.16, 'sine', 0.15), 100); break;
      case 'fare': this.tone(520, 0.12, 'triangle', 0.15); break;
      case 'checkpoint': this.tone(740, 0.1, 'sine', 0.15); setTimeout(() => this.tone(1108, 0.12, 'sine', 0.15), 80); break;
      case 'race': this.tone(440, 0.15, 'square', 0.12, 880); break;
      case 'guardDown': this.tone(220, 0.2, 'sawtooth', 0.12, 110); break;
      case 'paint': this.tone(330, 0.15, 'sine', 0.12, 660); break;
      case 'wasted': this.tone(320, 0.5, 'sawtooth', 0.15, 80); break;
      case 'heli': this.noise(0.6, 0.18, 500); break;
      case 'roadblock': this.tone(700, 0.2, 'square', 0.1, 500); break;
      case 'turfwar': this.tone(196, 0.2, 'square', 0.15, 392); setTimeout(() => this.tone(392, 0.2, 'square', 0.15, 196), 180); break;
      case 'steal': this.tone(300, 0.12, 'triangle', 0.15, 600); break;
      case 'mission': this.tone(523, 0.15, 'sine', 0.15); setTimeout(() => this.tone(784, 0.2, 'sine', 0.15), 120); break;
      default: break;
    }
  },
};
