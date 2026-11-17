// random.js — small deterministic random helpers for Solmar Heat.
// The city layout is generated from a fixed seed so every player sees the
// same Solmar; gameplay randomness (traffic spawns, pedestrian colours) uses
// a session seed that screenshot mode can pin down for reproducible shots.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    // One element of an array.
    pick(list) { return list[Math.floor(next() * list.length)]; },
    // True with probability p.
    chance(p) { return next() < p; },
    // Shuffle a copy of an array.
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
