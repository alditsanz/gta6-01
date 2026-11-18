// Solmar Heat — heli: the SCPD helicopter that joins the pursuit
// at 5 stars. It flies above the roads, faster than any cruiser,
// and only leaves when the heat drops below 5 stars.
SH.HELI_SPEED = 290;

SH.updateHeli = function (S, dt) {
  var p = S.player;
  var stars = SH.starsOf(S.heat);
  if (stars >= 5) {
    if (!S.heli.active) {
      S.heli.active = true;
      // Swoop in from the edge of the screen.
      S.heli.x = p.x + 500;
      S.heli.y = p.y - 420;
      S.message = 'SCPD helicopter overhead — lose the heat!';
      S.messageT = 3;
      SH.sfx('heli');
    }
    // Chase the player, always faster than the cruisers.
    var a = SH.angleTo(S.heli.x, S.heli.y, p.x, p.y);
    S.heli.x += Math.cos(a) * SH.HELI_SPEED * dt;
    S.heli.y += Math.sin(a) * SH.HELI_SPEED * dt;
    S.heli.angle = a;
    // Hover overhead: it never lands, and it never rams.
    var d = SH.dist(S.heli.x, S.heli.y, p.x, p.y);
    if (d < 70) {
      S.heli.x = p.x + Math.cos(a + Math.PI) * 70;
      S.heli.y = p.y + Math.sin(a + Math.PI) * 70;
    }
  } else if (S.heli.active) {
    S.heli.active = false;
    S.message = 'Helicopter broke off.';
    S.messageT = 2;
  }
};
