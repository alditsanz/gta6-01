// audio.js — every sound in Solmar Heat is synthesized live with WebAudio.
// No audio files, no network: oscillators, noise and envelopes only.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ensure() || this.muted) return;
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

  noiseBurst(dur, vol = 0.25, lowpass = 1200) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
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
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  shoot() {
    this.noiseBurst(0.12, 0.35, 3200);
    this.blip(180, 0.09, 'square', 0.12, 60);
  }

  punch() {
    this.noiseBurst(0.08, 0.2, 500);
  }

  pickup() {
    this.blip(660, 0.1, 'sine', 0.2);
    setTimeout(() => this.blip(990, 0.14, 'sine', 0.2), 90);
  }

  coin() {
    this.blip(1319, 0.1, 'sine', 0.2);
    setTimeout(() => this.blip(1760, 0.18, 'sine', 0.2), 80);
  }

  nearMiss() {
    this.noiseBurst(0.18, 0.18, 5200);
    this.blip(320, 0.16, 'sine', 0.1, 720);
  }

  missionStart() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 110));
  }

  missionDone() {
    [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.22), i * 120));
  }

  busted() {
    this.blip(440, 0.4, 'sawtooth', 0.2, 220);
    this.blip(330, 0.5, 'sawtooth', 0.2, 165);
  }

  crash() {
    this.noiseBurst(0.25, 0.3, 700);
  }

  // A low engine hum that follows the car's speed; call every frame.
  engine(speed, top, driving) {
    if (!this.ensure() || this.muted) {
      this.stopEngine();
      return;
    }
    if (!driving) {
      this.stopEngine();
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.03;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const ratio = Math.abs(speed) / Math.max(1, top);
    this.engineOsc.frequency.setValueAtTime(55 + ratio * 130, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0.02 + ratio * 0.05, this.ctx.currentTime);
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // A two-tone police siren while any cop is chasing; call every frame.
  siren(active) {
    if (!this.ensure() || this.muted || !active) {
      this.stopSiren();
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    }
    const phase = (performance.now() / 500) % 2;
    this.sirenOsc.frequency.setValueAtTime(phase < 1 ? 700 : 950, this.ctx.currentTime);
  }

  stopSiren() {
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // A lazy bass-and-hat groove that loops while the game runs.
  startMusic() {
    if (!this.ensure() || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const note = bass[this.musicStep % bass.length];
      this.blip(note, 0.5, 'triangle', 0.1);
      if (this.musicStep % 2 === 0) this.noiseBurst(0.03, 0.04, 6000);
      this.musicStep += 1;
    }, 320);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
