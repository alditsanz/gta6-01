// Solmar Heat — random: a small seeded generator so the city, the
// traffic and the pedestrians are the same every run for a given seed.
SH.makeRng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

SH.pick = function (rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
};

SH.range = function (rng, lo, hi) {
  return lo + rng() * (hi - lo);
};

SH.shuffle = function (rng, arr) {
  var out = arr.slice();
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
};

SH.clamp = function (v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
};

SH.dist = function (x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

SH.angleTo = function (x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
};

// Turn `a` toward `target` by at most `maxStep` radians.
SH.turnToward = function (a, target, maxStep) {
  var d = target - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > maxStep) return a + maxStep;
  if (d < -maxStep) return a - maxStep;
  return target;
};
