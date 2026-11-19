// Solmar Heat — audio.js
// Synthesised sound effects via WebAudio: no audio assets, everything is
// generated. The context is created lazily on the first user gesture, so
// importing this module (or loading the page) never touches audio.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  /** Create the context (call from a user gesture). Safe to call twice. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  _tone(freq, dur, type = 'square', slideTo = null, vol = 0.5) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol = 0.4, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shot() { this._tone(880, 0.09, 'square', 220, 0.4); this._noise(0.06, 0.25, 3000); }
  crash() { this._noise(0.25, 0.6, 900); this._tone(120, 0.2, 'sawtooth', 50, 0.4); }
  whoosh() { this._noise(0.35, 0.35, 2400); }
  coin() { this._tone(1320, 0.09, 'sine', null, 0.4); this._tone(1760, 0.14, 'sine', null, 0.35); }
  cash() { this._tone(1046, 0.1, 'sine', null, 0.4); this._tone(1318, 0.1, 'sine', null, 0.4); this._tone(1568, 0.18, 'sine', null, 0.4); }
  siren() { this._tone(700, 0.5, 'sine', 950, 0.16); }
  punch() { this._noise(0.08, 0.5, 700); }
  wasted() { this._tone(392, 0.5, 'sawtooth', 110, 0.4); }
  click() { this._tone(660, 0.05, 'sine', null, 0.3); }
  checkpoint() { this._tone(880, 0.08, 'sine', null, 0.4); this._tone(1174, 0.12, 'sine', null, 0.4); }
  engine() { this._tone(90, 0.12, 'sawtooth', 70, 0.06); }
}
