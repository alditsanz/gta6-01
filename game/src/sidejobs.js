// Solmar Heat — sidejobs: taxi fares, the Canal Row delivery run,
// and near-miss bonuses. All three pay cash and feed the score.
SH.newFare = function (S) {
  var rng = SH.makeRng((S.time * 1000 | 0) + S.fares * 7919 + 13);
  var spots = [
    { x: 374, y: 628 }, { x: 882, y: 1136 }, { x: 1390, y: 374 },
    { x: 1898, y: 882 }, { x: 628, y: 1644 }, { x: 2152, y: 1390 },
    { x: 1136, y: 2152 }, { x: 1644, y: 628 }
  ];
  var a = SH.pick(rng, spots), b = SH.pick(rng, spots);
  if (a === b) b = spots[(spots.indexOf(a) + 3) % spots.length];
  return {
    pickup: { x: a.x, y: a.y }, drop: { x: b.x, y: b.y },
    pay: SH.FARE_MIN + Math.floor(rng() * (SH.FARE_MAX - SH.FARE_MIN)),
    stage: 'pickup'
  };
};

// Press T near a fare: the passenger climbs in.
SH.tryTaxi = function (S) {
  var p = S.player;
  if (!p.car) { S.message = 'You need a car for a fare.'; S.messageT = 1.5; return; }
  if (S.taxi) { S.message = 'Already carrying a fare.'; S.messageT = 1.5; return; }
  S.taxi = SH.newFare(S);
  S.message = 'Fare waiting — pick them up (gold dot).';
  S.messageT = 2;
  SH.sfx('fare');
};

SH.updateTaxi = function (S, dt) {
  if (!S.taxi) return;
  var p = S.player;
  var t = S.taxi.stage === 'pickup' ? S.taxi.pickup : S.taxi.drop;
  if (SH.dist(p.x, p.y, t.x, t.y) < 46) {
    if (S.taxi.stage === 'pickup') {
      S.taxi.stage = 'drop';
      S.message = 'Passenger aboard — drive to the gold dot.';
      S.messageT = 2;
      SH.sfx('fare');
    } else {
      S.money += S.taxi.pay;
      S.score += 150;
      S.fares++;
      S.message = 'Fare complete! +$' + S.taxi.pay;
      S.messageT = 2.5;
      SH.sfx('cash');
      S.taxi = null;
      SH.saveGame(S);
    }
  }
};

// Delivery (round 5): E at Old Town Market picks the parcel up;
// Pier 9 pays out. Carrying it makes the police spot you faster.
SH.tryDelivery = function (S) {
  var p = S.player;
  if (S.delivery) return false;
  var pk = SH.DELIVERY.pickup;
  if (SH.dist(p.x, p.y, pk.x, pk.y) > 60) return false;
  S.delivery = { stage: 'carry', timer: SH.DELIVERY.time };
  S.message = 'Parcel picked up — run it to Pier 9!';
  S.messageT = 2.5;
  SH.sfx('fare');
  return true;
};

SH.updateDelivery = function (S, dt) {
  if (!S.delivery) return;
  var d = S.delivery, p = S.player;
  d.timer -= dt;
  if (d.timer <= 0) {
    S.delivery = null;
    S.message = 'Delivery late — the parcel job is gone.';
    S.messageT = 2.5;
    SH.sfx('fail');
    return;
  }
  if (SH.dist(p.x, p.y, SH.DELIVERY.drop.x, SH.DELIVERY.drop.y) < 56) {
    S.money += SH.DELIVERY.payout;
    S.score += 200;
    S.delivery = null;
    S.message = 'Delivery done! +$' + SH.DELIVERY.payout;
    S.messageT = 2.5;
    SH.sfx('cash');
    SH.saveGame(S);
  }
};

// Near-miss: threading past traffic at speed pays $15, with a
// 1.5-second cooldown so one pass pays once.
SH.checkNearMiss = function (S) {
  var p = S.player;
  if (!p.car || p.speed < 150) return;
  if (S.time - S.lastNearMiss < SH.NEAR_MISS_COOLDOWN) return;
  for (var i = 0; i < S.world.traffic.length; i++) {
    var tp = SH.trafficPos(S.world.traffic[i]);
    var d = SH.dist(p.x, p.y, tp.x, tp.y);
    if (d > 26 && d < 52) {
      S.lastNearMiss = S.time;
      S.money += SH.NEAR_MISS_VALUE;
      S.score += 10;
      S.nearMisses++;
      S.message = 'Near miss! +$' + SH.NEAR_MISS_VALUE;
      S.messageT = 1.2;
      SH.sfx('whoosh');
      return;
    }
  }
};
