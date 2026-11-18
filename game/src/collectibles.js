// collectibles.js — the 10 hidden Solmar coins ($75 each) and ammo pickups.

// Has this coin (by index into COIN_CELLS) already been collected?
function coinTaken(i) { return G.coinsGot.includes(i); }

// Walk over a coin to collect it. Returns true when a coin was just collected.
function checkCoins() {
  for (let i = 0; i < COIN_CELLS.length; i++) {
    if (coinTaken(i)) continue;
    const c = COIN_CELLS[i];
    if (dist(G.player.x, G.player.y, c.x, c.y) < 34) {
      G.coinsGot.push(i);
      G.money += CFG.coinPay;
      G.score += 75;
      showMessage('Solmar coin found! +$' + CFG.coinPay + ' (' + G.coinsGot.length + '/10)');
      playSound('coin');
      saveGame();
      return true;
    }
  }
  return false;
}

function coinsRemaining() { return COIN_CELLS.length - G.coinsGot.length; }

// Ammo pickups scattered near the HQ and the plaza; walking over one refills reserve ammo.
function spawnPickups() {
  G.pickups = [
    { x: LANDMARKS.hq.x - 120, y: LANDMARKS.hq.y + 60, kind: 'ammo' },
    { x: LANDMARKS.hq.x + 140, y: LANDMARKS.hq.y - 80, kind: 'ammo' },
    { x: LANDMARKS.plaza.x + 120, y: LANDMARKS.plaza.y + 100, kind: 'ammo' },
    { x: LANDMARKS.marina.x + 90, y: LANDMARKS.marina.y - 90, kind: 'ammo' },
  ];
}

function checkPickups() {
  for (const p of G.pickups) {
    if (p.taken) continue;
    if (dist(G.player.x, G.player.y, p.x, p.y) < 30) {
      p.taken = true;
      if (p.kind === 'ammo') {
        G.ammoReserve = Math.min(96, (G.ammoReserve || 0) + 24);
        showMessage('Ammo picked up (+24 reserve)');
        playSound('pickup');
      }
    }
  }
}
