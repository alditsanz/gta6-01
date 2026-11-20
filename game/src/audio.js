// audio.js — synthesized sound effects with WebAudio. No audio assets:
// every effect is an oscillator / noise burst shaped at play time.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return false;
      this.ctx = new AC();
      return true;
    } catch (err) {
      return false;
    }
  }

  tone(freq, dur, type, gain, slideTo) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  noise(dur, gain) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain || 0.12;
    src.connect(g); g.connect(ctx.destination);
    src.start();
  }

  play(name) {
    if (this.muted) return;
    switch (name) {
      case 'shot': this.noise(0.09, 0.16); this.tone(180, 0.08, 'square', 0.06, 60); break;
      case 'reload': this.tone(320, 0.06, 'square', 0.05); this.tone(240, 0.06, 'square', 0.05); break;
      case 'punch': this.noise(0.06, 0.1); break;
      case 'crash': this.noise(0.22, 0.2); this.tone(90, 0.2, 'sawtooth', 0.08, 40); break;
      case 'whoosh': this.noise(0.16, 0.07); this.tone(600, 0.16, 'sine', 0.03, 1200); break;
      case 'coin': this.tone(880, 0.09, 'sine', 0.07); this.tone(1320, 0.14, 'sine', 0.07); break;
      case 'cash': this.tone(660, 0.08, 'triangle', 0.08); this.tone(990, 0.12, 'triangle', 0.08); break;
      case 'siren': this.tone(720, 0.18, 'sine', 0.04, 980); break;
      case 'pickup': this.tone(520, 0.1, 'triangle', 0.07, 780); break;
      case 'fail': this.tone(220, 0.3, 'sawtooth', 0.07, 110); break;
      case 'win': this.tone(523, 0.12, 'triangle', 0.08); this.tone(784, 0.2, 'triangle', 0.08); break;
      default: break;
    }
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }
}
