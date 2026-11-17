// render.js — everything Solmar Heat draws: the city, the cars, the people,
// the HUD with its minimap, and the menus. Top-down canvas, one camera that
// follows the player, screen-space HUD on top.

import { CITY, PALETTE, PLACES, WANTED } from './config.js';
import { blockRect, placeCenter, nodePoint } from './world.js';

const TAU = Math.PI * 2;

// --- helpers ----------------------------------------------------------------

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, time) {
  const d = car.def;
  const L = d.len, W = d.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -L / 2, -W / 2, L, W, 8);
  ctx.fill();
  // Roof and windows.
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  rr(ctx, -L * 0.18, -W / 2 + 4, L * 0.36, W - 8, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.9)';
  ctx.fillRect(L * 0.22, -W / 2 + 5, 7, W - 10);
  ctx.fillRect(-L * 0.34, -W / 2 + 5, 5, W - 10);
  // Headlights and tail lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 6);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 6);
  ctx.fillStyle = '#c22';
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 6);
  ctx.fillRect(-L / 2, W / 2 - 8, 3, 6);
  if (d.kind === 'taxi') {
    ctx.fillStyle = '#222';
    for (let i = 0; i < 5; i++) ctx.fillRect(-L * 0.2 + i * 6, -W / 2 + 1, 3, 4);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-4, -W / 2 - 2, 8, 4);
  }
  if (d.kind === 'police') {
    ctx.fillStyle = '#e8e4d2';
    ctx.fillRect(-L * 0.1, -W / 2 + 2, L * 0.2, W - 4);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-8, -W / 2 - 1, 7, 4);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(1, -W / 2 - 1, 7, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11 * scale, 9 * scale, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 10 * scale, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(4 * scale, 0, 5.5 * scale, 0, TAU);
  ctx.fill();
  // Facing wedge.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(10 * scale, -3 * scale);
  ctx.lineTo(16 * scale, 0);
  ctx.lineTo(10 * scale, 3 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- Ground and city ----------------------------------------------------------

function drawGround(ctx, G) {
  const cam = G.camera;
  const vw = G.view.w / cam.zoom, vh = G.view.h / cam.zoom;
  const x0 = cam.x - vw / 2 - 40, y0 = cam.y - vh / 2 - 40;
  const x1 = cam.x + vw / 2 + 40, y1 = cam.y + vh / 2 + 40;
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach sand and sea along the east edge.
  const beachH = Math.min(y1, CITY.size) - Math.max(y0, 0);
  if (beachH > 0) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(CITY.size - 60, Math.max(y0, 0), 60, beachH);
  }
  const seaW = x1 - CITY.size;
  if (seaW > 0 && beachH > 0) {
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(CITY.size, Math.max(y0, 0), seaW, beachH);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
      ctx.fillRect(CITY.size + 30 + ((wy / 90) % 2) * 40, wy, 60, 6);
    }
  }
  // Park block.
  const park = blockRect(PLACES.park.block[0], PLACES.park.block[1]);
  ctx.fillStyle = PALETTE.parkGreen;
  ctx.fillRect(park.x, park.y, park.w, park.h);
  // Roads: asphalt strips with sidewalk shoulders.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let k = 0; k <= CITY.blocks; k++) {
    const c = k * CITY.pitch;
    ctx.fillRect(Math.max(x0, -40), c - CITY.roadHalf - 6, Math.min(x1, CITY.size + 40) - Math.max(x0, -40), CITY.road + 12);
    ctx.fillRect(c - CITY.roadHalf - 6, Math.max(y0, -40), CITY.road + 12, Math.min(y1, CITY.size + 40) - Math.max(y0, -40));
  }
  ctx.fillStyle = PALETTE.road;
  for (let k = 0; k <= CITY.blocks; k++) {
    const c = k * CITY.pitch;
    ctx.fillRect(Math.max(x0, -40), c - CITY.roadHalf, Math.min(x1, CITY.size + 40) - Math.max(x0, -40), CITY.road);
    ctx.fillRect(c - CITY.roadHalf, Math.max(y0, -40), CITY.road, Math.min(y1, CITY.size + 40) - Math.max(y0, -40));
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.laneDash;
  for (let k = 0; k <= CITY.blocks; k++) {
    const c = k * CITY.pitch;
    for (let s = 40; s < CITY.size; s += 90) {
      if (s % CITY.pitch < CITY.road) continue;
      ctx.fillRect(s, c - 2, 44, 4);
      ctx.fillRect(c - 2, s, 4, 44);
    }
  }
  // Crosswalk stripes at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j <= CITY.blocks; j++) {
      const p = nodePoint(i, j);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      for (let s = -30; s <= 30; s += 12) {
        ctx.fillRect(p.x + s, p.y - CITY.roadHalf - 2, 6, 12);
        ctx.fillRect(p.x + s, p.y + CITY.roadHalf - 10, 6, 12);
        ctx.fillRect(p.x - CITY.roadHalf - 2, p.y + s, 12, 6);
        ctx.fillRect(p.x + CITY.roadHalf - 10, p.y + s, 12, 6);
      }
    }
  }
}

function drawBuildings(ctx, G) {
  const cam = G.camera;
  const vw = G.view.w / cam.zoom, vh = G.view.h / cam.zoom;
  const x0 = cam.x - vw / 2 - 120, y0 = cam.y - vh / 2 - 120;
  const x1 = cam.x + vw / 2 + 120, y1 = cam.y + vh / 2 + 120;
  const sorted = G.world.buildings
    .filter((b) => b.x + b.w > x0 && b.x < x1 && b.y + b.h > y0 && b.y < y1)
    .sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of sorted) {
    const lift = b.hgt * 0.45; // pseudo-3D: roof shifted up-left
    // Shadow and side wall.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = '#9a8a72';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x - lift * 0.4, b.y + b.h - lift);
    ctx.lineTo(b.x + b.w - lift * 0.4, b.y + b.h - lift);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - lift * 0.4, b.y - lift, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(b.x - lift * 0.4, b.y - lift, b.w, b.h);
    // Roof windows / details.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        ctx.fillRect(b.x - lift * 0.4 + 8 + cx * ((b.w - 16) / cols), b.y - lift + 8 + cy * ((b.h - 16) / rows), 9, 7);
      }
    }
    if (b.label) {
      ctx.fillStyle = 'rgba(20,20,28,0.75)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2 - lift * 0.2, b.y - lift + b.h / 2 + 5);
    }
  }
  // Crates on the docks and beach.
  for (const c of G.world.crates) {
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    ctx.fillStyle = c.c;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.stroke();
  }
  // Park trees.
  for (const t of G.world.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = t.c;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, TAU);
    ctx.fill();
  }
}

// --- World entities ---------------------------------------------------------

function drawWorldEntities(ctx, G) {
  const time = G.now;
  // Objective beacon: a pillar of light and a pulsing ground ring.
  const obj = G.objectivePos;
  if (obj && G.state === 'play') {
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    const grad = ctx.createLinearGradient(obj.x, obj.y - 260, obj.x, obj.y);
    grad.addColorStop(0, 'rgba(255,210,63,0)');
    grad.addColorStop(1, 'rgba(255,210,63,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(obj.x - 14, obj.y - 260, 28, 260);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 26 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y - 52);
    ctx.lineTo(obj.x + 11, obj.y - 34);
    ctx.lineTo(obj.x - 11, obj.y - 34);
    ctx.closePath();
    ctx.fill();
  }
  // Pickups: health crosses and ammo boxes.
  for (const p of G.world.pickups) {
    if (p.taken) continue;
    const bob = Math.sin(time * 4 + p.x) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = p.kind === 'health' ? '#2fae5f' : '#c98a2e';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.kind === 'health' ? '+' : 'A', 0, 1);
    ctx.restore();
  }
  // Skid marks.
  for (const s of G.effects.skid) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = `rgba(20,20,24,${0.35 * (s.life / 4)})`;
    ctx.fillRect(-14, -3, 28, 5);
    ctx.restore();
  }
  // Parked and traffic cars.
  for (const car of G.world.traffic) drawCarShape(ctx, car, time);
  for (const car of G.world.parkedCars) drawCarShape(ctx, car, time);
  // Player's car, gangsters, cops, peds, player.
  if (G.playerCar) drawCarShape(ctx, G.playerCar, time);
  for (const cr of G.world.cruisers) drawCarShape(ctx, cr, time);
  for (const g of G.world.gangsters) {
    if (!g.alive) continue;
    drawPerson(ctx, g.x, g.y, g.angle, g.color, 1.05);
    // Health pip above a gangster.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(g.x - 14, g.y - 22, 28, 4);
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(g.x - 14, g.y - 22, 28 * Math.max(0, g.hp / 60), 4);
  }
  for (const cop of G.world.footCops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#1d2f4a', 1.05);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', cop.x, cop.y - 16);
  }
  for (const ped of G.world.pedestrians) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 0.9);
  }
  // The player, on foot: jacket red, pistol out when aiming.
  const P = G.player;
  if (!G.playerCar) {
    drawPerson(ctx, P.x, P.y, P.angle, '#c23b2e', 1.1);
    if (P.aiming) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(P.x + Math.cos(P.angle) * 12, P.y + Math.sin(P.angle) * 12);
      ctx.lineTo(P.x + Math.cos(P.angle) * 24, P.y + Math.sin(P.angle) * 24);
      ctx.stroke();
    }
  }
  // Bullets: bright tracers.
  for (const b of G.effects.bullets) {
    ctx.strokeStyle = `rgba(255,220,90,${Math.max(0, b.life / 0.12)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
  }
  // Muzzle flash.
  if (G.effects.muzzle.life > 0) {
    ctx.fillStyle = `rgba(255,200,80,${G.effects.muzzle.life / 0.08})`;
    ctx.beginPath();
    ctx.arc(G.effects.muzzle.x, G.effects.muzzle.y, 10, 0, TAU);
    ctx.fill();
  }
}

// --- HUD ----------------------------------------------------------------------

function drawStars(ctx, x, y, stars, time) {
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < WANTED.maxStars; i++) {
    const lit = i < stars;
    const flash = lit && stars >= 3 && Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = lit ? (flash ? '#ff5a3c' : '#ffd23f') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 28, y);
  }
}

function drawMinimap(ctx, G) {
  const S = 190;
  const x0 = 16, y0 = G.view.h - S - 16;
  const scale = S / (CITY.size + 120);
  const ox = x0 - (60 * scale);
  const oy = y0 - (60 * scale);
  ctx.save();
  ctx.fillStyle = 'rgba(12,14,20,0.82)';
  rr(ctx, x0 - 6, y0 - 6, S + 12, S + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x0, y0, S, S);
  ctx.clip();
  // Sea and land.
  ctx.fillStyle = '#1f5f7d';
  ctx.fillRect(x0, y0, S, S);
  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(x0, y0, S - 20, S);
  // Roads.
  ctx.strokeStyle = '#8a8f96';
  ctx.lineWidth = 3;
  for (let k = 0; k <= CITY.blocks; k++) {
    const c = k * CITY.pitch * scale + ox;
    ctx.beginPath(); ctx.moveTo(c, y0); ctx.lineTo(c, y0 + S); ctx.stroke();
    const r = k * CITY.pitch * scale + oy;
    ctx.beginPath(); ctx.moveTo(x0, r); ctx.lineTo(x0 + S, r); ctx.stroke();
  }
  const dot = (wx, wy, color, r = 3.5) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(wx * scale + ox, wy * scale + oy, r, 0, TAU);
    ctx.fill();
  };
  // Objective blip.
  if (G.objectivePos) dot(G.objectivePos.x, G.objectivePos.y, '#ffd23f', 5);
  // Safehouse.
  const sh = placeCenter('safehouse');
  dot(sh.x, sh.y, '#2fae5f', 4);
  for (const cr of G.world.cruisers) dot(cr.x, cr.y, '#ff3b30', 3.5);
  for (const cop of G.world.footCops) dot(cop.x, cop.y, '#5aa2ff', 3);
  for (const g of G.world.gangsters) if (g.alive) dot(g.x, g.y, '#e5484d', 3);
  // Player arrow.
  const px = G.player.x * scale + ox, py = G.player.y * scale + oy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North label.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x0 + 4, y0 + 14);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x0 + 2, y0 - 10);
}

function drawHud(ctx, G) {
  const W = G.view.w, H = G.view.h;
  const P = G.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: cash, health, ammo.
  ctx.fillStyle = 'rgba(12,14,20,0.8)';
  rr(ctx, 14, 14, 210, 86, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 28, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('REX MARLOWE', 28, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  rr(ctx, 28, 72, 182, 10, 5);
  ctx.fill();
  ctx.fillStyle = P.hp > 30 ? '#e5484d' : '#ff8a3c';
  rr(ctx, 28, 72, 182 * Math.max(0, P.hp / 100), 10, 5);
  ctx.fill();
  if (!G.playerCar) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('AMMO  ' + P.ammo + ' / ' + P.reserveAmmo, 28, 96);
    if (P.reloading) ctx.fillText('RELOADING…', 150, 96);
  }
  // Top-right: wanted stars, clock.
  ctx.fillStyle = 'rgba(12,14,20,0.8)';
  rr(ctx, W - 214, 14, 200, 86, 10);
  ctx.fill();
  drawStars(ctx, W - 200, 42, Math.round(G.wanted), G.now);
  const hh = Math.floor(G.time / 3600) % 24;
  const mm = Math.floor((G.time % 3600) / 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), W - 28, 78);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(G.missionIndex < 3 ? 'MISSION ' + (G.missionIndex + 1) + ' / 3' : 'FREE ROAM', W - 28, 94);
  // Top-centre: objective + distance.
  if (G.objectiveText) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const tw = ctx.measureText(G.objectiveText).width;
    ctx.fillStyle = 'rgba(12,14,20,0.66)';
    rr(ctx, W / 2 - tw / 2 - 16, 14, tw + 32, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(G.objectiveText, W / 2, 40);
    if (G.objectivePos) {
      const d = Math.hypot(G.objectivePos.x - P.x, G.objectivePos.y - P.y);
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(Math.round(d / 10) * 10 + ' m', W / 2, 72);
    }
  }
  // Bottom-right: speed and car.
  if (G.playerCar) {
    const kmh = Math.round(Math.abs(G.playerCar.speed) * 0.32);
    ctx.fillStyle = 'rgba(12,14,20,0.8)';
    rr(ctx, W - 190, H - 76, 176, 60, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(G.playerCar.def.name + '  ·  km/h', W - 24, H - 58);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(kmh, W - 24, H - 28);
  }
  // Bottom-centre: context hint.
  if (G.hintText) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(G.hintText).width;
    ctx.fillStyle = 'rgba(12,14,20,0.7)';
    rr(ctx, W / 2 - tw / 2 - 14, H - 46, tw + 28, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.hintText, W / 2, H - 24);
  }
  // Dialogue banner (mission intro / story beat).
  if (G.banner && G.banner.life > 0) {
    ctx.fillStyle = 'rgba(12,14,20,0.82)';
    rr(ctx, W / 2 - 420, H - 190, 840, 108, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(G.banner.title, W / 2 - 398, H - 160);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, G.banner.text, W / 2 - 398, H - 136, 796, 20);
  }
  // Off-screen objective arrow.
  if (G.objectivePos && G.state === 'play') {
    const cam = G.camera;
    const sx = (G.objectivePos.x - cam.x) * cam.zoom + W / 2;
    const sy = (G.objectivePos.y - cam.y) * cam.zoom + H / 2;
    if (sx < 60 || sx > W - 60 || sy < 60 || sy > H - 60) {
      const cx = Math.max(70, Math.min(W - 70, sx));
      const cy = Math.max(90, Math.min(H - 90, sy));
      const ang = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // Low-health vignette.
  if (P.hp < 35 && G.state === 'play') {
    const a = 0.25 + Math.sin(G.now * 5) * 0.1;
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(200,20,20,0)');
    grad.addColorStop(1, `rgba(200,20,20,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  drawMinimap(ctx, G);
  // Toast line (cash earned, saved, etc.).
  if (G.toast && G.toast.life > 0) {
    ctx.globalAlpha = Math.min(1, G.toast.life);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.fillText(G.toast.text, W / 2, 116);
    ctx.globalAlpha = 1;
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// --- Menus --------------------------------------------------------------------

function button(ctx, G, id, x, y, w, h, label, primary) {
  ctx.fillStyle = primary ? '#ffd23f' : 'rgba(255,255,255,0.14)';
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  if (!primary) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = primary ? '#1a1a1a' : '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  G.uiButtons.push({ id, x, y, w, h });
}

function drawMenu(ctx, G) {
  const W = G.view.w, H = G.view.h;
  G.uiButtons = [];
  // Sun-soaked title backdrop: sky gradient, sea band, skyline silhouettes.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ff9d5c');
  sky.addColorStop(0.45, '#ffb37a');
  sky.addColorStop(0.75, '#2e7f9e');
  sky.addColorStop(1, '#1f5f7d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffdf8a';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.2, 52, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,30,40,0.85)';
  const skyline = [90, 150, 120, 190, 140, 210, 110, 170, 130, 200];
  let sx = 0;
  for (const hgt of skyline) {
    ctx.fillRect(sx, H - 190 - hgt, 120, hgt + 190);
    sx += 132;
  }
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, H - 120, W, 120);
  ctx.fillStyle = '#20242e';
  ctx.save();
  ctx.translate(W * 0.2, H - 120);
  ctx.rotate(0.06);
  // A little red Vento parked on the sand, for scale and flavour.
  ctx.fillStyle = '#c23b2e';
  rr(ctx, -34, -18, 68, 34, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  rr(ctx, -12, -13, 24, 24, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.9)';
  ctx.fillRect(14, -12, 8, 24);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(30, -14, 4, 6);
  ctx.fillRect(30, 8, 4, 6);
  ctx.restore();
  // Title block.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(12,14,20,0.55)';
  rr(ctx, W / 2 - 330, 66, 660, 190, 16);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.fillText('SOLMAR HEAT', W / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in the sun-soaked city of Solmar', W / 2, 190);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Steal cars. Outrun the SCPD. Take the Harbor Job.', W / 2, 220);
  // Buttons.
  const bx = W / 2 - 150;
  let by = 300;
  if (G.hasSave) { button(ctx, G, 'continue', bx, by, 300, 48, 'CONTINUE', true); by += 60; }
  button(ctx, G, 'new', bx, by, 300, 48, G.hasSave ? 'NEW GAME' : 'START GAME', !G.hasSave);
  by += 60;
  button(ctx, G, 'howto', bx, by, 300, 48, 'HOW TO PLAY', false);
  by += 60;
  button(ctx, G, 'missions', bx, by, 300, 48, 'MISSIONS & STORY', false);
  // Footer: controls + save note.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move · E enter / steal car · Mouse aim · Click shoot · R reload · F punch · M mute · Esc pause', W / 2, H - 46);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Progress saves automatically · Original game — no Rockstar content · Solmar Heat, built for make.fun gta6-01', W / 2, H - 24);
  if (G.howto) {
    ctx.fillStyle = 'rgba(12,14,20,0.88)';
    rr(ctx, W / 2 - 340, 280, 680, 260, 14);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HOW TO PLAY', W / 2 - 310, 316);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'On foot: WASD to walk, Shift to run. Mouse aims your pistol, click shoots.',
      'Near a car: press E to steal it (or to get in). In a car: W/S drive, A/D steer,',
      'Space is the handbrake, E gets out. Stealing in front of witnesses raises heat.',
      'Wanted stars: crimes raise them, laying low lowers them. Cruisers hunt you',
      'with sirens; foot cops try to bust you. Busted = fine. Wasted = hospital.',
      'Follow the gold marker: 3 story missions pay cash. Esc saves and pauses.',
      'Pickups: green + heals, amber A is ammo. M mutes the synth sound.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2 - 310, 344 + i * 24));
    button(ctx, G, 'close', W / 2 - 60, 500, 120, 40, 'CLOSE', true);
  }
  if (G.storyPanel) {
    ctx.fillStyle = 'rgba(12,14,20,0.88)';
    rr(ctx, W / 2 - 340, 280, 680, 260, 14);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THE STORY', W / 2 - 310, 316);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'Rex Marlowe came home to Solmar with a jacket and a debt. Mama Lou,',
      'who runs the paint shop on 1st, has work — if you can drive, shoot,',
      'and outrun the SCPD long enough to get paid.',
      '',
      '1 · Lou\'s Errand — steal the red Vento at the docks.  $800',
      '2 · The Palms Pickup — fetch a package at the motel.  $1,400',
      '3 · The Harbor Job — crack the National Bank vault.  $3,500',
      '',
      'Finish all three and Solmar is yours: free roam, no more errands.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2 - 310, 344 + i * 24));
    button(ctx, G, 'close', W / 2 - 60, 500, 120, 40, 'CLOSE', true);
  }
}

function drawPaused(ctx, G) {
  const W = G.view.w, H = G.view.h;
  G.uiButtons = [];
  ctx.fillStyle = 'rgba(10,10,16,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Progress saved · Cash $' + G.cash.toLocaleString('en-US') + ' · Mission ' + Math.min(G.missionIndex + 1, 3) + ' / 3', W / 2, H / 2 - 20);
  button(ctx, G, 'resume', W / 2 - 150, H / 2 + 10, 300, 48, 'RESUME', true);
  button(ctx, G, 'quit', W / 2 - 150, H / 2 + 70, 300, 48, 'SAVE & QUIT TO MENU', false);
}

function drawEndCard(ctx, G, kind) {
  const W = G.view.w, H = G.view.h;
  G.uiButtons = [];
  ctx.fillStyle = kind === 'wasted' ? 'rgba(60,0,0,0.72)' : 'rgba(0,10,40,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'wasted' ? '#ff5a3c' : '#5aa2ff';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', W / 2, H / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(G.endCardText, W / 2, H / 2 + 14);
  ctx.fillText('Press Enter or click to wake up at Solmar General', W / 2, H / 2 + 44);
  button(ctx, G, 'wake', W / 2 - 150, H / 2 + 70, 300, 48, 'WAKE UP', true);
}

// --- Frame --------------------------------------------------------------------

export function drawFrame(ctx, G) {
  const W = G.view.w, H = G.view.h;
  ctx.clearRect(0, 0, W, H);
  if (G.state === 'menu') {
    drawMenu(ctx, G);
    return;
  }
  const cam = G.camera;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, G);
  drawBuildings(ctx, G);
  drawWorldEntities(ctx, G);
  ctx.restore();
  drawHud(ctx, G);
  if (G.state === 'paused') drawPaused(ctx, G);
  if (G.state === 'wasted' || G.state === 'busted') drawEndCard(ctx, G, G.state);
}
