// Solmar Heat — landmarks: the named places, Lou's Paint Shop
// (clears heat + repairs the car) and the hospital respawn point.

const Landmarks = {
  // True when the player (or their car) is inside the paint-shop yard.
  atPaintShop(x, y) {
    return dist(x, y, LANDMARKS.paintShop.x, LANDMARKS.paintShop.y) < 78;
  },

  // Driving into the yard with heat or damage spends nothing and
  // clears both. Returns what it did, for the HUD toast.
  usePaintShop(state) {
    const hadHeat = state.heat > 0;
    const car = state.car;
    const hadDamage = car && car.health < CFG.carMaxHealth;
    if (!hadHeat && !hadDamage) return null;
    state.heat = 0;
    state.stars = 0;
    if (car) car.health = CFG.carMaxHealth;
    state.paintCooldown = 2;
    AudioSys.sfx('paint');
    if (hadHeat && hadDamage) return "Lou's Paint Shop: heat cleared, car repaired";
    if (hadHeat) return "Lou's Paint Shop: heat cleared";
    return "Lou's Paint Shop: car repaired";
  },

  hospitalRespawn(state) {
    state.player.x = LANDMARKS.hospital.x;
    state.player.y = LANDMARKS.hospital.y;
    state.player.health = 100;
    state.player.angle = 0;
    state.car = null;
    state.heat = 0;
    state.stars = 0;
    state.money = Math.max(0, state.money - CFG.hospitalFee);
    state.screen = 'wasted';
    state.wastedTimer = 2.2;
    AudioSys.sfx('wasted');
  },
};
