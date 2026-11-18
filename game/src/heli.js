// Solmar Heat — helicopter: the SCPD chopper joins the pursuit at
// 5 stars. It flies above the roads, faster than any cruiser, with a
// ground shadow and a searchlight cone — and it only leaves when the
// heat drops back below 5 stars.

const Heli = {
  active: false,
  x: 0, y: 0,
  angle: 0,
  rotor: 0,

  init() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.rotor = 0;
  },

  update(state, dt) {
    this.rotor += dt * 18;
    if (state.stars >= 5) {
      if (!this.active) {
        this.active = true;
        this.x = state.player.x - 500;
        this.y = state.player.y - 500;
        AudioSys.sfx('heli');
      }
      const target = angleTo(this.x, this.y, state.player.x, state.player.y);
      this.angle += clamp(angleDiff(this.angle, target), -1.8 * dt, 1.8 * dt);
      const spd = 470;
      this.x += Math.cos(this.angle) * spd * dt;
      this.y += Math.sin(this.angle) * spd * dt;
      // Hovering overhead keeps the pressure on: slow heat decay
      // while the chopper watches you.
      if (dist(this.x, this.y, state.player.x, state.player.y) < 220) {
        Police.quietTimer = 0;
      }
    } else if (this.active) {
      this.active = false;
    }
  },
};
