// Solmar Heat — main: game state, cars, the mission engine, saving,
// the player on foot and behind the wheel, and the frame loop.

const SAVE_KEY = 'solmar-heat-save-v6';

// --- save -------------------------------------------------------------
const SaveGame = {
  save(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money,
        score: state.score,
        jobsDone: state.jobsDone,
        coins: Collectibles.takenIds(),
        turf: Turf.owners,
        races: Races.results,
        faresDone: state.faresDone,
        carsStolen: state.carsStolen,
        nearMisses: state.nearMisses,
      }));
    } catch (e) { /* storage unavailable: the run just is not saved */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
};

// --- cars ---------------------------------------------------------------
const Cars = {
  spawnCar(state, model, x, y) {
    const car = {
      modelId: model.id, modelName: model.name, color: model.color,
      taxi: !!model.taxi, topSpeed: model.speed,
      x, y, angle: 0, speed: 0,
      health: CFG.carMaxHealth, wrecked: false, stolen: false,
      damageTimer: 0,
    };
    state.cars.push(car);
    return car;
  },

  enter(state, car) {
    if (car.wrecked) {
      state.toast = 'That car is totaled — it will never drive again';
      state.toastTimer = 2;
      return false;
    }
    state.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    if (!car.stolen) {
      car.stolen = true;
      state.carsStolen++;
      state.score += 10;
      Police.addHeat(state, CFG.heatSteal);
      state.toast = `Stole the ${car.modelName}!`;
      state.toastTimer = 1.6;
      AudioSys.sfx('steal');
    }
    return true;
  },

  exit(state) {
    const car = state.car;
    if (!car) return;
    state.car = null;
    state.player.x = car.x + 34;
    state.player.y = car.y + 34;
    state.player.angle = car.angle;
  },

  wreck(state) {
    const car = state.car;
    if (!car) return;
    car.wrecked = true;
    car.health = 0;
    car.speed = 0;
    state.car = null;
    state.player.x = car.x + 34;
    state.player.y = car.y + 34;
    state.toast = 'Your car is totaled!';
    state.toastTimer = 2.5;
    AudioSys.sfx('crash');
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: car.x, y: car.y,
        vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220,
        life: 0.7, max: 0.7, color: '#ff9a3c',
      });
    }
  },

  nearest(state, maxDist) {
    let best = null, bestD = maxDist;
    for (const car of state.cars) {
      const d = dist(state.player.x, state.player.y, car.x, car.y);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  },

  update(state, dt) {
    const car = state.car;
    if (!car) return;
    const grip = DayNight.grip();
    const p = state.player;
    if (Input.up) car.speed += CFG.carAccel * grip * dt;
    if (Input.dn) car.speed -= CFG.carAccel * 0.9 * dt;
    if (!Input.up && !Input.dn) car.speed = lerp(car.speed, 0, dt * 0.6);
    if (Input.brake) car.speed = lerp(car.speed, 0, dt * 4);
    const maxF = car.topSpeed * grip;
    car.speed = clamp(car.speed, -CFG.carReverseMax, maxF);
    const steer = (Input.lf ? -1 : 0) + (Input.rt ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 8) {
      car.angle += steer * CFG.carTurn * grip * dt * (car.speed >= 0 ? 1 : -1)
        * clamp(Math.abs(car.speed) / 120, 0.35, 1);
    }
    const px = car.x, py = car.y;
    // Drive in short substeps so a fast car cannot jump a canal.
    let remaining = Math.abs(car.speed) * dt;
    const dirX = Math.cos(car.angle) * Math.sign(car.speed);
    const dirY = Math.sin(car.angle) * Math.sign(car.speed);
    while (remaining > 0) {
      const stepLen = Math.min(12, remaining);
      remaining -= stepLen;
      const ox = car.x, oy = car.y;
      car.x += dirX * stepLen;
      car.y += dirY * stepLen;
      car.x = clamp(car.x, 20, CFG.world - 20);
      car.y = clamp(car.y, 20, CFG.world - 20);
      // Water (not on a bridge) stops the car cold.
      if (World.inWater(car.x, car.y)) {
        car.x = ox; car.y = oy;
        car.speed *= 0.3;
        break;
      }
    }
    // Buildings hurt: 8 health a hit, with a short cooldown.
    car.damageTimer = Math.max(0, car.damageTimer - dt);
    if (World.collideCircle(car, 20)) {
      if (Math.abs(car.speed) > 60 && car.damageTimer <= 0) {
        car.damageTimer = 0.6;
        car.health -= CFG.wallDamage;
        car.speed *= 0.4;
        AudioSys.sfx('crash');
        state.toast = `Car damage — ${Math.max(0, car.health)} health left`;
        state.toastTimer = 1.2;
        if (car.health <= 0) this.wreck(state);
      } else {
        car.speed *= 0.85;
      }
    }
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
    // Speeding past a cruiser draws heat.
    state.speedHeatTimer = Math.max(0, (state.speedHeatTimer || 0) - dt);
    if (Math.abs(car.speed) > 300 && state.speedHeatTimer <= 0) {
      for (const c of Police.cars) {
        if (dist(c.x, c.y, car.x, car.y) < 140) {
          Police.addHeat(state, CFG.heatSpeeding);
          state.speedHeatTimer = 3;
          break;
        }
      }
    }
  },
};

// --- missions -------------------------------------------------------------
const Missions = {
  start(state, id) {
    const job = JOBS.find((j) => j.id === id);
    if (!job) return false;
    if (id > 1 && !state.jobsDone.includes(id - 1)) {
      state.toast = `Finish job ${id - 1} first`;
      state.toastTimer = 2;
      return false;
    }
    if (state.jobsDone.includes(id)) {
      state.toast = 'Job already done — replay it for fun, no second payout';
      state.toastTimer = 2;
    }
    state.mission = { job, step: 0, timer: null, ledgerTaken: false, followTime: 0, outTime: 0 };
    state.screen = 'play';
    this.enterStep(state);
    state.toast = `Job ${job.id}: ${job.name}`;
    state.toastTimer = 3;
    AudioSys.sfx('mission');
    return true;
  },

  enterStep(state) {
    const m = state.mission;
    const step = m.job.steps[m.step];
    // Only the timed steps run a countdown. ('follow' carries its own
    // accumulated time in step.time — the generic timer must not eat it.)
    m.timer = (step.type === 'timedReach' || step.type === 'escape') && step.time != null ? step.time : null;
    m.followTime = 0;
    m.outTime = 0;
    if (step.stars) Police.setStars(state, step.stars);
    if (step.type === 'clearGuards') Combat.spawnGuards();
    if (step.type === 'follow') {
      // Kane's courier: a dark Mamba looping the mid-city roads.
      const model = CAR_MODELS.find((mm) => mm.id === 'mamba');
      const courier = Cars.spawnCar(state, model, state.player.x + 200, state.player.y);
      courier.speed = 150;
      courier.angle = 0;
      m.courier = courier;
      m.courierDir = 1;
    }
  },

  currentTarget(state) {
    const m = state.mission;
    if (!m) return null;
    const step = m.job.steps[m.step];
    if (!step) return null;
    if (step.x != null) return { x: step.x, y: step.y };
    if (step.type === 'follow' && m.courier) return { x: m.courier.x, y: m.courier.y };
    return null;
  },

  objectiveText(state) {
    const m = state.mission;
    if (!m) return null;
    const step = m.job.steps[m.step];
    if (!step) return null;
    let text = step.text;
    if (step.type === 'clearGuards') {
      text = `Clear the guards — ${Combat.guardsAlive()} left`;
    }
    if (m.timer != null) text += ` — ${Math.ceil(m.timer)}s`;
    return text;
  },

  completeStep(state) {
    const m = state.mission;
    m.step++;
    if (m.step >= m.job.steps.length) {
      this.completeJob(state);
      return;
    }
    this.enterStep(state);
  },

  fail(state, why) {
    const m = state.mission;
    if (m && m.courier) {
      state.cars = state.cars.filter((c) => c !== m.courier);
    }
    state.mission = null;
    state.toast = `Job failed — ${why}`;
    state.toastTimer = 2.5;
  },

  completeJob(state) {
    const m = state.mission;
    const job = m.job;
    if (m.courier) state.cars = state.cars.filter((c) => c !== m.courier);
    const already = state.jobsDone.includes(job.id);
    if (!already) {
      state.money += job.pay;
      state.score += 100;
      state.jobsDone.push(job.id);
      state.rank = Math.min(7, state.jobsDone.length);
      if (job.id === 7) {
        // Total take $4,150: $4,000 for the job + $150 in guard drops
        // (3 guards x $50, paid as they went down).
        state.rank = 7;
        state.toast = 'STORY COMPLETE — you are a Solmar Legend! +$4,150';
      } else {
        state.toast = `Job ${job.id} complete! +$${job.pay}`;
      }
    } else {
      state.toast = `Job ${job.id} complete (replay — no payout)`;
    }
    state.toastTimer = 3.5;
    AudioSys.sfx('cash');
    state.mission = null;
    SaveGame.save(state);
  },

  update(state, dt) {
    const m = state.mission;
    if (!m) return;
    const step = m.job.steps[m.step];
    if (!step) return;
    const p = state.player;
    if (m.timer != null) {
      m.timer -= dt;
      if (m.timer <= 0) {
        this.fail(state, 'the timer ran out');
        return;
      }
    }
    switch (step.type) {
      case 'steal':
        if (state.car) this.completeStep(state);
        break;
      case 'stealModel':
        if (state.car && state.car.modelId === step.model) this.completeStep(state);
        break;
      case 'reach':
      case 'pickup':
        if (dist(p.x, p.y, step.x, step.y) < step.r) this.completeStep(state);
        break;
      case 'timedReach':
        if (dist(p.x, p.y, step.x, step.y) < step.r) this.completeStep(state);
        break;
      case 'follow': {
        const c = m.courier;
        if (!c) { this.completeStep(state); break; }
        // The courier cruises the roads in a loop.
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        if (c.x > CFG.world - 60 || c.x < 60 || c.y > CFG.world - 60 || c.y < 60) {
          c.angle += Math.PI / 2;
        }
        const d = dist(p.x, p.y, c.x, c.y);
        if (d <= step.maxDist) {
          m.followTime += dt;
          m.outTime = 0;
          if (m.followTime >= step.time) this.completeStep(state);
        } else {
          m.outTime += dt;
          if (m.outTime > 5) { this.fail(state, 'you lost the courier'); }
        }
        break;
      }
      case 'clearGuards':
        if (Combat.guardsAlive() === 0) this.completeStep(state);
        break;
      case 'grab':
        if (dist(p.x, p.y, step.x, step.y) < step.r) {
          m.ledgerTaken = true;
          this.completeStep(state);
        }
        break;
      case 'escape':
        if (dist(p.x, p.y, step.x, step.y) < step.r) this.completeStep(state);
        break;
      default:
        break;
    }
  },
};

// --- game state -------------------------------------------------------------
const GameState = {
  canvas: null,
  screen: 'title',
  time: 0,
  titleBlink: true,
  blinkTimer: 0,
  player: { x: 296, y: 500, angle: 0, health: 100 },
  car: null,
  cars: [],
  money: 0,
  score: 0,
  jobsDone: [],
  faresDone: 0,
  carsStolen: 0,
  nearMisses: 0,
  heat: 0,
  stars: 0,
  ammo: CFG.magSize,
  reserve: CFG.reserveAmmo,
  rank: 0,
  mission: null,
  toast: '',
  toastTimer: 0,
  paintCooldown: 0,
  wastedTimer: 0,
  speedHeatTimer: 0,
  particles: [],
  muted: false,
};

function newGameState(saved) {
  const s = GameState;
  s.money = saved ? saved.money : 0;
  s.score = saved ? saved.score : 0;
  s.jobsDone = saved ? saved.jobsDone.slice() : [];
  s.faresDone = saved ? saved.faresDone : 0;
  s.carsStolen = saved ? saved.carsStolen : 0;
  s.nearMisses = saved ? saved.nearMisses : 0;
  s.rank = Math.min(7, s.jobsDone.length);
  s.player = { x: 296, y: 500, angle: 0, health: 100 };
  s.car = null;
  s.cars = [];
  s.mission = null;
  s.particles = [];
  s.heat = 0;
  s.stars = 0;
  s.ammo = CFG.magSize;
  s.reserve = CFG.reserveAmmo;
  s.toast = '';
  s.toastTimer = 0;
  s.paintCooldown = 0;
  s.wastedTimer = 0;
  s.speedHeatTimer = 0;
  s.fireTimer = 0;
  for (const sp of CAR_SPAWNS) {
    const model = CAR_MODELS.find((mm) => mm.id === sp.model);
    Cars.spawnCar(s, model, sp.x, sp.y);
  }
  World.init();
  Collectibles.init(saved ? saved.coins : []);
  Combat.init();
  SideJobs.init();
  Races.init(saved ? saved.races : {});
  Police.init();
  Heli.init();
  Turf.init(saved ? saved.turf : null);
  DayNight.init();
}

// --- player on foot -----------------------------------------------------------
function updateOnFoot(state, dt) {
  const p = state.player;
  let mx = (Input.rt ? 1 : 0) - (Input.lf ? 1 : 0);
  let my = (Input.dn ? 1 : 0) - (Input.up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    const spd = CFG.walkSpeed * (Input.sprint ? CFG.sprintMult : 1);
    // Move in short substeps so a long frame cannot jump a canal or
    // tunnel through a building wall.
    let remaining = spd * dt;
    while (remaining > 0) {
      const stepLen = Math.min(12, remaining);
      remaining -= stepLen;
      const ox = p.x, oy = p.y;
      p.x += mx * stepLen;
      p.y += my * stepLen;
      p.x = clamp(p.x, 20, CFG.world - 20);
      p.y = clamp(p.y, 20, CFG.world - 20);
      if (World.inWater(p.x, p.y)) { p.x = ox; p.y = oy; break; }
      World.collideCircle(p, CFG.playerRadius);
    }
    p.angle = Math.atan2(my, mx);
  }
  // Aim at the mouse.
  const cam = Render.cam(state);
  const wx = Input.mouseX + cam.x, wy = Input.mouseY + cam.y;
  if (dist(wx, wy, p.x, p.y) > 30) p.angle = angleTo(p.x, p.y, wx, wy);
}

// --- the frame loop -------------------------------------------------------------
let lastT = 0;

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  const s = GameState;
  s.time += dt;
  s.blinkTimer += dt;
  if (s.blinkTimer > 0.6) { s.blinkTimer = 0; s.titleBlink = !s.titleBlink; }
  s.toastTimer = Math.max(0, s.toastTimer - dt);
  s.paintCooldown = Math.max(0, s.paintCooldown - dt);

  if (s.screen === 'title') {
    AudioSys.ensure();
    if (Input.clicked || Input.hit('Enter')) {
      s.screen = 'board';
      AudioSys.sfx('mission');
    }
  } else if (s.screen === 'board') {
    if (Input.clicked) handleBoardClick(s);
    if (Input.hit('Escape') || Input.hit('KeyP')) s.screen = 'play';
    if (Input.hit('Enter')) s.screen = 'play';
  } else if (s.screen === 'pause') {
    if (Input.hit('KeyP') || Input.hit('Escape')) s.screen = 'play';
    if (Input.hit('Enter')) s.screen = 'board';
    if (Input.hit('KeyM')) s.muted = AudioSys.toggleMute();
  } else if (s.screen === 'wasted') {
    s.wastedTimer -= dt;
    if (s.wastedTimer <= 0) s.screen = 'play';
  } else if (s.screen === 'play') {
    DayNight.update(dt);
    // Global keys.
    if (Input.hit('KeyP') || Input.hit('Escape')) { s.screen = 'pause'; }
    else if (Input.hit('KeyM')) { s.muted = AudioSys.toggleMute(); }
    else if (Input.hit('Enter')) { s.screen = 'board'; }
    else if (Input.hit('KeyE')) {
      if (s.car) Cars.exit(s);
      else {
        const car = Cars.nearest(s, 48);
        if (car) Cars.enter(s, car);
      }
    } else if (Input.hit('KeyT')) { SideJobs.tryPickupFare(s); }
    else if (Input.hit('KeyG')) { Turf.tryStartWar(s); }
    else if (Input.hit('KeyB')) { SideJobs.startDelivery(s); }
    else if (Input.hit('KeyR')) { Combat.startReload(s); }
    else if (Input.hit('KeyF')) { Combat.punch(s); }

    if (Input.clicked && !s.car) {
      const cam = Render.cam(s);
      Combat.shoot(s, Input.mouseX + cam.x, Input.mouseY + cam.y);
    }
    if (Input.mouseDown && !s.car && s.ammo > 0) {
      // Hold to keep firing, with a small fire-rate limit.
      s.fireTimer = Math.max(0, (s.fireTimer || 0) - dt);
      if (s.fireTimer <= 0) {
        s.fireTimer = 0.22;
        const cam = Render.cam(s);
        Combat.shoot(s, Input.mouseX + cam.x, Input.mouseY + cam.y);
      }
    }

    // Movement.
    if (s.car) Cars.update(s, dt);
    else updateOnFoot(s, dt);

    // Paint shop.
    if (s.paintCooldown <= 0 && Landmarks.atPaintShop(s.player.x, s.player.y)) {
      const msg = Landmarks.usePaintShop(s);
      if (msg) { s.toast = msg; s.toastTimer = 2.5; }
    }

    // Race start.
    if (s.car && !Races.race) {
      const def = Races.startMarker(s);
      if (def) Races.start(s, def);
    }

    World.updateTraffic(dt, s.car);
    World.updatePeds(dt);
    Police.update(s, dt);
    Heli.update(s, dt);
    Turf.update(s, dt);
    Combat.update(s, dt);
    SideJobs.update(s, dt);
    Races.update(s, dt);
    Missions.update(s, dt);
    Collectibles.update(s);

    // Particles.
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const pt = s.particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) s.particles.splice(i, 1);
    }
  }

  Render.draw(s);
  Input.endFrame();
  requestAnimationFrame(frame);
}

// Click a card on the mission board.
function handleBoardClick(s) {
  const x = Input.mouseX, y = Input.mouseY;
  JOBS.forEach((job, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const cx = 90 + col * 290, cy = 120 + row * 130;
    if (x >= cx && x <= cx + 270 && y >= cy && y <= cy + 110) {
      Missions.start(s, job.id);
    }
  });
  RACES.forEach((r, i) => {
    const rx = 90 + i * 290, ry = 436;
    if (x >= rx && x <= rx + 270 && y >= ry && y <= ry + 74) {
      s.screen = 'play';
      s.player.x = r.start.x;
      s.player.y = r.start.y;
      if (!s.car) {
        const car = Cars.nearest(s, 400) || Cars.spawnCar(s, CAR_MODELS[0], r.start.x + 40, r.start.y);
        Cars.enter(s, car);
      }
      Races.start(s, r);
    }
  });
}

// --- boot ---------------------------------------------------------------------
function boot() {
  const canvas = document.getElementById('game');
  GameState.canvas = canvas;
  canvas.width = Render.W;
  canvas.height = Render.H;
  Input.init(canvas);
  const saved = SaveGame.load();
  newGameState(saved);
  Shots.install(GameState);
  window.__solmarReady = true;
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
