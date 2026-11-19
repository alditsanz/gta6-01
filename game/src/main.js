// Solmar Heat — main.js
// The game itself: state, the loop, driving, the wanted system, police
// pursuit, the helicopter, roadblocks, the paint shop, the save, and the
// screens. It wires the pure modules together and owns the canvas.

import {
  WORLD, CARS, CAR_SPAWNS, LANDMARKS, MISSIONS, RACES, MOD_CATEGORIES, roadPos,
  PLAYER_SPEED, SPRINT_MULT, CAR_ACCEL, CAR_BRAKE, CAR_TURN,
  WALL_DAMAGE, CAR_MAX_HEALTH, PLAYER_MAX_HEALTH,
  HEAT_MAX, HEAT_DECAY, HEAT_CRIME_STEAL, HEAT_CRIME_SHOT, HEAT_CRIME_SPEED,
  starsFor, addHeat, rankFor, districtAt,
} from './config.js';
import { mulberry32, clamp, angleDiff } from './random.js';
import { Input } from './input.js';
import { buildCity, bfsPath, hitBuilding, inCanal, isOnRoad, nearestRoadIndex } from './world.js';
import { createClock, tickClock, hourOf, clockText, skyPhase, gripFactor, trafficTarget } from './weather.js';
import { createCoins, collectCoins, coinsSave, coinsLoad, coinsGot } from './collectibles.js';
import { createCombat, fireBullet, updateBullets, punch, startReload, guardsShoot } from './combat.js';
import { createSideJobs, offerFare, offerDelivery, tickSideJobs, checkNearMiss } from './sidejobs.js';
import { createRaces, startRace, tickRace, raceAt } from './races.js';
import { createTurf, zoneAt, zonesHeld, startChallenge, tickChallenge, turfIncome, turfSave, turfLoad } from './turf.js';
import { createMods, buyMod, moddedCarStats, modsSpent, modsSave, modsLoad } from './modshop.js';
import { createMissions, startMission, tickMission, missionTarget, job7Total } from './missions.js';
import { inPaintShop, inModShop, atLandmark, hospitalPoint, paintShopService } from './landmarks.js';
import { SoundBank } from './audio.js';
import { installShotsHook } from './shots.js';
import {
  setupCanvas, drawWorld, drawEntities, drawMinimap, drawHUD, drawNightOverlay,
  drawTitle, drawBoard, drawPause, drawWasted, drawModShop, VIEW_W, VIEW_H,
} from './render.js';

const SAVE_KEY = 'solmar-heat-save-v10';

/** Build a fresh game state. */
export function createState() {
  const rng = mulberry32(20261119);
  const cars = CAR_SPAWNS.map((s, i) => ({
    id: i,
    model: CARS[s.model].model,
    color: CARS[s.model].color,
    top: CARS[s.model].top,
    accel: CARS[s.model].accel,
    x: s.x, y: s.y, angle: rng() * Math.PI * 2,
    speed: 0, health: CAR_MAX_HEALTH, maxHealth: CAR_MAX_HEALTH,
    stolen: false, wrecked: false,
  }));
  return {
    time: 0,
    screen: 'title', // title | board | play | pause | wasted
    overlay: null, // null | 'modshop'
    money: 0,
    score: 0,
    carsStolen: 0,
    player: { x: 640, y: 640, angle: 0, speed: 0, health: PLAYER_MAX_HEALTH, inCar: false, car: null },
    cars,
    traffic: [],
    peds: [],
    police: [],
    roadblocks: [],
    rivals: [],
    heli: null,
    heat: 0,
    stars: 0,
    lastCrime: -99,
    coins: createCoins(),
    combat: createCombat(),
    missions: createMissions(),
    side: createSideJobs(),
    raceState: createRaces(),
    turf: createTurf(),
    mods: createMods(),
    clock: createClock(),
    city: buildCity(),
    landmarks: LANDMARKS,
    missionsList: MISSIONS,
    races: RACES,
    modCategories: MOD_CATEGORIES,
    cam: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
    toasts: [],
    banner: '',
    bannerTimer: 0,
    // Derived HUD fields, initialised so the title screen can read them
    // before the first update tick.
    rank: 'Nobody',
    clockText: '08:00',
    turfZonesHeld: 0,
    turfIncome: 0,
    modsSpent: 0,
    missionTarget: null,
    district: 'Sunset Mile',
    damageCooldown: 0,
    policeRamCooldown: 0,
    rivalHitCooldown: 0,
    saveTimer: 0,
    fareOfferTimer: 12,
    deliveryOfferTimer: 30,
    turfIncomeAcc: 0,
    lastHour: 8,
    rng,
  };
}

// ---------------------------------------------------------------- save

export function saveGame(s) {
  try {
    const data = {
      money: s.money, score: s.score, carsStolen: s.carsStolen,
      coins: coinsSave(s.coins),
      missionsDone: s.missions.done,
      storyComplete: s.missions.storyComplete,
      fareDone: s.side.fareDone,
      deliveryDone: s.side.deliveryDone,
      turf: turfSave(s.turf),
      mods: modsSave(s.mods),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage unavailable — the game still plays */ }
}

export function loadSave(s) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (typeof d.money === 'number') s.money = d.money;
    if (typeof d.score === 'number') s.score = d.score;
    if (typeof d.carsStolen === 'number') s.carsStolen = d.carsStolen;
    coinsLoad(s.coins, d.coins);
    if (Array.isArray(d.missionsDone)) s.missions.done = d.missionsDone.filter((n) => typeof n === 'number');
    if (d.storyComplete) s.missions.storyComplete = true;
    if (typeof d.fareDone === 'number') s.side.fareDone = d.fareDone;
    if (typeof d.deliveryDone === 'number') s.side.deliveryDone = d.deliveryDone;
    turfLoad(s.turf, d.turf);
    modsLoad(s.mods, d.mods);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- helpers

function toast(s, text) {
  s.toasts.push({ text, ttl: 4 });
  if (s.toasts.length > 4) s.toasts.shift();
}

function setBanner(s, text, seconds = 6) {
  s.banner = text;
  s.bannerTimer = seconds;
}

function addMoney(s, amount, why) {
  s.money += amount;
  s.score += Math.max(0, Math.round(amount / 2));
  if (why) toast(s, `${why} +$${amount}`);
}

function commitCrime(s, amount) {
  s.heat = addHeat(s.heat, amount);
  s.lastCrime = s.time;
}

// ---------------------------------------------------------------- the game

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sounds = new SoundBank();
    this.state = createState();
    this.last = 0;
    this.running = false;
    loadSave(this.state);
  }

  get screen() { return this.state.screen; }

  start() {
    setupCanvas(this.canvas);
    this.input.attach(this.canvas);
    installShotsHook(this);
    this.running = true;
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016);
      this.last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // -- hooks used by shots.js / the play-test -------------------------------

  toBoard() {
    this.state.screen = 'board';
  }

  clearMission() {
    this.state.missions.active = null;
  }

  startMission(n) {
    const s = this.state;
    s.screen = 'play';
    const m = startMission(s.missions, n);
    if (m) {
      if (m.job.stars > 0) s.heat = addHeat(s.heat, m.job.stars * 100);
      setBanner(s, m.job.objective, 8);
      this.sounds.click();
      return true;
    }
    return false;
  }

  setHeat(h) {
    this.state.heat = Math.max(0, Math.min(HEAT_MAX, h));
    this.state.stars = starsFor(this.state.heat);
  }

  teleport(x, y) {
    const s = this.state;
    s.player.x = Math.max(20, Math.min(WORLD - 20, x));
    s.player.y = Math.max(20, Math.min(WORLD - 20, y));
    if (s.player.inCar && s.player.car) {
      s.player.car.x = s.player.x;
      s.player.car.y = s.player.y;
    }
  }

  stageDrive() {
    const s = this.state;
    s.screen = 'play';
    // Plain driving shot: the player in the Falco, eastbound on the
    // Neon Strip road, no wanted level, mission 1 running.
    const falco = s.cars.find((c) => c.model === 'Falco');
    if (falco && !falco.wrecked) {
      falco.x = 1500; falco.y = 678; falco.angle = 0;
      this.enterCar(falco);
    }
    this.setHeat(0);
    setBanner(s, 'Steal the Falco, then reach the garage marker.', 8);
  }

  stageChase() {
    const s = this.state;
    s.screen = 'play';
    // Put the player in the Falco, driving down the Neon Strip.
    const falco = s.cars.find((c) => c.model === 'Falco');
    if (falco && !falco.wrecked) {
      falco.x = 1800; falco.y = 678; falco.angle = 0;
      this.enterCar(falco);
    }
    this.startMission(6);
    this.setHeat(450); // 4 stars, mid-band (set after the mission's own heat)
    this.spawnRoadblock();
    this.spawnPolice();
    setBanner(s, 'Reach Pier 9 before the timer runs out. 3 stars from the start.', 8);
  }

  stageMission7() {
    const s = this.state;
    s.screen = 'play';
    this.teleport(1900, 420);
    s.combat.ammo = 12;
    s.combat.reserve = 48;
    this.startMission(7);
    this.setHeat(450); // 4-star manhunt, mid-band (set after the mission's own heat)
    setBanner(s, "Clear the 3 guards, grab Kane's ledger, then escape to the Marina in 90 seconds.", 8);
  }

  // -- cars -----------------------------------------------------------------

  enterCar(car) {
    const s = this.state;
    if (car.wrecked) {
      toast(s, 'Wrecked — this car will never drive again.');
      return false;
    }
    const p = s.player;
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = 0;
    if (!car.stolen) {
      car.stolen = true;
      s.carsStolen++;
      s.score += 50;
      commitCrime(s, HEAT_CRIME_STEAL);
      toast(s, `Stole the ${car.model}! +1 wanted heat`);
      this.sounds.siren();
    }
    return true;
  }

  exitCar() {
    const s = this.state;
    const p = s.player;
    if (!p.inCar || !p.car) return;
    p.car.speed = 0;
    p.inCar = false;
    p.x = Math.max(20, Math.min(WORLD - 20, p.x + Math.cos(p.angle + Math.PI / 2) * 30));
    p.y = Math.max(20, Math.min(WORLD - 20, p.y + Math.sin(p.angle + Math.PI / 2) * 30));
    p.car = null;
    p.speed = 0;
  }

  // -- police / roadblocks / helicopter -------------------------------------

  spawnPolice() {
    const s = this.state;
    const want = Math.min(4, Math.max(0, s.stars));
    while (s.police.length < want) {
      const a = s.rng() * Math.PI * 2;
      const x = Math.max(60, Math.min(WORLD - 60, s.player.x + Math.cos(a) * 500));
      const y = Math.max(60, Math.min(WORLD - 60, s.player.y + Math.sin(a) * 500));
      s.police.push({ x, y, angle: 0, speed: 0, path: [], repath: 0, siren: true, ramCd: 0 });
    }
    while (s.police.length > want) s.police.pop();
  }

  spawnRoadblock() {
    const s = this.state;
    if (s.roadblocks.length > 0) return;
    const p = s.player;
    // Ahead of the player, snapped to the nearest road.
    const ahead = 320;
    const ax = p.x + Math.cos(p.angle) * ahead;
    const ay = p.y + Math.sin(p.angle) * ahead;
    const ri = nearestRoadIndex(Math.abs(Math.cos(p.angle)) > Math.abs(Math.sin(p.angle)) ? ay : ax);
    const horizontal = Math.abs(Math.cos(p.angle)) > Math.abs(Math.sin(p.angle));
    const bx = horizontal ? ax : roadPos(ri);
    const by = horizontal ? roadPos(ri) : ay;
    const ang = horizontal ? 0 : Math.PI / 2;
    s.roadblocks.push({
      x: bx, y: by,
      barriers: [{ x: bx - 20, y: by, angle: ang }, { x: bx + 20, y: by, angle: ang }],
      cruisers: [
        { x: bx - 60, y: by + (horizontal ? 0 : 0), angle: ang },
        { x: bx + 60, y: by, angle: ang },
      ],
    });
    toast(s, 'SCPD roadblock ahead!');
  }

  clearRoadblocks() {
    this.state.roadblocks = [];
  }

  // -- frame ----------------------------------------------------------------

  frame(dt) {
    const s = this.state;
    const input = this.input;
    s.time += dt;
    this.handleScreens(input);
    if (s.screen === 'play' && !s.overlay) this.update(dt);
    this.render();
    input.consume();
  }

  handleScreens(input) {
    const s = this.state;
    if (input.wasPressed('m')) {
      const muted = this.sounds.toggleMute();
      toast(s, muted ? 'Muted' : 'Sound on');
    }
    if (s.overlay === 'modshop') {
      if (input.wasPressed('Escape') || input.wasPressed('p')) s.overlay = null;
      if (input.wasClicked()) this.handleModShopClick();
      return;
    }
    if (s.screen === 'title') {
      if (input.wasPressed('Enter') || input.wasClicked()) {
        this.sounds.ensure();
        this.sounds.click();
        s.screen = 'board';
      }
      return;
    }
    if (s.screen === 'board') {
      if (input.wasPressed('Escape') || input.wasPressed('Enter')) s.screen = 'play';
      if (input.wasClicked()) this.handleBoardClick();
      return;
    }
    if (s.screen === 'pause') {
      if (input.wasPressed('p') || input.wasPressed('Escape') || input.wasPressed('Enter')) s.screen = 'play';
      return;
    }
    if (s.screen === 'wasted') {
      if (input.wasPressed('Enter') || input.wasClicked()) this.respawn();
      return;
    }
    // play screen
    if (input.wasPressed('p') || input.wasPressed('Escape')) { s.screen = 'pause'; return; }
    if (input.wasPressed('Enter')) { s.screen = 'board'; return; }
  }

  handleBoardClick() {
    const s = this.state;
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    for (const card of s.boardCards || []) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        this.sounds.click();
        if (card.kind === 'job') {
          if (this.startMission(card.id)) s.screen = 'play';
          else toast(s, 'That job is already done or running.');
        } else if (card.kind === 'race') {
          const race = RACES.find((r) => r.id === card.id);
          s.screen = 'play';
          this.teleport(race.start.x, race.start.y);
          toast(s, `${race.name}: press Q at the flag to start the race.`);
        }
        return;
      }
    }
  }

  handleModShopClick() {
    const s = this.state;
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    for (const card of s.modCards || []) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        const res = buyMod(s.mods, card.cat, s.money);
        if (res.ok) {
          s.money -= res.price;
          this.sounds.cash();
          toast(s, `${card.cat} upgraded to level ${res.level} — $${res.price}`);
          if (s.player.car) this.applyModsToCar(s.player.car);
          saveGame(s);
        } else if (res.reason === 'broke') {
          toast(s, 'Not enough cash for that upgrade.');
        } else {
          toast(s, 'Already maxed out.');
        }
        return;
      }
    }
  }

  applyModsToCar(car) {
    const s = this.state;
    const base = CARS.find((c) => c.model === car.model);
    const stats = moddedCarStats(s.mods, { top: base.top, accel: base.accel, maxHealth: CAR_MAX_HEALTH });
    car.top = stats.top;
    car.accel = stats.accel;
    const newMax = Math.round(stats.maxHealth);
    const ratio = car.health / car.maxHealth;
    car.maxHealth = newMax;
    car.health = Math.round(newMax * ratio);
  }

  respawn() {
    const s = this.state;
    const h = hospitalPoint();
    s.player.x = h.x;
    s.player.y = h.y;
    s.player.health = PLAYER_MAX_HEALTH;
    s.player.inCar = false;
    s.player.car = null;
    s.heat = 0;
    s.stars = 0;
    s.money = Math.max(0, s.money - 100);
    s.screen = 'play';
    toast(s, 'Hospital bill: -$100. Back on the streets.');
    saveGame(s);
  }

  update(dt) {
    const s = this.state;
    const input = this.input;
    const p = s.player;

    // Clock, weather, turf income by the hour.
    const roll = tickClock(s.clock, dt, s.rng);
    if (roll.changed) toast(s, `Weather: ${roll.weather}`);
    const hour = hourOf(s.clock);
    if (hour !== s.lastHour) {
      const income = turfIncome(s.turf, 1);
      if (income > 0) addMoney(s, income, `Turf income +$${income}`);
      s.lastHour = hour;
    }

    // Banner / toasts.
    if (s.bannerTimer > 0) {
      s.bannerTimer -= dt;
      if (s.bannerTimer <= 0) s.banner = '';
    }
    for (const t of s.toasts) t.ttl -= dt;
    s.toasts = s.toasts.filter((t) => t.ttl > 0);
    if (s.damageCooldown > 0) s.damageCooldown -= dt;
    if (s.policeRamCooldown > 0) s.policeRamCooldown -= dt;
    if (s.rivalHitCooldown > 0) s.rivalHitCooldown -= dt;

    // Wanted decay: lay low and the heat bleeds off.
    if (s.time - s.lastCrime > 5 && s.heat > 0) {
      s.heat = Math.max(0, s.heat - HEAT_DECAY * dt);
    }
    const newStars = starsFor(s.heat);
    if (newStars !== s.stars) {
      s.stars = newStars;
      if (newStars > 0) this.sounds.siren();
    }
    this.spawnPolice();
    if (s.stars >= 4 && s.roadblocks.length === 0) this.spawnRoadblock();
    if (s.stars < 4 && s.roadblocks.length > 0) this.clearRoadblocks();
    if (s.stars >= 5 && !s.heli) {
      s.heli = { x: p.x - 200, y: p.y - 200, angle: 0 };
      toast(s, 'SCPD helicopter overhead — you cannot outrun it on the road!');
    }
    if (s.stars < 5) s.heli = null;
    if (s.heli) {
      const h = s.heli;
      const a = Math.atan2(p.y - h.y, p.x - h.x);
      h.angle = a;
      h.x += Math.cos(a) * 480 * dt;
      h.y += Math.sin(a) * 480 * dt;
    }

    // -- player movement ----------------------------------------------------
    const grip = gripFactor(s.clock.weather);
    if (p.inCar && p.car) {
      this.updateCar(dt, grip);
    } else {
      this.updateOnFoot(dt);
    }

    // Steal / exit car.
    if (input.wasPressed('e')) {
      if (p.inCar) this.exitCar();
      else {
        let best = null;
        let bd = Infinity;
        for (const c of s.cars) {
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < 52 && d < bd) { bd = d; best = c; }
        }
        if (best) this.enterCar(best);
        else if (inPaintShop(p.x, p.y)) {
          const res = paintShopService(s);
          this.sounds.cash();
          toast(s, res.clearedHeat || res.repaired ? "Lou's Paint Shop: heat cleared, car repaired." : "Lou's Paint Shop: nothing to fix.");
          s.stars = starsFor(s.heat);
        } else if (inModShop(p.x, p.y)) {
          s.overlay = 'modshop';
          this.sounds.click();
        } else {
          toast(s, 'No car close enough to steal.');
        }
      }
    }

    // Combat: shoot with the mouse, punch with F, reload with R.
    if (!p.inCar) {
      if (input.mouseDown && s.combat.ammo > 0) {
        const wx = s.cam.x + input.mouseX;
        const wy = s.cam.y + input.mouseY;
        const b = fireBullet(s.combat, p.x, p.y, wx, wy);
        if (b) {
          this.sounds.shot();
          commitCrime(s, HEAT_CRIME_SHOT);
          p.angle = Math.atan2(wy - p.y, wx - p.x);
        }
      }
      if (input.wasPressed('r')) {
        if (startReload(s.combat)) toast(s, 'Reloading…');
      }
      if (input.wasPressed('f')) {
        const targets = [];
        if (s.missions.active && s.missions.active.job.id === 7) targets.push(...s.missions.active.guards);
        targets.push(...s.rivals);
        const hit = punch(s.combat, p.x, p.y, p.angle, targets);
        if (hit) this.sounds.punch();
      }
      // Ammo pickups: a shot-down guard drops ammo.
      const targets = [];
      if (s.missions.active && s.missions.active.job.id === 7) targets.push(...s.missions.active.guards);
      targets.push(...s.rivals);
      const hits = updateBullets(s.combat, dt, targets);
      for (const h of hits) {
        if (h.target.hp <= 0 && h.target.kind === 'guard') {
          // A downed guard drops ammo; the $50 guard drops are paid with
          // the job-7 completion bonus (3 x $50), so the job totals $4,150.
          s.combat.reserve += 12;
          toast(s, 'Guard down — +12 ammo');
        }
        if (h.target.hp <= 0 && h.target.kind === 'rival') {
          toast(s, 'Rival down!');
        }
      }
      // Guards shoot back.
      if (s.missions.active && s.missions.active.job.id === 7) {
        const shots = guardsShoot(s.missions.active.guards, p, dt);
        for (const sh of shots) {
          p.health -= sh.damage;
          if (p.health <= 0) { this.die(); return; }
        }
      }
    } else {
      // Bullets still fly while driving (drive-by is off; clear them).
      s.combat.bullets = [];
    }

    // Coins.
    const got = collectCoins(s.coins, p.x, p.y);
    if (got.count > 0) {
      this.sounds.coin();
      addMoney(s, got.value, `Solmar coin +$${got.value}`);
    }

    // Taxi fare: press T near the pickup (the tick below honours the press).
    if (input.wasPressed('t') && !s.side.fare) offerFare(s.side);

    // Race start: press Q at a starter flag, in a car.
    if (input.wasPressed('q')) {
      const race = raceAt(p.x, p.y);
      if (race) {
        if (!p.inCar) toast(s, 'Get in a car first — races are driven, not run.');
        else if (startRace(s.raceState, race.id)) {
          setBanner(s, `${race.name}: hit every checkpoint before the par time!`, 6);
          this.sounds.checkpoint();
        }
      }
    }

    // Turf challenge: press G inside a rival zone.
    if (input.wasPressed('g')) {
      const z = zoneAt(p.x, p.y);
      if (z && s.turf.owners[z.id] !== 'You') {
        if (startChallenge(s.turf, z.id)) {
          setBanner(s, `Turf war: hold ${z.name} for 30 seconds!`, 6);
          this.sounds.siren();
        }
      } else if (z) {
        toast(s, 'This zone is already yours.');
      }
    }

    // Side jobs tick (fares, deliveries, near-miss via traffic below).
    const nearFn = (x, y, r) => Math.hypot(x - p.x, y - p.y) <= r;
    const sideEvents = tickSideJobs(s.side, dt, nearFn, s.stars, input.wasPressed('t'));
    for (const ev of sideEvents) {
      if (ev.type === 'fare-paid') { addMoney(s, ev.amount, `Fare to ${ev.district}`); this.sounds.cash(); }
      if (ev.type === 'fare-failed') toast(s, 'Fare lost — too slow.');
      if (ev.type === 'delivery-paid') { addMoney(s, ev.amount, 'Delivery complete'); this.sounds.cash(); }
      if (ev.type === 'delivery-failed') toast(s, 'Delivery failed — the package went cold.');
      if (ev.type === 'delivery-spotted') {
        commitCrime(s, 40);
        toast(s, 'Spotted by police mid-delivery — heat rising!');
      }
    }

    // Offer fares/deliveries over time.
    s.fareOfferTimer -= dt;
    if (s.fareOfferTimer <= 0) {
      s.fareOfferTimer = 25;
      if (!s.side.fare) offerFare(s.side);
    }
    s.deliveryOfferTimer -= dt;
    if (s.deliveryOfferTimer <= 0) {
      s.deliveryOfferTimer = 60;
      if (!s.side.delivery) offerDelivery(s.side);
    }

    // Races tick.
    const raceEvents = tickRace(s.raceState, dt, nearFn);
    for (const ev of raceEvents) {
      if (ev.type === 'checkpoint') this.sounds.checkpoint();
      if (ev.type === 'won') { addMoney(s, ev.amount, `${ev.race.name} won in ${ev.time.toFixed(1)}s`); this.sounds.cash(); }
      if (ev.type === 'lost') toast(s, `${ev.race.name} failed — too slow. Retry at the flag.`);
    }

    // Turf challenge tick.
    const zone = zoneAt(p.x, p.y);
    const challenge = s.turf.challenge;
    if (challenge) {
      const inZone = zone && zone.id === challenge.zoneId;
      const turfEvents = tickChallenge(s.turf, dt, !!inZone, false);
      for (const ev of turfEvents) {
        if (ev.type === 'rival') {
          const z = ev.zone;
          s.rivals.push({
            x: Math.max(40, Math.min(WORLD - 40, p.x + (s.rng() < 0.5 ? -1 : 1) * 160)),
            y: Math.max(40, Math.min(WORLD - 40, p.y + (s.rng() < 0.5 ? -1 : 1) * 160)),
            kind: 'rival', hp: 60, r: 12, speed: 95, hitCd: 0,
          });
          toast(s, `A ${z.crew} rival showed up!`);
        }
        if (ev.type === 'flipped') { addMoney(s, 100, `${ev.zone.name} is yours now`); this.sounds.cash(); }
        if (ev.type === 'fled') toast(s, 'You left the zone — the turf war is off.');
        if (ev.type === 'all-held') { addMoney(s, ev.amount, 'ALL TURF HELD — bonus'); this.sounds.cash(); }
      }
    }

    // Rivals chase and hit the player.
    for (const r of s.rivals) {
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      if (d > 8) {
        const a = Math.atan2(p.y - r.y, p.x - r.x);
        r.x += Math.cos(a) * r.speed * dt;
        r.y += Math.sin(a) * r.speed * dt;
      }
      if (d < 26 && s.rivalHitCooldown <= 0) {
        s.rivalHitCooldown = 0.9;
        p.health -= 8;
        this.sounds.punch();
        if (p.health <= 0) { this.die(); return; }
      }
    }
    s.rivals = s.rivals.filter((r) => r.hp > 0);

    // Missions tick.
    if (s.missions.active) {
      const ctx = {
        x: p.x, y: p.y, inCar: p.inCar,
        carModel: p.car ? p.car.model : null,
      };
      const mEvents = tickMission(s.missions, dt, ctx);
      for (const ev of mEvents) {
        if (ev.type === 'stage') setBanner(s, ev.text, 6);
        if (ev.type === 'paid') {
          addMoney(s, ev.amount, `${ev.job.name} complete`);
          this.sounds.cash();
          saveGame(s);
        }
        if (ev.type === 'failed') toast(s, `${ev.job.name} failed — ${ev.reason === 'time' ? 'out of time' : 'aborted'}. Try again from the board.`);
        if (ev.type === 'story-complete') {
          setBanner(s, 'STORY COMPLETE — you are a Solmar Legend!', 10);
          toast(s, 'The Last Ledger: $4,150 total. Story complete!');
        }
      }
    }

    // Traffic + pedestrians.
    this.updateTraffic(dt);
    this.updatePeds(dt);

    // Police pursuit.
    this.updatePolice(dt);

    // Near-miss bonus while driving fast.
    if (p.inCar && p.car) {
      let closest = Infinity;
      for (const t of s.traffic) {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d < closest) closest = d;
      }
      const pay = checkNearMiss(s.side, Math.abs(p.speed), closest);
      if (pay > 0) {
        this.sounds.whoosh();
        addMoney(s, pay, 'Near miss!');
      }
    }

    // Speeding past police adds a little heat.
    if (p.inCar && Math.abs(p.speed) > 380) {
      for (const pc of s.police) {
        if (Math.hypot(pc.x - p.x, pc.y - p.y) < 220) {
          commitCrime(s, HEAT_CRIME_SPEED * dt);
          break;
        }
      }
    }

    // Camera follows the player.
    s.cam.x = clamp(p.x - VIEW_W / 2, 0, WORLD - VIEW_W);
    s.cam.y = clamp(p.y - VIEW_H / 2, 0, WORLD - VIEW_H);

    // Autosave every 10 seconds.
    s.saveTimer += dt;
    if (s.saveTimer > 10) {
      s.saveTimer = 0;
      saveGame(s);
    }

    // Derived HUD fields.
    s.stars = starsFor(s.heat);
    s.rank = rankFor(s.score);
    s.clockText = clockText(s.clock);
    s.turfZonesHeld = zonesHeld(s.turf);
    s.turfIncome = s.turfZonesHeld * 5;
    s.modsSpent = modsSpent(s.mods);
    s.missionTarget = missionTarget(s.missions);
    s.district = districtAt(p.x, p.y);
  }

  updateOnFoot(dt) {
    const s = this.state;
    const input = this.input;
    const p = s.player;
    let mx = 0;
    let my = 0;
    if (input.down('w', 'ArrowUp')) my -= 1;
    if (input.down('s', 'ArrowDown')) my += 1;
    if (input.down('a', 'ArrowLeft')) mx -= 1;
    if (input.down('d', 'ArrowRight')) mx += 1;
    if (mx === 0 && my === 0) { p.speed = 0; return; }
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const sprint = input.down('Shift') ? SPRINT_MULT : 1;
    const sp = PLAYER_SPEED * sprint;
    p.angle = Math.atan2(my, mx);
    p.speed = sp;
    let nx = p.x + mx * sp * dt;
    let ny = p.y + my * sp * dt;
    nx = Math.max(20, Math.min(WORLD - 20, nx));
    ny = Math.max(20, Math.min(WORLD - 20, ny));
    if (inCanal(nx, ny)) { nx = p.x; ny = p.y; }
    if (!hitBuilding(s.city.buildings, nx, ny, 11)) {
      p.x = nx;
      p.y = ny;
    }
  }

  updateCar(dt, grip) {
    const s = this.state;
    const input = this.input;
    const p = s.player;
    const car = p.car;
    // Mods apply to the MODEL's base stats, never to the car's live stats
    // (applying them to live stats would stack the bonus every frame).
    const base = CARS.find((c) => c.model === car.model);
    const stats = moddedCarStats(s.mods, { top: base.top, accel: base.accel, maxHealth: CAR_MAX_HEALTH });
    const top = stats.top * grip;
    const accel = CAR_ACCEL * car.accel * stats.accel * grip;
    const handbrake = input.down(' ');
    let throttle = 0;
    if (input.down('w', 'ArrowUp')) throttle = 1;
    if (input.down('s', 'ArrowDown')) throttle = -0.6;
    if (throttle > 0) car.speed += accel * dt;
    else if (throttle < 0) car.speed += accel * throttle * dt;
    else car.speed *= Math.max(0, 1 - 1.4 * dt);
    if (handbrake) {
      car.speed *= Math.max(0, 1 - 4.5 * dt);
    }
    car.speed = clamp(car.speed, -top * 0.45, top);
    const steer = (input.down('a', 'ArrowLeft') ? -1 : 0) + (input.down('d', 'ArrowRight') ? 1 : 0);
    const turnRate = CAR_TURN * (handbrake ? 1.5 : 1) * (stats.grip || 1) * clamp(Math.abs(car.speed) / 120, 0, 1);
    car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hitWall =
      hitBuilding(s.city.buildings, nx, ny, 18) ||
      nx < 20 || nx > WORLD - 20 || ny < 20 || ny > WORLD - 20 ||
      inCanal(nx, ny);
    if (hitWall) {
      if (Math.abs(car.speed) > 60 && s.damageCooldown <= 0) {
        s.damageCooldown = 0.5;
        car.health -= WALL_DAMAGE;
        this.sounds.crash();
        toast(s, `Crash! Car condition -${WALL_DAMAGE}`);
        if (car.health <= 0) {
          car.health = 0;
          car.wrecked = true;
          toast(s, 'The car is totaled!');
          this.exitCar();
          p.x = Math.max(20, Math.min(WORLD - 20, nx));
          p.y = Math.max(20, Math.min(WORLD - 20, ny));
          return;
        }
      }
      car.speed *= -0.25;
    } else {
      car.x = nx;
      car.y = ny;
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    // Driving fast through the rain is a little slippery — handled by grip.
  }

  updateTraffic(dt) {
    const s = this.state;
    const target = trafficTarget(hourOf(s.clock));
    while (s.traffic.length < target) {
      const horizontal = s.rng() < 0.5;
      const road = Math.floor(s.rng() * 9);
      const along = 100 + s.rng() * 2240;
      const dir = s.rng() < 0.5 ? 1 : -1;
      const x = horizontal ? along : road * 0 + (136 + road * 271);
      const y = horizontal ? 136 + road * 271 : along;
      if (Math.hypot(x - s.player.x, y - s.player.y) < 320) continue;
      const model = CARS[Math.floor(s.rng() * CARS.length)];
      s.traffic.push({
        x, y,
        angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
        speed: (140 + s.rng() * 90) * dir,
        color: model.color, model: model.model,
        horizontal, road,
      });
    }
    const next = [];
    for (const t of s.traffic) {
      if (t.horizontal) {
        t.x += Math.cos(t.angle) * Math.abs(t.speed) * dt;
        if (t.x < -40) t.x = WORLD + 40;
        if (t.x > WORLD + 40) t.x = -40;
      } else {
        t.y += Math.sin(t.angle) * Math.abs(t.speed) * dt;
        if (t.y < -40) t.y = WORLD + 40;
        if (t.y > WORLD + 40) t.y = -40;
      }
      // A traffic car that hits the player car costs car health.
      const p = s.player;
      if (p.inCar && p.car && Math.hypot(t.x - p.x, t.y - p.y) < 26 && s.damageCooldown <= 0) {
        s.damageCooldown = 0.6;
        p.car.health -= 5;
        this.sounds.crash();
        if (p.car.health <= 0) {
          p.car.health = 0;
          p.car.wrecked = true;
          toast(s, 'The car is totaled!');
          this.exitCar();
        }
      }
      if (Math.hypot(t.x - s.player.x, t.y - s.player.y) < 1600) next.push(t);
    }
    s.traffic = next.slice(0, target + 6);
  }

  updatePeds(dt) {
    const s = this.state;
    while (s.peds.length < 10) {
      const road = Math.floor(s.rng() * 9);
      const along = 100 + s.rng() * 2240;
      const horizontal = s.rng() < 0.5;
      s.peds.push({
        x: horizontal ? along : 136 + road * 271 + 26,
        y: horizontal ? 136 + road * 271 + 26 : along,
        angle: s.rng() * Math.PI * 2,
        speed: 28 + s.rng() * 22,
        color: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'][Math.floor(s.rng() * 5)],
        turn: 0,
      });
    }
    for (const pd of s.peds) {
      pd.turn -= dt;
      if (pd.turn <= 0) {
        pd.turn = 2 + s.rng() * 4;
        pd.angle += (s.rng() - 0.5) * 1.6;
      }
      let nx = pd.x + Math.cos(pd.angle) * pd.speed * dt;
      let ny = pd.y + Math.sin(pd.angle) * pd.speed * dt;
      if (nx < 30 || nx > WORLD - 30 || ny < 30 || ny > WORLD - 30 || hitBuilding(s.city.buildings, nx, ny, 8) || inCanal(nx, ny)) {
        pd.angle += Math.PI;
        nx = pd.x;
        ny = pd.y;
      }
      pd.x = nx;
      pd.y = ny;
    }
  }

  updatePolice(dt) {
    const s = this.state;
    const p = s.player;
    for (const pc of s.police) {
      pc.repath -= dt;
      if (pc.repath <= 0) {
        pc.repath = 1.0;
        pc.path = bfsPath(pc.x, pc.y, p.x, p.y);
      }
      const target = pc.path.length > 0 ? pc.path[0] : { x: p.x, y: p.y };
      const d = Math.hypot(target.x - pc.x, target.y - pc.y);
      if (d < 24 && pc.path.length > 0) pc.path.shift();
      const want = Math.atan2(target.y - pc.y, target.x - pc.x);
      pc.angle += clamp(angleDiff(pc.angle, want), -2.4 * dt, 2.4 * dt);
      const speed = 300 + s.stars * 18;
      pc.x += Math.cos(pc.angle) * speed * dt;
      pc.y += Math.sin(pc.angle) * speed * dt;
      pc.x = Math.max(20, Math.min(WORLD - 20, pc.x));
      pc.y = Math.max(20, Math.min(WORLD - 20, pc.y));
      // Ramming the player costs health.
      if (Math.hypot(pc.x - p.x, pc.y - p.y) < 30) {
        if (p.inCar && p.car && s.policeRamCooldown <= 0) {
          s.policeRamCooldown = 0.8;
          p.car.health -= 4;
          this.sounds.crash();
          if (p.car.health <= 0) {
            p.car.health = 0;
            p.car.wrecked = true;
            toast(s, 'The car is totaled!');
            this.exitCar();
          }
        } else if (!p.inCar && s.policeRamCooldown <= 0) {
          s.policeRamCooldown = 0.8;
          p.health -= 6;
          if (p.health <= 0) { this.die(); return; }
        }
      }
    }
  }

  die() {
    const s = this.state;
    s.screen = 'wasted';
    this.sounds.wasted();
    if (s.turf.challenge) {
      tickChallenge(s.turf, 0, false, true);
    }
    saveGame(s);
  }

  render() {
    const s = this.state;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (s.screen === 'title') {
      drawTitle(ctx, s);
      return;
    }
    if (s.screen === 'board') {
      drawBoard(ctx, s);
      return;
    }
    if (s.screen === 'wasted') {
      drawWasted(ctx, s);
      return;
    }
    // Play / pause: draw the world, then the pause panel on top.
    ctx.save();
    ctx.translate(-s.cam.x, -s.cam.y);
    drawWorld(ctx, s, s.cam);
    drawEntities(ctx, s);
    ctx.restore();
    drawNightOverlay(ctx, s);
    drawHUD(ctx, s);
    drawMinimap(ctx, s);
    if (s.overlay === 'modshop') drawModShop(ctx, s);
    if (s.screen === 'pause') drawPause(ctx, s);
  }
}

/** Boot the game when the page loads. */
export function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  game.start();
  return game;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
