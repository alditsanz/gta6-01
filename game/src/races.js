// Solmar Heat — races: three street-race routes with checkered-flag
// starters. Enter a race, chase the checkpoints in order, beat the
// par time and the purse is yours. Miss the par and you can retry.
SH.raceAt = function (x, y) {
  for (var i = 0; i < SH.RACES.length; i++) {
    var r = SH.RACES[i];
    if (SH.dist(x, y, r.start.x, r.start.y) < 70) return r;
  }
  return null;
};

// Press E on a starter flag to begin that route.
SH.tryRace = function (S) {
  var p = S.player;
  if (S.race) return false;
  var r = SH.raceAt(p.x, p.y);
  if (!r) return false;
  S.race = {
    def: r, next: 0, timer: r.par,
    done: false, failed: false
  };
  S.message = r.name + ' — beat ' + r.par + 's for $' + r.payout + '!';
  S.messageT = 3;
  SH.sfx('race');
  return true;
};

SH.updateRace = function (S, dt) {
  if (!S.race || S.race.done || S.race.failed) return;
  var r = S.race, p = S.player;
  r.timer -= dt;
  if (r.timer <= 0) {
    r.failed = true;
    S.message = 'Race over — par time missed. Retry at the flag.';
    S.messageT = 3;
    SH.sfx('fail');
    S.race = null;
    return;
  }
  var cp = r.def.checkpoints[r.next];
  if (!cp) return;
  if (SH.dist(p.x, p.y, cp.x, cp.y) < 62) {
    r.next++;
    SH.sfx('checkpoint');
    if (r.next >= r.def.checkpoints.length) {
      r.done = true;
      S.money += r.def.payout;
      S.score += 300;
      S.racesWon = (S.racesWon || 0) + 1;
      S.message = r.def.name + ' won! +$' + r.def.payout;
      S.messageT = 3;
      SH.sfx('cash');
      S.race = null;
      SH.saveGame(S);
    } else {
      S.message = 'Checkpoint ' + r.next + '/' + r.def.checkpoints.length;
      S.messageT = 1.2;
    }
  }
};

// Where the next checkpoint is, for the HUD arrow and the minimap.
SH.raceTarget = function (S) {
  if (!S.race) return null;
  return S.race.def.checkpoints[S.race.next] || null;
};
