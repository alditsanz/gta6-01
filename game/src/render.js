// render.js — all canvas drawing: the city, vehicles, people, effects,
// HUD and minimap. Pure drawing only; game rules live elsewhere.

import { WORLD_SIZE, ROAD_CENTERS, ROAD_WIDTH, districtAt } from './config.js';
import { isCanal, isBridge } from './world.js';
import { LANDMARKS } from './landmarks.js';
import { darknessForHour } from './weather.js';

export function makeCamera(x, y, w, h) { return { x, y, w, h }; }

export function followCamera(cam, tx, ty) {
  cam.x = Math.max(0, Math.min(WORLD_SIZE - cam.w, tx - cam.w / 2));
  cam.y = Math.max(0, Math.min(WORLD_SIZE - cam.h, ty - cam.h / 2));
  return cam;
}

function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

export function drawWorld(ctx, game, cam) {
  const wx = game.weather;
  // Ground: sun-baked pavement / grass tint by district mood.
  rect(ctx, -cam.x, -cam.y, WORLD_SIZE, WORLD_SIZE, '#cbb98a');
  // Canals in Canal Row.
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(1560 - cam.x, 1560 - cam.y, 880, 880);
  ctx.fillStyle = '#cbb98a';
  // Re-paint land inside Canal Row except the two channels.
  for (let gx = 1560; gx < 2440; gx += 44) {
    for (let gy = 1560; gy < 2440; gy += 44) {
      if (!isCanal(gx + 22, gy + 22) && !isBridge(gx + 22, gy + 22)) rect(ctx, gx - cam.x, gy - cam.y, 44, 44, '#c2b183');
    }
  }
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(1830 - 34 - cam.x, 1560 - cam.y, 68, 880);
  ctx.fillRect(1560 - cam.x, 1830 - 34 - cam.y, 880, 68);
  // Parks.
  for (const p of game.world.parks) rect(ctx, p.x - cam.x, p.y - cam.y, p.w, p.h, '#79a85b');
  // Roads.
  for (const c of ROAD_CENTERS) {
    rect(ctx, c - ROAD_WIDTH / 2 - cam.x, -cam.y, ROAD_WIDTH, WORLD_SIZE, '#4a4a52');
    rect(ctx, -cam.x, c - ROAD_WIDTH / 2 - cam.y, WORLD_SIZE, ROAD_WIDTH, '#4a4a52');
  }
  // Bridge decks over canals (roads already drawn; add plank lines).
  ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3;
  for (const c of ROAD_CENTERS) {
    ctx.beginPath(); ctx.moveTo(c - cam.x, 1796 - cam.y); ctx.lineTo(c - cam.x, 1864 - cam.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1796 - cam.x, c - cam.y); ctx.lineTo(1864 - cam.x, c - cam.y); ctx.stroke();
  }
  // Dashed lane markings.
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  for (const c of ROAD_CENTERS) {
    ctx.beginPath(); ctx.moveTo(c - cam.x, -cam.y); ctx.lineTo(c - cam.x, WORLD_SIZE - cam.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-cam.x, c - cam.y); ctx.lineTo(WORLD_SIZE - cam.x, c - cam.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings with roofs and lit windows at night.
  const dark = darknessForHour(wx.hour());
  for (const b of game.world.buildings) {
    rect(ctx, b.x - cam.x + 4, b.y - cam.y + 5, b.w, b.h, 'rgba(0,0,0,0.18)');
    rect(ctx, b.x - cam.x, b.y - cam.y, b.w, b.h, b.color);
    rect(ctx, b.x - cam.x + 5, b.y - cam.y + 5, b.w - 10, b.h - 10, 'rgba(255,255,255,0.14)');
    if (dark > 0.15) {
      ctx.fillStyle = '#ffd76e';
      for (let wy = 0; wy < 3; wy++) for (let wxi = 0; wxi < 3; wxi++) {
        if ((wxi * 3 + wy + b.floors) % 3 === 0) ctx.fillRect(b.x - cam.x + 12 + wxi * 26, b.y - cam.y + 12 + wy * 26, 9, 9);
      }
    }
  }
  // Trees.
  for (const t of game.world.trees) {
    ctx.fillStyle = '#3e7d3a';
    ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#55a04e';
    ctx.beginPath(); ctx.arc(t.x - cam.x - 3, t.y - cam.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  // Landmark pads + signs.
  for (const lm of LANDMARKS) {
    rect(ctx, lm.x - 44 - cam.x, lm.y - 44 - cam.y, 88, 88, lm.color);
    rect(ctx, lm.x - 38 - cam.x, lm.y - 38 - cam.y, 76, 76, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lm.icon, lm.x - cam.x, lm.y - cam.y - 2);
    ctx.font = '11px sans-serif';
    ctx.fillText(lm.short, lm.x - cam.x, lm.y - cam.y + 16);
  }
  // Turf zone rings.
  if (game.turf) for (const z of game.turf.zones) {
    ctx.strokeStyle = z.owner === 'Solmar Crew' ? '#2ecc71' : '#e74c3c';
    ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(z.x - cam.x, z.y - cam.y, z.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Coins.
  for (const c of game.coins) {
    if (c.taken) continue;
    ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(c.x - cam.x, c.y - cam.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8860b'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('S', c.x - cam.x, c.y - cam.y + 4);
  }
  // Race starters + checkpoints.
  if (game.races) {
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    for (const r of game.raceList) ctx.fillText('🏁', r.start.x - cam.x, r.start.y - cam.y);
    const cp = game.races.currentCheckpoint ? game.races.currentCheckpoint() : null;
    if (cp) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cp.x - cam.x, cp.y - cam.y, 30 + Math.sin(game.time * 5) * 5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Mission / fare / delivery markers.
  drawTargetMarker(ctx, game, cam);
}

function drawTargetMarker(ctx, game, cam) {
  let t = null, color = '#ffd700';
  if (game.missions && game.missions.active) t = game.missions.currentTarget();
  else if (game.side && game.side.fare && game.side.fare.phase === 'ride') t = game.side.fare.dest;
  else if (game.side && game.side.delivery && game.side.delivery.phase === 'run') t = game.side.delivery.dest;
  if (!t) return;
  const bob = Math.sin(game.time * 4) * 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(t.x - cam.x, t.y - cam.y - 44 + bob);
  ctx.lineTo(t.x - cam.x - 13, t.y - cam.y - 68 + bob);
  ctx.lineTo(t.x - cam.x + 13, t.y - cam.y - 68 + bob);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, 34, 0, Math.PI * 2); ctx.stroke();
}

export function drawCarShape(ctx, car, cam, isPolice) {
  const x = car.x - cam.x, y = car.y - cam.y;
  ctx.save(); ctx.translate(x, y); ctx.rotate(car.angle || 0);
  if (car.wrecked) ctx.globalAlpha = 0.55;
  rect(ctx, -24, -13, 48, 26, car.wrecked ? '#555555' : car.color);
  rect(ctx, -8, -10, 18, 20, '#bfe8ff'); // windshield cabin
  rect(ctx, -22, -13, 6, 26, 'rgba(0,0,0,0.25)');
  rect(ctx, 18, -13, 6, 26, 'rgba(255,255,255,0.3)');
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-19, -17, 11, 5); ctx.fillRect(8, -17, 11, 5);
  ctx.fillRect(-19, 12, 11, 5); ctx.fillRect(8, 12, 11, 5);
  if (isPolice) {
    rect(ctx, -5, -12, 10, 24, '#ffffff');
    ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#ff4444' : '#4488ff';
    ctx.fillRect(-4, -4, 8, 8);
  }
  ctx.restore();
  if (car.health !== undefined && car.health < 100) {
    rect(ctx, x - 22, y - 28, 44, 5, '#333333');
    rect(ctx, x - 22, y - 28, 44 * Math.max(0, car.health) / 100, 5, car.health > 40 ? '#2ecc71' : '#e74c3c');
  }
}

export function drawEntities(ctx, game, cam) {
  for (const p of game.pedestrians) {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5cfa5';
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y - 2, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of game.traffic) drawCarShape(ctx, c, cam, false);
  for (const c of game.cars) if (c !== game.player.car) drawCarShape(ctx, c, cam, false);
  for (const cop of game.police) drawCarShape(ctx, cop, cam, true);
  // Guards with health pips.
  const guards = game.missions && game.missions.guards ? game.missions.guards : [];
  for (const g of guards) {
    if (!g.alive) continue;
    ctx.fillStyle = '#34495e';
    ctx.beginPath(); ctx.arc(g.x - cam.x, g.y - cam.y, 11, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < g.maxHealth; i++) {
      rect(ctx, g.x - cam.x - 12 + i * 9, g.y - cam.y - 24, 7, 5, i < g.health ? '#e74c3c' : '#555555');
    }
  }
  // Helicopter: shadow, body, rotor, searchlight.
  if (game.heli && game.heli.active) {
    const hx = game.heli.x - cam.x, hy = game.heli.y - cam.y;
    ctx.fillStyle = 'rgba(255,255,190,0.16)';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 90, hy + 190); ctx.lineTo(hx + 90, hy + 190); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(hx + 16, hy + 22, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(game.heli.angle || 0);
    rect(ctx, -26, -10, 52, 20, '#2c3e50');
    rect(ctx, -44, -3, 20, 6, '#2c3e50');
    rect(ctx, 4, -6, 14, 12, '#bfe8ff');
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 3;
    const r = (game.time * 28) % Math.PI;
    ctx.beginPath(); ctx.moveTo(-Math.cos(r) * 40, -Math.sin(r) * 8); ctx.lineTo(Math.cos(r) * 40, Math.sin(r) * 8); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SCPD', hx, hy - 18);
  }
  // Player car or player on foot.
  if (game.player.car) drawCarShape(ctx, game.player.car, cam, false);
  else {
    const p = game.player;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x - cam.x, p.y - cam.y + 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5cfa5';
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y - 3, 5, 0, Math.PI * 2); ctx.fill();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x - cam.x, p.y - cam.y);
    ctx.lineTo(p.x - cam.x + Math.cos(p.angle) * 30, p.y - cam.y + Math.sin(p.angle) * 30); ctx.stroke();
  }
  // Bullets.
  ctx.fillStyle = '#ffe66d';
  for (const b of game.combat.bullets) ctx.fillRect(b.x - cam.x - 2, b.y - cam.y - 2, 5, 5);
  // Roadblocks.
  for (const rb of game.roadblocks) {
    drawCarShape(ctx, rb.a, cam, true);
    drawCarShape(ctx, rb.b, cam, true);
    ctx.save(); ctx.translate(rb.x - cam.x, rb.y - cam.y); ctx.rotate(rb.angle || 0);
    for (let i = 0; i < 5; i++) rect(ctx, -8, -42 + i * 18, 16, 9, i % 2 ? '#ffffff' : '#e74c3c');
    ctx.restore();
  }
}

export function drawSkyAndWeather(ctx, game, w, h) {
  const dark = darknessForHour(game.weather.hour());
  if (dark > 0) { ctx.fillStyle = 'rgba(10,16,48,' + dark + ')'; ctx.fillRect(0, 0, w, h); }
  if (game.weather.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,220,255,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = (i * 61 + game.time * 620) % w, y = (i * 97 + game.time * 880) % h;
      ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14);
    }
    ctx.stroke();
  }
  if (game.weather.weather === 'fog') { ctx.fillStyle = 'rgba(220,225,230,0.34)'; ctx.fillRect(0, 0, w, h); }
}

export function drawMinimap(ctx, game, x, y, size) {
  rect(ctx, x - 4, y - 4, size + 8, size + 8, 'rgba(0,0,0,0.55)');
  const s = size / WORLD_SIZE;
  rect(ctx, x, y, size, size, '#cbb98a');
  ctx.fillStyle = '#4a4a52';
  for (const c of ROAD_CENTERS) { ctx.fillRect(x + c * s - 1, y, 2, size); ctx.fillRect(x, y + c * s - 1, size, 2); }
  if (game.turf) for (const z of game.turf.zones) {
    ctx.fillStyle = z.owner === 'Solmar Crew' ? 'rgba(46,204,113,0.5)' : 'rgba(231,76,60,0.4)';
    ctx.beginPath(); ctx.arc(x + z.x * s, y + z.y * s, z.r * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffd700';
  for (const c of game.coins) if (!c.taken) ctx.fillRect(x + c.x * s - 2, y + c.y * s - 2, 4, 4);
  if (game.races && game.races.active) {
    const cp = game.races.currentCheckpoint();
    if (cp) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + cp.x * s - 3, y + cp.y * s - 3, 6, 6); }
  }
  ctx.fillStyle = '#7ec8ff';
  for (const c of game.cars) ctx.fillRect(x + c.x * s - 2, y + c.y * s - 2, 4, 4);
  ctx.fillStyle = '#ff4444';
  for (const cop of game.police) ctx.fillRect(x + cop.x * s - 2, y + cop.y * s - 2, 4, 4);
  let t = null;
  if (game.missions && game.missions.active) t = game.missions.currentTarget();
  if (t) { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(x + t.x * s, y + t.y * s, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x + game.player.x * s, y + game.player.y * s, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x, y, size, size);
}

export function drawHUD(ctx, game, w, h) {
  const p = game.player;
  ctx.textAlign = 'left';
  rect(ctx, 0, 0, w, 46, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText('$' + game.money, 14, 29);
  ctx.fillStyle = '#ffd700'; ctx.font = '14px sans-serif';
  ctx.fillText('Score ' + game.score, 120, 29);
  ctx.fillText('Coins ' + game.coins.filter((c) => c.taken).length + '/10', 230, 29);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(game.weather.clockText() + ' ' + game.weather.weather, 350, 29);
  ctx.fillText('Turf ' + (game.turf ? game.turf.heldCount() : 0) + '/6', 470, 29);
  // Wanted stars.
  ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.stars ? '#ffd700' : 'rgba(255,255,255,0.3)';
    ctx.fillText('★', w / 2 - 56 + i * 28, 31);
  }
  ctx.textAlign = 'left';
  drawMinimap(ctx, game, w - 196, 56, 180);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(districtAt(p.x, p.y), w - 106, 256);
  ctx.font = '12px sans-serif'; ctx.fillText(game.rank, w - 106, 274);
  // Health + ammo / speed.
  rect(ctx, 12, h - 58, 190, 15, '#333333');
  rect(ctx, 12, h - 58, 190 * Math.max(0, p.health) / 100, 15, p.health > 30 ? '#2ecc71' : '#e74c3c');
  ctx.fillStyle = '#ffffff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 14, h - 62 + 4 - 16 + 12);
  if (p.car) {
    rect(ctx, 12, h - 36, 190, 11, '#333333');
    rect(ctx, 12, h - 36, 190 * Math.max(0, p.car.health) / 100, 11, '#3498db');
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CAR ' + Math.round(Math.abs(p.car.speed)) + ' u/s', 210, h - 26);
  } else {
    ctx.fillText('Ammo ' + game.combat.mag + '/' + game.combat.reserve + (game.combat.reloading > 0 ? ' reloading…' : ''), 14, h - 26);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Stolen ' + game.stats.stolen + ' · Fares ' + game.stats.fares + ' · Near-miss ' + game.stats.nearMiss, 330, h - 26);
  // Objective banner.
  const obj = game.objectiveText;
  if (obj) {
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(obj).width + 32;
    rect(ctx, (w - tw) / 2, 54, tw, 32, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = '#ffd700'; ctx.textAlign = 'center';
    ctx.fillText(obj, w / 2, 76);
    ctx.textAlign = 'left';
  }
  if (game.message && game.messageT > 0) {
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.message, w / 2, h - 84);
    ctx.textAlign = 'left';
  }
}
