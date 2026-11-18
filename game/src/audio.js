// Solmar Heat — audio.js
// One job: synthesized sound effects through WebAudio. No audio files,
// no network — every sound is built from oscillators and noise.

export function createAudio() {
  const audio = {
    muted: false,
    ctx: null,
    master: null,
    sirenOn: false,
    ensure() {
      if (this.ctx) return true;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        return true;
      } catch (e) {
        return false;
      }
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },
    tone(freq, duration, type, volume, slideTo) {
      if (this.muted || !this.ensure()) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
        gain.gain.setValueAtTime(volume || 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      } catch (e) { /* sound is best-effort */ }
    },
    noise(duration, volume, filterFreq) {
      if (this.muted || !this.ensure()) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq || 1200;
        const gain = this.ctx.createGain();
        gain.gain.value = volume || 0.3;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start(t);
      } catch (e) { /* sound is best-effort */ }
    },
    shoot() { this.noise(0.12, 0.5, 900); this.tone(180, 0.08, 'square', 0.15, 60); },
    punch() { this.noise(0.08, 0.35, 300); },
    crash() { this.noise(0.25, 0.5, 220); this.tone(70, 0.25, 'sine', 0.4, 40); },
    whoosh() { this.noise(0.35, 0.3, 2400); },
    coin() { this.tone(880, 0.12, 'sine', 0.3); this.tone(1320, 0.18, 'sine', 0.25); },
    pickup() { this.tone(660, 0.1, 'triangle', 0.3, 990); },
    success() {
      this.tone(523, 0.14, 'triangle', 0.3);
      setTimeout(() => this.tone(659, 0.14, 'triangle', 0.3), 120);
      setTimeout(() => this.tone(784, 0.22, 'triangle', 0.3), 240);
    },
    fail() { this.tone(220, 0.3, 'sawtooth', 0.25, 110); },
    siren() { this.tone(700, 0.5, 'sine', 0.08, 950); },
    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    },
  };
  return audio;
}
