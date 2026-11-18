// main.js — Solmar Heat: game loop, movement, wanted level + police pursuit,
// missions, save/load, and all the glue the other modules call.

// --- messages & particles ---
function showMessage(text) {
  G.message = text;
  G.messageAt = G.time;
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x, y, color,
      vx: (rng() - 0.5) * 160, vy: (rng() - 0.5) * 160,
      life: 0.5, max: 0.5,
    });
  }
}

function updateParticles(dt) {
  for (const p of G.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
}

// --- wanted level ---
// Stars are heat bands of 20. A newly gained star lands mid-band (boundary + 10),
// never on a boundary that would decay straight back off.
function wantedStars() {
  return Math.min(5, Math.floor(G.heat / CFG.heatPerStar));
}

function addHeat(amount) {
  const before = wantedStars();
  G.heat = clamp(G.heat + amount, 0, CFG.heatMax);
  G.lastCrimeAt = G.time;
  const after = wantedStars();
  if (after > before) {
    // Land mid-band; 5 stars sits at the top of the gauge (heat 100).
    G.heat = after >= 5 ? CFG.heatMax : Math.min(after * CFG.heatPerStar + 10, CFG.heatMax - 1);
  }
}

function updateHeat(dt) {
  if (G.time - G.lastCrimeAt > CFG.heatCalmDelay && G.heat > 0) {
    G.heat = Math.max(0, G.heat - CFG.heatDecayPerSec * dt);
  }
}

// --- police pursuit (BFS over the 9x9 road grid) ---
function nodeOf(x, y) {
  let ix = 0, iy = 0, bx = Infinity, by = Infinity;
  for (let i = 0; i < CFG.roads.length; i++) {
    const dx = Math.abs(x - CFG.roads[i]);
    if (dx < bx) { bx = dx; ix = i; }
    const dy = Math.abs(y - CFG.roads[i]);
    if (dy < by) { by = dy; iy = i; }
  }
  return { ix, iy };
}

// BFS from a start node to a goal node on the 9x9 grid; returns the next node.
function bfsNext(sx, sy, gx, gy) {
  const N = CFG.roads.length;
  const key = (x, y) => y * N + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === gx && y === gy) {
      // Walk back to the step after the start.
      let cx = x, cy = y;
      while (prev.has(key(cx, cy))) {
        const p = prev.get(key(cx, cy));
        if (p[0] === sx && p[1] === sy) return { ix: cx, iy: cy };
        cx = p[0]; cy = p[1];
      }
      return { ix: gx, iy: gy };
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return { ix: gx, iy: gy };
}

function updatePolice(dt) {
  const stars = wantedStars();
  const want = stars === 0 ? 0 : Math.min(4, stars);
  while (G.police.length < want) {
    const n = nodeOf(G.player.x, G.player.y);
    // Spawn a few blocks away, on a road.
    const sx = clamp(n.ix + (rng() < 0.5 ? -3 : 3), 0, 8);
    const sy = clamp(n.iy + (rng() < 0.5 ? -3 : 3), 0, 8);
    G.police.push({
      x: CFG.roads[sx], y: CFG.roads[sy], angle: 0,
      speed: 200 + stars * 18, hp: 100, disabled: false, node: { ix: sx, iy: sy },
    });
  }
  if (G.police.length > want) G.police.length = want;
  const target = nodeOf(G.player.x, G.player.y);
  for (const p of G.police) {
    if (p.disabled) continue;
    const cur = nodeOf(p.x, p.y);
    const next = bfsNext(cur.ix, cur.iy, target.ix, target.iy);
    const tx = CFG.roads[next.ix], ty = CFG.roads[next.iy];
    const a = angleTo(p.x, p.y, tx, ty);
    p.angle = a;
    p.x += Math.cos(a) * p.speed * dt;
    p.y += Math.sin(a) * p.speed * dt;
    // Bumping the player hurts and adds heat.
    if (dist(p.x, p.y, G.player.x, G.player.y) < 34) {
      G.player.hp -= 4;
      addHeat(1);
      if (G.player.hp <= 0) wastedRespawn();
    }
  }
  G.police = G.police.filter((p) => !p.disabled);
  updateRoadblocks();
}

// Roadblocks from 4 stars: two cruisers with a striped barrier ahead of the player.
function updateRoadblocks() {
  const stars = wantedStars();
  if (stars >= 4 && G.roadblocks.length === 0) {
    const a = G.player.angle;
    const bx = clamp(G.player.x + Math.cos(a) * 260, 60, CFG.world - 60);
    const by = clamp(G.player.y + Math.sin(a) * 260, 60, CFG.world - 60);
    G.roadblocks.push({ x: bx, y: by, angle: a + Math.PI / 2 });
    showMessage('Roadblock ahead! Find another way around.');
    playSound('siren');
  }
  if (stars < 4 && G.roadblocks.length > 0) G.roadblocks = [];
}

// --- movement ---
function movePlayer(dt) {
  const p = G.player;
  const axes = moveAxes();
  if (p.onFoot) {
    const sprint = Keys.down.shift;
    const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    let dx = axes.x, dy = axes.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; p.angle = Math.atan2(dy, dx); }
    const nx = clamp(p.x + dx * speed * dt, 20, CFG.world - 20);
    const ny = clamp(p.y + dy * speed * dt, 20, CFG.world - 20);
    if (!hitsBuilding(nx, p.y, 10) && !inCanal(nx, p.y)) p.x = nx;
    if (!hitsBuilding(p.x, ny, 10) && !inCanal(p.x, ny)) p.y = ny;
    p.speed = len > 0 ? speed : 0;
  } else {
    const car = G.cars[p.carId];
    if (!car) { p.onFoot = true; return; }
    const grip = weatherGrip();
    const forward = axes.y < 0 ? 1 : axes.y > 0 ? -0.45 : 0;
    const handbrake = Keys.down.space;
    if (forward > 0) p.speed += car.accel * grip * forward * dt;
    else if (forward < 0) p.speed += car.accel * grip * forward * dt;
    else p.speed *= Math.pow(0.88, dt); // gentle coast-down; handbrake is far stronger
    if (handbrake) p.speed *= Math.exp(-3 * dt);
    p.speed = clamp(p.speed, -car.top * 0.45, car.top);
    const steer = axes.x * (p.speed >= 0 ? 1 : -1) * (handbrake ? 1.5 : 1) * grip;
    p.angle += steer * 2.1 * dt * clamp(Math.abs(p.speed) / 120, 0, 1);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    const hit = hitsBuilding(nx, ny, 12) || inCanal(nx, ny);
    if (hit) {
      // Wall hit: 8 damage, bounce, crash. A totaled car can never be re-entered.
      if (Math.abs(p.speed) > 40 && G.time - (car.lastHitAt || -99) > 0.5) {
        car.lastHitAt = G.time;
        car.health -= CFG.carDamagePerHit;
        playSound('crash');
        burst(p.x, p.y, '#ff7a3c', 8);
        G.shake = 6;
        if (car.health <= 0) {
          car.health = 0;
          car.totaled = true;
          showMessage('Car totaled! It can never be driven again.');
          p.onFoot = true;
          p.carId = -1;
          p.speed = 0;
          p.x = clamp(p.x - Math.cos(p.angle) * 30, 20, CFG.world - 20);
          p.y = clamp(p.y - Math.sin(p.angle) * 30, 20, CFG.world - 20);
          return;
        }
      }
      p.speed *= -0.25;
    } else {
      p.x = clamp(nx, 20, CFG.world - 20);
      p.y = clamp(ny, 20, CFG.world - 20);
    }
    car.x = p.x; car.y = p.y; car.angle = p.angle;
  }
}

// Near-miss: threading past traffic at speed over 150 pays $15, 1.5 s cooldown.
function checkNearMiss() {
  if (G.player.onFoot || Math.abs(G.player.speed) < CFG.nearMissSpeed) return;
  if (G.time - G.nearMissAt < CFG.nearMissCooldown) return;
  for (const t of G.traffic) {
    const d = dist(t.x, t.y, G.player.x, G.player.y);
    if (d > 26 && d < 52) {
      G.nearMissAt = G.time;
      G.money += CFG.nearMissPay;
      G.score += CFG.nearMissPay;
      G.nearMisses++;
      showMessage('Near miss! +$' + CFG.nearMissPay);
      playSound('nearMiss');
      return;
    }
  }
}

// --- steal / exit ---
function tryStealOrExit() {
  const p = G.player;
  if (!p.onFoot) {
    p.onFoot = true;
    p.carId = -1;
    p.speed = 0;
    p.x = clamp(p.x - Math.cos(p.angle) * 34, 20, CFG.world - 20);
    p.y = clamp(p.y - Math.sin(p.angle) * 34, 20, CFG.world - 20);
    showMessage('You left the car.');
    return;
  }
  let best = null, bd = 60;
  for (const c of G.cars) {
    const d = dist(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) { showMessage('No car close enough to steal.'); return; }
  if (best.totaled) {
    showMessage('That car is totaled — it can never be driven again.');
    return;
  }
  p.onFoot = false;
  p.carId = best.id;
  p.angle = best.angle;
  p.speed = 0;
  G.carsStolen++;
  G.score += 25;
  addHeat(8);
  showMessage('Stole the ' + best.model + '! The law noticed (+heat).');
  playSound('steal');
  saveGame();
}

// --- missions ---
function startMission(index) {
  const def = MISSIONS[index];
  if (!def) return false;
  if (G.mission) return false;
  G.mission = {
    def, index,
    stage: def.pickup ? 'pickup' : (def.id === 7 ? 'guards' : 'go'),
    timeLeft: def.timer,
    objective: missionObjectiveText(def, def.pickup ? 'pickup' : (def.id === 7 ? 'guards' : 'go')),
  };
  if (def.stars > 0) {
    G.heat = def.stars * CFG.heatPerStar + 10; // mid-band for the starting star level
    G.lastCrimeAt = G.time;
  }
  if (def.id === 7) spawnGuards();
  if (def.id === 6) showMessage('Reach Pier 9 before the timer runs out. 3 stars from the start.');
  else showMessage(def.name + ' started: ' + def.brief);
  playSound('race');
  return true;
}

function missionObjectiveText(def, stage) {
  if (def.id === 7) {
    if (stage === 'guards') return 'Clear the 3 guards at SCPD HQ';
    if (stage === 'ledger') return 'Grab the ledger at SCPD HQ';
    return 'Escape to the Marina — 90 seconds, 4 stars!';
  }
  if (stage === 'pickup') return 'Pick up the package';
  return def.brief;
}

function updateMission(dt) {
  const m = G.mission;
  if (!m) return;
  m.timeLeft -= dt;
  if (m.timeLeft <= 0) {
    showMessage(m.def.name + ' failed — time ran out.');
    playSound('fail');
    G.mission = null;
    G.guards = [];
    return;
  }
  const p = G.player;
  if (m.def.id === 7) {
    if (m.stage === 'guards') {
      if (guardsAlive() === 0) {
        m.stage = 'ledger';
        m.objective = missionObjectiveText(m.def, 'ledger');
        showMessage('Guards down! Grab the ledger at HQ.');
      }
    } else if (m.stage === 'ledger') {
      if (dist(p.x, p.y, LANDMARKS.hq.x, LANDMARKS.hq.y) < 50) {
        m.stage = 'escape';
        m.timeLeft = 90;
        m.objective = missionObjectiveText(m.def, 'escape');
        G.heat = 4 * CFG.heatPerStar + 10; // 4-star manhunt, mid-band
        G.lastCrimeAt = G.time;
        showMessage('Ledger grabbed! Escape to the Marina in 90 seconds!');
        playSound('cash');
      }
    } else if (m.stage === 'escape') {
      if (dist(p.x, p.y, m.def.target.x, m.def.target.y) < 80) completeMission(m);
    }
    return;
  }
  if (m.stage === 'pickup' && m.def.pickup) {
    if (dist(p.x, p.y, m.def.pickup.x, m.def.pickup.y) < 60) {
      m.stage = 'go';
      m.objective = missionObjectiveText(m.def, 'go');
      showMessage('Package picked up! Deliver it.');
    }
    return;
  }
  const needCar = m.def.needCar;
  if (needCar && p.onFoot) return;
  if (dist(p.x, p.y, m.def.target.x, m.def.target.y) < 80) completeMission(m);
}

function completeMission(m) {
  const payout = m.def.payout;
  G.money += payout;
  G.score += payout;
  G.missionDone[m.index] = true;
  G.missionIndex = Math.max(G.missionIndex, m.index + 1);
  G.mission = null;
  G.guards = [];
  updateRank();
  showMessage(m.def.name + ' complete! +$' + payout + (m.def.id === 7 ? ' (total take $4,150 with guard drops)' : ''));
  playSound('cash');
  if (m.def.id === 7) {
    G.storyDone = true;
    G.rankIndex = 7;
    showMessage('STORY COMPLETE! You are a Solmar Legend. Total take $4,150.');
  }
  saveGame();
}

function updateRank() {
  if (G.storyDone) { G.rankIndex = 7; return; }
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (G.score >= RANKS[i].score) r = i;
  G.rankIndex = Math.min(r, 6);
}

// --- save / load ---
function saveGame() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      money: G.money, score: G.score, carsStolen: G.carsStolen, faresDone: G.faresDone,
      nearMisses: G.nearMisses, coinsGot: G.coinsGot, missionDone: G.missionDone,
      missionIndex: G.missionIndex, storyDone: G.storyDone, racesWon: G.racesWon,
      turf: G.turf, turfIncomeEarned: G.turfIncomeEarned, rankIndex: G.rankIndex,
    }));
  } catch (e) { /* storage may be unavailable */ }
}

function loadGame() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return;
    const s = JSON.parse(raw);
    G.money = s.money || 0;
    G.score = s.score || 0;
    G.carsStolen = s.carsStolen || 0;
    G.faresDone = s.faresDone || 0;
    G.nearMisses = s.nearMisses || 0;
    G.coinsGot = s.coinsGot || [];
    G.missionDone = s.missionDone || [false, false, false, false, false, false, false];
    G.missionIndex = s.missionIndex || 0;
    G.storyDone = !!s.storyDone;
    G.racesWon = s.racesWon || [];
    G.turf = s.turf || {};
    G.turfIncomeEarned = s.turfIncomeEarned || 0;
    G.rankIndex = s.rankIndex || 0;
  } catch (e) { /* corrupt save: start fresh */ }
}

// --- boot / reset ---
function resetWorld() {
  BUILDINGS = buildBuildings();
  TREES = buildTrees(BUILDINGS);
  spawnParkedCars();
  spawnPedestrians();
  spawnPickups();
  G.traffic = [];
  G.police = [];
  G.roadblocks = [];
  G.heli = null;
  G.bullets = [];
  G.guards = [];
  G.particles = [];
  G.fareMarkers = [];
  G.player.x = 561; G.player.y = 700; // on road 2, clear of the race flag at (400,400)
  G.player.angle = 0; G.player.speed = 0; G.player.hp = CFG.playerMaxHealth;
  G.player.onFoot = true; G.player.carId = -1;
  G.heat = 0;
  G.clockHours = 8;
  G.weather = 'clear';
  G.weatherTimer = CFG.weatherChangeSec;
  G.mission = null;
  G.race = null;
  G.delivery = null;
  G.taxi = null;
  G.turfChallenge = null;
  G.ammo = 12;
  G.ammoReserve = 48;
  G.aimAngle = 0;
  spawnFare();
}

function startPlay() {
  G.screen = 'play';
  showMessage('Welcome to Solmar. Steal a car (E), take a job (B).');
}

let lastT = 0;

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  G.time += dt;
  if (G.screen === 'play') update(dt);
  else updateScreens();
  // Camera follows the player.
  G.camX = clamp(G.player.x, 0, CFG.world);
  G.camY = clamp(G.player.y, 0, CFG.world);
  render();
  endFrameInput();
}

function update(dt) {
  advanceClock(dt);
  updateWeather(dt);
  // Aim from mouse.
  const ps = worldToScreen(G.player.x, G.player.y);
  G.aimAngle = aimAngle(ps.x, ps.y);
  movePlayer(dt);
  updateTraffic(dt);
  updatePeds(dt);
  updateHeat(dt);
  updatePolice(dt);
  updateHelicopter(dt);
  updateBullets(dt);
  updateGuards(dt);
  updateParticles(dt);
  checkCoins();
  checkPickups();
  checkNearMiss();
  updateMission(dt);
  updateRace(dt);
  updateDelivery(dt);
  updateTaxi();
  updateTurfChallenge(dt);
  if (atPaintShop(G.player.x, G.player.y) && G.time - (G.lastPaintAt || -99) > 2) {
    G.lastPaintAt = G.time;
    usePaintShop();
  }
  // Shooting.
  if (Keys.mouseClicked && G.screen === 'play') fireBullet();
  if (Keys.pressed.r) {
    if (G.ammo < 12 && G.ammoReserve > 0) {
      const need = 12 - G.ammo;
      const take = Math.min(need, G.ammoReserve);
      G.ammo += take; G.ammoReserve -= take;
      playSound('pickup');
    }
  }
  if (Keys.pressed.f) punch();
  if (Keys.pressed.e) tryStealOrExit();
  if (Keys.pressed.t) { if (!tryTaxiPickup()) spawnFare(); }
  if (Keys.pressed.c) tryStartTurfChallenge();
  if (Keys.pressed.m) { G.muted = !G.muted; showMessage(G.muted ? 'Muted' : 'Sound on'); }
  if (Keys.pressed.p || Keys.pressed.escape) { G.screen = 'pause'; }
  if (Keys.pressed.b) { G.screen = 'board'; }
  // Race starters: stand on a flag and press Q/W/E is handled on the board;
  // in the world, walk onto a flag to start its race.
  for (const r of RACES) {
    if (!G.race && dist(G.player.x, G.player.y, r.start.x, r.start.y) < 50) {
      startRace(r.id);
      break;
    }
  }
  // Delivery depot: walk in to start a delivery when none is active.
  if (!G.delivery && dist(G.player.x, G.player.y, LANDMARKS.depot.x, LANDMARKS.depot.y) < 60) {
    startDelivery();
  }
  updateRank();
}

function handleTitleKeys() {
  if (Keys.pressed.enter || Keys.mouseClicked) startPlay();
}

function handleBoardKeys() {
  for (let i = 0; i < 7; i++) {
    if (Keys.pressed[String(i + 1)]) {
      if (startMission(i)) G.screen = 'play';
      return;
    }
  }
  const raceKeys = ['q', 'w', 'e'];
  for (let i = 0; i < 3; i++) {
    if (Keys.pressed[raceKeys[i]]) {
      startRace(RACES[i].id);
      G.screen = 'play';
      return;
    }
  }
  if (Keys.pressed.b || Keys.pressed.escape) G.screen = 'play';
  if (Keys.mouseClicked) {
    // Click a mission card.
    for (let i = 0; i < MISSIONS.length; i++) {
      const x = 90 + (i % 4) * 290, y = 120 + Math.floor(i / 4) * 150;
      if (Keys.mouseX >= x && Keys.mouseX <= x + 270 && Keys.mouseY >= y && Keys.mouseY <= y + 130) {
        if (startMission(i)) G.screen = 'play';
        return;
      }
    }
  }
}

function handlePauseKeys() {
  if (Keys.pressed.p || Keys.pressed.escape || Keys.pressed.enter) G.screen = 'play';
  if (Keys.pressed.b) G.screen = 'board';
}

function handleWastedKeys() {
  if (Keys.pressed.enter || Keys.mouseClicked) G.screen = 'play';
}

// Route screen-specific keys each frame (called from the frame loop via updateScreens).
function updateScreens() {
  if (G.screen === 'title') handleTitleKeys();
  else if (G.screen === 'board') handleBoardKeys();
  else if (G.screen === 'pause') handlePauseKeys();
  else if (G.screen === 'wasted') handleWastedKeys();
}

function boot() {
  loadGame();
  resetWorld();
  initCanvas();
  if (typeof window !== 'undefined') {
    window.__solmar = { G, CFG, MISSIONS, RACES, TURF_ZONES, startMission, startRace, wantedStars, rushHourMultiplier, skyPhaseForHour, turfIncomePerHour };
    window.addEventListener('keydown', (e) => { if (e.key === 'Enter') Keys.pressed.enter = true; });
  }
  requestAnimationFrame((t) => { lastT = t; frame(t); });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
