// shots.js — deterministic screenshot scenarios.
// The screenshot harness loads the game with ?shot=<name> and this file
// arranges a real, playable scene (never a fake composite): the same
// update/render loop then draws it.

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

export function getShotName(search) {
  try {
    const q = new URLSearchParams(search || '');
    const s = q.get('shot');
    return SHOT_NAMES.includes(s) ? s : null;
  } catch (err) {
    return null;
  }
}

// Arrange `game` (the object built in main.js) into a named scene.
export function applyShotScenario(game, name) {
  const p = game.player;
  if (name === 'start') {
    game.mode = 'title';
    p.x = 660; p.y = 660; p.car = null;
    game.camera.x = p.x - 640; game.camera.y = p.y - 360;
    return game;
  }
  game.mode = 'play';
  if (name === 'drive') {
    const car = game.cars[0];
    car.x = 1180; car.y = 1180; car.angle = 0; car.speed = 210;
    game.enterCar(car);
    game.weather.setHour(11); game.weather.setWeather('clear');
    game.message = 'Driving the Falco through Downtown Solmar';
    game.messageT = 99;
    return game;
  }
  if (name === 'chase') {
    const car = game.cars[4];
    car.x = 1440; car.y = 920; car.angle = 0; car.speed = 260;
    game.enterCar(car);
    game.startMissionByIndex(5); // Pier 9 Getaway timer on the HUD
    game.setHeat(450); // 4 stars exactly: roadblocks + pursuit (set after the mission, whose own stars would stack)
    game.spawnRoadblock();
    game.missions.timeLeft = 96;
    game.weather.setHour(18); game.weather.setWeather('clear');
    // Police right behind the player so the chase reads in one frame.
    game.police.forEach((cop, i) => {
      cop.x = car.x - 130 - i * 70; cop.y = car.y + (i % 2 ? 30 : -30);
      cop.angle = 0;
    });
    game.message = 'Police chase! Lose them or reach Pier 9';
    game.messageT = 99;
    return game;
  }
  if (name === 'mission') {
    // The Last Ledger at SCPD HQ: guards with pips, stars, ammo on HUD.
    p.x = 660; p.y = 780; p.car = null;
    game.startMissionByIndex(6);
    game.setHeat(350); // mid-band 3+ stars shown with the heist
    game.police.forEach((cop, i) => { cop.x = 520 + i * 60; cop.y = 520; });
    game.weather.setHour(15); game.weather.setWeather('clear');
    game.message = 'The Last Ledger — clear the guards!';
    game.messageT = 99;
    return game;
  }
  return game;
}
