// Solmar Heat — collectibles: the ten hidden Solmar coins. Walk
// or drive over one and it pays $75, counts on the HUD and the
// minimap, and stays collected in the save.
SH.coinState = function () {
  var got = [];
  for (var i = 0; i < SH.COINS.length; i++) got.push(false);
  return got;
};

SH.checkCoins = function (S) {
  var p = S.player;
  for (var i = 0; i < SH.COINS.length; i++) {
    if (S.coinsGot[i]) continue;
    var c = SH.COINS[i];
    if (SH.dist(p.x, p.y, c.x, c.y) < 34) {
      S.coinsGot[i] = true;
      S.money += SH.COIN_VALUE;
      S.score += 100;
      S.message = 'Solmar coin! +$' + SH.COIN_VALUE;
      S.messageT = 2;
      SH.sfx('coin');
      SH.saveGame(S);
    }
  }
};

SH.coinsCollected = function (S) {
  var n = 0;
  for (var i = 0; i < S.coinsGot.length; i++) if (S.coinsGot[i]) n++;
  return n;
};
