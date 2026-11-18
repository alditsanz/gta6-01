// Solmar Heat — shots: the four staged scenes the screenshots are
// taken from. A `?shot=start|drive|chase|mission&seed=N` URL sets
// the game up in that scene before the first frame is drawn.
SH.applyShot = function (S, shot) {
  var p = S.player;
  if (shot === 'start') {
    S.screen = 'title';
    return;
  }
  S.screen = 'play';
  if (shot === 'drive') {
    // Cruising down Sunset Mile in the Falco.
    var falco = S.cars[0];
    p.car = falco;
    p.x = falco.x; p.y = falco.y; p.angle = 0;
    falco.x = 628; falco.y = 374; falco.angle = 0;
    p.x = 628; p.y = 374;
    p.speed = 190;
    S.money = 1250;
    S.score = 1450;
    S.carsStolen = 1;
    return;
  }
  if (shot === 'chase') {
    // Job 6, Pier 9 Getaway, at full heat: 5 stars, cruisers,
    // a roadblock ahead and the helicopter overhead.
    SH.startMission(S, 6);
    S.heat = 500;
    S.lastCrimeT = S.time;
    p.car = S.cars[0];
    p.x = 1136; p.y = 1136; p.angle = 0;
    p.speed = 210;
    S.cars[0].x = 1136; S.cars[0].y = 1136;
    S.mission.timer = 42;
    SH.updatePolice(S, 0.1);
    SH.updateHeli(S, 0.1);
    SH.updateRoadblocks(S);
    S.money = 2340;
    S.score = 2600;
    S.carsStolen = 1;
    return;
  }
  if (shot === 'mission') {
    // Job 7, The Last Ledger, at SCPD Headquarters: guards with
    // health pips, the ledger to grab, 4 stars on the HUD.
    SH.startMission(S, 7);
    S.mission.stage = 1;
    SH.spawnGuards(S, 1898, 628, 3);
    S.heat = 450;
    S.lastCrimeT = S.time;
    p.x = 1760; p.y = 628; p.aim = 0;
    p.ammo = 12; p.reserve = 48;
    S.money = 3100;
    S.score = 4200;
    S.carsStolen = 3;
    return;
  }
};
