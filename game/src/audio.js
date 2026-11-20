// Solmar Heat — audio.js
// All sound is synthesised with WebAudio: engine hum, sirens, shots,
// pickups, jingles and a warm Am-F-C-G pad-and-bass loop. No assets.
// In Node (logic tests) every method is a safe no-op.

export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false; this.master = null;
    this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.musicTimer = 0;
  }
  ensure() {
    if (this.ctx || typeof window === 'undefined') return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
    return this.ctx;
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol) {
    if (!this.ensure() || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(g); g.connect(this.master); src.start();
  }
  shot() { this.noise(0.09, 0.25); this.tone(160, 0.08, 'square', 0.08, 60); }
  punch() { this.noise(0.06, 0.15); }
  pickup() { this.tone(660, 0.09, 'sine', 0.15); setTimeout(() => this.tone(990, 0.12, 'sine', 0.15), 60); }
  cash() { this.tone(880, 0.08, 'triangle', 0.18); setTimeout(() => this.tone(1320, 0.14, 'triangle', 0.18), 70); }
  jingle(win) { const seq = win ? [523, 659, 784, 1046] : [392, 330, 262, 196]; seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.16), i * 110)); }
  whoosh() { this.noise(0.18, 0.1); }
  crash() { this.noise(0.25, 0.3); this.tone(90, 0.2, 'sawtooth', 0.1, 40); }
  setEngine(on, speedRatio) {
    if (!this.ensure() || this.muted) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth'; this.engineGain.gain.value = 0.03;
      this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.master); this.engineOsc.start();
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + Math.abs(speedRatio || 0) * 130;
      if (!on) { try { this.engineOsc.stop(); } catch { /* already stopped */ } this.engineOsc = null; }
    }
  }
  setSiren(on) {
    if (!this.ensure() || this.muted) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator(); this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle'; this.sirenGain.gain.value = 0.02;
      const lfo = this.ctx.createOscillator(); const lg = this.ctx.createGain();
      lfo.frequency.value = 0.7; lg.gain.value = 180; lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 760; this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start(); this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch { /* noop */ }
      this.sirenOsc = null;
    }
  }
  stepMusic(dt) {
    this.musicTimer -= dt;
    if (this.musicTimer <= 0 && this.ctx && !this.muted) {
      this.musicTimer = 4;
      const chords = [[220, 261, 329], [174, 220, 261], [196, 246, 293], [164, 196, 246]];
      const c = chords[Math.floor(Math.random() * chords.length)];
      c.forEach((f) => this.tone(f, 3.6, 'sine', 0.03));
      this.tone(c[0] / 2, 3.6, 'triangle', 0.05);
    }
  }
}
