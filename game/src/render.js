// Solmar Heat — render.js
// Every pixel the game draws: the city, the cars, the people, the police,
// the helicopter, the HUD, the minimap and all the menus. Pure canvas 2D,
// no assets — every sprite is drawn from shapes. The game hands this module
// its state and a canvas context; nothing here owns game logic.

import { WORLD, ROAD_HALF, roadPos, GRID, districtAt } from './config.js';
import { skyPhase } from './weather.js';
import { TURF_ZONES } from './config.js';
import { guardPips } from './combat.js';
import { modsSummary } from './modshop.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

/** Set up a canvas for crisp drawing at the view size. */
export function setupCanvas(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, w = 34, h = 18) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -w / 2 + 2, -h / 2 + 3, w, h, 5);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -w / 2, -h / 2, w, h, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  rr(ctx, -w / 2 + 7, -h / 2 + 3, 9, h - 6, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,30,0.9)';
  rr(ctx, w / 2 - 9, -h / 2 + 3, 6, h - 6, 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(-w / 2 + 2, -h / 2 - 2, 7, 3);
  ctx.fillRect(-w / 2 + 2, h / 2 - 1, 7, 3);
  ctx.fillRect(w / 2 - 9, -h / 2 - 2, 7, 3);
  ctx.fillRect(w / 2 - 9, h / 2 - 1, 7, 3);
  ctx.restore();
}

/** Draw the city: ground, roads, canal, parks, buildings, landmarks. */
export function drawWorld(ctx, s, cam) {
  const { city, clock } = s;
  const phase = skyPhase(Math.floor(clock.time / 3600) % 24);
  // Ground.
  ctx.fillStyle = phase === 'night' ? '#2c3a2e' : phase === 'dusk' ? '#7a6a4e' : '#69a84f';
  ctx.fillRect(cam.x - 20, cam.y - 20, cam.w + 40, cam.h + 40);
  // City floor.
  ctx.fillStyle = phase === 'night' ? '#3a3f45' : '#8f9aa5';
  ctx.fillRect(0, 0, WORLD, WORLD);
  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = phase === 'night' ? '#1f4d2a' : '#3f9e4d';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Canal water (Canal Row) + bridges.
  ctx.fillStyle = phase === 'night' ? '#16324a' : '#2e86c1';
  ctx.fillRect(813, 1920, 813, 80);
  ctx.fillStyle = '#7f8c8d';
  for (const bx of [1000, 1350]) ctx.fillRect(bx - 46, 1912, 92, 96);
  // Roads.
  ctx.fillStyle = phase === 'night' ? '#22252a' : '#3a3f46';
  for (let i = 0; i < GRID; i++) {
    ctx.fillRect(roadPos(i) - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
    ctx.fillRect(0, roadPos(i) - ROAD_HALF, WORLD, ROAD_HALF * 2);
  }
  // Dashed lane markings.
  ctx.strokeStyle = phase === 'night' ? 'rgba(255,255,180,0.35)' : 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 18]);
  for (let i = 0; i < GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(roadPos(i), 0);
    ctx.lineTo(roadPos(i), WORLD);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, roadPos(i));
    ctx.lineTo(WORLD, roadPos(i));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Wet-road sheen in the rain.
  if (clock.weather === 'rain') {
    ctx.fillStyle = 'rgba(180,200,255,0.10)';
    for (let i = 0; i < GRID; i++) {
      ctx.fillRect(roadPos(i) - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
      ctx.fillRect(0, roadPos(i) - ROAD_HALF, WORLD, ROAD_HALF * 2);
    }
  }
  // Turf zone tints (a soft wash of the owner's colour).
  for (const z of TURF_ZONES) {
    const owner = s.turf.owners[z.id];
    if (owner === 'You') {
      ctx.fillStyle = 'rgba(46,204,113,0.10)';
      ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    }
  }
  // Buildings with lit windows at night.
  for (const b of city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    if (phase === 'night' && b.lit) {
      ctx.fillStyle = 'rgba(255,214,120,0.9)';
      const cols = Math.max(1, Math.floor(b.w / 22));
      const rows = Math.max(1, Math.floor(b.h / 24));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if ((cx * 7 + cy * 3 + b.hgt) % 3 === 0) {
            ctx.fillRect(b.x + 6 + cx * 22, b.y + 6 + cy * 24, 9, 11);
          }
        }
      }
    }
    // Roof line.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = phase === 'night' ? '#1e4d2a' : '#2e8b57';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 2, t.y + 2, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Streetlight pools at night.
  if (phase === 'night' || phase === 'dusk') {
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j += 2) {
        const g = ctx.createRadialGradient(roadPos(i), roadPos(j), 4, roadPos(i), roadPos(j), 70);
        g.addColorStop(0, 'rgba(255,220,130,0.20)');
        g.addColorStop(1, 'rgba(255,220,130,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(roadPos(i), roadPos(j), 70, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Landmark markers + labels.
  for (const l of s.landmarks) {
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.name, l.x, l.y - 20);
  }
}

/** Draw coins, traffic, pedestrians, police, helicopter, guards, bullets. */
export function drawEntities(ctx, s) {
  const p = s.player;
  // Solmar coins.
  for (const c of s.coins) {
    if (c.taken) continue;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8a6508';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', c.x, c.y);
  }
  // Race checkpoints + starter flags.
  for (const r of s.races) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(r.start.x - 2, r.start.y - 26, 3, 26);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(r.start.x + 1, r.start.y - 26);
    ctx.lineTo(r.start.x + 18, r.start.y - 20);
    ctx.lineTo(r.start.x + 1, r.start.y - 14);
    ctx.closePath();
    ctx.fill();
  }
  const active = s.raceState.active;
  if (active) {
    const cp = active.race.checkpoints[active.checkpoint];
    if (cp) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`CP ${active.checkpoint + 1}`, cp.x, cp.y - 42);
    }
  }
  // Mission target marker.
  if (s.missionTarget) {
    const t = s.missionTarget;
    const pulse = 26 + Math.sin(s.time * 4) * 4;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 44);
    ctx.lineTo(t.x - 9, t.y - 26);
    ctx.lineTo(t.x + 9, t.y - 26);
    ctx.closePath();
    ctx.fill();
  }
  // Fare / delivery markers.
  if (s.side.fare) {
    const f = s.side.fare;
    const t = f.pickedUp ? { x: f.dx, y: f.dy } : { x: f.px, y: f.py };
    ctx.fillStyle = f.pickedUp ? '#2ecc71' : '#f1c40f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', t.x, t.y);
  }
  if (s.side.delivery) {
    const d = s.side.delivery;
    const t = d.pickedUp ? { x: d.dx, y: d.dy } : { x: d.px, y: d.py };
    ctx.fillStyle = '#9b59b6';
    ctx.fillRect(t.x - 11, t.y - 11, 22, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PKG', t.x, t.y);
  }
  // Traffic cars.
  for (const t of s.traffic) drawCarShape(ctx, t.x, t.y, t.angle, t.color);
  // Pedestrians.
  for (const pd of s.peds) {
    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(pd.x, pd.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(pd.x, pd.y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stealable cars.
  for (const c of s.cars) {
    if (c.wrecked) {
      drawCarShape(ctx, c.x, c.y, c.angle, '#555');
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x - 12, c.y - 12);
      ctx.lineTo(c.x + 12, c.y + 12);
      ctx.moveTo(c.x + 12, c.y - 12);
      ctx.lineTo(c.x - 12, c.y + 12);
      ctx.stroke();
      continue;
    }
    drawCarShape(ctx, c.x, c.y, c.angle, c.color);
    if (!c.stolen) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.model, c.x, c.y - 16);
    }
  }
  // Police cars.
  for (const pc of s.police) {
    drawCarShape(ctx, pc.x, pc.y, pc.angle, '#1a1a2e', 36, 19);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', pc.x, pc.y - 15);
    if (pc.siren) {
      ctx.fillStyle = Math.floor(s.time * 6) % 2 === 0 ? '#ff2d2d' : '#2d6bff';
      ctx.beginPath();
      ctx.arc(pc.x, pc.y - 12, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Roadblocks (4+ stars): two cruisers + striped barriers ahead of the player.
  for (const rb of s.roadblocks) {
    for (const b of rb.barriers) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-26, -5, 52, 10);
      ctx.fillStyle = '#111';
      for (let i = -26; i < 26; i += 13) ctx.fillRect(i, -5, 6, 10);
      ctx.restore();
    }
    for (const c of rb.cruisers) drawCarShape(ctx, c.x, c.y, c.angle, '#1a1a2e', 36, 19);
  }
  // Helicopter at 5 stars: shadow, body, searchlight cone.
  if (s.heli) {
    const h = s.heli;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(h.x + 14, h.y + 18, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, 150);
    g.addColorStop(0, 'rgba(255,255,200,0.28)');
    g.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 22, 11, h.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.x - 20, h.y);
    ctx.lineTo(h.x - 40, h.y);
    ctx.moveTo(h.x + 18, h.y - 3);
    ctx.lineTo(h.x + 34, h.y - 6);
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD AIR', h.x, h.y - 18);
  }
  // Job 7 guards with health pips.
  if (s.missions.active && s.missions.active.job.id === 7) {
    for (const g of s.missions.active.guards) {
      if (g.hp <= 0) continue;
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GUARD', g.x, g.y - 20);
      const pips = guardPips(g);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < pips ? '#e74c3c' : 'rgba(0,0,0,0.35)';
        ctx.fillRect(g.x - 18 + i * 10, g.y + 18, 8, 5);
      }
    }
    if (s.missions.active.stage === 'grab' || s.missions.active.stage === 'start') {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(2050 - 8, 400 - 8, 16, 16);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LEDGER', 2050, 400 - 14);
    }
  }
  // Rival crew members during a turf challenge.
  for (const r of s.rivals) {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(r.x, r.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RIVAL', r.x, r.y - 14);
  }
  // Bullets.
  ctx.fillStyle = '#ffe66d';
  for (const b of s.combat.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Melee swing arc.
  if (s.combat.meleeArc > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, p.angle - 0.8, p.angle + 0.8);
    ctx.stroke();
  }
  // The player.
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.x, p.y, p.angle, p.car.color, 36, 19);
    if (p.car.health < p.car.maxHealth) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - 20, p.y - 28, 40, 5);
      ctx.fillStyle = p.car.health > 40 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(p.x - 20, p.y - 28, 40 * (p.car.health / p.car.maxHealth), 5);
    }
  } else {
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e5109';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.stroke();
  }
  // Rain streaks over the camera.
  if (s.clock.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,255,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const rx = ((i * 173 + s.time * 900) % (camW(s))) + (camX(s) - 640);
      const ry = ((i * 97 + s.time * 1400) % 760) + (camY(s) - 360);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 14);
      ctx.stroke();
    }
  }
  // Fog haze.
  if (s.clock.weather === 'fog') {
    ctx.fillStyle = 'rgba(200,200,210,0.18)';
    ctx.fillRect(camX(s) - 640, camY(s) - 360, VIEW_W, VIEW_H);
  }
}

function camX(s) { return s.cam.x; }
function camY(s) { return s.cam.y; }
function camW(s) { return VIEW_W; }

/** The minimap (top-right) with dots for player, cars, coins, target. */
export function drawMinimap(ctx, s) {
  const size = 190;
  const x0 = VIEW_W - size - 14;
  const y0 = 14;
  const k = size / WORLD;
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  rr(ctx, x0, y0, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + roadPos(i) * k, y0);
    ctx.lineTo(x0 + roadPos(i) * k, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + roadPos(i) * k);
    ctx.lineTo(x0 + size, y0 + roadPos(i) * k);
    ctx.stroke();
  }
  // Turf owners as coloured dots in zone centres.
  for (const z of TURF_ZONES) {
    ctx.fillStyle = s.turf.owners[z.id] === 'You' ? '#2ecc71' : z.color;
    ctx.beginPath();
    ctx.arc(x0 + ((z.x0 + z.x1) / 2) * k, y0 + ((z.y0 + z.y1) / 2) * k, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Coins.
  ctx.fillStyle = '#ffd700';
  for (const c of s.coins) {
    if (c.taken) continue;
    ctx.beginPath();
    ctx.arc(x0 + c.x * k, y0 + c.y * k, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cars.
  ctx.fillStyle = '#fff';
  for (const c of s.cars) {
    if (c.wrecked) continue;
    ctx.fillRect(x0 + c.x * k - 1.5, y0 + c.y * k - 1.5, 3, 3);
  }
  // Race checkpoints.
  if (s.raceState.active) {
    const cp = s.raceState.active.race.checkpoints[s.raceState.active.checkpoint];
    if (cp) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x0 + cp.x * k, y0 + cp.y * k, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Mission target.
  if (s.missionTarget) {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x0 + s.missionTarget.x * k, y0 + s.missionTarget.y * k, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#3498db';
  for (const pc of s.police) {
    ctx.beginPath();
    ctx.arc(x0 + pc.x * k, y0 + pc.y * k, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(x0 + s.player.x * k, y0 + s.player.y * k, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // District name under the minimap.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(districtAt(s.player.x, s.player.y), x0 + size / 2, y0 + size + 18);
}

/** The HUD: money, stars, bars, banner, timer, clock, weather, mods. */
export function drawHUD(ctx, s) {
  const p = s.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left money block.
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  rr(ctx, 12, 12, 250, 118, 8);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${Math.floor(s.money).toLocaleString('en-US')}`, 24, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Score ${Math.floor(s.score)}  ·  ${s.rank}`, 24, 66);
  ctx.fillText(`Cars stolen ${s.carsStolen}  ·  Fares ${s.side.fareDone}  ·  Near-miss ${s.side.nearMisses}`, 24, 84);
  ctx.fillText(`Solmar coins ${s.coins.filter((c) => c.taken).length}/10  ·  Turf ${s.turfZonesHeld}/5  ·  +$${s.turfIncome}/hr`, 24, 102);
  ctx.fillStyle = '#f1c40f';
  ctx.fillText(modsSummary(s.mods), 24, 120);
  // Wanted stars (top centre).
  const cx = VIEW_W / 2;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < s.stars ? '#ffd700' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx - 60 + i * 30, 40);
  }
  // Mission objective banner.
  if (s.banner) {
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    const w = Math.min(720, ctx.measureText(s.banner).width + 40);
    rr(ctx, cx - w / 2, 52, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(s.banner, cx, 75);
  }
  // Mission timer.
  if (s.missions.active && s.missions.active.timer > 0) {
    ctx.fillStyle = s.missions.active.timer < 15 ? '#e74c3c' : '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(s.missions.active.timer)}s`, cx, 112);
  }
  // Race timer + checkpoints.
  if (s.raceState.active) {
    const a = s.raceState.active;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${a.race.name}  ${a.checkpoint}/${a.race.checkpoints.length}  ${Math.ceil(a.timer)}s`, cx, 140);
  }
  // Clock + weather (top-right, under the minimap).
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  const wIcon = s.clock.weather === 'rain' ? '🌧' : s.clock.weather === 'fog' ? '🌫' : '☀';
  ctx.fillText(`${s.clockText}  ${wIcon} ${s.clock.weather}`, VIEW_W - 16, 244);
  // Bottom-left: health + car condition + ammo + speed.
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  rr(ctx, 12, VIEW_H - 92, 300, 80, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 24, VIEW_H - 70);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(90, VIEW_H - 80, 200, 10);
  ctx.fillStyle = p.health > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(90, VIEW_H - 80, 200 * (p.health / 100), 10);
  if (p.inCar && p.car) {
    ctx.fillStyle = '#fff';
    ctx.fillText('CAR', 24, VIEW_H - 48);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(90, VIEW_H - 58, 200, 10);
    ctx.fillStyle = p.car.health > 40 ? '#3498db' : '#e74c3c';
    ctx.fillRect(90, VIEW_H - 58, 200 * (p.car.health / p.car.maxHealth), 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${p.car.model}  ${Math.round(Math.abs(p.speed) * 0.9)} km/h`, 24, VIEW_H - 26);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillText('On foot — press E near a car to steal it', 24, VIEW_H - 26);
  }
  // Ammo (bottom-right).
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  rr(ctx, VIEW_W - 172, VIEW_H - 62, 160, 50, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.combat.reloading > 0 ? 'RELOADING…' : `🔫 ${s.combat.ammo}/${s.combat.reserve}`, VIEW_W - 92, VIEW_H - 28);
  // Turf challenge timer.
  if (s.turf.challenge) {
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`TURF WAR — hold the zone! ${Math.ceil(s.turf.challenge.timer)}s`, cx, 170);
  }
  // Toast messages.
  let ty = 190;
  for (const t of s.toasts) {
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    const w = ctx.measureText(t.text).width + 30;
    rr(ctx, cx - w / 2, ty, w, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, cx, ty + 19);
    ty += 34;
  }
}

/** Night overlay: darkens the world after dusk (drawn over the world). */
export function drawNightOverlay(ctx, s) {
  const phase = skyPhase(Math.floor(s.clock.time / 3600) % 24);
  if (phase === 'night') {
    ctx.fillStyle = 'rgba(8,12,40,0.42)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else if (phase === 'dusk') {
    ctx.fillStyle = 'rgba(255,120,40,0.10)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else if (phase === 'dawn') {
    ctx.fillStyle = 'rgba(255,180,120,0.08)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------------------------------------------------------------- screens

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,20,0.88)';
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Title screen. */
export function drawTitle(ctx, s) {
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#ff7e2e');
  g.addColorStop(0.55, '#c0392b');
  g.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, 300);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', VIEW_W / 2, 170);
  ctx.font = 'italic 22px sans-serif';
  ctx.fillStyle = '#ffe66d';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', VIEW_W / 2, 212);
  panel(ctx, 290, 260, 700, 300);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 296);
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  const lines = [
    'WASD / Arrows — move & drive      E — steal / exit car',
    'Mouse — aim & shoot      R — reload      F — punch',
    'Space — handbrake      Shift — sprint      T — taxi fare',
    'P — pause      M — mute      Enter — mission board',
    '',
    '7 story jobs, 10 hidden Solmar coins, taxi fares, street races,',
    'turf wars, deliveries, the paint shop and Lou\'s Mod Shop —',
    'progress saves automatically.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 330, 326 + i * 24));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('▶  Click or press Enter to play', VIEW_W / 2, 596);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', VIEW_W / 2, 640);
  ctx.fillText(`Best: ${s.rank}  ·  $${Math.floor(s.money).toLocaleString('en-US')}  ·  ${s.missions.done.length}/7 jobs done`, VIEW_W / 2, 664);
}

/** Mission board: 7 story jobs + 3 races + turf panel. */
export function drawBoard(ctx, s) {
  ctx.fillStyle = 'rgba(5,8,16,0.92)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION BOARD — SOLMAR', VIEW_W / 2, 56);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ffe66d';
  ctx.fillText('Click a job to start it  ·  Esc / Enter to go back', VIEW_W / 2, 82);
  // Job cards, two rows of four.
  s.boardCards = [];
  MISSIONS_LIST(s).forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 60 + col * 300;
    const y = 110 + row * 150;
    const done = s.missions.done.includes(m.id);
    const active = s.missions.active && s.missions.active.job.id === m.id;
    panel(ctx, x, y, 280, 132);
    if (done) {
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (active) {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = done ? '#2ecc71' : active ? '#e74c3c' : '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${m.id}. ${m.name}`, x + 14, y + 28);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px sans-serif';
    wrapText(ctx, m.brief, x + 14, y + 50, 252, 16);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(done ? '✓ DONE' : `$${m.payout.toLocaleString('en-US')}  ·  ${m.timer ? m.timer + 's' : 'no timer'}  ·  ${m.stars}★`, x + 14, y + 116);
    s.boardCards.push({ x, y, w: 280, h: 132, id: m.id, kind: 'job' });
  });
  // Race cards.
  s.races.forEach((r, i) => {
    const x = 60 + i * 300;
    const y = 430;
    panel(ctx, x, y, 280, 110);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🏁 ${r.name}`, x + 14, y + 28);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${r.difficulty}  ·  ${r.checkpoints.length} checkpoints  ·  par ${r.par}s`, x + 14, y + 52);
    ctx.fillText(`${r.district}  ·  pays $${r.payout}`, x + 14, y + 72);
    const rec = s.raceState.results[r.id];
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(rec ? `Best ${rec.best.toFixed(1)}s  ·  ${rec.wins} win${rec.wins === 1 ? '' : 's'}` : 'Not raced yet', x + 14, y + 96);
    s.boardCards.push({ x, y, w: 280, h: 110, id: r.id, kind: 'race' });
  });
  // Turf panel.
  panel(ctx, 960, 430, 260, 110);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚔ TURF WARS', 974, 458);
  ctx.fillStyle = '#ddd';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Zones held: ${s.turfZonesHeld}/5  ·  income $${s.turfIncome}/hr`, 974, 482);
  ctx.fillText(`Earned so far: $${Math.floor(s.turf.incomeEarned)}`, 974, 502);
  ctx.fillText('Stand in a rival zone and press G to challenge it.', 974, 522);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press Enter or click a card to start · Esc to close', VIEW_W / 2, 590);
}

function MISSIONS_LIST(s) {
  return s.missionsList;
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

/** Pause screen. */
export function drawPause(ctx, s) {
  ctx.fillStyle = 'rgba(5,8,16,0.8)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, 390, 170, 500, 380);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, 220);
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  const lines = [
    `Rank: ${s.rank}`,
    `Money: $${Math.floor(s.money).toLocaleString('en-US')}   Score: ${Math.floor(s.score)}`,
    `Jobs done: ${s.missions.done.length}/7${s.missions.storyComplete ? ' — STORY COMPLETE' : ''}`,
    `Coins: ${s.coins.filter((c) => c.taken).length}/10   Fares: ${s.side.fareDone}`,
    `Turf: ${s.turfZonesHeld}/5 zones  ·  $${s.turfIncome}/hr income`,
    `Races won: ${Object.values(s.raceState.results).reduce((n, r) => n + r.wins, 0)}`,
    `Mods: ${modsSummary(s.mods)} (spent $${s.modsSpent})`,
    `Time: ${s.clockText}   Weather: ${s.clock.weather}`,
    '',
    'P / Esc — resume      M — mute      Enter — mission board',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 430, 260 + i * 26));
}

/** WASTED screen. */
export function drawWasted(ctx, s) {
  ctx.fillStyle = 'rgba(20,0,0,0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('You wake up at Solmar General Hospital…', VIEW_W / 2, 370);
  ctx.fillText('Click or press Enter to get back out there.', VIEW_W / 2, 400);
}

/** Lou's Mod Shop panel (opened inside the mod shop zone). */
export function drawModShop(ctx, s) {
  ctx.fillStyle = 'rgba(5,8,16,0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, 290, 110, 700, 500);
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("LOU'S MOD SHOP", VIEW_W / 2, 158);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Cash: $${Math.floor(s.money).toLocaleString('en-US')}   ·   Upgrades stick to your car and save with you.`, VIEW_W / 2, 186);
  s.modCards = [];
  s.modCategories.forEach((cat, ci) => {
    const y = 220 + ci * 116;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cat.name, 330, y);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Level ${s.mods[cat.id]}/3`, 330, y + 22);
    cat.levels.forEach((lv, li) => {
      const x = 470 + li * 160;
      const owned = s.mods[cat.id] >= lv.level;
      const next = s.mods[cat.id] === lv.level - 1;
      ctx.fillStyle = owned ? 'rgba(46,204,113,0.25)' : next ? 'rgba(241,196,15,0.2)' : 'rgba(255,255,255,0.08)';
      rr(ctx, x, y - 18, 145, 62, 8);
      ctx.fill();
      ctx.fillStyle = owned ? '#2ecc71' : '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(lv.name, x + 10, y + 4);
      ctx.fillStyle = '#ffe66d';
      ctx.font = '12px sans-serif';
      ctx.fillText(owned ? 'OWNED' : `$${lv.price}`, x + 10, y + 26);
      if (next) s.modCards.push({ x, y: y - 18, w: 145, h: 62, cat: cat.id });
    });
  });
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click a highlighted level to buy it  ·  Esc to leave the shop', VIEW_W / 2, 580);
}
