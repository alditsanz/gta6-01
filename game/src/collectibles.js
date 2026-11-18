// Solmar Heat — collectibles: the 10 hidden Solmar coins.
// Fixed spots, $75 each, collected once and kept in the save.

const Collectibles = {
  coins: [],

  init(collectedIds) {
    this.coins = COIN_SPOTS.map((spot, i) => ({
      id: i,
      x: spot[0],
      y: spot[1],
      taken: collectedIds ? collectedIds.includes(i) : false,
    }));
  },

  takenIds() {
    return this.coins.filter((c) => c.taken).map((c) => c.id);
  },

  count() { return this.coins.filter((c) => c.taken).length; },

  update(state) {
    const p = state.player;
    for (const c of this.coins) {
      if (c.taken) continue;
      if (dist(p.x, p.y, c.x, c.y) < 30) {
        c.taken = true;
        state.money += CFG.coinValue;
        state.score += 25;
        state.toast = `Solmar coin +$${CFG.coinValue} (${this.count()}/10)`;
        state.toastTimer = 2;
        AudioSys.sfx('coin');
        SaveGame.save(state);
      }
    }
  },
};
