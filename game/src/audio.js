// Solmar Heat — audio: every sound is synthesized with WebAudio,
// so the game ships no audio files at all. M toggles mute.
SH.audio = { ctx: null, muted: false, sirenNodes: null };

SH.initAudio = function () {
  if (SH.audio.ctx) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    SH.audio.ctx = new AC();
  } catch (e) { SH.audio.ctx = null; }
};

SH.tone = function (freq, dur, type, vol, slideTo) {
  if (!SH.audio.ctx || SH.audio.muted) return;
  try {
    var ctx = SH.audio.ctx;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) { /* audio is best-effort */ }
};

SH.noise = function (dur, vol, freq) {
  if (!SH.audio.ctx || SH.audio.muted) return;
  try {
    var ctx = SH.audio.ctx;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 1200;
    var g = ctx.createGain();
    g.gain.value = vol || 0.12;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) { /* audio is best-effort */ }
};

SH.sfx = function (name) {
  if (!SH.audio.ctx || SH.audio.muted) return;
  switch (name) {
    case 'shot': SH.noise(0.12, 0.2, 900); SH.tone(220, 0.1, 'square', 0.06, 60); break;
    case 'dry': SH.tone(140, 0.06, 'square', 0.05); break;
    case 'reload': SH.tone(500, 0.08, 'square', 0.05); SH.tone(700, 0.08, 'square', 0.05); break;
    case 'punch': SH.noise(0.1, 0.15, 400); break;
    case 'hurt': SH.tone(160, 0.2, 'sawtooth', 0.1, 90); break;
    case 'crash': SH.noise(0.25, 0.25, 300); break;
    case 'coin': SH.tone(880, 0.12, 'sine', 0.09); SH.tone(1320, 0.18, 'sine', 0.09); break;
    case 'cash': SH.tone(660, 0.1, 'sine', 0.09); SH.tone(880, 0.1, 'sine', 0.09); SH.tone(1100, 0.2, 'sine', 0.09); break;
    case 'whoosh': SH.noise(0.35, 0.14, 2400); break;
    case 'fare': SH.tone(520, 0.1, 'sine', 0.08); SH.tone(780, 0.14, 'sine', 0.08); break;
    case 'paint': SH.tone(440, 0.15, 'sine', 0.08, 880); break;
    case 'checkpoint': SH.tone(990, 0.1, 'sine', 0.09); break;
    case 'race': SH.tone(392, 0.12, 'square', 0.08); SH.tone(523, 0.12, 'square', 0.08); SH.tone(659, 0.25, 'square', 0.08); break;
    case 'fail': SH.tone(330, 0.25, 'sawtooth', 0.08, 180); break;
    case 'heli': SH.noise(0.5, 0.1, 220); break;
    case 'siren': SH.tone(700, 0.4, 'sine', 0.05, 1100); break;
    case 'guardDown': SH.tone(300, 0.15, 'square', 0.08, 120); break;
    case 'mission': SH.tone(523, 0.15, 'sine', 0.09); SH.tone(784, 0.3, 'sine', 0.09); break;
    default: break;
  }
};

SH.toggleMute = function () {
  SH.audio.muted = !SH.audio.muted;
  return SH.audio.muted;
};
