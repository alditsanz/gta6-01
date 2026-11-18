// Solmar Heat — render: everything drawn on the canvas — the city,
// the cars and people in it, the night and the weather, the HUD with
// its minimap, and the title / board / pause / WASTED screens.

const Render = {
  W: 1280, H: 720,

  cam(state) {
    const p = state.player;
    const x = clamp(p.x - this.W / 2, 0, CFG.world - this.W);
    const y = clamp(p.y - this.H / 2, 0, CFG.world - this.H);
    return { x, y };
  },

  draw(state) {
    const cv = state.canvas;
    const ctx = cv.getContext('2d');
    const cam = this.cam(state);
    ctx.save();
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.translate(-cam.x, -cam.y);
    this.drawWorld(ctx, state, cam);
    this.drawEntities(ctx, state, cam);
    this.drawSky(ctx, state, cam);
    ctx.restore();
    this.drawHUD(ctx, state);
    if (state.screen === 'title') this.drawTitle(ctx, state);
    if (state.screen === 'board') this.drawBoard(ctx, state);
    if (state.screen === 'pause') this.drawPause(ctx, state);
    if (state.screen === 'wasted') this.drawWasted(ctx, state);
  },

  // --- the city ------------------------------------------------------
  drawWorld(ctx, state, cam) {
    // Ground.
    ctx.fillStyle = '#232b22';
    ctx.fillRect(cam.x, cam.y, this.W, this.H);

    // Turf tint: each district washed with its owner's colour.
    for (const d of DISTRICTS) {
      const owner = Turf.owners[d.name];
      ctx.fillStyle = GANGS[owner].color;
      ctx.globalAlpha = owner === 'player' ? 0.10 : 0.07;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      ctx.globalAlpha = 1;
      // District name, faint, at the centre.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2);
      // Turf flag at the centre.
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      ctx.fillStyle = GANGS[owner].color;
      ctx.fillRect(cx - 2, cy - 26, 3, 26);
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 26); ctx.lineTo(cx + 20, cy - 20); ctx.lineTo(cx + 1, cy - 14);
      ctx.closePath(); ctx.fill();
    }

    // Parks.
    for (const pk of World.parks) {
      ctx.fillStyle = '#2f6b34';
      ctx.fillRect(pk.x0, pk.y0, pk.x1 - pk.x0, pk.y1 - pk.y0);
    }
    // Roads.
    ctx.fillStyle = '#3a3f45';
    for (const r of CFG.roads) {
      ctx.fillRect(r - CFG.roadWidth / 2, 0, CFG.roadWidth, CFG.world);
      ctx.fillRect(0, r - CFG.roadWidth / 2, CFG.world, CFG.roadWidth);
    }
    // Dashed lane markings.
    ctx.fillStyle = '#d8c95a';
    for (const r of CFG.roads) {
      for (let v = 0; v < CFG.world; v += 56) {
        ctx.fillRect(r - 2, v, 4, 26);
        ctx.fillRect(v, r - 2, 26, 4);
      }
    }
    // Canals + bridges (bridges are the road colour over the water).
    for (const c of CANALS) {
      ctx.fillStyle = '#1e5f8a';
      ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
      ctx.fillStyle = '#7fb2d9';
      ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, 4);
      ctx.fillRect(c.x0, c.y1 - 4, c.x1 - c.x0, 4);
    }
    for (const r of CFG.roads) {
      for (const c of CANALS) {
        ctx.fillStyle = '#3a3f45';
        ctx.fillRect(c.x0, r - CFG.roadWidth / 2, c.x1 - c.x0, CFG.roadWidth);
        ctx.fillStyle = '#d8c95a';
        ctx.fillRect(c.x0, r - 2, c.x1 - c.x0, 4);
      }
    }
    // Buildings.
    for (const b of World.buildings) {
      ctx.fillStyle = `hsl(${b.hue}, 28%, ${b.tall ? 42 : 34}%)`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      // Windows: lit at night, dark by day.
      const night = DayNight.darkness();
      ctx.fillStyle = night > 0.4 ? 'rgba(255,214,120,0.9)' : 'rgba(180,210,240,0.5)';
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
        for (let wy = b.y + 8; wy < b.y + b.h - 8; wy += 16) {
          ctx.fillRect(wx, wy, 8, 9);
        }
      }
    }
    // Trees.
    for (const t of World.trees) {
      ctx.fillStyle = '#2c7a35';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d5c24';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // Landmarks.
    this.drawLandmark(ctx, LANDMARKS.scpdHq, '#27408b', 'SCPD HQ');
    this.drawLandmark(ctx, LANDMARKS.paintShop, '#c94f7c', "LOU'S");
    this.drawLandmark(ctx, LANDMARKS.marina, '#2a9d8f', 'MARINA');
    this.drawLandmark(ctx, LANDMARKS.pier9, '#8d6b3d', 'PIER 9');
    this.drawLandmark(ctx, LANDMARKS.plaza, '#6a8caf', 'PLAZA');
    this.drawLandmark(ctx, LANDMARKS.hospital, '#e8e8e8', 'HOSPITAL');
    this.drawLandmark(ctx, LANDMARKS.canalDepot, '#b5651d', 'DEPOT');
    // Race start lines: checkered flags.
    for (const def of RACES) {
      this.drawFlag(ctx, def.start.x, def.start.y, '#ffffff');
    }
  },

  drawLandmark(ctx, lm, color, label) {
    ctx.fillStyle = color;
    ctx.fillRect(lm.x - 42, lm.y - 26, 84, 52);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(lm.x - 42, lm.y - 26, 84, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, lm.x, lm.y + 4);
  },

  drawFlag(ctx, x, y, color) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 2, y - 30, 3, 30);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#111';
        ctx.fillRect(x + i * 6, y - 30 + j * 7, 6, 7);
      }
    }
  },

  // --- moving things ---------------------------------------------------
  drawCarShape(ctx, x, y, angle, color, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-20, -10, 40, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-8, -9, 16, 18);
    ctx.fillStyle = '#bfe3ff';
    ctx.fillRect(2, -8, 8, 16);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(18, -8, 3, 5);
    ctx.fillRect(18, 3, 3, 5);
    if (opts.police) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-20, -10, 40, 5);
      ctx.fillStyle = '#e33f2f';
      ctx.fillRect(-4, -10, 8, 5);
      ctx.fillStyle = '#3f7de3';
      ctx.fillRect(4, -10, 8, 5);
    }
    if (opts.taxi) {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
  },

  drawEntities(ctx, state, cam) {
    // Coins.
    for (const c of Collectibles.coins) {
      if (c.taken) continue;
      const pulse = 1 + Math.sin(state.time * 4 + c.id) * 0.15;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(c.x, c.y, 10 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S', c.x, c.y + 4);
    }
    // Ammo pickups.
    for (const a of Combat.ammoPickups) {
      if (a.taken) continue;
      ctx.fillStyle = '#8d6b3d';
      ctx.fillRect(a.x - 10, a.y - 8, 20, 16);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', a.x, a.y + 4);
    }
    // Taxi fares waiting.
    for (const f of SideJobs.fares) {
      if (f.done || f.active) continue;
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', f.x, f.y + 4);
    }
    // Traffic.
    for (const t of World.traffic) {
      this.drawCarShape(ctx, t.x, t.y, t.angle, t.color);
    }
    // Pedestrians.
    for (const p of World.peds) {
      const bob = Math.sin(p.phase) * 2;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob - 5, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Stealable cars.
    for (const car of state.cars) {
      if (car.wrecked) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -10, 40, 20);
        ctx.fillStyle = '#e33f2f';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WRECK', 0, -14);
        ctx.restore();
        continue;
      }
      this.drawCarShape(ctx, car.x, car.y, car.angle, car.color, { taxi: car.taxi });
      if (car === state.car) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(car.x - 24, car.y - 14, 48, 28);
      }
    }
    // Police cars.
    for (const c of Police.cars) {
      this.drawCarShape(ctx, c.x, c.y, c.angle, '#1c2f6e', { police: true });
    }
    // Roadblocks.
    for (const rb of Police.roadblocks) {
      ctx.save();
      ctx.translate(rb.x, rb.y);
      ctx.rotate(rb.angle);
      ctx.fillStyle = '#e33f2f';
      ctx.fillRect(-26, -5, 52, 10);
      ctx.fillStyle = '#fff';
      for (let i = -24; i < 24; i += 12) ctx.fillRect(i, -5, 6, 10);
      ctx.restore();
      this.drawCarShape(ctx, rb.x, rb.y, rb.angle, '#1c2f6e', { police: true });
    }
    // Gang cars during a turf war.
    for (const g of Turf.gangCars) {
      this.drawCarShape(ctx, g.x, g.y, g.angle, g.color);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GANG', g.x, g.y - 16);
    }
    // Guards (ledger job) with health pips.
    for (const g of Combat.guards) {
      if (!g.alive) continue;
      ctx.fillStyle = '#3a3f45';
      ctx.beginPath(); ctx.arc(g.x, g.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b04b';
      ctx.beginPath(); ctx.arc(g.x, g.y - 6, 6, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < Math.ceil(g.health / 25) ? '#e33f2f' : '#555';
        ctx.fillRect(g.x - 16 + i * 9, g.y - 24, 7, 5);
      }
    }
    // The ledger, once the guards are down.
    if (state.mission && state.mission.job.id === 7 && state.mission.step >= 2 && !state.mission.ledgerTaken) {
      const lm = LANDMARKS.scpdHq;
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(lm.x - 10, lm.y - 8, 20, 16);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LEDGER', lm.x, lm.y + 22);
    }
    // Bullets.
    ctx.fillStyle = '#ffe9a8';
    for (const b of Combat.bullets) {
      ctx.fillRect(b.x - 3, b.y - 2, 6, 4);
    }
    // Mission / race / delivery markers.
    this.drawMarkers(ctx, state);
    // The player.
    const p = state.player;
    if (state.car) {
      // The car shape is drawn above; add a headlight cone at night.
      if (DayNight.isNight()) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const grad = ctx.createLinearGradient(0, 0, 190, 0);
        grad.addColorStop(0, 'rgba(255,240,180,0.28)');
        grad.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(18, -8); ctx.lineTo(190, -55); ctx.lineTo(190, 55); ctx.lineTo(18, 8);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#e8b04b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a4d8f';
      ctx.fillRect(p.x - 7, p.y - 4, 14, 12);
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(p.x, p.y - 9, 6, 0, Math.PI * 2); ctx.fill();
      // Aim direction.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
      ctx.stroke();
    }
    // Helicopter shadow + body.
    if (Heli.active) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(Heli.x + 26, Heli.y + 30, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(Heli.x, Heli.y);
      ctx.rotate(Heli.angle);
      ctx.fillStyle = '#1c2f6e';
      ctx.fillRect(-22, -9, 44, 18);
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(10, -6, 9, 12);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 3;
      const r = Math.sin(Heli.rotor) * 30;
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      ctx.restore();
      // Searchlight cone.
      ctx.save();
      ctx.translate(Heli.x, Heli.y);
      ctx.rotate(angleTo(Heli.x, Heli.y, p.x, p.y));
      const grad = ctx.createLinearGradient(0, 0, 260, 0);
      grad.addColorStop(0, 'rgba(255,255,200,0.25)');
      grad.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(260, -46); ctx.lineTo(260, 46); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  },

  drawMarkers(ctx, state) {
    const p = state.player;
    const mark = (x, y, color, label) => {
      const pulse = 1 + Math.sin(state.time * 5) * 0.2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      if (label) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - 34);
      }
    };
    if (state.mission) {
      const t = Missions.currentTarget(state);
      if (t) mark(t.x, t.y, '#e33f2f', 'TARGET');
    }
    const rt = Races.currentTarget();
    if (rt) mark(rt.x, rt.y, '#39d353', 'CHECKPOINT');
    if (SideJobs.delivery) {
      const d = SideJobs.delivery;
      if (d.state === 'waiting') mark(d.x, d.y, '#f2c230', 'PICKUP');
      else mark(d.dx, d.dy, '#f2c230', 'DELIVER');
    }
    for (const f of SideJobs.fares) {
      if (f.active) mark(f.dx, f.dy, '#f2c230', 'FARE');
    }
    // Off-screen arrow toward the current target.
    const tgt = state.mission ? Missions.currentTarget(state) : Races.currentTarget();
    if (tgt) {
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      if (Math.hypot(dx, dy) > 420) {
        const a = Math.atan2(dy, dx);
        const ax = this.W / 2 + Math.cos(a) * 260;
        const ay = this.H / 2 + Math.sin(a) * 200;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#e33f2f';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  },

  // --- night, rain, fog ----------------------------------------------
  drawSky(ctx, state, cam) {
    const dark = DayNight.darkness();
    if (dark > 0) {
      ctx.fillStyle = `rgba(6, 10, 38, ${dark * 0.42})`;
      ctx.fillRect(cam.x, cam.y, this.W, this.H);
      // Street lamps glow at night.
      for (const r of CFG.roads) {
        for (let v = 120; v < CFG.world; v += 265) {
          if (v < cam.x - 60 || v > cam.x + this.W + 60) continue;
          if (r + 24 < cam.y - 60 || r + 24 > cam.y + this.H + 60) continue;
          const grad = ctx.createRadialGradient(v, r + 24, 2, v, r + 24, 46);
          grad.addColorStop(0, 'rgba(255,214,120,0.35)');
          grad.addColorStop(1, 'rgba(255,214,120,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(v, r + 24, 46, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    if (DayNight.weather === 'rain') {
      ctx.strokeStyle = 'rgba(180,200,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of DayNight.rainDrops) {
        const x = cam.x + d.x * this.W;
        const y = cam.y + d.y * this.H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + d.len);
      }
      ctx.stroke();
    }
    if (DayNight.weather === 'fog') {
      const cx = state.player.x, cy = state.player.y;
      const grad = ctx.createRadialGradient(cx, cy, 120, cx, cy, 520);
      grad.addColorStop(0, 'rgba(200,205,215,0)');
      grad.addColorStop(1, 'rgba(200,205,215,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(cam.x, cam.y, this.W, this.H);
    }
  },

  // --- HUD -------------------------------------------------------------
  drawHUD(ctx, state) {
    ctx.textAlign = 'left';
    // Top-left: money, score, rank.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(10, 10, 250, 84);
    ctx.fillStyle = '#39d353';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`$${state.money.toLocaleString()}`, 20, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Score ${state.score}   •   ${RANKS[state.rank]}`, 20, 60);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(`Coins ${Collectibles.count()}/10   •   Fares ${state.faresDone}   •   Turf ${Turf.ownedCount()}/10`, 20, 80);
    // Wanted stars, top centre.
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < state.stars ? '#ffd94a' : 'rgba(255,255,255,0.25)';
      this.star(ctx, 560 + i * 34, 34, 13);
    }
    // Objective banner.
    const obj = state.mission ? Missions.objectiveText(state) : null;
    const raceObj = Races.race ? `RACE ${Races.race.def.name}: checkpoint ${Races.race.cpIndex + 1}/${Races.race.def.checkpoints.length + 1} — ${Math.ceil(Races.race.timer)}s` : null;
    const banner = obj || raceObj || (Turf.war ? `TURF WAR ${Turf.war.district}: ${Math.ceil(Turf.war.timer)}s — hold the district!` : null);
    if (banner) {
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(banner).width + 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.W / 2 - w / 2, 56, w, 30);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(banner, this.W / 2, 76);
      ctx.textAlign = 'left';
    }
    // Mission / race timer bar under the banner.
    const tLeft = state.mission && state.mission.timer != null ? state.mission.timer
      : Races.race ? Races.race.timer : null;
    if (tLeft != null) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.W / 2 - 110, 92, 220, 12);
      ctx.fillStyle = tLeft < 10 ? '#e33f2f' : '#39d353';
      ctx.fillRect(this.W / 2 - 110, 92, 220 * clamp(tLeft / 90, 0, 1), 12);
    }
    // Minimap, top right.
    const mm = { x: this.W - 200, y: 10, s: 180 };
    const sc = mm.s / CFG.world;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(mm.x - 4, mm.y - 4, mm.s + 8, mm.s + 8);
    for (const d of DISTRICTS) {
      ctx.fillStyle = GANGS[Turf.owners[d.name]].color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(mm.x + d.x0 * sc, mm.y + d.y0 * sc, (d.x1 - d.x0) * sc, (d.y1 - d.y0) * sc);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for (const r of CFG.roads) {
      ctx.beginPath(); ctx.moveTo(mm.x + r * sc, mm.y); ctx.lineTo(mm.x + r * sc, mm.y + mm.s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mm.x, mm.y + r * sc); ctx.lineTo(mm.x + mm.s, mm.y + r * sc); ctx.stroke();
    }
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mm.x + x * sc, mm.y + y * sc, r || 3, 0, Math.PI * 2); ctx.fill();
    };
    for (const c of Collectibles.coins) if (!c.taken) dot(c.x, c.y, '#ffd94a', 2.5);
    for (const car of state.cars) if (!car.wrecked) dot(car.x, car.y, '#f2c230', 2.5);
    for (const c of Police.cars) dot(c.x, c.y, '#3f7de3', 3);
    if (Heli.active) dot(Heli.x, Heli.y, '#ff7b00', 4);
    const tgt = state.mission ? Missions.currentTarget(state) : Races.currentTarget();
    if (tgt) dot(tgt.x, tgt.y, '#e33f2f', 5);
    for (const g of Turf.gangCars) dot(g.x, g.y, '#e33f2f', 3);
    dot(state.player.x, state.player.y, '#fff', 4);
    // District name under the minimap + clock and weather.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(World.districtAt(state.player.x, state.player.y), this.W - 110, mm.y + mm.s + 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = DayNight.isNight() ? '#ffd94a' : '#fff';
    ctx.fillText(`${DayNight.isNight() ? '☾' : '☀'} ${DayNight.clockText()}  •  ${DayNight.weatherLabel()}`, this.W - 110, mm.y + mm.s + 42);
    ctx.textAlign = 'left';
    // Bottom-left: health + car bars.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(10, this.H - 66, 250, 56);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('HEALTH', 18, this.H - 48);
    ctx.fillStyle = '#e33f2f';
    ctx.fillRect(80, this.H - 58, 160 * clamp(state.player.health / 100, 0, 1), 10);
    ctx.fillStyle = '#fff';
    ctx.fillText('CAR', 18, this.H - 26);
    if (state.car) {
      ctx.fillStyle = state.car.health < 30 ? '#e33f2f' : '#39d353';
      ctx.fillRect(80, this.H - 36, 160 * clamp(state.car.health / 100, 0, 1), 10);
    } else {
      ctx.fillStyle = '#888';
      ctx.fillText('on foot', 80, this.H - 26);
    }
    // Bottom-right: speed + ammo.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(this.W - 220, this.H - 66, 210, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    const spd = state.car ? Math.round(state.car.speed * 0.9) : 0;
    ctx.fillText(`${spd} mph`, this.W - 20, this.H - 38);
    ctx.font = '13px sans-serif';
    ctx.fillText(state.car ? `${state.car.modelName} — ${Combat.reloadTimer > 0 ? 'RELOADING…' : `Ammo ${state.ammo}/${state.reserve}`}` : `Ammo ${state.ammo}/${state.reserve}`, this.W - 20, this.H - 18);
    ctx.textAlign = 'left';
    // Toast.
    if (state.toastTimer > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const w = ctx.measureText(state.toast).width + 30;
      ctx.fillRect(this.W / 2 - w / 2, this.H - 110, w, 30);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, this.W / 2, this.H - 90);
      ctx.textAlign = 'left';
    }
    // Controls hint.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD drive • E steal/exit • Mouse shoot • R reload • F punch • T taxi • G turf war • Space brake • P pause • M mute', 10, this.H - 78);
  },

  star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  },

  // --- screens ---------------------------------------------------------
  drawTitle(ctx, state) {
    ctx.fillStyle = 'rgba(8,12,24,0.82)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('SOLMAR HEAT', this.W / 2, 190);
    ctx.fillStyle = '#ffd94a';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime story — steal, drive, run, survive.', this.W / 2, 232);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    const lines = [
      'WASD / arrows — move & drive      E — steal / exit car      Mouse — aim & shoot',
      'R — reload      F — punch      Space — handbrake      T — taxi fare      G — turf war',
      'Shift — sprint      P — pause      M — mute',
      '',
      '7 story jobs, 3 street races, 10 hidden Solmar coins, taxi fares,',
      'turf wars across 10 districts, day & night with rain and fog, the paint shop —',
      'progress saves automatically.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, this.W / 2, 300 + i * 26));
    ctx.fillStyle = '#39d353';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(state.titleBlink ? '▶  CLICK OR PRESS ENTER TO PLAY' : 'CLICK OR PRESS ENTER TO PLAY', this.W / 2, 560);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('A wholly original game. No part of it comes from any commercial game.', this.W / 2, 640);
    ctx.textAlign = 'left';
  },

  drawBoard(ctx, state) {
    ctx.fillStyle = 'rgba(8,12,24,0.88)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('MISSION BOARD', this.W / 2, 64);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Click a job to start it — or a race, or a delivery. Esc / P to go back.', this.W / 2, 92);
    // 7 job cards.
    const cards = [];
    JOBS.forEach((job, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      cards.push({ x: 90 + col * 290, y: 120 + row * 130, w: 270, h: 110, job });
    });
    for (const c of cards) {
      const done = state.jobsDone.includes(c.job.id);
      const locked = c.job.id > 1 && !state.jobsDone.includes(c.job.id - 1);
      ctx.fillStyle = done ? 'rgba(57,211,83,0.25)' : locked ? 'rgba(120,120,120,0.2)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = done ? '#39d353' : '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${c.job.id}. ${c.job.name}`, c.x + 12, c.y + 26);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#ddd';
      const words = c.job.brief.split(' ');
      let line = '', ly = c.y + 48;
      for (const w of words) {
        if (ctx.measureText(line + w).width > c.w - 24) { ctx.fillText(line, c.x + 12, ly); ly += 16; line = ''; }
        line += w + ' ';
      }
      ctx.fillText(line, c.x + 12, ly);
      ctx.fillStyle = '#39d353';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`$${c.job.pay.toLocaleString()}${done ? '  ✓ DONE' : locked ? '  🔒 finish job ' + (c.job.id - 1) : ''}`, c.x + 12, c.y + c.h - 12);
    }
    // Races row.
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STREET RACES', 90, 420);
    RACES.forEach((r, i) => {
      const x = 90 + i * 290, y = 436;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, 270, 74);
      ctx.strokeStyle = '#888';
      ctx.strokeRect(x, y, 270, 74);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${r.name} — ${r.diff}`, x + 12, y + 24);
      ctx.font = '13px sans-serif';
      ctx.fillText(`$${r.pay}  •  par ${r.par}s  •  ${Races.results[r.id] === 'won' ? '✓ WON' : 'not won yet'}`, x + 12, y + 48);
    });
    // Turf + delivery row.
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('TURF & SIDE WORK', 90, 560);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Turf held: ${Turf.ownedCount()}/10 districts  •  income $${Turf.ownedCount() * CFG.turfIncomePerDistrict}/min`, 90, 586);
    ctx.fillText('Delivery job: pick up at the Canal Row Depot (press B near it) — $250 per run', 90, 612);
    ctx.fillText('Press B anywhere in Canal Row to start a delivery. Press G on a district flag to start a turf war.', 90, 638);
    ctx.textAlign = 'left';
  },

  drawPause(ctx, state) {
    ctx.fillStyle = 'rgba(8,12,24,0.8)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', this.W / 2, 110);
    ctx.font = '17px sans-serif';
    const lines = [
      `Money $${state.money.toLocaleString()}   •   Score ${state.score}   •   Rank ${RANKS[state.rank]}`,
      `Story jobs done: ${state.jobsDone.length}/7${state.jobsDone.length === 7 ? ' — STORY COMPLETE' : ''}`,
      `Races won: ${Object.values(Races.results).filter((r) => r === 'won').length}/3`,
      `Turf held: ${Turf.ownedCount()}/10 districts — ${DISTRICTS.filter((d) => Turf.owners[d.name] === 'player').map((d) => d.name).join(', ') || 'none yet'}`,
      `Solmar coins: ${Collectibles.count()}/10   •   Taxi fares: ${state.faresDone}   •   Near misses: ${state.nearMisses}`,
      `Cars stolen: ${state.carsStolen}   •   Time ${DayNight.clockText()} — ${DayNight.weatherLabel()}`,
      '',
      'P / Esc — resume      M — mute      Click a job on the board (Enter) to open it',
    ];
    lines.forEach((l, i) => ctx.fillText(l, this.W / 2, 170 + i * 30));
    ctx.textAlign = 'left';
  },

  drawWasted(ctx, state) {
    ctx.fillStyle = 'rgba(60,0,0,0.75)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e33f2f';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', this.W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Hospital bill $${CFG.hospitalFee} — you wake up at Solmar General.`, this.W / 2, 350);
    ctx.textAlign = 'left';
  },
};
