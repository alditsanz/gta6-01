// Solmar Heat — random.js
// A tiny seeded random number generator (mulberry32) so the city layout,
// traffic and weather are deterministic from a seed, and so the logic
// test can replay the exact same world twice and compare byte for byte.

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

// A small helper object around one generator, with the calls the game
// actually needs. Create one per game with a fixed seed for a stable city.
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max] inclusive
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // one element of an array
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // true with probability p (0..1)
    chance(p) {
      return next() < p;
    },
  };
}
