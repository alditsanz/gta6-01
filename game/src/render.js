// Solmar Heat — render.js
// One job: drawing. The city, every car and person in it, the HUD with
// its minimap, and the title / board / pause / WASTED screens. It reads
// the game state and draws it; it never changes the state.

import { WORLD_SIZE, ROADS, DISTRICTS, RANKS } from './config.js';
import { districtAt, skyPhase, isNightHour } from './world.js';
import { LANDMARKS, CANAL } from './landmarks.js';
import { COINS } from './collectibles.js';
import { MISSIONS } from './missions.js';
import { RACES } from './sidejobs.js';
import { rankForScore } from './config.js';

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// Sky tint per phase of the day. The ground is drawn over it.
export const SKY_TINTS = {
  dawn: 'rgba(255, 170, 110, 0.16)',
  day: 'rgba(255, 244, 200, 0.05)',
  dusk: 'rgba(255, 130, 60, 0.20)',
  evening: 'rgba(90, 60, 160, 0.22)',
  night: 'rgba(10, 16, 60, 0.42)',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#111';
  ctx.fillRect(-16 * scale, -11 * scale, 32 * scale, 22 * scale);
  ctx.fillStyle = color;
  roundRect(ctx, -15 * scale, -9 * scale, 30 * scale, 18 * scale, 4 * scale);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 220, 255, 0.85)';
  ctx.fillRect(-4 * scale, -8 * scale, 8 * scale, 16 * scale);
  ctx.fillStyle = '#f8e27a';
  ctx.fillRect(13 * scale, -7 * scale, 2 * scale, 3 * scale);
  ctx.fillRect(13 * scale, 4 * scale, 2 * scale, 3 * scale);
  ctx.fillStyle = '#ff4b3e';
  ctx.fillRect(-15 * scale, -7 * scale, 2 * scale, 3 * scale);
  ctx.fillRect(-15 * scale, 4 * scale, 2 * scale, 3 * scale);
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(4, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the city

function drawWorld(ctx, state) {
  const cam = state.camera;
  const phase = skyPhase(state.clock.hour);
  // Ground: sun-baked asphalt-and-sand base.
  ctx.fillStyle = '#cbb98d';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.translate(-cam.x + CANVAS_W / 2, -cam.y + CANVAS_H / 2);

  // City blocks.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color + '22';
    ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  }
  // Parks.
  for (const p of state.parks || []) {
    ctx.fillStyle = '#6fae5e';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Canal water across Canal Row.
  ctx.fillStyle = '#3f8fb5';
  ctx.fillRect(CANAL.x0, CANAL.y0, CANAL.x1 - CANAL.x0, CANAL.y1 - CANAL.y0);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(CANAL.x0, CANAL.y0 + 30, CANAL.x1 - CANAL.x0, 4);
  // Bridges where roads cross the canal.
  for (const rx of ROADS) {
    if (rx < CANAL.x0 || rx > CANAL.x1) continue;
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(rx - 34, CANAL.y0 - 6, 68, CANAL.y1 - CANAL.y0 + 12);
  }
  // Roads.
  ctx.fillStyle = '#3a3d44';
  for (const r of ROADS) {
    ctx.fillRect(0, r - 16, WORLD_SIZE, 32);
    ctx.fillRect(r - 16, 0, 32, WORLD_SIZE);
  }
  // Dashed centre lines.
  ctx.fillStyle = '#f2d060';
  for (const r of ROADS) {
    for (let v = 0; v < WORLD_SIZE; v += 64) {
      ctx.fillRect(v, r - 2, 30, 4);
      ctx.fillRect(r - 2, v, 4, 30);
    }
  }
  // Landmark lots.
  for (const l of LANDMARKS) {
    ctx.fillStyle = l.color;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(l.x, l.y, l.w, l.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.name, l.x + l.w / 2, l.y + l.h / 2 - 4);
  }
  // Buildings.
  for (const b of state.buildings || []) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let wy = b.y + 10; wy < b.y + b.h - 8; wy += 18) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
        ctx.fillRect(wx, wy, 7, 9);
      }
    }
    if (isNightHour(state.clock.hour)) {
      ctx.fillStyle = 'rgba(255, 220, 120, 0.75)';
      for (let wy = b.y + 10; wy < b.y + b.h - 8; wy += 36) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 32) {
          ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }
  }
  // Trees.
  for (const t of state.trees || []) {
    ctx.fillStyle = '#2f7a3d';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(t.x - 2, t.y + 6, 4, 6);
  }
  // Streetlights at night: pools of light along the roads.
  if (isNightHour(state.clock.hour)) {
    ctx.fillStyle = 'rgba(255, 220, 130, 0.10)';
    for (const r of ROADS) {
      for (let v = 120; v < WORLD_SIZE; v += 528) {
        ctx.beginPath();
        ctx.arc(v, r, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r, v, 70, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // Sky tint + weather overlays, in screen space.
  ctx.fillStyle = SKY_TINTS[phase] || SKY_TINTS.day;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (state.weather === 'fog') {
    ctx.fillStyle = 'rgba(200, 205, 215, 0.20)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (state.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const seed = Math.floor(performance.now() / 40);
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137 + seed * 7) % CANVAS_W);
      const y = ((i * 211 + seed * 31) % CANVAS_H);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 16);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- entities

function drawEntities(ctx, state) {
  const cam = state.camera;
  const ox = -cam.x + CANVAS_W / 2;
  const oy = -cam.y + CANVAS_H / 2;
  ctx.save();
  ctx.translate(ox, oy);

  // Coins.
  for (let i = 0; i < COINS.length; i++) {
    if (state.coinsCollected.has(i)) continue;
    const c = COINS[i];
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87f00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a87f00';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S', c.x, c.y + 4);
  }
  // Ammo pickups.
  for (let i = 0; i < (state.ammoPickups || []).length; i++) {
    if (state.ammoTaken.has(i)) continue;
    const p = state.ammoPickups[i];
    ctx.fillStyle = '#2fae6e';
    ctx.fillRect(p.x - 10, p.y - 7, 20, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', p.x, p.y + 3);
  }
  // Mission / race / fare / delivery markers.
  const marker = (x, y, color, label) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 4);
    }
  };
  if (state.missionTarget) marker(state.missionTarget.x, state.missionTarget.y, '#ffcf3d', '!');
  if (state.race && state.race.nextCheckpoint) {
    marker(state.race.nextCheckpoint.x, state.race.nextCheckpoint.y, '#3ddc84', 'R');
  }
  if (state.fare && !state.fare.pickedUp) marker(state.fare.fromX, state.fare.fromY, '#f2c230', 'T');
  if (state.fare && state.fare.pickedUp) marker(state.fare.toX, state.fare.toY, '#f2c230', 'T');
  if (state.delivery) {
    const d = state.delivery.pickedUp ? state.delivery.dropoff : state.delivery.pickup;
    marker(d.x, d.y, '#e26fd5', 'D');
  }
  if (state.ledger && !state.ledger.taken) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(state.ledger.x - 9, state.ledger.y - 6, 18, 12);
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    // Label below the marker so it never collides with the HQ name above.
    ctx.fillText('LEDGER', state.ledger.x, state.ledger.y + 26);
  }
  // Parked stealable cars.
  for (const c of state.cars) {
    if (c === state.player.car) continue;
    if (c.wreck) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = '#3a3a3a';
      roundRect(ctx, -15, -9, 30, 18, 4);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, c.x, c.y, c.angle || 0, c.color, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.model, c.x, c.y - 16);
  }
  // Traffic.
  for (const t of state.traffic) {
    drawCarShape(ctx, t.x, t.y, t.angle, t.color, 0.95);
  }
  // Pedestrians.
  for (const p of state.peds) {
    drawPerson(ctx, p.x, p.y, p.angle, p.color);
  }
  // Police cruisers.
  for (const cop of state.police) {
    drawCarShape(ctx, cop.x, cop.y, cop.angle, '#1c2f6e', 1);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', cop.x, cop.y - 16);
  }
  // Roadblocks: two parked cruisers and striped barriers.
  for (const rb of state.roadblocks) {
    ctx.save();
    ctx.translate(rb.x, rb.y);
    ctx.rotate(rb.angle);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-46, -6, 92, 12);
    ctx.fillStyle = '#111';
    for (let i = -46; i < 46; i += 16) ctx.fillRect(i, -6, 8, 12);
    ctx.restore();
    drawCarShape(ctx, rb.x - 60, rb.y - 24, rb.angle, '#1c2f6e', 0.9);
    drawCarShape(ctx, rb.x + 60, rb.y + 24, rb.angle, '#1c2f6e', 0.9);
  }
  // Helicopter: shadow on the ground, body above it, searchlight cone.
  if (state.heli) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(state.heli.x, state.heli.y + 26, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 200, 0.18)';
    ctx.beginPath();
    ctx.moveTo(state.heli.x, state.heli.y);
    ctx.lineTo(state.heli.x - 60, state.heli.y + 150);
    ctx.lineTo(state.heli.x + 60, state.heli.y + 150);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#22303e';
    ctx.beginPath();
    ctx.ellipse(state.heli.x, state.heli.y, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22303e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.heli.x - 24, state.heli.y);
    ctx.lineTo(state.heli.x - 44, state.heli.y);
    ctx.moveTo(state.heli.x + 24, state.heli.y);
    ctx.lineTo(state.heli.x + 44, state.heli.y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD AIR', state.heli.x, state.heli.y - 16);
  }
  // Guards with health pips.
  for (const g of state.guards || []) {
    if (!g.alive) continue;
    drawPerson(ctx, g.x, g.y, 0, '#7a1f1f');
    for (let i = 0; i < g.maxHp; i++) {
      ctx.fillStyle = i < g.hp ? '#e74c3c' : '#555';
      ctx.fillRect(g.x - 14 + i * 10, g.y - 22, 8, 5);
    }
  }
  // Turf rivals during a challenge.
  for (const r of state.turfRivals || []) {
    drawPerson(ctx, r.x, r.y, r.angle, '#8a2f2f');
  }
  // The player (or their car).
  const p = state.player;
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.x, p.y, p.angle, p.car.color, 1.05);
  } else {
    drawPerson(ctx, p.x, p.y, p.angle, '#f2c230');
    // Aim line while shooting.
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 40, p.y + Math.sin(p.angle) * 40);
    ctx.stroke();
  }
  // Bullets.
  ctx.fillStyle = '#ffe27a';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

function drawStars(ctx, stars) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd94a' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', 16 + i * 30, 40);
  }
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, Math.max(0, frac))), h - 4);
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 6, y + h - 5);
  }
}

function drawHUD(ctx, state) {
  const p = state.player;
  const stars = state.stars;
  // Dark panel behind the top-left stats so world art never eats the text.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 8, 8, 340, 128, 8);
  ctx.fill();
  ctx.textAlign = 'left';
  drawStars(ctx, stars);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('$' + Math.floor(state.money).toLocaleString('en-US'), 16, 74);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Score ' + Math.floor(state.score) + '  •  Cars ' + state.carsStolen +
    '  •  Fares ' + state.faresDone + '  •  Near-miss ' + state.nearMisses, 16, 94);
  ctx.fillText('Coins ' + state.coinsCollected.size + '/10  •  Turf ' +
    state.turfHeld + '/' + state.turfTotal + '  •  Turf $' + state.turfIncome + '/h', 16, 112);
  ctx.fillText(rankForScore(state.score).title, 16, 130);

  // Clock + weather, top centre.
  const hh = String(Math.floor(state.clock.hour)).padStart(2, '0');
  const mm = String(Math.floor(state.clock.minute)).padStart(2, '0');
  const weatherIcon = state.weather === 'rain' ? '🌧' : state.weather === 'fog' ? '🌫' : '☀';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hh + ':' + mm + '  ' + weatherIcon + ' ' + state.weather.toUpperCase(), CANVAS_W / 2, 30);
  if (state.heat > 0) {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('HEAT ' + Math.floor(state.heat), CANVAS_W / 2, 50);
  }

  // Objective banner.
  if (state.objectiveText) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = Math.min(760, ctx.measureText(state.objectiveText).width + 40);
    ctx.fillRect(CANVAS_W / 2 - w / 2, 58, w, 34);
    ctx.fillStyle = '#ffcf3d';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.objectiveText, CANVAS_W / 2, 80);
  }
  // Mission / race timer.
  if (state.timerText) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.timerText, CANVAS_W / 2, 122);
  }

  // Bottom-left: health + car condition.
  bar(ctx, 16, CANVAS_H - 58, 220, 18, p.health / 100, '#2fae6e', 'HEALTH');
  if (p.inCar && p.car) {
    bar(ctx, 16, CANVAS_H - 34, 220, 18, p.car.health / 100, '#3d7bd4', 'CAR');
  }
  // Bottom-right: speed + ammo.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  const speed = p.inCar && p.car ? Math.round(Math.abs(p.car.speed)) : Math.round(p.speed || 0);
  ctx.fillText(speed + ' mph', CANVAS_W - 16, CANVAS_H - 34);
  ctx.font = '15px sans-serif';
  ctx.fillText('AMMO ' + state.ammo.mag + '/' + state.ammo.reserve, CANVAS_W - 16, CANVAS_H - 58);
  if (p.inCar && p.car) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffcf3d';
    ctx.fillText(p.car.model + (state.paintName ? ' • ' + state.paintName : ''), CANVAS_W - 16, CANVAS_H - 80);
  }
  // Turf challenge timer.
  if (state.turfChallenge) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TURF WAR: hold the zone! ' + Math.ceil(state.turfChallenge.timer) + 's',
      CANVAS_W / 2, CANVAS_H - 100);
  }
  // Toast messages.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  let my = 160;
  for (const m of state.messages || []) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = ctx.measureText(m.text).width + 24;
    ctx.fillRect(CANVAS_W / 2 - w / 2, my - 18, w, 26);
    ctx.fillStyle = '#fff';
    ctx.fillText(m.text, CANVAS_W / 2, my);
    my += 32;
  }
  drawMinimap(ctx, state);
}

function drawMinimap(ctx, state) {
  const size = 190;
  const x0 = CANVAS_W - size - 14;
  const y0 = 14;
  const scale = size / WORLD_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  // District tint blocks.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color + '44';
    ctx.fillRect(x0 + d.x0 * scale, y0 + d.y0 * scale, (d.x1 - d.x0) * scale, (d.y1 - d.y0) * scale);
  }
  // Turf owners.
  for (const z of state.turfZones || []) {
    ctx.fillStyle = z.owner === 'Solmar Heat' ? '#2fae6e' : '#c0392b';
    ctx.fillRect(x0 + z.x0 * scale, y0 + z.y0 * scale, 6, 6);
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r || 3, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < COINS.length; i++) {
    if (!state.coinsCollected.has(i)) dot(COINS[i].x, COINS[i].y, '#ffd94a', 2.5);
  }
  for (const c of state.cars) if (!c.wreck) dot(c.x, c.y, '#fff', 2);
  if (state.missionTarget) dot(state.missionTarget.x, state.missionTarget.y, '#ffcf3d', 5);
  if (state.race && state.race.nextCheckpoint) dot(state.race.nextCheckpoint.x, state.race.nextCheckpoint.y, '#3ddc84', 4);
  for (const cop of state.police) dot(cop.x, cop.y, '#5a7dff', 3);
  if (state.heli) dot(state.heli.x, state.heli.y, '#ff8ad8', 4);
  // Player dot on top.
  dot(state.player.x, state.player.y, '#2fae6e', 5);
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 6, 0, Math.PI * 2);
  ctx.stroke();
  // District name under the minimap.
  const d = districtAt(state.player.x, state.player.y);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.name, x0 + size / 2, y0 + size + 20);
}

// ---------------------------------------------------------------- screens

export function screenButtons(mode, w, h) {
  if (mode === 'title') {
    return [
      { id: 'play', label: '▶  PLAY', x: w / 2 - 130, y: 430, w: 260, h: 52 },
      { id: 'missions', label: 'MISSION BOARD', x: w / 2 - 130, y: 494, w: 260, h: 52 },
    ];
  }
  if (mode === 'board') {
    const btns = [];
    MISSIONS.forEach((m, i) => {
      btns.push({ id: 'mission-' + m.id, label: 'JOB ' + m.id + ' — ' + m.title, x: 90, y: 150 + i * 52, w: 560, h: 44 });
    });
    RACES.forEach((r, i) => {
      btns.push({ id: 'race-' + r.id, label: 'RACE — ' + r.name + ' (' + r.difficulty + ')', x: 700, y: 150 + i * 52, w: 480, h: 44 });
    });
    btns.push({ id: 'back', label: 'BACK', x: w / 2 - 100, y: 620, w: 200, h: 44 });
    return btns;
  }
  if (mode === 'pause') {
    return [
      { id: 'resume', label: 'RESUME', x: w / 2 - 110, y: 330, w: 220, h: 48 },
      { id: 'board', label: 'MISSION BOARD', x: w / 2 - 110, y: 390, w: 220, h: 48 },
      { id: 'title', label: 'QUIT TO TITLE', x: w / 2 - 110, y: 450, w: 220, h: 48 },
    ];
  }
  if (mode === 'wasted') {
    return [{ id: 'respawn', label: 'RESPAWN AT HOSPITAL', x: w / 2 - 160, y: 430, w: 320, h: 52 }];
  }
  return [];
}

function drawButton(ctx, b, disabled) {
  ctx.fillStyle = disabled ? 'rgba(120,120,120,0.8)' : 'rgba(20,20,30,0.85)';
  roundRect(ctx, b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.strokeStyle = disabled ? '#777' : '#ffcf3d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = disabled ? '#aaa' : '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
}

function drawTitle(ctx, state) {
  ctx.fillStyle = '#1a1430';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#e8a34c';
  ctx.beginPath();
  ctx.arc(1040, 130, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.arc(1040, 130, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2fae6e';
  ctx.fillRect(0, 560, CANVAS_W, 160);
  ctx.fillStyle = '#3a3d44';
  ctx.fillRect(0, 540, CANVAS_W, 20);
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', CANVAS_W / 2, 200);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 22px sans-serif';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', CANVAS_W / 2, 250);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('WASD drive & walk  •  E steal / exit car  •  Mouse aim & shoot  •  R reload  •  F punch', CANVAS_W / 2, 300);
  ctx.fillText('Space handbrake  •  Shift sprint  •  T taxi fare  •  G turf war  •  C repaint at Lou\'s  •  P pause  •  M mute', CANVAS_W / 2, 326);
  ctx.fillStyle = '#ffcf3d';
  ctx.font = '15px sans-serif';
  ctx.fillText('7 story jobs, 10 hidden Solmar coins, taxi fares, street races, turf wars, the paint shop — progress saves automatically', CANVAS_W / 2, 372);
  if (state.saveSummary) {
    ctx.fillStyle = '#fff';
    ctx.fillText(state.saveSummary, CANVAS_W / 2, 400);
  }
  for (const b of screenButtons('title', CANVAS_W, CANVAS_H)) drawButton(ctx, b, false);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', CANVAS_W / 2, 690);
}

function drawBoard(ctx, state) {
  ctx.fillStyle = 'rgba(10, 10, 24, 0.94)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION BOARD', CANVAS_W / 2, 70);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('Story jobs with Lena Voss and Kane — finish Job 7 to become a Solmar Legend.', CANVAS_W / 2, 100);
  ctx.textAlign = 'left';
  for (const b of screenButtons('board', CANVAS_W, CANVAS_H)) {
    const missionId = b.id.startsWith('mission-') ? parseInt(b.id.slice(8), 10) : null;
    const done = missionId ? state.completedMissions.includes(missionId) : false;
    const locked = missionId ? missionId > 1 && !state.completedMissions.includes(missionId - 1) : false;
    let label = b.label;
    if (done) label += '  ✓ DONE';
    if (locked) label += '  🔒';
    const copy = { ...b, label };
    drawButton(ctx, copy, locked);
    if (missionId) {
      const m = MISSIONS.find((x) => x.id === missionId);
      ctx.fillStyle = '#ffcf3d';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + m.payout.toLocaleString('en-US'), b.x + b.w - 10, b.y + b.h - 8);
      ctx.textAlign = 'left';
    }
  }
  // Turf panel on the right.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('TURF — held ' + state.turfHeld + '/' + state.turfTotal + '  •  $' + state.turfIncome + '/h', 700, 330);
  ctx.font = '13px sans-serif';
  (state.turfZones || []).forEach((z, i) => {
    ctx.fillStyle = z.owner === 'Solmar Heat' ? '#3ddc84' : '#ff8a7a';
    ctx.fillText(z.name + ' — ' + z.owner, 700, 356 + i * 22);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Stand in a rival zone and press G to start a turf war (30s hold).', 700, 480);
  ctx.fillText('Hold all 5 zones for a $500 bonus.', 700, 502);
  ctx.fillText('Money $' + Math.floor(state.money).toLocaleString('en-US') + '  •  Rank: ' + rankForScore(state.score).title, 700, 540);
}

function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CANVAS_W / 2, 200);
  ctx.font = '16px sans-serif';
  const m = state.mission ? MISSIONS.find((x) => x.id === state.mission.id) : null;
  ctx.fillText(m ? 'Mission: ' + m.title + ' — stage ' + (state.mission.stage + 1) + ' of ' + m.stages.length : 'Free roam', CANVAS_W / 2, 240);
  ctx.fillText('Races won: ' + Object.keys(state.raceDone || {}).length + '  •  Coins ' + state.coinsCollected.size + '/10  •  Turf ' + state.turfHeld + '/' + state.turfTotal, CANVAS_W / 2, 268);
  for (const b of screenButtons('pause', CANVAS_W, CANVAS_H)) drawButton(ctx, b, false);
}

function drawWasted(ctx, state) {
  ctx.fillStyle = 'rgba(120, 0, 0, 0.75)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', CANVAS_W / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillText('The SCPD scraped you off the Sunset Mile. The hospital bill stings, but the city is still yours.', CANVAS_W / 2, 350);
  for (const b of screenButtons('wasted', CANVAS_W, CANVAS_H)) drawButton(ctx, b, false);
}

// ---------------------------------------------------------------- frame

export function drawFrame(ctx, state) {
  if (state.mode === 'title') {
    drawTitle(ctx, state);
    return;
  }
  drawWorld(ctx, state);
  drawEntities(ctx, state);
  drawHUD(ctx, state);
  if (state.mode === 'board') drawBoard(ctx, state);
  if (state.mode === 'pause') drawPause(ctx, state);
  if (state.mode === 'wasted') drawWasted(ctx, state);
}
