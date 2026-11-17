// SOLMAR HEAT — render.js
// Everything the player sees: the sun-soaked city drawn top-down with
// extruded buildings, traffic, pedestrians, police, the HUD with its
// minimap, and the title / pause / wasted / busted / complete screens.
// One canvas, no images, no fonts from the network.

import { GAME, PALETTE, PLACES, STREETS, WORLD, ROAD_HALF, VIEW_W, VIEW_H } from './config.js';
import { currentMission, currentStep } from './world.js';
import { clamp, dist } from './random.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, font, color, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

// -------------------------------------------------------------- world -----

function drawGround(ctx, cam) {
  const x0 = cam.x - VIEW_W / 2;
  const y0 = cam.y - VIEW_H / 2;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, VIEW_W, VIEW_H);
  // Dry grass patches for texture.
  ctx.fillStyle = PALETTE.grassDry;
  for (let gx = Math.floor(x0 / 260) * 260; gx < x0 + VIEW_W; gx += 260) {
    for (let gy = Math.floor(y0 / 260) * 260; gy < y0 + VIEW_H; gy += 260) {
      const h = ((gx * 31 + gy * 17) % 100 + 100) % 100;
      if (h < 34) ctx.fillRect(gx + 40, gy + 60, 120, 70);
    }
  }
  // Beach + water along the south edge.
  if (y0 + VIEW_H > 3400) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, 3400, VIEW_W, 200);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, 3540, VIEW_W, 60);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let wx = Math.floor(x0 / 90) * 90; wx < x0 + VIEW_W; wx += 90) {
      ctx.fillRect(wx, 3560 + ((wx * 7) % 20), 46, 5);
    }
  }
  // Sidewalks: pale bands along every street.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const s of STREETS) {
    ctx.fillRect(x0, s - ROAD_HALF - 12, VIEW_W, (ROAD_HALF + 12) * 2);
    ctx.fillRect(s - ROAD_HALF - 12, y0, (ROAD_HALF + 12) * 2, VIEW_H);
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.asphalt;
  for (const s of STREETS) {
    ctx.fillRect(x0, s - ROAD_HALF, VIEW_W, ROAD_HALF * 2);
    ctx.fillRect(s - ROAD_HALF, y0, ROAD_HALF * 2, VIEW_H);
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.laneMark;
  for (const s of STREETS) {
    for (let d = Math.floor(x0 / 60) * 60; d < x0 + VIEW_W; d += 60) {
      ctx.fillRect(d, s - 2, 30, 4);
    }
    for (let d = Math.floor(y0 / 60) * 60; d < y0 + VIEW_H; d += 60) {
      ctx.fillRect(s - 2, d, 4, 30);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = '#d8d8d8';
  for (const sx of STREETS) {
    for (const sy of STREETS) {
      if (sx < x0 - 80 || sx > x0 + VIEW_W + 80 || sy < y0 - 80 || sy > y0 + VIEW_H + 80) continue;
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(sx + k * 12 - 4, sy - ROAD_HALF - 2, 8, 10);
        ctx.fillRect(sx + k * 12 - 4, sy + ROAD_HALF - 8, 8, 10);
      }
    }
  }
}

function drawBuildings(ctx, cam) {
  const x0 = cam.x - VIEW_W / 2;
  const y0 = cam.y - VIEW_H / 2;
  const x1 = x0 + VIEW_W;
  const y1 = y0 + VIEW_H;
  for (const b of window.__world.city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const h = b.hgt;
    // South + east faces (the sun comes from the north-west).
    ctx.fillStyle = b.side;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + h * 0.45, b.y + b.h - h * 0.45);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y + b.h - h * 0.45);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y - h * 0.45);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y + b.h - h * 0.45);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    // Roof.
    ctx.fillStyle = b.top;
    ctx.beginPath();
    ctx.moveTo(b.x + h * 0.45, b.y - h * 0.45);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y - h * 0.45);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y + b.h - h * 0.45);
    ctx.lineTo(b.x + h * 0.45, b.y + b.h - h * 0.45);
    ctx.closePath();
    ctx.fill();
    // Roof detail: a darker inset + a few lit windows on the south face.
    ctx.fillStyle = PALETTE.roofDetail;
    ctx.fillRect(b.x + h * 0.45 + 8, b.y - h * 0.45 + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = '#ffe9a8';
    const wy = b.y + b.h - 6;
    for (let wx = b.x + 12; wx < b.x + b.w - 8; wx += 22) {
      ctx.fillRect(wx, wy, 10, 5);
    }
  }
  // Trees.
  for (const t of window.__world.city.trees) {
    if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
    ctx.fillStyle = '#2f5c2a';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.parkTree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.parkTreeLight;
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, TAU);
    ctx.fill();
  }
}

function drawCarShape(ctx, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -spec.len / 2 + 3, -spec.wid / 2 + 4, spec.len, spec.wid, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
  ctx.fill();
  // The player's car gets a gold outline so it is findable in traffic.
  if (car.driver === 'player') {
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
    ctx.stroke();
  }
  // Police livery.
  if (car.type === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-6, -spec.wid / 2, 12, spec.wid);
    ctx.fillStyle = '#1c2733';
    text(ctx, 'SCPD', 0, 0, 'bold 9px sans-serif', '#f2f2f2', 'center');
    ctx.fillStyle = '#e84a3a';
    ctx.fillRect(spec.len / 2 - 10, -spec.wid / 2 + 2, 5, 4);
    ctx.fillStyle = '#2e6fb0';
    ctx.fillRect(spec.len / 2 - 10, spec.wid / 2 - 6, 5, 4);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222831';
    ctx.fillRect(-spec.len / 2 + 6, -spec.wid / 2, 10, spec.wid);
    text(ctx, 'TAXI', 4, 0, 'bold 8px sans-serif', '#222831', 'center');
  }
  // Windshield + rear window.
  ctx.fillStyle = '#1c2733';
  roundRect(ctx, spec.len / 2 - 16, -spec.wid / 2 + 4, 9, spec.wid - 8, 3);
  ctx.fill();
  roundRect(ctx, -spec.len / 2 + 6, -spec.wid / 2 + 4, 7, spec.wid - 8, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(spec.len / 2 - 2, -spec.wid / 2 + 2, 3, 5);
  ctx.fillRect(spec.len / 2 - 2, spec.wid / 2 - 7, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(-spec.len / 2 - 1, -spec.wid / 2 + 2, 3, 5);
    ctx.fillRect(-spec.len / 2 - 1, spec.wid / 2 - 7, 3, 5);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, skin, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11 * scale, 8 * scale, 0, 0, TAU);
  ctx.fill();
  // Body (shoulders) + head, top-down.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9 * scale, 0, TAU);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(3 * scale, 0, 5.5 * scale, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawEntities(ctx, world) {
  const p = world.player;
  // Pickups.
  for (const pk of world.pickups) {
    const bob = Math.sin(pk.bob) * 2;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#1f8a5b';
      roundRect(ctx, pk.x - 9, pk.y - 6 + bob, 18, 12, 2);
      ctx.fill();
      text(ctx, '$', pk.x, pk.y + bob, 'bold 10px sans-serif', '#e8f5e9', 'center');
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#f2f2f2';
      roundRect(ctx, pk.x - 11, pk.y - 11 + bob, 22, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
    } else {
      ctx.fillStyle = '#e8b73a';
      roundRect(ctx, pk.x - 10, pk.y - 6 + bob, 20, 12, 2);
      ctx.fill();
      text(ctx, 'AMMO', pk.x, pk.y + bob, 'bold 7px sans-serif', '#222831', 'center');
    }
  }
  // Parked + traffic cars, then the player's car on top.
  const cars = [...world.cars].sort((a, b) => (a === p.inCar ? 1 : 0) - (b === p.inCar ? 1 : 0));
  for (const car of cars) {
    if (car.driver === 'none') {
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawCarShape(ctx, car);
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, car);
  }
  // Pedestrians (the dead lie flat).
  for (const ped of world.peds) {
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin);
  }
  // Gang members: dark jackets, red bandanas.
  for (const g of world.gang) {
    drawPerson(ctx, g.x, g.y, g.angle, '#222831', '#c98d5f');
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.angle) * 4, g.y + Math.sin(g.angle) * 4, 4, 0, TAU);
    ctx.fill();
    // HP pips.
    ctx.fillStyle = '#c0392b';
    for (let i = 0; i < g.hp; i++) ctx.fillRect(g.x - 9 + i * 7, g.y - 20, 5, 3);
  }
  // Cops on foot: navy with a cap.
  for (const cop of world.cops) {
    if (cop.kind === 'cop') {
      drawPerson(ctx, cop.x, cop.y, cop.angle, '#1c2733', '#e8b88a');
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3, 6.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1c2733';
      ctx.beginPath();
      ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3, 4, 0, TAU);
      ctx.fill();
      if (cop.bustTimer > 0) {
        text(ctx, 'BUSTING…', cop.x, cop.y - 26, 'bold 11px sans-serif', '#ff5a4a', 'center');
      }
    }
  }
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, TAU);
    ctx.fill();
  }
  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The player, on foot: a red-jacketed figure with a pistol glint.
  if (!p.inCar) {
    drawPerson(ctx, p.x, p.y, p.aimAngle ?? p.angle, '#c0392b', '#e8b88a', 1.15);
    ctx.strokeStyle = '#222831';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle ?? p.angle) * 8, p.y + Math.sin(p.aimAngle ?? p.angle) * 8);
    ctx.lineTo(p.x + Math.cos(p.aimAngle ?? p.angle) * 18, p.y + Math.sin(p.aimAngle ?? p.angle) * 18);
    ctx.stroke();
    // Name tag so the player is always findable in a busy frame.
    text(ctx, 'REX', p.x, p.y - 26, 'bold 11px sans-serif', '#ffffff', 'center');
  }
  // Mission marker: a pulsing yellow beacon + a floating label.
  const step = currentStep(world);
  if (step && world.missionState === 'active') {
    const pulse = 1 + Math.sin(world.clock * 4) * 0.12;
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(step.x, step.y, 26 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242,194,48,0.25)';
    ctx.beginPath();
    ctx.arc(step.x, step.y, 26 * pulse, 0, TAU);
    ctx.fill();
    // Beacon beam.
    const grad = ctx.createLinearGradient(step.x, step.y - 130, step.x, step.y);
    grad.addColorStop(0, 'rgba(242,194,48,0)');
    grad.addColorStop(1, 'rgba(242,194,48,0.45)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(step.x - 8, step.y);
    ctx.lineTo(step.x - 2, step.y - 130);
    ctx.lineTo(step.x + 2, step.y - 130);
    ctx.lineTo(step.x + 8, step.y);
    ctx.closePath();
    ctx.fill();
  }
  // Place labels at key locations.
  ctx.font = 'bold 12px sans-serif';
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    if (Math.abs(pl.x - world.camera.x) > VIEW_W / 2 + 100) continue;
    if (Math.abs(pl.y - world.camera.y) > VIEW_H / 2 + 100) continue;
    text(ctx, pl.label.toUpperCase(), pl.x, pl.y - 46, 'bold 11px sans-serif', 'rgba(255,255,255,0.85)', 'center');
  }
}

// -------------------------------------------------------------- minimap ----

function drawMinimap(ctx, world) {
  const MW = 196;
  const MH = 150;
  const MX = VIEW_W - MW - 14;
  const MY = 58;
  const s = MW / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(20,28,38,0.88)';
  roundRect(ctx, MX - 6, MY - 6, MW + 12, MH + 12, 8);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, MX, MY, MW, MH, 4);
  ctx.clip();
  ctx.fillStyle = PALETTE.minimapBg;
  ctx.fillRect(MX, MY, MW, MH);
  // Water + park.
  ctx.fillStyle = PALETTE.minimapWater;
  ctx.fillRect(MX, MY + 3400 * s, MW, MH - 3400 * s);
  ctx.fillStyle = PALETTE.minimapPark;
  ctx.fillRect(MX + (STREETS[2] + ROAD_HALF) * s, MY + (STREETS[5] + ROAD_HALF) * s, 336 * s, 336 * s);
  // Roads.
  ctx.strokeStyle = PALETTE.minimapRoad;
  ctx.lineWidth = 3;
  for (const st of STREETS) {
    ctx.beginPath();
    ctx.moveTo(MX, MY + st * s);
    ctx.lineTo(MX + MW, MY + st * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MX + st * s, MY);
    ctx.lineTo(MX + st * s, MY + MH);
    ctx.stroke();
  }
  // Mission marker.
  const step = currentStep(world);
  if (step && world.missionState === 'active') {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(MX + step.x * s, MY + step.y * s, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#222831';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Cops.
  ctx.fillStyle = '#4a90e8';
  for (const cop of world.cops) {
    const cx = cop.kind === 'cop' ? cop.x : cop.car.x;
    const cy = cop.kind === 'cop' ? cop.y : cop.car.y;
    ctx.beginPath();
    ctx.arc(MX + cx * s, MY + cy * s, 3.5, 0, TAU);
    ctx.fill();
  }
  // Hospital.
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(MX + PLACES.hospital.x * s - 3, MY + PLACES.hospital.y * s - 3, 6, 6);
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(MX + p.x * s, MY + p.y * s);
  ctx.rotate(p.inCar ? p.inCar.angle : (p.aimAngle ?? p.angle));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'SOLMAR', MX + MW / 2, MY + MH + 16, 'bold 10px sans-serif', 'rgba(255,255,255,0.75)', 'center');
}

// ------------------------------------------------------------------ HUD ---

function drawHud(ctx, world, input) {
  const p = world.player;
  // Top-left: mission objective panel.
  ctx.fillStyle = 'rgba(16,22,30,0.82)';
  roundRect(ctx, 12, 12, 430, 66, 8);
  ctx.fill();
  const m = currentMission(world);
  const step = currentStep(world);
  if (world.banner && world.missionState === 'done-banner') {
    text(ctx, world.banner.title, 26, 30, 'bold 14px sans-serif', '#f2c230');
    text(ctx, world.banner.sub, 26, 54, '13px sans-serif', '#ffffff');
  } else if (m && world.missionState === 'active' && step) {
    text(ctx, m.title.toUpperCase(), 26, 30, 'bold 14px sans-serif', '#f2c230');
    text(ctx, step.text, 26, 54, '13px sans-serif', '#ffffff');
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const d = Math.round(dist(px, py, step.x, step.y));
    text(ctx, `${d}m`, 428, 30, 'bold 13px sans-serif', '#f2c230', 'right');
    if (step.kind === 'wait' && world.waitTimer > 0) {
      ctx.fillStyle = '#222831';
      ctx.fillRect(26, 62, 200, 6);
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(26, 62, 200 * clamp(world.waitTimer / (step.wait || 2), 0, 1), 6);
    }
  } else if (world.storyDone) {
    text(ctx, 'FREE ROAM — STORY COMPLETE', 26, 30, 'bold 14px sans-serif', '#f2c230');
    text(ctx, 'Solmar is yours. Steal cars, dodge cops, collect street cash.', 26, 54, '13px sans-serif', '#ffffff');
  } else {
    text(ctx, 'SOLMAR HEAT', 26, 30, 'bold 14px sans-serif', '#f2c230');
    text(ctx, 'Press Enter to start the story.', 26, 54, '13px sans-serif', '#ffffff');
  }

  // Top-right: wanted stars + clock + money.
  ctx.fillStyle = 'rgba(16,22,30,0.82)';
  roundRect(ctx, VIEW_W - 230, 12, 218, 40, 8);
  ctx.fill();
  for (let i = 0; i < GAME.maxWanted; i++) {
    const filled = i < p.wanted;
    text(ctx, '★', VIEW_W - 216 + i * 24, 33, '20px sans-serif', filled ? '#ffcf3a' : 'rgba(255,255,255,0.28)');
  }
  const hh = Math.floor(world.time);
  const mm = Math.floor((world.time - hh) * 60);
  text(ctx, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, VIEW_W - 22, 33, 'bold 15px sans-serif', '#ffffff', 'right');

  // Money, under the stars.
  text(ctx, `$${p.money.toLocaleString('en-US')}`, VIEW_W - 22, 66, 'bold 20px sans-serif', '#7de08a', 'right');

  drawMinimap(ctx, world);

  // Bottom-left: health bar + ammo.
  ctx.fillStyle = 'rgba(16,22,30,0.82)';
  roundRect(ctx, 12, VIEW_H - 58, 250, 46, 8);
  ctx.fill();
  text(ctx, 'HEALTH', 24, VIEW_H - 40, 'bold 11px sans-serif', '#ffffff');
  ctx.fillStyle = '#333';
  ctx.fillRect(86, VIEW_H - 46, 150, 12);
  ctx.fillStyle = p.hp > 50 ? '#2ecc71' : p.hp > 25 ? '#e8b73a' : '#e84a3a';
  ctx.fillRect(86, VIEW_H - 46, 150 * clamp(p.hp / GAME.playerMaxHp, 0, 1), 12);
  if (p.inCar) {
    text(ctx, `${p.inCar.spec.name.toUpperCase()}  •  HP ${Math.max(0, Math.round(p.inCar.hp))}`, 24, VIEW_H - 22, '11px sans-serif', '#ffffff');
  } else {
    const ammoText = p.reloading > 0 ? 'RELOADING…' : `PISTOL  ${p.ammo}/${GAME.pistolAmmo}`;
    text(ctx, ammoText, 24, VIEW_H - 22, '11px sans-serif', '#ffffff');
  }

  // Bottom-right: speedometer when driving.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.9);
    ctx.fillStyle = 'rgba(16,22,30,0.82)';
    roundRect(ctx, VIEW_W - 172, VIEW_H - 66, 160, 54, 8);
    ctx.fill();
    text(ctx, `${kmh}`, VIEW_W - 62, VIEW_H - 40, 'bold 30px sans-serif', '#ffffff', 'center');
    text(ctx, 'KM/H', VIEW_W - 62, VIEW_H - 18, '10px sans-serif', '#f2c230', 'center');
  }

  // Controls hint, bottom centre.
  text(ctx, p.inCar
    ? 'W/S drive  •  A/D steer  •  SPACE handbrake  •  E exit car  •  P pause  •  M mute'
    : 'WASD move  •  SHIFT sprint  •  MOUSE aim  •  CLICK shoot  •  E steal car  •  F punch  •  P pause',
  VIEW_W / 2, VIEW_H - 14, '12px sans-serif', 'rgba(255,255,255,0.8)', 'center');

  // Toast messages above the hint.
  let ty = VIEW_H - 96;
  for (const msg of world.messages.slice().reverse()) {
    ctx.font = '13px sans-serif';
    const w = ctx.measureText(msg.text).width + 28;
    ctx.fillStyle = 'rgba(16,22,30,0.85)';
    roundRect(ctx, VIEW_W / 2 - w / 2, ty - 15, w, 26, 6);
    ctx.fill();
    text(ctx, msg.text, VIEW_W / 2, ty - 1, '13px sans-serif', '#ffe9a8', 'center');
    ty -= 32;
  }

  // Mission banner (MISSION PASSED / WASTED / BUSTED).
  if (world.banner) {
    const a = clamp(world.banner.t, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,22,30,0.75)';
    ctx.fillRect(0, VIEW_H / 2 - 62, VIEW_W, 96);
    text(ctx, world.banner.title, VIEW_W / 2, VIEW_H / 2 - 22, 'bold 44px sans-serif', '#f2c230', 'center');
    text(ctx, world.banner.sub, VIEW_W / 2, VIEW_H / 2 + 22, '15px sans-serif', '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }

  // Screen-edge arrow pointing at the mission marker when it is off-screen.
  if (step && world.missionState === 'active') {
    const cam = world.camera;
    const sx = step.x - (cam.x - VIEW_W / 2);
    const sy = step.y - (cam.y - VIEW_H / 2);
    if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
      const cx = clamp(sx, 40, VIEW_W - 40);
      const cy = clamp(sy, 90, VIEW_H - 90);
      const ang = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Crosshair on foot.
  if (!p.inCar && world.screen === 'play') {
    const mx = input.mouse.x;
    const my = input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 13);
    ctx.stroke();
  }

  // Hurt flash.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,30,30,${p.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// --------------------------------------------------------------- screens ---

function panel(ctx, title, lines, footer) {
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(16,22,30,0.92)';
  roundRect(ctx, VIEW_W / 2 - 330, 120, 660, 420, 14);
  ctx.fill();
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 2;
  roundRect(ctx, VIEW_W / 2 - 330, 120, 660, 420, 14);
  ctx.stroke();
  text(ctx, title, VIEW_W / 2, 168, 'bold 34px sans-serif', '#f2c230', 'center');
  let y = 224;
  for (const line of lines) {
    text(ctx, line, VIEW_W / 2, y, line.startsWith('•') ? '15px sans-serif' : '16px sans-serif', '#ffffff', 'center');
    y += 30;
  }
  if (footer) text(ctx, footer, VIEW_W / 2, 500, 'bold 16px sans-serif', '#7de08a', 'center');
}

export function drawScreen(ctx, world, input, saveExists) {
  if (world.screen === 'title') {
    // The city behind the title, gently panning.
    const t = world.clock;
    world.camera.x = 1800 + Math.cos(t * 0.05) * 500;
    world.camera.y = 1800 + Math.sin(t * 0.05) * 500;
    drawWorldView(ctx, world);
    ctx.fillStyle = 'rgba(10,14,20,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'SOLMAR HEAT', VIEW_W / 2, 150, 'bold 72px sans-serif', '#f2c230', 'center');
    text(ctx, 'An open-world crime story — a city to steal, a name to make.', VIEW_W / 2, 196, '18px sans-serif', '#ffffff', 'center');
    ctx.fillStyle = 'rgba(16,22,30,0.88)';
    roundRect(ctx, VIEW_W / 2 - 330, 226, 660, 268, 14);
    ctx.fill();
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 2;
    roundRect(ctx, VIEW_W / 2 - 330, 226, 660, 268, 14);
    ctx.stroke();
    text(ctx, 'REX MARLOWE came back to Solmar with nothing but a jacket', VIEW_W / 2, 250, '15px sans-serif', '#ffffff', 'center');
    text(ctx, 'and a debt. Mama Lou has work — if you can drive, shoot,', VIEW_W / 2, 278, '15px sans-serif', '#ffffff', 'center');
    text(ctx, 'and outrun the SCPD long enough to get paid.', VIEW_W / 2, 306, '15px sans-serif', '#ffffff', 'center');
    text(ctx, '•  Steal cars (E)  •  Drive the whole city  •  Dodge the cops', VIEW_W / 2, 352, '15px sans-serif', '#ffe9a8', 'center');
    text(ctx, '•  3 story missions  •  Wanted stars  •  Combat  •  Save & continue', VIEW_W / 2, 380, '15px sans-serif', '#ffe9a8', 'center');
    text(ctx, saveExists ? 'ENTER — Start story      C — Continue saved game' : 'ENTER — Start story', VIEW_W / 2, 440, 'bold 17px sans-serif', '#7de08a', 'center');
    text(ctx, 'WASD move  •  Mouse aim  •  Click shoot  •  E steal / enter car', VIEW_W / 2, 478, '13px sans-serif', 'rgba(255,255,255,0.75)', 'center');
    text(ctx, 'An original game. No Rockstar names, art or assets — everything here is invented.', VIEW_W / 2, 690, '12px sans-serif', 'rgba(255,255,255,0.6)', 'center');
  } else if (world.screen === 'pause') {
    drawWorldView(ctx, world);
    panel(ctx, 'PAUSED', [
      'The city waits for no one — except right now.',
      '',
      '•  ENTER — Resume',
      '•  S — Save progress',
      '•  T — Back to title',
      '•  M — Mute / unmute',
    ], '');
  } else if (world.screen === 'wasted' || world.screen === 'busted') {
    drawWorldView(ctx, world);
    const wasted = world.screen === 'wasted';
    panel(ctx, wasted ? 'WASTED' : 'BUSTED', [
      wasted ? 'St. Clara Hospital patched you up.' : 'Detective Kane booked you — and let you go.',
      `Money: $${world.player.money.toLocaleString('en-US')}   •   Missions done: ${world.stats.missionsDone}`,
      `Cars stolen: ${world.stats.carsStolen}   •   Kills: ${world.stats.kills}`,
      '',
      'ENTER — Back on the streets',
    ], '');
  } else if (world.screen === 'complete') {
    drawWorldView(ctx, world);
    panel(ctx, 'SOLMAR IS YOURS', [
      'Three jobs. One city. Rex Marlowe runs Solmar now.',
      `Money earned: $${world.player.money.toLocaleString('en-US')}   •   Cars stolen: ${world.stats.carsStolen}`,
      `Kills: ${world.stats.kills}   •   Shots fired: ${world.stats.shotsFired}`,
      '',
      'Free roam continues — steal cars, dodge cops, collect street cash.',
      'ENTER — Keep playing',
    ], '');
  }
}

// ------------------------------------------------------------ main draw ---

export function drawWorldView(ctx, world) {
  const cam = world.camera;
  ctx.save();
  ctx.translate(-(cam.x - VIEW_W / 2), -(cam.y - VIEW_H / 2));
  drawGround(ctx, cam);
  drawBuildings(ctx, cam);
  drawEntities(ctx, world);
  ctx.restore();
  // Golden-hour wash: warmer as the evening deepens.
  const warmth = clamp((world.time - 17) / 3, 0, 1);
  ctx.fillStyle = `rgba(255,150,60,${0.05 + warmth * 0.08})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Vignette.
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function render(ctx, world, input, saveExists) {
  // render.js reaches the world through a module-level handle so the
  // building/tree loops stay cheap; set once per frame by main.js.
  window.__world = world;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (world.screen === 'play') {
    drawWorldView(ctx, world);
    drawHud(ctx, world, input);
  } else {
    drawScreen(ctx, world, input, saveExists);
  }
}
