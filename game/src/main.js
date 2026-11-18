// Solmar Heat — main: game state, the loop, the player, the cars
// and the seven story jobs. Everything else is a system this file
// calls once a frame.
SH.newGame = function (seed) {
  var world = SH.buildWorld(seed);
  var cars = [];
  for (var i = 0; i < SH.CAR_SPOTS.length; i++) {
    var spot = SH.CAR_SPOTS[i];
    var model = SH.CARS[spot.model];
    cars.push({
      model: spot.model, modelName: model.name, color: model.color,
      top: model.top, accel: model.accel,
      x: spot.x, y: spot.y, angle: 0, health: 100, totaled: false
    });
  }
  var S = {
    seed: seed, world: world, cars: cars,
    screen: 'title', time: 0,
    money: 0, score: 0, carsStolen: 0, fares: 0, nearMisses: 0,
    racesWon: 0, completed: [], storyDone: false,
    coinsGot: SH.coinState(),
    heat: 0, lastCrimeT: -99,
    player: {
      x: 628, y: 628, angle: 0, aim: 0, speed: 0,
      health: 100, ammo: 12, reserve: 48, car: null, punchT: 0
    },
    police: [], roadblocks: [], heli: { active: false, x: 0, y: 0, angle: 0 },
    bfs: null, bfsT: 0, lastRamT: -9,
    bullets: [], guards: [], ammo: SH.ammoSpots(),
    mission: null, taxi: null, delivery: null, race: null,
    lastNearMiss: -9, message: '', messageT: 0, reloadT: 0,
    channelT: 0
  };
  SH.loadSave(S);
  return S;
};

// ---- save --------------------------------------------------------------
SH.saveGame = function (S) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SH.SAVE_KEY, JSON.stringify({
      money: S.money, score: S.score, completed: S.completed,
      coinsGot: S.coinsGot, racesWon: S.racesWon, fares: S.fares,
      storyDone: S.storyDone, carsStolen: S.carsStolen
    }));
  } catch (e) { /* saving is best-effort */ }
};

SH.loadSave = function (S) {
  try {
    if (typeof localStorage === 'undefined') return;
    var raw = localStorage.getItem(SH.SAVE_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    if (typeof d.money === 'number') S.money = d.money;
    if (typeof d.score === 'number') S.score = d.score;
    if (Array.isArray(d.completed)) S.completed = d.completed;
    if (Array.isArray(d.coinsGot) && d.coinsGot.length === SH.COINS.length) S.coinsGot = d.coinsGot;
    if (typeof d.racesWon === 'number') S.racesWon = d.racesWon;
    if (typeof d.fares === 'number') S.fares = d.fares;
    if (d.storyDone) S.storyDone = true;
    if (typeof d.carsStolen === 'number') S.carsStolen = d.carsStolen;
  } catch (e) { /* a bad save never breaks the game */ }
};

// ---- missions ----------------------------------------------------------
SH.startMission = function (S, id) {
  var def = null;
  for (var i = 0; i < SH.MISSIONS.length; i++) {
    if (SH.MISSIONS[i].id === id) def = SH.MISSIONS[i];
  }
  if (!def) return false;
  S.mission = { def: def, id: id, stage: 0, timer: def.time, target: null, channelT: 0 };
  if (id === 4) S.heat = SH.gainStar(S.heat, 2);
  if (id === 6) S.heat = SH.gainStar(S.heat, 3);
  S.lastCrimeT = S.time;
  S.message = def.name + ' — ' + def.banner;
  S.messageT = 3;
  SH.sfx('mission');
  SH.updateMissionTarget(S);
  return true;
};

SH.updateMissionTarget = function (S) {
  var m = S.mission;
  if (!m) return;
  var plaza = SH.landmark('Cactus Court Plaza');
  var marina = SH.landmark('Marina');
  var hq = SH.landmark('SCPD Headquarters');
  var neon = SH.landmark('Neon Strip');
  var pier = SH.landmark('Pier 9');
  var market = SH.landmark('Old Town Market');
  switch (m.id) {
    case 1:
      m.target = m.stage === 0 ? null : SH.makeTarget(plaza.x, plaza.y, 'Lena');
      break;
    case 2: m.target = SH.makeTarget(marina.x, marina.y, 'Marina'); break;
    case 3:
      m.target = m.stage === 0 ? SH.makeTarget(S.cars[0].x, S.cars[0].y, 'Falco')
        : SH.makeTarget(plaza.x, plaza.y, 'Plaza');
      break;
    case 4: m.target = SH.makeTarget(neon.x, neon.y, 'Neon Strip'); break;
    case 5:
      m.target = m.stage <= 1 ? SH.makeTarget(hq.x, hq.y, 'SCPD HQ')
        : SH.makeTarget(market.x, market.y, 'Old Town');
      break;
    case 6: m.target = SH.makeTarget(pier.x, pier.y, 'Pier 9'); break;
    case 7:
      m.target = m.stage <= 2 ? SH.makeTarget(hq.x, hq.y, 'SCPD HQ')
        : SH.makeTarget(marina.x, marina.y, 'Marina');
      break;
    default: m.target = null;
  }
};

SH.completeMission = function (S) {
  var m = S.mission;
  if (!m) return;
  S.money += m.def.payout;
  S.score += 500;
  if (S.completed.indexOf(m.id) < 0) S.completed.push(m.id);
  if (m.id === 7) S.storyDone = true;
  S.message = m.def.name + ' complete! +$' + m.def.payout;
  S.messageT = 3;
  SH.sfx('cash');
  S.mission = null;
  SH.saveGame(S);
};

SH.failMission = function (S, why) {
  S.message = why || 'Job failed.';
  S.messageT = 3;
  SH.sfx('fail');
  S.mission = null;
  S.guards = [];
};

SH.updateMission = function (S, dt) {
  var m = S.mission;
  if (!m) return;
  var p = S.player;
  m.timer -= dt;
  if (m.timer <= 0) { SH.failMission(S, m.def.name + ' — time ran out.'); return; }
  var plaza = SH.landmark('Cactus Court Plaza');
  var marina = SH.landmark('Marina');
  var hq = SH.landmark('SCPD Headquarters');
  var neon = SH.landmark('Neon Strip');
  var pier = SH.landmark('Pier 9');
  var market = SH.landmark('Old Town Market');
  switch (m.id) {
    case 1:
      if (m.stage === 0 && p.car) { m.stage = 1; SH.updateMissionTarget(S); }
      else if (m.stage === 1 && SH.dist(p.x, p.y, plaza.x, plaza.y) < 60) SH.completeMission(S);
      break;
    case 2:
      if (SH.dist(p.x, p.y, marina.x, marina.y) < 70) SH.completeMission(S);
      break;
    case 3:
      if (m.stage === 0 && p.car === S.cars[0]) { m.stage = 1; SH.updateMissionTarget(S); }
      else if (m.stage === 1 && SH.dist(p.x, p.y, plaza.x, plaza.y) < 60) SH.completeMission(S);
      break;
    case 4:
      // The manhunt stays hot for the whole chase.
      S.heat = Math.max(S.heat, 200);
      if (SH.dist(p.x, p.y, neon.x, neon.y) < 80) SH.completeMission(S);
      break;
    case 5:
      if (m.stage === 0 && SH.dist(p.x, p.y, hq.x, hq.y) < 70) {
        m.stage = 1; m.channelT = 0; SH.updateMissionTarget(S);
        S.message = 'Planting the package… stay put.';
        S.messageT = 2;
      } else if (m.stage === 1) {
        if (SH.dist(p.x, p.y, hq.x, hq.y) > 80) { m.stage = 0; SH.updateMissionTarget(S); }
        else {
          m.channelT += dt;
          if (m.channelT >= 3) { m.stage = 2; SH.updateMissionTarget(S); S.message = 'Package planted — get back to Old Town.'; S.messageT = 2; }
        }
      } else if (m.stage === 2 && SH.dist(p.x, p.y, market.x, market.y) < 70) {
        SH.completeMission(S);
      }
      break;
    case 6:
      if (SH.dist(p.x, p.y, pier.x, pier.y) < 70) SH.completeMission(S);
      break;
    case 7:
      if (m.stage === 0 && SH.dist(p.x, p.y, hq.x, hq.y) < 80) {
        m.stage = 1;
        SH.spawnGuards(S, hq.x, hq.y, 3);
        SH.updateMissionTarget(S);
        S.message = 'Clear the 3 guards!';
        S.messageT = 2;
      } else if (m.stage === 1) {
        var alive = 0;
        for (var i = 0; i < S.guards.length; i++) if (S.guards[i].alive) alive++;
        if (alive === 0) {
          m.stage = 2;
          S.message = 'Guards down — grab the ledger!';
          S.messageT = 2;
        }
      } else if (m.stage === 2) {
        if (SH.dist(p.x, p.y, hq.x + 40, hq.y + 40) < 46) {
          m.stage = 3;
          m.timer = 90;
          S.heat = SH.gainStar(S.heat, 4);
          S.lastCrimeT = S.time;
          SH.updateMissionTarget(S);
          S.message = 'Ledger grabbed! Run to the Marina — 90 seconds, 4 stars!';
          S.messageT = 3;
        }
      } else if (m.stage === 3) {
        if (SH.dist(p.x, p.y, marina.x, marina.y) < 70) SH.completeMission(S);
      }
      break;
    default: break;
  }
};

// ---- wasted ------------------------------------------------------------
SH.wasted = function (S) {
  var p = S.player;
  p.health = 0;
  if (p.car) { p.car = null; }
  S.screen = 'wasted';
  S.heat = 0;
  S.police = [];
  S.roadblocks = [];
  S.heli.active = false;
  S.mission = null;
  S.taxi = null;
  S.delivery = null;
  S.race = null;
  SH.sfx('fail');
};

SH.respawn = function (S) {
  var p = S.player;
  var h = SH.hospitalSpot();
  p.x = h.x; p.y = h.y;
  p.health = 100;
  p.speed = 0;
  p.car = null;
  S.money = Math.max(0, S.money - 100);
  S.screen = 'play';
  S.message = 'Patched up at Sunset Hospital. -$100.';
  S.messageT = 3;
  SH.saveGame(S);
};

// ---- player ------------------------------------------------------------
SH.nearestCar = function (S, maxD) {
  var p = S.player, best = null, bd = maxD;
  for (var i = 0; i < S.cars.length; i++) {
    var c = S.cars[i];
    var d = SH.dist(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};

// E: race flag first, then the delivery parcel, then steal / exit.
SH.pressE = function (S) {
  var p = S.player;
  if (SH.tryRace(S)) return;
  if (SH.tryDelivery(S)) return;
  if (p.car) {
    var c = p.car;
    p.car = null;
    p.x = c.x + Math.cos(p.angle + Math.PI / 2) * 26;
    p.y = c.y + Math.sin(p.angle + Math.PI / 2) * 26;
    p.speed = 0;
    return;
  }
  var car = SH.nearestCar(S, 56);
  if (!car) return;
  if (car.totaled) {
    S.message = 'That car is wrecked — it will never drive again.';
    S.messageT = 2;
    return;
  }
  p.car = car;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  S.carsStolen++;
  S.score += 25;
  SH.addHeat(S, 25);
  S.message = 'Stole the ' + car.modelName + '!';
  S.messageT = 2;
  SH.sfx('cash');
  SH.saveGame(S);
};

SH.updatePlayer = function (S, dt) {
  var p = S.player;
  if (p.punchT > 0) p.punchT -= dt;
  if (S.reloadT > 0) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) SH.finishReload(S);
  }
  // Aim follows the mouse.
  var cam = SH.camera(S);
  p.aim = SH.angleTo(p.x, p.y, cam.x + SH.mouse.x, cam.y + SH.mouse.y);
  if (p.car) {
    var car = p.car;
    var top = car.top;
    var fwd = SH.down('KeyW', 'ArrowUp');
    var back = SH.down('KeyS', 'ArrowDown');
    var left = SH.down('KeyA', 'ArrowLeft');
    var right = SH.down('KeyD', 'ArrowRight');
    var brake = SH.down('Space');
    if (fwd) p.speed += car.accel * dt;
    if (back) p.speed -= car.accel * 0.8 * dt;
    if (!fwd && !back) {
      if (p.speed > 0) p.speed = Math.max(0, p.speed - 60 * dt);
      else p.speed = Math.min(0, p.speed + 60 * dt);
    }
    if (brake) {
      if (p.speed > 0) p.speed = Math.max(0, p.speed - 420 * dt);
      else p.speed = Math.min(0, p.speed + 420 * dt);
    }
    p.speed = SH.clamp(p.speed, -top * 0.4, top);
    var steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer !== 0 && Math.abs(p.speed) > 5) {
      p.angle += steer * 2.3 * dt * (p.speed >= 0 ? 1 : -1) * SH.clamp(Math.abs(p.speed) / 120, 0.3, 1);
    }
    var dx = Math.cos(p.angle) * p.speed * dt;
    var dy = Math.sin(p.angle) * p.speed * dt;
    var before = { x: p.x, y: p.y };
    var res = SH.tryMove(S.world, p, dx, dy, 16);
    car.x = p.x; car.y = p.y; car.angle = p.angle;
    if (res.hitWall && Math.abs(p.speed) > 60) {
      car.health -= SH.DAMAGE_PER_HIT;
      SH.sfx('crash');
      SH.addHeat(S, 4);
      p.speed *= -0.25;
      if (car.health <= 0) {
        car.health = 0;
        car.totaled = true;
        p.car = null;
        p.speed = 0;
        S.message = 'The ' + car.modelName + ' is totaled!';
        S.messageT = 3;
      }
    }
    if (SH.dist(p.x, p.y, before.x, before.y) < 0.001 && Math.abs(p.speed) > 5 && (dx || dy)) {
      // Stuck against a wall: bleed speed off.
      p.speed *= 0.9;
    }
  } else {
    var mx = (SH.down('KeyD', 'ArrowRight') ? 1 : 0) - (SH.down('KeyA', 'ArrowLeft') ? 1 : 0);
    var my = (SH.down('KeyS', 'ArrowDown') ? 1 : 0) - (SH.down('KeyW', 'ArrowUp') ? 1 : 0);
    var spd = SH.down('ShiftLeft', 'ShiftRight') ? 220 : 140;
    if (mx !== 0 || my !== 0) {
      var len = Math.sqrt(mx * mx + my * my);
      var nx = (mx / len) * spd * dt, ny = (my / len) * spd * dt;
      SH.tryMove(S.world, p, nx, ny, 12);
      p.angle = Math.atan2(my, mx);
    }
    p.speed = 0;
  }
};

// ---- frame update ------------------------------------------------------
SH.update = function (S, dt) {
  S.time += dt;
  if (S.messageT > 0) S.messageT -= dt;
  SH.updateTraffic(S.world, dt);
  if (S.screen !== 'play') return;
  SH.updatePlayer(S, dt);
  SH.updateHeat(S, dt);
  SH.updatePolice(S, dt);
  SH.updateHeli(S, dt);
  SH.updateBullets(S, dt);
  SH.updateGuards(S, dt);
  SH.checkCoins(S);
  SH.checkAmmo(S);
  SH.updateTaxi(S, dt);
  SH.updateDelivery(S, dt);
  SH.updateRace(S, dt);
  SH.updateMission(S, dt);
  SH.paintShopVisit(S);
  SH.checkNearMiss(S);
  // Keys that fire once per press.
  if (SH.pressed('KeyE')) SH.pressE(S);
  if (SH.pressed('KeyT')) SH.tryTaxi(S);
  if (SH.pressed('KeyF')) SH.punch(S);
  if (SH.pressed('KeyR')) SH.reload(S);
  if (SH.pressed('KeyM')) SH.toggleMute();
  if (SH.pressed('KeyB')) S.screen = 'board';
  if (SH.mouse.clicked && !S.player.car) {
    var cam = SH.camera(S);
    SH.shoot(S, cam.x + SH.mouse.x, cam.y + SH.mouse.y);
  }
};

// ---- render ------------------------------------------------------------
SH.render = function (S, ctx) {
  ctx.clearRect(0, 0, SH.CANVAS_W, SH.CANVAS_H);
  if (S.screen === 'title') { SH.drawTitle(ctx, S); return; }
  if (S.screen === 'board') { SH.drawBoard(ctx, S); return; }
  if (S.screen === 'wasted') { SH.drawWasted(ctx, S); return; }
  var cam = SH.camera(S);
  SH.drawWorld(ctx, S, cam);
  SH.drawEntities(ctx, S, cam);
  SH.drawHUD(ctx, S);
  SH.drawMinimap(ctx, S);
  if (S.screen === 'pause') SH.drawPause(ctx, S);
};

// ---- boot --------------------------------------------------------------
SH.boot = function () {
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  SH.initInput(canvas);
  SH.initAudio();
  var params = new URLSearchParams(window.location.search);
  var seed = parseInt(params.get('seed') || '1', 10) || 1;
  var S = SH.newGame(seed);
  SH.game = S;
  var shot = params.get('shot');
  if (shot) SH.applyShot(S, shot);
  // Title / board / wasted clicks.
  canvas.addEventListener('click', function () {
    SH.initAudio();
    if (S.screen === 'title') { S.screen = 'board'; return; }
    if (S.screen === 'wasted') { SH.respawn(S); return; }
    if (S.screen === 'board') {
      var mx = SH.mouse.x, my = SH.mouse.y;
      for (var i = 0; i < SH.MISSIONS.length; i++) {
        var col = i % 4, row = Math.floor(i / 4);
        var x = 40 + col * 305, y = 130 + row * 190;
        if (mx >= x && mx <= x + 285 && my >= y && my <= y + 170) {
          SH.startMission(S, SH.MISSIONS[i].id);
          S.screen = 'play';
          return;
        }
      }
    }
  });
  window.addEventListener('keydown', function (e) {
    if (S.screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) S.screen = 'board';
    else if (S.screen === 'wasted' && e.code === 'Enter') SH.respawn(S);
    else if (S.screen === 'board') {
      if (e.code === 'Escape') S.screen = 'play';
      else if (/^Digit[1-7]$/.test(e.code)) {
        var n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 7) { SH.startMission(S, n); S.screen = 'play'; }
      }
    } else if (S.screen === 'pause' && e.code === 'KeyP') S.screen = 'play';
    else if (S.screen === 'play' && e.code === 'KeyP') S.screen = 'pause';
  });
  var last = performance.now();
  var frame = function () {
    var now = performance.now();
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    SH.update(S, dt);
    SH.render(S, ctx);
    SH.endFrameInput();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  SH.boot();
}

