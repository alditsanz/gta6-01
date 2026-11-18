// Solmar Heat — landmarks: what each named place does when the
// player reaches it. The paint shop clears heat and repairs the
// car; the hospital is where a WASTED player wakes up.
SH.insideLandmark = function (lm, x, y, pad) {
  return SH.dist(x, y, lm.x, lm.y) <= lm.r + (pad || 0);
};

// Lou's Paint Shop: drive in and the heat is gone, the car is fixed.
// Returns true when a repaint happened this frame.
SH.paintShopVisit = function (S) {
  var shop = SH.landmark("Lou's Paint Shop");
  if (!shop) return false;
  var p = S.player;
  if (!SH.insideLandmark(shop, p.x, p.y, 0)) return false;
  if (S.heat <= 0 && (!p.car || p.car.health >= 100)) return false;
  S.heat = 0;
  if (p.car) p.car.health = 100;
  S.message = 'Fresh paint — heat cleared, car repaired.';
  S.messageT = 2.5;
  SH.sfx('paint');
  return true;
};

SH.hospitalSpot = function () {
  var h = SH.landmark('Sunset Hospital');
  return { x: h.x, y: h.y };
};

// A point on the map the player is told to reach, with a label.
SH.makeTarget = function (x, y, label) {
  return { x: x, y: y, label: label };
};
