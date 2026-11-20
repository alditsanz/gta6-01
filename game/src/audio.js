// audio.js — synthesized sound, no assets: WebAudio beeps, noise
// whooshes, a two-tone siren and a lazy bassline.
// One job: own the AudioContext and expose one method per sound.
// Everything is guarded — no context, no sound, no crash.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.noteIdx = 0;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlip = 0;
  }

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
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, dur, type = 'square', vol = 0.2, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 900) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  shot() { this.noise(0.09, 0.25, 1600); this.tone(160, 0.07, 'square', 0.12, -80); }
  punch() { this.noise(0.06, 0.18, 500); }
  crash() { this.noise(0.22, 0.3, 300); this.tone(70, 0.2, 'sawtooth', 0.16, -30); }
  coin() { this.tone(950, 0.07, 'sine', 0.16); setTimeout(() => this.tone(1420, 0.1, 'sine', 0.14), 55); }
  pickup() { this.tone(620, 0.08, 'sine', 0.15, 240); }
  nearMiss() { this.noise(0.16, 0.14, 2400); }
  ui() { this.tone(520, 0.05, 'sine', 0.1); }
  passed() { this.tone(523, 0.1, 'sine', 0.14); setTimeout(() => this.tone(784, 0.14, 'sine', 0.14), 90); }

  // Called every frame from main: music pulse + siren state.
  step(world, dt) {
    if (!this.ensure()) return;
    // Bassline: a slow island groove while playing.
    this.musicTimer -= dt;
    if (this.musicTimer <= 0 && !this.muted) {
      this.musicTimer = 0.42;
      const bass = [55, 55, 65.4, 55, 82.4, 73.4, 65.4, 49];
      this.tone(bass[this.noteIdx % bass.length], 0.3, 'triangle', 0.1);
      this.noteIdx += 1;
    }
    // Siren: two-tone while wanted, only when a cop is near.
    const wantSiren = world.wanted > 0 && !this.muted;
    if (wantSiren && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    } else if (!wantSiren && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
    if (this.sirenOsc) {
      this.sirenFlip -= dt;
      if (this.sirenFlip <= 0) {
        this.sirenFlip = 0.38;
        this.sirenOsc.frequency.value = this.sirenOsc.frequency.value > 800 ? 660 : 920;
      }
    }
  }
}
