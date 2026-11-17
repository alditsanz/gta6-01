// Synthesized sound for Solmar Heat: every effect is built with the
// WebAudio API at play time. No audio files, no network, nothing to load.

/** Create the sound engine. The AudioContext starts lazily on first use. */
export function createSound() {
  const sfx = {
    ctx: null,
    muted: false,
    master: null,
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        return true;
      } catch {
        return false;
      }
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type, vol, slideTo) {
      if (this.muted || !this.ensure()) return;
      this.resume();
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    noise(dur, vol, lowpass) {
      if (this.muted || !this.ensure()) return;
      this.resume();
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    },
    shoot() {
      this.noise(0.12, 0.5, 2400);
      this.tone(220, 0.08, 'square', 0.18, 60);
    },
    punch() {
      this.noise(0.08, 0.35, 900);
    },
    crash() {
      this.noise(0.25, 0.6, 500);
      this.tone(90, 0.2, 'sawtooth', 0.25, 40);
    },
    whoosh() {
      this.noise(0.35, 0.3, 3200);
    },
    coin() {
      this.tone(880, 0.12, 'sine', 0.3);
      this.tone(1318, 0.18, 'sine', 0.25);
    },
    pickup() {
      this.tone(660, 0.1, 'triangle', 0.3, 990);
    },
    missionDone() {
      this.tone(523, 0.14, 'triangle', 0.3);
      this.tone(659, 0.14, 'triangle', 0.3);
      this.tone(784, 0.3, 'triangle', 0.35);
    },
    wasted() {
      this.tone(392, 0.5, 'sawtooth', 0.3, 98);
      this.tone(311, 0.7, 'sawtooth', 0.25, 78);
    },
    siren() {
      this.tone(720, 0.4, 'sine', 0.06, 980);
    },
    engine() {
      this.tone(70, 0.1, 'sawtooth', 0.05, 110);
    },
  };
  return sfx;
}
