// sidejobs.js — taxi fares, street races, the delivery job and turf challenges.

// --- taxi fares ---
function spawnFare() {
  // A fare marker appears on a random road, a few blocks from the player.
  for (let tries = 0; tries < 10; tries++) {
    const x = pickOne(rng, CFG.roads) + (rng() < 0.5 ? -24 : 24);
    const y = randRange(rng, 80, CFG.world - 80);
    if (dist(x, y, G.player.x, G.player.y) > 260) {
      const dest = {
        x: pickOne(rng, CFG.roads),
        y: randRange(rng, 80, CFG.world - 80),
      };
      G.taxi = { state: 'waiting', x, y, dest, pay: CFG.taxiBasePay + Math.floor(rng() * 41) - 20 };
      return;
    }
  }
  G.taxi = null;
}

function tryTaxiPickup() {
  if (!G.taxi || G.taxi.state !== 'waiting') return false;
  if (dist(G.player.x, G.player.y, G.taxi.x, G.taxi.y) < 60) {
    G.taxi.state = 'riding';
    showMessage('Fare picked up! Drive them to the marker. Pays ~$' + G.taxi.pay);
    playSound('fare');
    return true;
  }
  return false;
}

function updateTaxi() {
  if (!G.taxi || G.taxi.state !== 'riding') return;
  if (dist(G.player.x, G.player.y, G.taxi.dest.x, G.taxi.dest.y) < 70) {
    G.money += G.taxi.pay;
    G.score += G.taxi.pay;
    G.faresDone++;
    showMessage('Fare complete! +$' + G.taxi.pay);
    playSound('cash');
    G.taxi = null;
    saveGame();
  }
}

// --- street races ---
function raceMarkerPositions() {
  return RACES.map((r) => ({ x: r.start.x, y: r.start.y, race: r }));
}

function startRace(raceId) {
  const race = RACES.find((r) => r.id === raceId);
  if (!race) return false;
  G.race = {
    id: race.id, name: race.name, payout: race.payout, par: race.par,
    checkpoints: race.checkpoints, index: 0, timeLeft: race.par, started: true,
  };
  G.player.x = race.start.x;
  G.player.y = race.start.y;
  showMessage(race.name + ' started! Hit all ' + race.checkpoints.length + ' checkpoints in ' + race.par + 's!');
  playSound('race');
  return true;
}

function updateRace(dt) {
  if (!G.race) return;
  const r = G.race;
  r.timeLeft -= dt;
  if (r.timeLeft <= 0) {
    showMessage('Race failed — out of time. Try again at the flag.');
    playSound('fail');
    G.race = null;
    return;
  }
  const cp = r.checkpoints[r.index];
  if (cp && dist(G.player.x, G.player.y, cp.x, cp.y) < 60) {
    r.index++;
    playSound('checkpoint');
    if (r.index >= r.checkpoints.length) {
      const bonus = Math.max(0, Math.floor(r.timeLeft));
      const total = r.payout + bonus;
      G.money += total;
      G.score += total;
      if (!G.racesWon.includes(r.id)) G.racesWon.push(r.id);
      showMessage(r.name + ' won! +$' + total + ' (par bonus +$' + bonus + ')');
      playSound('cash');
      G.race = null;
      saveGame();
    } else {
      showMessage('Checkpoint ' + r.index + '/' + r.checkpoints.length);
    }
  }
}

function racePayout(raceId) {
  const r = RACES.find((x) => x.id === raceId);
  return r ? r.payout : 0;
}

// --- delivery job ---
function startDelivery() {
  const depot = LANDMARKS.depot;
  const dest = { x: pickOne(rng, [296, 561, 2151]), y: pickOne(rng, [296, 826, 1395]) };
  G.delivery = { state: 'pickup', x: depot.x, y: depot.y, dest, timeLeft: 150, pay: 220 };
  showMessage('Delivery: pick up the package at the Canal Row Depot.');
}

function updateDelivery(dt) {
  if (!G.delivery) return;
  const d = G.delivery;
  d.timeLeft -= dt;
  if (d.timeLeft <= 0) {
    showMessage('Delivery failed — too slow.');
    playSound('fail');
    G.delivery = null;
    return;
  }
  if (d.state === 'pickup' && dist(G.player.x, G.player.y, d.x, d.y) < 60) {
    d.state = 'deliver';
    showMessage('Package collected! Deliver it across town — stay out of sight of police.');
    playSound('pickup');
  } else if (d.state === 'deliver' && dist(G.player.x, G.player.y, d.dest.x, d.dest.y) < 70) {
    G.money += d.pay;
    G.score += d.pay;
    showMessage('Delivery complete! +$' + d.pay);
    playSound('cash');
    G.delivery = null;
    saveGame();
  }
  // Being spotted by police during a delivery raises heat faster.
  if (d.state === 'deliver' && G.police.length > 0) {
    const near = G.police.some((p) => dist(p.x, p.y, G.player.x, G.player.y) < 240);
    if (near) addHeat(2 * dt);
  }
}

// --- turf wars ---
// Stand inside a rival zone and press C to start a hold: survive the timer
// while rival crew members spawn and attack. Survive and the zone flips.
function tryStartTurfChallenge() {
  const zone = turfZoneAt(G.player.x, G.player.y);
  if (!zone) { showMessage('No turf zone here.'); return false; }
  if (G.turf[zone.id] === 'player') { showMessage('You already hold ' + zone.name + '.'); return false; }
  if (G.turfChallenge) return false;
  G.turfChallenge = {
    zoneId: zone.id, zoneName: zone.name, crew: zone.crew,
    timeLeft: CFG.turfHoldSeconds, spawnAt: 0, attackers: [],
  };
  showMessage('Turf challenge: hold ' + zone.name + ' against the ' + zone.crew + ' for ' + CFG.turfHoldSeconds + 's!');
  playSound('turf');
  return true;
}

function updateTurfChallenge(dt) {
  const ch = G.turfChallenge;
  if (!ch) return;
  const zone = TURF_ZONES.find((z) => z.id === ch.zoneId);
  ch.timeLeft -= dt;
  ch.spawnAt -= dt;
  // Fleeing the zone forfeits the challenge.
  if (!zone || G.player.x < zone.x0 || G.player.x >= zone.x1 || G.player.y < zone.y0 || G.player.y >= zone.y1) {
    showMessage('You left the zone — challenge lost. The ' + ch.crew + ' keep ' + ch.zoneName + '.');
    G.turfChallenge = null;
    return;
  }
  if (ch.spawnAt <= 0 && ch.attackers.length < 4) {
    ch.spawnAt = 4;
    const edge = pickOne(rng, [
      { x: zone.x0 + 40, y: zone.y0 + 40 }, { x: zone.x1 - 40, y: zone.y0 + 40 },
      { x: zone.x0 + 40, y: zone.y1 - 40 }, { x: zone.x1 - 40, y: zone.y1 - 40 },
    ]);
    ch.attackers.push({ x: edge.x, y: edge.y, hp: 60, speed: 70, shootAt: 1 });
  }
  for (const a of ch.attackers) {
    if (a.hp <= 0) continue;
    const ang = angleTo(a.x, a.y, G.player.x, G.player.y);
    a.x += Math.cos(ang) * a.speed * dt;
    a.y += Math.sin(ang) * a.speed * dt;
    a.shootAt -= dt;
    if (dist(a.x, a.y, G.player.x, G.player.y) < 30) {
      G.player.hp -= 5;
      a.shootAt = 0.8;
      if (G.player.hp <= 0) { wastedRespawn(); return; }
    }
  }
  ch.attackers = ch.attackers.filter((a) => a.hp > 0);
  // Bullets hit attackers too.
  for (const b of G.bullets) {
    for (const a of ch.attackers) {
      if (a.hp > 0 && segmentHits(b.px, b.py, b.x, b.y, a.x, a.y, 15)) { a.hp -= 34; b.life = 0; }
    }
  }
  if (ch.timeLeft <= 0) {
    G.turf[ch.zoneId] = 'player';
    G.score += 200;
    const held = turfHeldCount();
    showMessage(ch.zoneName + ' is yours now! (' + held + '/' + TURF_ZONES.length + ' zones held)');
    playSound('turfwin');
    if (turfAllHeld()) {
      G.score += 500;
      showMessage('ALL TURF HELD! Turf King bonus: +$' + CFG.turfAllZonesBonusPerHour + '/hour');
    }
    G.turfChallenge = null;
    saveGame();
  }
}
