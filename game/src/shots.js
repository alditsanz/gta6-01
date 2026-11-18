// shots.js — staged scenes for the four screenshots and the play-test.
// ?shot=start  → title screen
// ?shot=board  → mission board (7 jobs + 3 races + turf panel)
// ?shot=drive  → driving a stolen Falco through the city
// ?shot=chase  → mission 6 in progress, 4 stars, roadblock ahead, timer running
// ?shot=mission→ job 7 "The Last Ledger" at SCPD HQ, guards up, ammo and stars shown
// The scene is set up once the game has booted; window.__shotReady flips true
// after the first frame of the staged scene has rendered.

function shotParam() {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return new URLSearchParams(window.location.search).get('shot');
  } catch (e) { return null; }
}

function putPlayerInCar(modelIndex, x, y, angle, speed) {
  const car = G.cars[modelIndex];
  if (!car) return;
  car.x = x; car.y = y; car.angle = angle;
  G.player.x = x; G.player.y = y; G.player.angle = angle;
  G.player.onFoot = false;
  G.player.carId = car.id;
  G.player.speed = speed || 120;
  G.carsStolen = Math.max(G.carsStolen, 1);
}

function setupShot(name) {
  if (!name) return;
  if (name === 'start' || name === 'board') {
    G.screen = name === 'board' ? 'board' : 'title';
    return;
  }
  G.screen = 'play';
  if (name === 'drive') {
    putPlayerInCar(0, 826, 1091, 0, 330); // Falco, mid-city heading east at speed
    G.clockHours = 10;
    G.weather = 'clear';
    G.money = 1250;
    G.score = 900;
    spawnFare();
    return;
  }
  if (name === 'chase') {
    putPlayerInCar(0, 1091, 1200, 0, 330);
    G.clockHours = 18; // dusk, rush hour — heavy traffic
    G.weather = 'rain';
    G.money = 2400;
    G.score = 2600;
    startMission(5); // Pier 9 Getaway
    G.heat = 4 * CFG.heatPerStar + 10; // 4 stars, mid-band → roadblock spawns
    G.lastCrimeAt = G.time;
    G.roadblocks = [];
    updateRoadblocks();
    return;
  }
  if (name === 'mission') {
    G.player.x = LANDMARKS.hq.x - 40;
    G.player.y = LANDMARKS.hq.y + 160;
    G.player.angle = -Math.PI / 2;
    G.player.onFoot = true;
    G.clockHours = 21; // night, streetlights on
    G.weather = 'clear';
    G.money = 3800;
    G.score = 5200;
    G.ammo = 12;
    G.ammoReserve = 48;
    startMission(6); // The Last Ledger
    G.heat = 4 * CFG.heatPerStar + 10; // 4-star manhunt
    G.lastCrimeAt = G.time;
    return;
  }
}

// Run once, shortly after boot, so the first frames paint the staged scene.
function armShotSetup() {
  const name = shotParam();
  if (!name) return;
  let tries = 0;
  const tick = () => {
    tries++;
    if (typeof G !== 'undefined' && G.cars && G.cars.length > 0) {
      setupShot(name);
      if (typeof window !== 'undefined') {
        window.__shotReady = true;
        window.__shotName = name;
      }
    } else if (tries < 200) {
      setTimeout(tick, 25);
    }
  };
  setTimeout(tick, 50);
}

if (typeof window !== 'undefined') {
  window.__shotReady = false;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armShotSetup);
  else armShotSetup();
}
