// audio.js — every sound in Solmar Heat is synthesised with WebAudio.
// No audio files, no assets: oscillators and filtered noise, built the first
// time the player interacts (browsers require a user gesture for audio).

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.muted = false;
    this.sirenOn = false;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenTimer = null;
  }

  // Must be called from a user gesture (start button click).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  get ready() { return !!this.ctx; }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  // --- Game sounds ----------------------------------------------------------
  gunshot() { this._noise(0.16, 0.5, 2400); this._tone(160, 0.1, 'square', 0.25, 60); }
  punch() { this._noise(0.08, 0.35, 900); }
  pickup() { this._tone(660, 0.09, 'sine', 0.3); setTimeout(() => this._tone(880, 0.14, 'sine', 0.3), 80); }
  cash() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.3), i * 90));
  }
  missionDone() {
    [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.32), i * 110));
  }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.3, 110); }
  wasted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.4, 'sawtooth', 0.28), i * 220)); }
  click() { this._tone(900, 0.05, 'sine', 0.2); }
  engineStart() { this._tone(90, 0.3, 'sawtooth', 0.25, 140); }

  // --- Engine loop: a sawtooth through a lowpass, pitch follows speed. ------
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { this.engineOsc = null; }
  }

  setEngine(speedRatio, on) {
    if (!this.engineOsc || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on && !this.muted ? 0.06 + speedRatio * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + speedRatio * 900, t, 0.1);
  }

  stopEngine() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} }
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  // --- Siren: two-tone wail while any cruiser is hunting. -------------------
  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!this.ctx) return;
    if (on && !this.muted) {
      try {
        this._sirenOsc = this.ctx.createOscillator();
        this._sirenOsc.type = 'sine';
        this._sirenOsc.frequency.value = 760;
        this._sirenGain = this.ctx.createGain();
        this._sirenGain.gain.value = 0.045;
        this._sirenOsc.connect(this._sirenGain);
        this._sirenGain.connect(this.master);
        this._sirenOsc.start();
        let high = true;
        this._sirenTimer = setInterval(() => {
          if (!this._sirenOsc) return;
          high = !high;
          this._sirenOsc.frequency.setTargetAtTime(high ? 760 : 980, this.ctx.currentTime, 0.05);
        }, 420);
      } catch (e) { /* siren is decoration; never break the game */ }
    } else {
      if (this._sirenTimer) clearInterval(this._sirenTimer);
      this._sirenTimer = null;
      if (this._sirenOsc) { try { this._sirenOsc.stop(); } catch (e) {} }
      this._sirenOsc = null;
      this._sirenGain = null;
    }
  }
}
