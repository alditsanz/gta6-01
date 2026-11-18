// landmarks.js — named places and what they do: Lou's Paint Shop, the hospital,
// the HQ, the Marina, Pier 9, the plaza and the Canal Row depot.

// Is the player (or their car) inside the paint shop's service bay?
function atPaintShop(x, y) {
  return dist(x, y, LANDMARKS.paint.x, LANDMARKS.paint.y) < 90;
}

// Lou's: clears all heat and fully repairs the current car, for a flat fee.
function usePaintShop() {
  if (G.money >= CFG.paintShopFee) G.money -= CFG.paintShopFee;
  G.heat = 0;
  G.lastCrimeAt = -99;
  G.roadblocks = [];
  G.police = [];
  G.heli = null;
  if (!G.player.onFoot && G.player.carId >= 0) {
    const car = G.cars[G.player.carId];
    if (car) { car.health = CFG.carMaxHealth; car.totaled = false; }
  }
  showMessage("Lou's Paint Shop: heat cleared, car repaired (-$" + CFG.paintShopFee + ')');
  playSound('paint');
}

// WASTED: the player died. Respawn at the hospital, pay the fine, lose the heat.
function wastedRespawn() {
  G.money = Math.max(0, G.money - CFG.wastedFine);
  G.player.hp = CFG.playerMaxHealth;
  G.player.x = LANDMARKS.hospital.x;
  G.player.y = LANDMARKS.hospital.y;
  G.player.onFoot = true;
  G.player.carId = -1;
  G.player.speed = 0;
  G.heat = 0;
  G.police = [];
  G.roadblocks = [];
  G.heli = null;
  G.turfChallenge = null;
  G.screen = 'wasted';
  playSound('wasted');
  saveGame();
}

// District helpers used by the HUD and the turf board.
function turfZoneAt(x, y) {
  for (const z of TURF_ZONES) {
    if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) return z;
  }
  return null;
}

function turfOwner(zoneId) { return G.turf[zoneId] || null; }
function turfHeldCount() {
  let n = 0;
  for (const z of TURF_ZONES) if (G.turf[z.id] === 'player') n++;
  return n;
}
function turfAllHeld() { return turfHeldCount() === TURF_ZONES.length; }

// Hourly turf income: $5 per held zone, +$25 when all five are held.
function turfIncomePerHour() {
  const held = turfHeldCount();
  return held * CFG.turfIncomePerHour + (held === TURF_ZONES.length ? CFG.turfAllZonesBonusPerHour : 0);
}

// Called by the clock each time a whole in-game hour ticks over.
function onHourTick(hour) {
  const pay = turfIncomePerHour();
  if (pay > 0) {
    G.money += pay;
    G.turfIncomeEarned += pay;
    G.score += pay;
    showMessage('Turf income: +$' + pay + (turfAllHeld() ? ' (all zones held!)' : ''));
  }
}
