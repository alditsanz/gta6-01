// Solmar Heat — render.js
// Everything the player sees: the city from above, the cars and people,
// the police and the helicopter, the HUD with its minimap, and the four
// screens (title, mission board, pause, WASTED). The camera follows the
// player; the day/night sky and the weather paint over the world.

import { WORLD, ROADS, ROAD_W, DISTRICT_ROWS, RANKS, MISSIONS, RACES, LANDMARKS, TURF_ZONES, HEAT_PER_STAR } from './config.js';
import { districtAt, isWater, isBridge } from './world.js';
import { coinsCollected } from './collectibles.js';
import { wantedStars, rankTitle } from './main.js';

// Sky phase from the in-game hour: bright day, orange dusk, dark night.
export function skyPhase(hour) {
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  if (hour >= 5 && hour < 7) return 'dawn';
  return 'night';
}

function skyOverlay(hour) {
  const phase = skyPhase(hour);
  if (phase === 'day') return null;
  if (phase === 'dusk') return 'rgba(255,110,30,0.20)';
  if (phase === 'dawn') return 'rgba(255,170,90,0.12)';
  return 'rgba(8,12,38,0.48)';
}

function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(ctx, state, input) {
  const W = 1280;
  const H = 720;
  if (state.screen === 'title') return renderTitle(ctx, state);
  if (state.screen === 'board') return renderBoard(ctx, state);
  if (state.screen === 'wasted') return renderWasted(ctx, state);
  renderWorld(ctx, state);
  renderHud(ctx, state);
  if (state.screen === 'pause') renderPause(ctx, state);
}

// ------------------------------------------------------------------ world
function renderWorld(ctx, state) {
  const W = 1280;
  const H = 720;
  const camX = state.camera.x - W / 2;
  const camY = state.camera.y - H / 2;
  // Ground: sun-baked sand and grass blocks.
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-camX, -camY);
  // Parks first (green blocks under everything else).
  for (const p of state.city.parks) {
    ctx.fillStyle = '#7fae5a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Roads: dark asphalt with dashed centre lines.
  ctx.fillStyle = '#3d4148';
  for (const r of ROADS) {
    ctx.fillRect(r - ROAD_W / 2, 0, ROAD_W, WORLD);
    ctx.fillRect(0, r - ROAD_W / 2, WORLD, ROAD_W);
  }
  ctx.strokeStyle = '#e8d44d';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const r of ROADS) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r, WORLD);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(WORLD, r);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Canals: blue water with bridge decks over them.
  ctx.fillStyle = '#3f8fd0';
  for (const c of [{ y0: 380, y1: 430 }, { y0: 760, y1: 810 }]) {
    ctx.fillRect(1952, c.y0, WORLD - 1952, c.y1 - c.y0);
  }
  ctx.fillStyle = '#8a6f4d';
  for (const c of [{ y0: 380, y1: 430 }, { y0: 760, y1: 810 }]) {
    ctx.fillRect(2151 - 44, c.y0 - 4, 88, c.y1 - c.y0 + 8);
  }
  // Buildings with lighter roofs.
  for (const b of state.city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
  }
  // Trees.
  for (const t of state.city.trees) {
    ctx.fillStyle = '#4e8a3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // Turf zone tints (very light, so the map stays readable).
  for (const z of TURF_ZONES) {
    ctx.fillStyle = z.owner === 'player' ? 'rgba(46,204,113,0.10)' : 'rgba(192,57,43,0.06)';
    ctx.fillRect(z.rect.x, z.rect.y, z.rect.w, z.rect.h);
    ctx.strokeStyle = z.owner === 'player' ? '#2ecc71' : z.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(z.rect.x, z.rect.y, z.rect.w, z.rect.h);
    ctx.setLineDash([]);
    ctx.fillStyle = z.owner === 'player' ? '#1e8449' : z.color;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(z.owner === 'player' ? `${z.name} — YOURS` : `${z.name} — ${z.owner}`, z.rect.x + 12, z.rect.y + 24);
  }
  // Landmarks.
  for (const l of LANDMARKS) {
    drawLandmark(ctx, l);
  }
  // Solmar coins: gold, spinning (pulsing radius).
  const pulse = 9 + Math.sin(state.time * 4) * 2;
  for (const c of state.coins) {
    if (c.taken) continue;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(c.x, c.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S', c.x, c.y + 4);
    ctx.textAlign = 'left';
  }
  // Fare marker.
  const f = state.fare;
  if (f && f.active && !f.pickedUp) {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('T', f.x, f.y + 5);
    ctx.textAlign = 'left';
  }
  if (f && f.pickedUp) {
    drawMarker(ctx, f.destX, f.destY, '#f2c230', 'FARE');
  }
  // Delivery markers.
  const d = state.delivery;
  if (d.active) {
    if (!d.pickedUp) drawMarker(ctx, d.x, d.y, '#9b59b6', 'PKG');
    else drawMarker(ctx, d.destX, d.destY, '#9b59b6', 'DELIVER');
  }
  // Race starter flags + next checkpoint.
  for (const r of RACES) {
    const c0 = r.checkpoints[0];
    drawFlag(ctx, c0.x, c0.y, '#ffffff');
  }
  if (state.race.active && state.race.def) {
    const cp = state.race.def.checkpoints[state.race.index];
    if (cp) drawMarker(ctx, cp.x, cp.y, '#2ecc71', `CP ${state.race.index + 1}`);
  }
  // Mission target marker.
  if (state.mission.active && state.mission.def) {
    const t = state.mission.def.target;
    drawMarker(ctx, t.x, t.y, '#ff4757', state.mission.def.finale && state.mission.stage === 'escape' ? 'MARINA' : 'TARGET');
    // Finale escape target: the Marina.
    if (state.mission.def.finale && state.mission.stage === 'escape') {
      drawMarker(ctx, 387, 2151, '#ff4757', 'ESCAPE');
    }
  }
  // Parked stealable cars.
  for (const c of state.parked) {
    if (c.stolen && state.player.car === c) continue; // drawn as the player car
    drawCar(ctx, c.x, c.y, c.angle, c.color, c.wrecked ? 0.45 : 1, c.model);
  }
  // Traffic.
  for (const t of state.traffic) drawCar(ctx, t.x, t.y, t.angle, t.color, 1, '');
  // Pedestrians.
  for (const p of state.peds) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 9, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police cruisers.
  for (const cop of state.police) {
    drawCar(ctx, cop.x, cop.y, cop.angle, '#1c2733', 1, '');
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(cop.x - 8, cop.y - 14, 7, 5);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(cop.x + 2, cop.y - 14, 7, 5);
  }
  // Roadblocks: two cruisers + striped barriers.
  for (const rb of state.roadblocks) {
    drawCar(ctx, rb.x, rb.y, rb.angle, '#1c2733', 1, '');
    ctx.save();
    ctx.translate(rb.x, rb.y);
    ctx.rotate(rb.angle);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-30, 16, 60, 10);
    ctx.fillStyle = '#222';
    for (let i = -30; i < 30; i += 12) ctx.fillRect(i, 16, 6, 10);
    ctx.restore();
  }
  // HQ guards with health pips.
  for (const g of state.mission.guards) {
    if (g.dead) continue;
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    for (let i = 0; i < g.maxHp; i++) {
      ctx.beginPath();
      ctx.arc(g.x - 14 + i * 14, g.y - 26, i < g.hp ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i < g.hp ? '#e74c3c' : 'rgba(231,76,60,0.3)';
      ctx.fill();
    }
  }
  // Turf rivals.
  for (const r of state.turf.rivals) {
    if (r.dead) continue;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(r.x, r.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('R', r.x, r.y + 4);
    ctx.textAlign = 'left';
  }
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: on foot a figure, in a car the car itself.
  const p = state.player;
  if (p.inCar && p.car) {
    drawCar(ctx, p.x, p.y, p.angle, p.car.color, 1, p.car.model);
  } else {
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e5109';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.onFootAngle) * 18, p.y + Math.sin(p.onFootAngle) * 18);
    ctx.stroke();
  }
  // Helicopter shadow + body + searchlight cone.
  if (state.heli) {
    const h = state.heli;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(h.x + 40, h.y + 40, 34, 16, h.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,180,0.18)';
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + Math.cos(h.angle + 0.5) * 190, h.y + Math.sin(h.angle + 0.5) * 190);
    ctx.lineTo(h.x + Math.cos(h.angle - 0.5) * 190, h.y + Math.sin(h.angle - 0.5) * 190);
    ctx.closePath();
    ctx.fill();
    drawHeli(ctx, h.x, h.y, h.angle);
  }
  ctx.restore();

  // Day/night + weather overlays (screen space).
  const overlay = skyOverlay(state.clockHours);
  if (overlay) {
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);
  }
  if (skyPhase(state.clockHours) === 'night') {
    // Streetlight pools along the roads near the player.
    ctx.fillStyle = 'rgba(255,220,120,0.10)';
    for (const r of ROADS) {
      for (let k = 0; k < 4; k++) {
        const lx = r + (k % 2 === 0 ? -40 : 40);
        const ly = 300 + k * 600;
        const sx = lx - camX;
        const sy = ly - camY;
        if (sx > -60 && sx < W + 60 && sy > -60 && sy < H + 60) {
          ctx.beginPath();
          ctx.arc(sx, sy, 46, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  if (state.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,230,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const drop of state.rainDrops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 6, drop.y + 18);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,150,190,0.10)';
    ctx.fillRect(0, 0, W, H);
  }
  if (state.weather === 'fog') {
    ctx.fillStyle = 'rgba(200,205,215,0.30)';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawLandmark(ctx, l) {
  ctx.save();
  ctx.translate(l.x, l.y);
  if (l.kind === 'hq') {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-46, -34, 92, 68);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, 4);
    ctx.textAlign = 'left';
  } else if (l.kind === 'paint') {
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(-40, -28, 80, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("LOU'S", 0, -2);
    ctx.fillText('PAINT', 0, 12);
    ctx.textAlign = 'left';
  } else if (l.kind === 'modshop') {
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(-40, -28, 80, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("LOU'S", 0, -2);
    ctx.fillText('MODS', 0, 12);
    ctx.textAlign = 'left';
  } else if (l.kind === 'marina') {
    ctx.fillStyle = '#16a085';
    ctx.fillRect(-44, -26, 88, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MARINA', 0, 4);
    ctx.textAlign = 'left';
  } else if (l.kind === 'pier') {
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-40, -26, 80, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIER 9', 0, 4);
    ctx.textAlign = 'left';
  } else if (l.kind === 'plaza') {
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLAZA', 0, 4);
    ctx.textAlign = 'left';
  } else if (l.kind === 'locks') {
    ctx.fillStyle = '#3f8fd0';
    ctx.fillRect(-34, -20, 68, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKS', 0, 4);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#d4ac0d';
    ctx.fillRect(-36, -22, 72, 44);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUNSET', 0, -2);
    ctx.fillText('MILE', 0, 11);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawMarker(ctx, x, y, color, label) {
  const bob = Math.sin(Date.now() / 300) * 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 34 + bob);
  ctx.lineTo(x + 12, y - 12 + bob);
  ctx.lineTo(x - 12, y - 12 + bob);
  ctx.closePath();
  ctx.fill();
  // Dark pill behind the label so it reads over buildings and landmarks.
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  const tw = ctx.measureText(label).width;
  roundRect(ctx, x - tw / 2 - 6, y - 58 + bob, tw + 12, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 43 + bob);
  ctx.textAlign = 'left';
}

function drawFlag(ctx, x, y, color) {
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 34);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 34);
  ctx.lineTo(x + 26, y - 27);
  ctx.lineTo(x, y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#222';
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(x + 4 + i * 10, y - 32 + (i % 2) * 5, 5, 5);
  }
}

function drawCar(ctx, x, y, angle, color, alpha, label) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  roundRect(ctx, -20, -11, 40, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-6, -9, 12, 18);
  ctx.fillStyle = '#222';
  ctx.fillRect(-20, -12, 7, 4);
  ctx.fillRect(-20, 8, 7, 4);
  ctx.fillRect(13, -12, 7, 4);
  ctx.fillRect(13, 8, 7, 4);
  ctx.restore();
  if (label) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 18);
    ctx.textAlign = 'left';
  }
}

function drawHeli(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#1c2733';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-26, -3, 10, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -18);
  ctx.lineTo(6, 18);
  ctx.moveTo(-6, 18);
  ctx.lineTo(6, -18);
  ctx.stroke();
  ctx.restore();
}

// -------------------------------------------------------------------- HUD
function renderHud(ctx, state) {
  const W = 1280;
  const H = 720;
  const p = state.player;
  const stars = wantedStars(state);
  ctx.textAlign = 'left';

  // Top-left: money, score, rank.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 250, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${Math.floor(state.money)}`, 24, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Score ${state.score}   •   ${rankTitle(state)}`, 24, 66);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Cars stolen ${state.stats.carsStolen}   Fares ${state.stats.fares}   Near misses ${state.stats.nearMisses}`, 24, 86);

  // Top-centre: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W / 2 - 110, 12, 220, 44, 8);
  ctx.fill();
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  let starText = '';
  for (let i = 0; i < 5; i++) starText += i < stars ? '★' : '☆';
  ctx.fillStyle = stars >= 4 ? '#ff4757' : '#ffd700';
  ctx.fillText(starText, W / 2, 44);
  ctx.textAlign = 'left';

  // Top-right: clock + weather + coins.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W - 262, 12, 250, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(fmtClock(state.clockHours), W - 248, 40);
  ctx.font = '15px sans-serif';
  const weatherIcon = state.weather === 'rain' ? '🌧 Rain' : state.weather === 'fog' ? '🌫 Fog' : '☀ Clear';
  ctx.fillText(weatherIcon, W - 248, 64);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`Solmar coins ${coinsCollected(state.coins)}/10`, W - 248, 86);

  // Bottom-left: health + car condition + ammo + speed.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, H - 118, 270, 106, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEALTH', 24, H - 94);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(90, H - 106, 170 * Math.max(0, p.health / 100), 12);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(90, H - 106, 170, 12);
  ctx.fillStyle = '#fff';
  ctx.fillText(p.inCar ? 'CAR' : 'ON FOOT', 24, H - 70);
  if (p.inCar && p.car) {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(90, H - 82, 170 * Math.max(0, p.car.health / 100), 12);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(90, H - 82, 170, 12);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Ammo ${p.ammo}/${p.reserve}`, 24, H - 44);
  ctx.fillText(p.inCar ? `Speed ${Math.round(Math.abs(p.speed))}  •  ${p.car.model}` : 'Press E near a car to steal it', 24, H - 24);

  // Bottom-centre: message banner.
  if (state.message) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const tw = ctx.measureText(state.message).width;
    roundRect(ctx, W / 2 - tw / 2 - 14, H - 52, tw + 28, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, W / 2, H - 29);
    ctx.textAlign = 'left';
  }

  // Mission objective banner (top, under the stars).
  if (state.mission.active && state.mission.def) {
    const m = state.mission;
    let line = m.def.name;
    if (m.def.finale) {
      if (m.stage === 'reach-hq') line += ' — reach SCPD Headquarters';
      else if (m.stage === 'clear-guards') line += ' — clear the 3 guards';
      else if (m.stage === 'grab-ledger') line += ' — grab the ledger';
      else if (m.stage === 'escape') line += ` — escape to the Marina! ${fmtTimer(m.escapeTimer)}`;
    } else if (m.timer > 0) {
      line += ` — ${m.def.target.label}  •  ${fmtTimer(m.timer)}`;
    } else {
      line += ` — ${m.def.target.label}`;
    }
    ctx.fillStyle = 'rgba(120,20,20,0.75)';
    const tw = ctx.measureText(line).width;
    roundRect(ctx, W / 2 - tw / 2 - 14, 64, tw + 28, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(line, W / 2, 85);
    ctx.textAlign = 'left';
  }

  // Race HUD.
  if (state.race.active && state.race.def) {
    const r = state.race;
    const line = `${r.def.name} — checkpoint ${r.index + 1}/${r.def.checkpoints.length}  •  ${fmtTimer(r.timer)}`;
    ctx.fillStyle = 'rgba(20,90,40,0.75)';
    const tw = ctx.measureText(line).width;
    roundRect(ctx, W / 2 - tw / 2 - 14, 104, tw + 28, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(line, W / 2, 125);
    ctx.textAlign = 'left';
  }

  // Delivery HUD.
  if (state.delivery.active) {
    const d = state.delivery;
    const line = d.pickedUp ? `Deliver the package! ${fmtTimer(d.timer)}` : `Pick up the package! ${fmtTimer(d.timer)}`;
    ctx.fillStyle = 'rgba(90,40,120,0.75)';
    const tw = ctx.measureText(line).width;
    roundRect(ctx, W / 2 - tw / 2 - 14, 144, tw + 28, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(line, W / 2, 165);
    ctx.textAlign = 'left';
  }

  // Turf challenge HUD.
  if (state.turf.active) {
    const t = state.turf;
    const line = `Turf war: ${t.zone.name} — hold the ground! ${fmtTimer(t.timer)}`;
    ctx.fillStyle = 'rgba(140,40,40,0.8)';
    const tw = ctx.measureText(line).width;
    roundRect(ctx, W / 2 - tw / 2 - 14, 184, tw + 28, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(line, W / 2, 205);
    ctx.textAlign = 'left';
  }

  // Mod shop prompt.
  if (state.player.x && Math.hypot(state.player.x - 639, state.player.y - 387) < 130) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, 12, H - 230, 330, 104, 8);
    ctx.fill();
    ctx.fillStyle = '#d7b3ff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText("Lou's Mod Shop — press 1/2/3 to buy:", 24, H - 206);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`1 Engine Lv${state.mods.engine}/3   2 Armor Lv${state.mods.armor}/3   3 Tires Lv${state.mods.tires}/3`, 24, H - 184);
    ctx.fillText('Engine: top speed   Armor: car health   Tires: grip', 24, H - 164);
    ctx.fillText('Paint shop next door clears heat + repairs (drive in).', 24, H - 144);
  }

  renderMinimap(ctx, state);
}

function renderMinimap(ctx, state) {
  const W = 1280;
  const H = 720;
  const size = 190;
  const x0 = W - size - 14;
  const y0 = H - size - 14;
  const scale = size / WORLD;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 8);
  ctx.fill();
  // Turf colours on the minimap.
  for (const z of TURF_ZONES) {
    ctx.fillStyle = z.owner === 'player' ? 'rgba(46,204,113,0.5)' : z.color + '55';
    ctx.fillRect(x0 + z.rect.x * scale, y0 + z.rect.y * scale, z.rect.w * scale, z.rect.h * scale);
  }
  ctx.fillStyle = '#3d4148';
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  for (const r of ROADS) {
    ctx.beginPath();
    ctx.moveTo(x0 + (r - ROAD_W / 2) * scale, y0);
    ctx.lineTo(x0 + (r - ROAD_W / 2) * scale, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + (r - ROAD_W / 2) * scale);
    ctx.lineTo(x0 + size, y0 + (r - ROAD_W / 2) * scale);
    ctx.stroke();
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const c of state.coins) if (!c.taken) dot(c.x, c.y, '#ffd700', 3);
  for (const c of state.parked) if (!c.wrecked && !c.stolen) dot(c.x, c.y, '#fff', 3);
  for (const cop of state.police) dot(cop.x, cop.y, '#3498db', 4);
  if (state.heli) dot(state.heli.x, state.heli.y, '#e74c3c', 5);
  if (state.mission.active && state.mission.def) {
    const t = state.mission.def.target;
    dot(t.x, t.y, '#ff4757', 6);
  }
  if (state.race.active && state.race.def) {
    const cp = state.race.def.checkpoints[state.race.index];
    if (cp) dot(cp.x, cp.y, '#2ecc71', 5);
  }
  if (state.fare.active && !state.fare.pickedUp) dot(state.fare.x, state.fare.y, '#f2c230', 4);
  dot(state.player.x, state.player.y, '#2ecc71', 5);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 7, 0, Math.PI * 2);
  ctx.stroke();
  // District name ABOVE the minimap (below it falls off the screen).
  const district = districtAt(state.player.x, state.player.y);
  ctx.font = 'bold 15px sans-serif';
  const dw = ctx.measureText(district).width;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, x0 + size / 2 - dw / 2 - 10, y0 - 30, dw + 20, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(district, x0 + size / 2, y0 - 13);
  ctx.textAlign = 'left';
}

// ----------------------------------------------------------------- screens
function renderTitle(ctx, state) {
  const W = 1280;
  const H = 720;
  // Sunset gradient sky over a stylised city skyline.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a2a5e');
  grad.addColorStop(0.45, '#e8703a');
  grad.addColorStop(0.75, '#f2a541');
  grad.addColorStop(1, '#2c1a3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(20,16,40,0.9)';
  const skyline = [120, 200, 150, 260, 180, 230, 300, 170, 240, 190, 280, 150, 210];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, H - 220 - h, 100, h + 220);
    sx += 100;
  }
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(1020, 150, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR HEAT', W / 2, 200);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'italic 24px sans-serif';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', W / 2, 244);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  const lines = [
    'WASD / arrows — move & drive      E — steal / exit car      Mouse — aim & shoot',
    'R — reload      F — punch      Space — handbrake      T — taxi fare      Shift — sprint',
    'P — pause      M — mute      C — turf war      V — delivery      G — repaint at Lou\'s',
    '1 / 2 / 3 — buy Engine / Armor / Tires at Lou\'s Mod Shop',
    '',
    '7 story jobs, 10 hidden Solmar coins, taxi fares, street races, turf wars,',
    'the paint shop — progress saves automatically',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 300 + i * 26));
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Click or press Enter to play', W / 2, 560);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '14px sans-serif';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', W / 2, 640);
  ctx.textAlign = 'left';
}

function renderBoard(ctx, state) {
  const W = 1280;
  const H = 720;
  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION BOARD', W / 2, 70);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Click a job or press its number — B to go back', W / 2, 100);
  ctx.textAlign = 'left';
  MISSIONS.forEach((m, i) => {
    const x = 90 + (i % 4) * 300;
    const y = 170 + Math.floor(i / 4) * 190;
    const done = state.missionsDone.includes(m.id);
    const active = state.mission.active && state.mission.id === m.id;
    ctx.fillStyle = done ? '#1e5c33' : active ? '#7a2d1d' : '#232838';
    roundRect(ctx, x, y, 270, 160, 10);
    ctx.fill();
    ctx.strokeStyle = done ? '#2ecc71' : '#444';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`JOB ${m.id}  •  $${m.payout.toLocaleString()}`, x + 14, y + 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    const name = m.name.length > 24 ? m.name.slice(0, 24) + '…' : m.name;
    ctx.fillText(name, x + 14, y + 52);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    const words = m.brief.split(' ');
    let line = '';
    let ly = y + 76;
    for (const w of words) {
      if ((line + ' ' + w).length > 34) {
        ctx.fillText(line, x + 14, ly);
        ly += 17;
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) ctx.fillText(line, x + 14, ly);
    ctx.fillStyle = done ? '#2ecc71' : '#888';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(done ? '✓ COMPLETE' : 'Press ' + m.id, x + 14, y + 140);
  });
  // Races row.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('STREET RACES — start at the checkered flag in each district', 90, 560);
  RACES.forEach((r, i) => {
    const x = 90 + i * 300;
    const y = 580;
    ctx.fillStyle = '#232838';
    roundRect(ctx, x, y, 270, 90, 10);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${r.name} — $${RACES_PAYOUT(r)}`, x + 14, y + 26);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${r.district}  •  par ${r.par}s  •  ${r.checkpoints.length} checkpoints`, x + 14, y + 52);
  });
  // Turf panel.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  const held = TURF_ZONES.filter((z) => z.owner === 'player').length;
  ctx.fillText(`Turf held: ${held}/${TURF_ZONES.length}  •  income $${held * 5}/hour  •  Press C inside a rival zone to challenge it`, 90, 700);
}

function RACES_PAYOUT(r) {
  return { easy: 150, medium: 300, hard: 600 }[r.id] || 150;
}

function renderPause(ctx, state) {
  const W = 1280;
  const H = 720;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('PAUSED', W / 2, 200);
  ctx.font = '18px sans-serif';
  ctx.fillText(`Missions done: ${state.missionsDone.length}/7    •    Races won: ${state.stats.races || 0}`, W / 2, 250);
  ctx.fillText(`Turf held: ${state.stats.turfHeld || 0}/${TURF_ZONES.length}    •    Coins: ${coinsCollected(state.coins)}/10`, W / 2, 282);
  ctx.fillText(`Money $${Math.floor(state.money)}    •    Rank: ${rankTitle(state)}`, W / 2, 314);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('P — resume      Q — back to title', W / 2, 380);
  ctx.textAlign = 'left';
}

function renderWasted(ctx, state) {
  const W = 1280;
  const H = 720;
  ctx.fillStyle = '#1a0505';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('WASTED', W / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('The hospital patched you up. -$100.', W / 2, 380);
  ctx.textAlign = 'left';
}
