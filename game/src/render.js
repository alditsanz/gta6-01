// render.js — everything the player sees: the city, the figures,
// the cars, the full HUD grammar, the map & record screen and the
// title screen. Pure canvas, no assets. Draw order is world first
// (culled to the camera), then weather/light, then HUD plates.

import {
  WORLD, BLOCK, CELL, GRID, roadCenter, districtAt, districtIndex,
  BEACH_X, WATER_X, PARK_BLOCK, PLAZA_BLOCK, rankFor, CREW,
} from './config.js';
import { LANDMARKS, landmark } from './landmarks.js';
import { skyPhase, PHASE_TINT, isNight, formatClock } from './weather.js';
import { stationLine } from './radio.js';
import { missionStage, stepTarget, MISSIONS } from './missions.js';
import { starsOf, completionPct } from './world.js';
import { coinsTaken, stashesTaken, jumpsDone } from './collectibles.js';
import { zonesHeld } from './turf.js';
import { WEAPONS } from './combat.js';
import { roofKit } from './props.js';
import { hash2 } from './random.js';

// ---------------------------------------------------------------
export function plate(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(10,14,22,${alpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
}
function txt(ctx, s, x, y, size = 13, color = '#f4f1e8', bold = false, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}
function bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.16)') {
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}
function stars(ctx, x, y, n, size = 15) {
  ctx.font = `${size}px system-ui, sans-serif`; ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * (size + 1), y);
  }
}

// ---------------------------------------------------------------
// Ground + buildings + props
// ---------------------------------------------------------------
function drawGround(ctx, world, view) {
  const { x0, y0, x1, y1 } = view;
  // Base land.
  ctx.fillStyle = '#79a75b';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach sand + water on the east edge.
  ctx.fillStyle = '#ecd28f';
  ctx.fillRect(BEACH_X, y0, WATER_X - BEACH_X, y1 - y0);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(WATER_X, y0, x1 - WATER_X, y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(WATER_X, y0, 5, y1 - y0); // foam edge
  // Boardwalk planks west of the sand.
  ctx.fillStyle = '#b08954';
  ctx.fillRect(3136, y0, 26, y1 - y0);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = Math.floor(y0 / 26) * 26; y < y1; y += 26) ctx.fillRect(3136, y, 26, 2);

  // Block ground treatments.
  for (let bx = 0; bx < GRID; bx++) {
    for (let by = 0; by < GRID; by++) {
      const gx = bx * BLOCK, gy = by * BLOCK;
      if (gx + CELL < x0 || gx > x1 || gy + CELL < y0 || gy > y1) continue;
      const di = districtIndex(gx + 150, gy + 150);
      const tint = hash2(bx, by);
      if (bx === 8) continue; // beach already painted
      if (bx === PARK_BLOCK.bx && by === PARK_BLOCK.by) {
        ctx.fillStyle = '#5f9e4e';
        ctx.fillRect(gx, gy, CELL, CELL);
        ctx.strokeStyle = '#cbb98a'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(gx, gy + CELL / 2); ctx.lineTo(gx + CELL, gy + CELL / 2);
        ctx.moveTo(gx + CELL / 2, gy); ctx.lineTo(gx + CELL / 2, gy + CELL); ctx.stroke();
        ctx.fillStyle = '#3f7fbf';
        ctx.beginPath(); ctx.ellipse(gx + CELL * 0.68, gy + CELL * 0.3, 34, 22, 0, 0, 6.29); ctx.fill();
      } else if (bx === PLAZA_BLOCK.bx && by === PLAZA_BLOCK.by) {
        ctx.fillStyle = (bx + by) % 2 ? '#cbb894' : '#c2ab84';
        ctx.fillRect(gx, gy, CELL, CELL);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
          if ((i + j) % 2) ctx.fillRect(gx + i * CELL / 4, gy + j * CELL / 4, CELL / 4, CELL / 4);
      } else {
        const g = 96 + Math.floor(tint * 14) + (di % 3) * 3;
        ctx.fillStyle = `rgb(${g + 18},${g + 42},${g - 12})`;
        ctx.fillRect(gx, gy, CELL, CELL);
        // Parking-lot blocks: asphalt patch + painted bays.
        if (tint > 0.72) {
          ctx.fillStyle = '#5b5f66';
          ctx.fillRect(gx + 26, gy + 26, CELL - 52, CELL - 52);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            ctx.strokeRect(gx + 40 + i * 48, gy + 44, 34, 60);
            ctx.strokeRect(gx + 40 + i * 48, gy + CELL - 104, 34, 60);
          }
        }
      }
      // Sidewalk border.
      ctx.strokeStyle = '#cfc8b8'; ctx.lineWidth = 5;
      ctx.strokeRect(gx + 2, gy + 2, CELL - 4, CELL - 4);
    }
  }

  // Roads: asphalt bands, centre dashes, crosswalks at junctions.
  ctx.fillStyle = '#43464c';
  for (let i = 0; i < GRID; i++) {
    ctx.fillRect(roadCenter(i) - 46, y0, 92, y1 - y0);
    ctx.fillRect(x0, roadCenter(i) - 46, x1 - x0, 92);
  }
  ctx.fillStyle = 'rgba(240,230,180,0.75)';
  for (let i = 0; i < GRID; i++) {
    const c = roadCenter(i);
    for (let s = Math.floor(y0 / 46) * 46; s < y1; s += 46) ctx.fillRect(c - 2, s, 4, 22);
    for (let s = Math.floor(x0 / 46) * 46; s < x1; s += 46) ctx.fillRect(s, c - 2, 22, 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const cx = roadCenter(i), cy = roadCenter(j);
    if (cx < x0 - 60 || cx > x1 + 60 || cy < y0 - 60 || cy > y1 + 60) continue;
    for (let s = -40; s <= 28; s += 17) { ctx.fillRect(cx - 44, cy + s, 14, 8); ctx.fillRect(cx + 30, cy + s, 14, 8); }
  }
}

function drawBuilding(ctx, b, world) {
  const phase = skyPhase(world.clock);
  const tint = PHASE_TINT[phase];
  const sx = tint.shadow, sy = tint.shadow * 0.45;
  // Long warm shadow at low sun.
  ctx.fillStyle = tint.warm ? 'rgba(80,40,10,0.30)' : 'rgba(10,16,10,0.28)';
  ctx.fillRect(b.x + sx, b.y + sy, b.w, b.h);
  // Walls + roof inset.
  ctx.fillStyle = b.hue;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const inset = 7 + (b.floors % 3) * 2;
  const rh = hash2(b.bx * 13 + b.idx, b.by * 7);
  ctx.fillStyle = `rgb(${178 + Math.floor(rh * 30)},${160 + Math.floor(rh * 22)},${132 + Math.floor(rh * 18)})`;
  ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
  ctx.strokeStyle = 'rgba(70,52,36,0.75)'; ctx.lineWidth = 2.4;
  ctx.strokeRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
  // Roof kit: AC box, skylight, water tower.
  const kit = roofKit(b);
  if (kit.ac) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * kit.acX, b.y + b.h * kit.acY, 20, 15);
  }
  if (kit.skylight) {
    ctx.fillStyle = 'rgba(140,190,220,0.8)';
    ctx.fillRect(b.x + b.w * 0.55, b.y + b.h * 0.6, 24, 14);
  }
  if (kit.tower) {
    ctx.fillStyle = '#8a6f4d';
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.3, 11, 0, 6.29); ctx.fill();
  }
  // Windows: lit grid at night, glass sheen by day.
  const night = isNight(world.clock);
  const cols = Math.max(2, Math.floor(b.w / 30)), rows = Math.min(6, b.floors + 1);
  for (let cx = 0; cx < cols; cx++) for (let ry = 0; ry < rows; ry++) {
    const lit = hash2(b.idx * 51 + cx * 7, b.bx * 91 + ry * 13 + b.by) > 0.45;
    ctx.fillStyle = night ? (lit ? 'rgba(255,205,110,0.95)' : 'rgba(40,50,80,0.7)') : 'rgba(120,160,190,0.5)';
    ctx.fillRect(b.x + 9 + cx * ((b.w - 18) / cols), b.y + 9 + ry * ((b.h - 18) / rows), 9, 7);
  }
  // Storefront band + awning + sign on commercial edges.
  const di = districtIndex(b.x + b.w / 2, b.y + b.h / 2);
  if ((di === 2 || di === 4 || di === 1) && b.y + b.h > 200) {
    ctx.fillStyle = 'rgba(30,34,44,0.85)';
    ctx.fillRect(b.x + 4, b.y + b.h - 20, b.w - 8, 16);
    ctx.fillStyle = ['#e4572e', '#2e86e4', '#f2c230', '#e45a9c'][b.idx % 4];
    ctx.fillRect(b.x + 4, b.y + b.h - 26, b.w - 8, 6);
    if (isNight(world.clock)) {
      ctx.fillStyle = 'rgba(255,120,200,0.18)';
      ctx.fillRect(b.x, b.y + b.h - 32, b.w, 24);
    }
  }
}

function drawProp(ctx, p, world) {
  const night = isNight(world.clock);
  switch (p.kind) {
    case 'lamp':
      ctx.fillStyle = '#3c4046'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      if (skyPhase(world.clock) === 'night') {
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 38);
        g.addColorStop(0, 'rgba(255,214,140,0.42)'); g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 38, 0, 6.29); ctx.fill();
      }
      break;
    case 'palm': {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(p.x + 12, p.y + 6, 16, 6, 0.6, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#8a6f4d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 3, p.y - 8, p.x + 6, p.y - 13); ctx.stroke();
      ctx.strokeStyle = '#3e8e4f'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.28 + p.angle;
        ctx.beginPath(); ctx.moveTo(p.x + 6, p.y - 13);
        ctx.quadraticCurveTo(p.x + 6 + Math.cos(a) * 13, p.y - 16 + Math.sin(a) * 5, p.x + 6 + Math.cos(a) * 20, p.y - 9 + Math.sin(a) * 9);
        ctx.stroke();
      }
      break;
    }
    case 'tree':
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.arc(p.x + 6, p.y + 5, 13, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#4c9455'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#67b06f'; ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 8, 0, 6.29); ctx.fill();
      break;
    case 'umbrella':
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(p.x + 5, p.y + 4, 12, 0, 6.29); ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.29); ctx.fill();
      break;
    case 'towel':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color; ctx.fillRect(-11, -5, 22, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-11, -1, 22, 2);
      ctx.restore();
      break;
    case 'bench':
      ctx.fillStyle = '#7a5c38'; ctx.fillRect(p.x - 13, p.y - 4, 26, 8);
      ctx.fillStyle = '#94744a'; ctx.fillRect(p.x - 13, p.y - 4, 26, 3);
      break;
    case 'planter':
      ctx.fillStyle = '#a33f31'; ctx.fillRect(p.x - 9, p.y - 6, 18, 12);
      ctx.fillStyle = '#4c9455'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.29); ctx.fill();
      break;
    case 'crate':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = '#a9803e'; ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#7d5c26'; ctx.strokeRect(-11, -11, 22, 22);
      ctx.beginPath(); ctx.moveTo(-11, -11); ctx.lineTo(11, 11); ctx.stroke();
      ctx.restore();
      break;
    case 'barrel':
      ctx.fillStyle = '#546e7a'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#78909c'; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 3, 0, 6.29); ctx.fill();
      break;
    case 'hydrant':
      ctx.fillStyle = '#d33f2e'; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      break;
    case 'newsbox':
      ctx.fillStyle = '#2e6da4'; ctx.fillRect(p.x - 5, p.y - 4, 10, 8);
      break;
    case 'busstop':
      ctx.fillStyle = '#37474f'; ctx.fillRect(p.x - 2, p.y - 10, 4, 14);
      ctx.fillStyle = '#ffd23e'; ctx.fillRect(p.x - 6, p.y - 14, 12, 6);
      break;
    default: break;
  }
}

// ---------------------------------------------------------------
// Figures + vehicles
// ---------------------------------------------------------------
export function drawFigure(ctx, x, y, angle, color, opts = {}) {
  const bob = opts.still ? 0 : Math.sin((opts.time || 0) * 9 + x * 0.05) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 7, 8, 3.4, 0, 0, 6.29); ctx.fill();
  // Legs + body.
  ctx.fillStyle = '#2e3138';
  ctx.fillRect(x - 5, y + 2 + bob * 0.3, 4, 7); ctx.fillRect(x + 1, y + 2 - bob * 0.3, 4, 7);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - 5.5, y - 6 + bob * 0.4, 11, 10, 3); ctx.fill();
  if (opts.armsUp) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x - 10, y - 13);
    ctx.moveTo(x + 5, y - 4); ctx.lineTo(x + 10, y - 13); ctx.stroke();
  }
  // Head + cap/hair.
  ctx.fillStyle = '#e8b98d';
  ctx.beginPath(); ctx.arc(x + Math.cos(angle) * 1.5, y - 10 + bob * 0.4, 4.1, 0, 6.29); ctx.fill();
  if (opts.cap) {
    ctx.fillStyle = opts.cap;
    ctx.beginPath(); ctx.arc(x, y - 11 + bob * 0.4, 4.4, Math.PI, 6.29); ctx.fill();
  }
  if (opts.hp !== undefined && opts.maxHp) {
    const n = Math.ceil(5 * Math.max(0, opts.hp) / opts.maxHp);
    ctx.fillStyle = '#ff5347';
    for (let i = 0; i < n; i++) ctx.fillRect(x - 10 + i * 4.4, y - 22, 3.2, 3.2);
  }
}

export function drawCar(ctx, car, world) {
  const night = isNight(world.clock);
  ctx.save();
  ctx.translate(car.x, car.y);
  // Airborne stunt: scale up + shadow left behind on the road.
  const airLift = car.air > 0 ? Math.sin(Math.min(1, (0.85 - car.air) / 0.85) * Math.PI) * 14 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(4 + airLift * 0.4, 6, 30, 12, 0, 0, 6.29); ctx.fill();
  ctx.rotate(car.angle);
  if (airLift) ctx.scale(1 + airLift * 0.012, 1 + airLift * 0.012);
  const L = car.style === 'limo' ? 62 : car.style === 'truck' ? 58 : car.style === 'van' ? 52 : 46;
  const W = 24;
  // Headlight glow at dusk/night.
  if (night && !car.parked) {
    const g = ctx.createRadialGradient(L / 2 + 8, 0, 2, L / 2 + 8, 0, 44);
    g.addColorStop(0, 'rgba(255,240,190,0.35)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.fillRect(L / 2 - 4, -20, 52, 40);
  }
  // Wheels.
  ctx.fillStyle = '#17181c';
  for (const [wx, wy] of [[-L / 2 + 9, -W / 2 - 2], [L / 2 - 9, -W / 2 - 2], [-L / 2 + 9, W / 2 - 2], [L / 2 - 9, W / 2 - 2]])
    ctx.fillRect(wx - 5, wy, 10, 5);
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.4; ctx.stroke();
  if (car.style === 'truck') {
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(-L / 2 + 16, -W / 2 + 2, L - 18, W - 4);
    ctx.fillStyle = 'rgba(30,40,55,0.85)'; ctx.fillRect(L / 2 - 13, -W / 2 + 4, 8, W - 8);
  } else if (car.style === 'police') {
    ctx.fillStyle = '#fdfdfd'; ctx.fillRect(-8, -W / 2 + 1, 18, W - 2);
    ctx.fillStyle = '#274b8f'; ctx.fillRect(-L / 2 + 2, -3, L - 4, 6);
    txt(ctx, 'SCPD', 1, 3, 7, '#274b8f', true, 'center');
    const flash = Math.sin(world.time * 10 + car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b6bff';
    ctx.fillRect(-6, -W / 2 - 3, 12, 4);
    ctx.fillStyle = flash ? 'rgba(255,60,40,0.35)' : 'rgba(60,110,255,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, 6.29); ctx.fill();
  } else {
    // Cabin: windshield + rear glass; open cockpit for the sport.
    ctx.fillStyle = car.style === 'sport' ? 'rgba(20,16,10,0.9)' : 'rgba(24,34,48,0.88)';
    const cw = car.style === 'van' ? L * 0.5 : L * 0.42;
    ctx.beginPath(); ctx.roundRect(-cw / 2 + 2, -W / 2 + 3.5, cw, W - 7, 4); ctx.fill();
    ctx.fillStyle = 'rgba(170,210,235,0.55)';
    ctx.fillRect(cw / 2 - 3, -W / 2 + 4.5, 4, W - 9);
    if (car.style === 'taxi') {
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(-6, -5, 12, 10);
      txt(ctx, 'TAXI', 0, 3, 6.5, '#222', true, 'center');
    }
    if (car.style === 'limo') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(2, -W / 2 + 2, 2, W - 4); }
  }
  // Lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5); ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
  ctx.fillStyle = '#e33f2e';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 3, 3, 5); ctx.fillRect(-L / 2 - 1, W / 2 - 8, 3, 5);
  if (car === world.player.car) {
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 8); ctx.stroke();
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(20,20,20,0.5)';
    ctx.beginPath(); ctx.arc(-4, 0, 12, 0, 6.29); ctx.fill();
  }
  ctx.restore();
  // Burning wreck smoke (staged drama + totaled cars).
  if (car.burning) {
    for (let i = 0; i < 3; i++) {
      const ph = (world.time * 0.7 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(40,40,44,${0.4 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(car.x + ph * 26 - 6, car.y - 12 - ph * 44, 8 + ph * 15, 0, 6.29); ctx.fill();
    }
    ctx.fillStyle = '#ff7b2e';
    ctx.beginPath(); ctx.arc(car.x - 4, car.y, 6 + Math.sin(world.time * 11) * 1.6, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffc93e';
    ctx.beginPath(); ctx.arc(car.x - 4, car.y, 3.4, 0, 6.29); ctx.fill();
  }
}

// ---------------------------------------------------------------
// World scene
// ---------------------------------------------------------------
export function drawWorld(ctx, world, vw, vh) {
  const cam = world.camera;
  const zoom = cam.zoom || 1;
  const hw = vw / 2 / zoom, hh = vh / 2 / zoom;
  const view = { x0: cam.x - hw - 60, y0: cam.y - hh - 60, x1: cam.x + hw + 60, y1: cam.y + hh + 60 };
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x + (world.shakeX || 0), -cam.y + (world.shakeY || 0));

  drawGround(ctx, world, view);
  const inView = (x, y, m = 70) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;

  for (const p of world.props) if (inView(p.x, p.y, 50)) drawProp(ctx, p, world);
  for (const b of world.buildings) if (inView(b.x + b.w / 2, b.y + b.h / 2, 260)) drawBuilding(ctx, b, world);
  // Turf zone rings.
  for (const z of world.turf) {
    if (!inView(z.x, z.y, z.r)) continue;
    ctx.strokeStyle = z.owner === 'player' ? 'rgba(80,220,120,0.75)' : 'rgba(255,80,80,0.55)';
    ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.29); ctx.stroke(); ctx.setLineDash([]);
  }
  // Collectibles.
  for (const c of world.coins) {
    if (c.taken || !inView(c.x, c.y, 30)) continue;
    ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 6.29); ctx.fill();
    txt(ctx, '$', c.x, c.y + 4, 11, '#7a5b00', true, 'center');
  }
  for (const s of world.stashes) {
    if (s.taken || !inView(s.x, s.y, 30)) continue;
    ctx.fillStyle = 'rgba(255,170,60,0.25)'; ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffb03a'; ctx.fillRect(s.x - 3, s.y - 7, 6, 10);
    ctx.fillStyle = '#ffe1a8'; ctx.fillRect(s.x - 1.5, s.y - 5, 3, 5);
  }
  for (const r of world.ramps) {
    if (!inView(r.x, r.y, 40)) continue;
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.angle);
    ctx.fillStyle = r.done ? '#5f9e4e' : '#c9562e';
    ctx.beginPath(); ctx.moveTo(-16, 12); ctx.lineTo(16, 12); ctx.lineTo(16, -10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Race checkpoints + fare/delivery markers.
  if (world.race) {
    const cp = world.race.def.checkpoints[world.race.cp];
    if (cp) {
      ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 34 + Math.sin(world.time * 5) * 5, 0, 6.29); ctx.stroke();
    }
  }
  if (world.fare && !world.fare.aboard) marker(ctx, world.fare.x, world.fare.y, '#f2c230', 'FARE');
  if (world.delivery && !world.delivery.carried) marker(ctx, world.delivery.x, world.delivery.y, '#39c2d7', 'PKG');

  // Mission target ring.
  const tgt = stepTarget(world);
  if (tgt && world.gameState === 'play') {
    ctx.strokeStyle = 'rgba(80,255,140,0.9)'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 30 + Math.sin(world.time * 4) * 4, 0, 6.29); ctx.stroke();
  }
  // Vault circle.
  if (world.mission && world.mission.def.steps[world.mission.step] && world.mission.def.steps[world.mission.step].kind === 'vault') {
    const bank = landmark('bank');
    ctx.strokeStyle = 'rgba(80,255,140,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(bank.x, bank.y, 95, 0, 6.29); ctx.stroke();
    ctx.strokeStyle = '#39e75f'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(bank.x, bank.y, 95, -Math.PI / 2, -Math.PI / 2 + (world.mission.vault / 100) * 6.29); ctx.stroke();
  }

  // Roadblocks.
  for (const rb of world.roadblocks) {
    ctx.save(); ctx.translate(rb.x, rb.y); ctx.rotate(rb.angle);
    ctx.fillStyle = '#e8ebee'; ctx.fillRect(-52, -14, 30, 20); ctx.fillRect(22, -14, 30, 20);
    ctx.fillStyle = '#274b8f'; ctx.fillRect(-52, -6, 30, 6); ctx.fillRect(22, -6, 30, 6);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#f2f2f2' : '#e4572e';
      ctx.fillRect(-22 + i * 12, -5, 12, 9);
    }
    ctx.restore();
  }

  // Cars, people, cops.
  for (const car of world.cars) if (inView(car.x, car.y, 80)) drawCar(ctx, car, world);
  for (const cop of world.cops) if (inView(cop.x, cop.y, 80)) drawCar(ctx, cop, world);
  for (const ped of world.peds) {
    if (!inView(ped.x, ped.y, 30)) continue;
    drawFigure(ctx, ped.x, ped.y, ped.angle, ped.color, { time: world.time, armsUp: ped.flee > 0.4 });
  }
  for (const g of world.gang) drawFigure(ctx, g.x, g.y, g.angle, g.color, { time: world.time, hp: g.hp, maxHp: g.maxHp });
  for (const f of world.footCops) drawFigure(ctx, f.x, f.y, f.angle, '#33507e', { time: world.time, cap: '#1d2f4d' });

  // Player.
  const p = world.player;
  if (!p.car) {
    drawFigure(ctx, p.x, p.y, p.angle, '#c33d31', { time: world.time, still: false });
    if (p.punchT > 0) {
      ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14, 7, 0, 6.29); ctx.stroke();
    }
  }
  // Helicopter + searchlight.
  if (world.heli) {
    const h = world.heli;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    const grad = ctx.createRadialGradient(px, py, 8, px, py, 120);
    grad.addColorStop(0, 'rgba(255,246,200,0.55)'); grad.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(px - 66, py + 40); ctx.lineTo(px + 66, py + 40); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, 62, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(h.x + 16, h.y + 20, 34, 12, 0.3, 0, 6.29); ctx.fill();
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.angle);
    // Rotor blur disc first, so the air unit reads at a glance.
    ctx.fillStyle = 'rgba(235,240,245,0.20)';
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,245,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.29); ctx.stroke();
    ctx.fillStyle = '#22262e';
    ctx.beginPath(); ctx.roundRect(-38, -14, 76, 28, 12); ctx.fill();
    ctx.fillRect(-72, -4, 40, 8);
    ctx.fillStyle = '#3d434f'; ctx.fillRect(-76, -11, 7, 22);
    ctx.fillStyle = 'rgba(160,210,240,0.95)';
    ctx.beginPath(); ctx.roundRect(12, -10, 20, 20, 6); ctx.fill();
    txt(ctx, 'AIR-1', -52, 3.4, 9, '#f4f1e8', true, 'center');
    ctx.strokeStyle = 'rgba(20,20,24,0.85)'; ctx.lineWidth = 4;
    const ra = world.time * 40;
    ctx.beginPath(); ctx.moveTo(Math.cos(ra) * 44, Math.sin(ra) * 44); ctx.lineTo(-Math.cos(ra) * 44, -Math.sin(ra) * 44); ctx.stroke();
    ctx.restore();
  }
  // Bullets (tracers with glow at night).
  const night = isNight(world.clock);
  for (const b of world.bullets) {
    ctx.strokeStyle = b.from === 'player' ? '#ffe066' : '#ff8a75';
    ctx.lineWidth = night ? 3.6 : 2.4;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (night) {
      ctx.fillStyle = 'rgba(255,200,90,0.45)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 6.29); ctx.fill();
    }
  }
  // Particles.
  for (const pt of world.particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillRect(pt.x - 2.4, pt.y - 2.4, 4.8, 4.8);
    ctx.globalAlpha = 1;
  }
  // Landmark labels LAST, so mission circles never overdraw them.
  for (const l of LANDMARKS) {
    if (!inView(l.x, l.y, 90)) continue;
    plate(ctx, l.x - 68, l.y - 42, 136, 20, 0.78);
    txt(ctx, l.name.toUpperCase(), l.x, l.y - 27.5, 9.5, '#ffe9a8', true, 'center');
  }
  ctx.restore();

  // Weather + phase light over the world (screen space).
  const phase = skyPhase(world.clock);
  ctx.fillStyle = PHASE_TINT[phase].color;
  ctx.fillRect(0, 0, vw, vh);
  if (world.weather === 'rain') {
    ctx.strokeStyle = 'rgba(190,215,240,0.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const rx = (i * 197 + world.time * 620) % (vw + 40), ry = (i * 131 + world.time * 880) % (vh + 30);
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 13);
    }
    ctx.stroke();
  }
  if (world.weather === 'fog') {
    ctx.fillStyle = 'rgba(210,218,224,0.30)';
    ctx.fillRect(0, 0, vw, vh);
  }
  // Vignette.
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.42, vw / 2, vh / 2, vh * 0.86);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
}

function marker(ctx, x, y, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, 6.29); ctx.fill();
  txt(ctx, label, x, y - 18, 10, color, true, 'center');
}

// ---------------------------------------------------------------
// HUD — the complete grammar, no clipped strings
// ---------------------------------------------------------------
export function drawHUD(ctx, world, vw, vh) {
  const p = world.player;
  const st = starsOf(world);
  const rk = rankFor(p.rp);

  // Top-left status plate: money, counters, rank + RP, HP/armour.
  plate(ctx, 14, 12, 252, 130);
  txt(ctx, '$' + p.money.toLocaleString('en-US'), 26, 36, 21, '#8be26a', true);
  txt(ctx, `Cars ${world.stats.carsStolen} · Coins ${coinsTaken(world)}/20 · Stash ${stashesTaken(world)}/12`, 26, 56, 11.5, '#e8e2d2');
  txt(ctx, `Rank: ${rk.name}`, 26, 75, 12, '#ffd23e', true);
  txt(ctx, rk.nextName ? `${p.rp}/${rk.next} RP` : `${p.rp} RP MAX`, 254, 75, 10.5, '#e8e2d2', false, 'right');
  bar(ctx, 26, 82, 224, 7, rk.next > rk.cur ? (p.rp - rk.cur) / (rk.next - rk.cur) : 1, '#ffd23e');
  txt(ctx, 'HP', 26, 108, 10.5, '#f4f1e8', true);
  bar(ctx, 52, 100, 108, 9, p.hp / 100, '#e33f2e');
  txt(ctx, 'ARM', 172, 108, 10.5, '#f4f1e8', true);
  bar(ctx, 208, 100, 42, 9, p.armour / 100, '#7db8e8');
  txt(ctx, `Turf ${zonesHeld(world)}/5 · Jumps ${jumpsDone(world)}/5`, 26, 128, 11.5, '#e8e2d2');

  // Top-right: stars, clock, weather.
  stars(ctx, vw - 152, 32, st, 16);
  txt(ctx, `${formatClock(world.clock)} · ${world.weather.toUpperCase()}`, vw - 26, 54, 12.5, '#f4f1e8', true, 'right');
  txt(ctx, districtAt(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y), vw - 26, 72, 11.5, '#ffe9a8', false, 'right');

  // SCPD RESPONSE panel (live unit data) when wanted.
  if (st >= 1) {
    const units = [];
    world.cops.slice(0, 4).forEach((c, i) => units.push({ tag: `SCPD-${11 + i * 7}`, u: c, kind: 'PURSUIT' }));
    if (world.roadblocks.length) units.push({ tag: 'SCPD-40', u: world.roadblocks[0], kind: 'ROADBLOCK' });
    world.footCops.slice(0, 2).forEach((f, i) => units.push({ tag: `SCPD-F${3 + i}`, u: f, kind: 'FOOT CHASE' }));
    if (world.heli) units.push({ tag: 'AIR-1', u: world.heli, kind: 'SPOTLIGHT' });
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    const rows = units.slice(0, 5);
    plate(ctx, vw - 262, 82, 248, 30 + rows.length * 17);
    txt(ctx, `SCPD RESPONSE — ${world.cops.length + world.footCops.length + (world.heli ? 1 : 0)} UNITS · ${st}★`, vw - 250, 101, 11.5, '#ff9d8a', true);
    rows.forEach((r, i) => {
      const d = Math.round(Math.hypot(r.u.x - px, r.u.y - py));
      txt(ctx, `${r.tag}  ${d}m  ${r.kind}`, vw - 250, 119 + i * 17, 11.5, '#f4f1e8');
    });
    // IN SIGHT / SEARCHING bar under the panel.
    const by = 82 + 30 + rows.length * 17 + 8;
    plate(ctx, vw - 262, by, 248, 26);
    const inSight = world.exposure > 0.25;
    txt(ctx, inSight ? 'IN SIGHT' : 'SEARCHING', vw - 250, by + 17, 11, inSight ? '#ff8a75' : '#8be26a', true);
    bar(ctx, vw - 168, by + 8, 142, 9, world.exposure, inSight ? '#ff8a75' : '#8be26a');
  }

  // Mission header (top centre): MISSION n/5 · STAGE x/y · NEXT.
  const ms = missionStage(world);
  if (ms) {
    const tgt = stepTarget(world);
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    const d = tgt ? Math.round(Math.hypot(tgt.x - px, tgt.y - py)) : 0;
    plate(ctx, vw / 2 - 252, 12, 504, 52);
    txt(ctx, `MISSION ${ms.idx + 1}/${ms.total} — ${ms.def.title.toUpperCase()} · STAGE ${ms.stepIdx + 1}/${ms.stepCount}`, vw / 2, 32, 13.5, '#ffd23e', true, 'center');
    txt(ctx, `${ms.step.label} — ${d}m${ms.nextLabel ? ' · NEXT: ' + ms.nextLabel : ''}`, vw / 2, 52, 12, '#f4f1e8', false, 'center');
    // Edge arrow toward the target.
    if (tgt) {
      const ang = Math.atan2(tgt.y - py, tgt.x - px);
      const ax = vw / 2 + Math.cos(ang) * 120, ay = 96 + Math.sin(ang) * 26;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = '#50ff8c'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  } else if (world.race) {
    plate(ctx, vw / 2 - 252, 12, 504, 52);
    txt(ctx, `RACE — ${world.race.def.name.toUpperCase()} · CHECKPOINT ${world.race.cp}/${world.race.def.checkpoints.length}`, vw / 2, 32, 13.5, '#ffd23e', true, 'center');
    txt(ctx, `Time ${world.race.t.toFixed(1)}s · Par ${world.race.def.par}s · Prize $${world.race.def.pay}`, vw / 2, 52, 12, '#f4f1e8', false, 'center');
  } else if (world.turfHold) {
    plate(ctx, vw / 2 - 200, 12, 400, 40);
    txt(ctx, `TAKING TURF — hold ${Math.ceil(world.turfHold.t)}s`, vw / 2, 37, 13.5, '#ff9d8a', true, 'center');
  }

  // Vault progress bar (bank job) — on its own plate, never overlapped.
  if (world.mission && ms && ms.step.kind === 'vault') {
    plate(ctx, vw / 2 - 170, vh - 148, 340, 30);
    txt(ctx, `VAULT ${Math.floor(world.mission.vault)}%`, vw / 2 - 158, vh - 128, 12.5, '#8be26a', true);
    bar(ctx, vw / 2 - 62, vh - 140, 210, 11, world.mission.vault / 100, '#39e75f');
  }
  if (world.mission && ms && ms.step.kind === 'hold') {
    plate(ctx, vw / 2 - 170, vh - 148, 340, 30);
    txt(ctx, `HOLD ${Math.ceil(world.mission.holdT)}s`, vw / 2 - 158, vh - 128, 12.5, '#ff9d8a', true);
    bar(ctx, vw / 2 - 62, vh - 140, 210, 11, 1 - world.mission.holdT / ms.step.holdSec, '#ff8a75');
  }

  // Dialogue plate (bottom centre) with speaker + role.
  if (world.dialogue && world.dialogueT > 0) {
    plate(ctx, vw / 2 - 260, vh - 108, 520, 44);
    txt(ctx, `${world.dialogue.who} · ${world.dialogue.role}`, vw / 2 - 246, vh - 88, 10.5, '#ffd23e', true);
    txt(ctx, world.dialogue.line, vw / 2 - 246, vh - 70, 12.5, '#f4f1e8');
  }

  // Minimap (bottom-left, circular) + district under it.
  drawMinimap(ctx, world, 86, vh - 108, 66);
  txt(ctx, districtAt(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y), 86, vh - 26, 11.5, '#ffe9a8', true, 'center');

  // Bottom-right stack: crew, weapons, vehicle, radio, speed, ammo.
  const bx = vw - 14;
  let by = vh - 14;
  // Crew line.
  const louCd = Math.ceil(world.crewCd.lou), dexCd = Math.ceil(world.crewCd.dex);
  txt(ctx, `CREW ${CREW[0].name} — ${CREW[0].ability} ${louCd > 0 ? louCd + 's' : 'READY'} · ${CREW[1].name} — ${CREW[1].ability} ${dexCd > 0 ? dexCd + 's' : 'READY'}`, bx, by, 10.5, '#cfd8e3', false, 'right');
  by -= 19;
  // Weapon slots.
  const w = WEAPONS[p.weapon];
  WEAPONS.forEach((wp, i) => {
    const sx = bx - (3 - i) * 86 + 6;
    plate(ctx, sx, by - 30, 80, 32, i === p.weapon ? 0.92 : 0.55);
    txt(ctx, `${wp.slot} ${wp.name}`, sx + 40, by - 17, 10.5, i === p.weapon ? '#ffd23e' : '#e8e2d2', true, 'center');
    txt(ctx, wp.ammo ? `${p.mag[wp.ammo]}/${p.ammo[wp.ammo]}` : '—', sx + 40, by - 5, 9.5, '#cfd8e3', false, 'center');
  });
  txt(ctx, p.reloadT > 0 ? 'RELOADING…' : `AMMO ${w.ammo ? p.mag[w.ammo] + '/' + p.ammo[w.ammo] : '—'}`, bx - 264, by - 12, 11, '#f4f1e8', true, 'right');
  by -= 40;
  if (p.car) {
    txt(ctx, `${p.car.name} · ${Math.max(0, Math.round(p.car.hp))}% CONDITION`, bx, by, 12, '#f4f1e8', true, 'right');
    by -= 15;
    bar(ctx, bx - 190, by - 8, 190, 8, Math.max(0, p.car.hp) / 100, '#7db8e8');
    by -= 16;
    txt(ctx, stationLine(world), bx, by, 11.5, '#9fd8ff', false, 'right');
    by -= 19;
    txt(ctx, `${Math.round(Math.abs(p.car.speed) * 0.55)} KM/H`, bx, by, 19, '#f4f1e8', true, 'right');
  } else {
    txt(ctx, 'ON FOOT', bx, by, 13, '#f4f1e8', true, 'right');
  }

  // Toast message.
  if (world.message && world.messageT > 0) {
    plate(ctx, vw / 2 - 210, 76, 420, 34);
    txt(ctx, world.message, vw / 2, 98, 13.5, '#8be26a', true, 'center');
  }
}

export function drawMinimap(ctx, world, cx, cy, r) {
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.clip();
  ctx.fillStyle = '#69a355'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const scale = (r * 2) / 1900;
  const toX = (x) => cx + (x - px) * scale, toY = (y) => cy + (y - py) * scale;
  ctx.fillStyle = '#2e86ab'; ctx.fillRect(toX(WATER_X), cy - r, (WORLD - WATER_X) * scale, r * 2);
  ctx.fillStyle = '#ecd28f'; ctx.fillRect(toX(BEACH_X), cy - r, (WATER_X - BEACH_X) * scale, r * 2);
  ctx.strokeStyle = '#43464c'; ctx.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(toX(roadCenter(i)), cy - r); ctx.lineTo(toX(roadCenter(i)), cy + r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r, toY(roadCenter(i))); ctx.lineTo(cx + r, toY(roadCenter(i))); ctx.stroke();
  }
  ctx.fillStyle = '#ffd23e';
  for (const c of world.coins) if (!c.taken) ctx.fillRect(toX(c.x) - 1.6, toY(c.y) - 1.6, 3.2, 3.2);
  ctx.fillStyle = '#3b6bff';
  for (const c of world.cops) ctx.fillRect(toX(c.x) - 2.2, toY(c.y) - 2.2, 4.4, 4.4);
  const tgt = stepTarget(world);
  if (tgt) { ctx.fillStyle = '#50ff8c'; ctx.beginPath(); ctx.arc(toX(tgt.x), toY(tgt.y), 4.4, 0, 6.29); ctx.fill(); }
  // Player arrow.
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-5, 4.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.stroke();
}

// ---------------------------------------------------------------
// Map & record screen (v2): tabs, island, ring, story, career, saves
// ---------------------------------------------------------------
export function drawMapScreen(ctx, world, vw, vh, slots) {
  ctx.fillStyle = '#0d1420'; ctx.fillRect(0, 0, vw, vh);
  // Tab header.
  const tabs = ['MAP', 'STORY', 'STATS', 'CREW', 'SAVE'];
  tabs.forEach((t, i) => {
    const x = 24 + i * 118;
    plate(ctx, x, 14, 108, 34, i === 0 ? 0.95 : 0.45);
    txt(ctx, t, x + 54, 37, 14, i === 0 ? '#ffd23e' : '#9fb2c8', true, 'center');
  });
  txt(ctx, 'SOLMAR — MAP & RECORD', vw - 26, 37, 15, '#f4f1e8', true, 'right');

  // Island map (left): land, water, roads, districts, route, legend.
  const mx = 24, my = 62, ms = 520;
  ctx.fillStyle = '#2e86ab'; ctx.fillRect(mx, my, ms, ms);
  const S = ms / WORLD;
  ctx.fillStyle = '#79a75b'; ctx.fillRect(mx, my, BEACH_X * S, ms);
  ctx.fillStyle = '#ecd28f'; ctx.fillRect(mx + BEACH_X * S, my, (WATER_X - BEACH_X) * S, ms);
  ctx.strokeStyle = '#43464c'; ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(mx + roadCenter(i) * S, my); ctx.lineTo(mx + roadCenter(i) * S, my + ms); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + roadCenter(i) * S); ctx.lineTo(mx + ms, my + roadCenter(i) * S); ctx.stroke();
  }
  // District tints + names, with a block texture so the island
  // reads as a city and not a spreadsheet.
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
    ctx.fillStyle = ['rgba(255,190,90,0.10)', 'rgba(90,200,160,0.10)', 'rgba(200,120,220,0.10)', 'rgba(120,170,255,0.10)'][(dx + dy * 3) % 4];
    ctx.fillRect(mx + dx * 1200 * S, my + dy * 1200 * S, 1200 * S, 1200 * S);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let bx = 0; bx < 3; bx++) for (let by = 0; by < 3; by++)
      ctx.fillRect(mx + (dx * 1200 + bx * 400 + 8) * S, my + (dy * 1200 + by * 400 + 8) * S, 292 * S, 292 * S);
    txt(ctx, ['SUNSET MILE', 'CACTUS COURT', 'NEON STRIP', 'OLD MARKET', 'DOWNTOWN', 'CANAL ROW', 'PALM HEIGHTS', 'THE MARINA', 'PIER 9 DOCKS'][dy * 3 + dx],
      mx + (dx * 1200 + 600) * S, my + (dy * 1200 + 556) * S, 10.5, 'rgba(255,255,255,0.9)', true, 'center');
  }
  // Route line player -> mission target.
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  const tgt = stepTarget(world);
  if (tgt) {
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(mx + px * S, my + py * S); ctx.lineTo(mx + tgt.x * S, my + tgt.y * S); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#50ff8c'; ctx.beginPath(); ctx.arc(mx + tgt.x * S, my + tgt.y * S, 6, 0, 6.29); ctx.fill();
  }
  for (const l of LANDMARKS) {
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(mx + l.x * S, my + l.y * S, 3.4, 0, 6.29); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx + px * S, my + py * S, 5, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, ms, ms);
  // Legend.
  plate(ctx, mx + 10, my + ms - 92, 208, 82, 0.8);
  txt(ctx, '● Landmark   ● You   ● Target', mx + 20, my + ms - 66, 11, '#f4f1e8');
  txt(ctx, '— Route   ▦ District   ~ Water', mx + 20, my + ms - 48, 11, '#f4f1e8');
  txt(ctx, `Turf held ${zonesHeld(world)}/5 · Coins ${coinsTaken(world)}/20`, mx + 20, my + ms - 30, 11, '#f4f1e8');

  // Middle column: completion ring + collectible counts.
  const cx0 = 576;
  const pct = completionPct(world);
  txt(ctx, 'COMPLETE', cx0 + 62, 92, 13, '#9fb2c8', true, 'center');
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.arc(cx0 + 62, 152, 50, 0, 6.29); ctx.stroke();
  ctx.strokeStyle = '#ffd23e';
  ctx.beginPath(); ctx.arc(cx0 + 62, 152, 50, -Math.PI / 2, -Math.PI / 2 + pct / 100 * 6.29); ctx.stroke();
  txt(ctx, pct.toFixed(1) + '%', cx0 + 62, 160, 19, '#ffd23e', true, 'center');
  const counts = [
    ['Story missions', `${world.stats.missionsDone}/5`],
    ['Solmar coins', `${coinsTaken(world)}/20`],
    ['Lantern stashes', `${stashesTaken(world)}/12`],
    ['Turf zones', `${zonesHeld(world)}/5`],
    ['Races won', `${world.stats.racesWon}/3`],
    ['Stunt jumps', `${jumpsDone(world)}/5`],
  ];
  counts.forEach((c, i) => {
    txt(ctx, c[0], cx0, 248 + i * 25, 12.5, '#e8e2d2');
    txt(ctx, c[1], cx0 + 196, 248 + i * 25, 12.5, '#ffd23e', true, 'right');
  });
  const rk = rankFor(p.rp);
  txt(ctx, `Rank: ${rk.name}`, cx0, 424, 13, '#ffd23e', true);
  txt(ctx, rk.nextName ? `${p.rp}/${rk.next} RP to ${rk.nextName}` : `${p.rp} RP — top rank`, cx0, 446, 11.5, '#e8e2d2');
  txt(ctx, `Money $${p.money.toLocaleString('en-US')}`, cx0, 468, 12.5, '#8be26a', true);

  // Right column: story list with grades + career stats.
  const rx = 852;
  txt(ctx, 'STORY — REX KANE', rx, 92, 13, '#9fb2c8', true);
  MISSIONS.forEach((m, i) => {
    const done = i < world.stats.missionsDone;
    const isNext = i === world.stats.missionsDone;
    const y = 120 + i * 30;
    txt(ctx, `${i + 1}. ${m.title}`, rx, y, 13, done ? '#8be26a' : isNext ? '#ffd23e' : '#7d8ea3', isNext);
    txt(ctx, done ? `DONE · GRADE ${world.grades[m.id] || '—'} · $${m.pay}` : isNext ? `NEXT · $${m.pay}` : 'LOCKED', rx + 404, y, 11.5, '#e8e2d2', false, 'right');
  });
  txt(ctx, 'CAREER', rx, 296, 13, '#9fb2c8', true);
  const career = [
    ['Cars stolen', world.stats.carsStolen], ['Taxi fares', world.stats.fares],
    ['Deliveries', world.stats.deliveries], ['Near misses', world.stats.nearMisses],
    ['Distance driven', world.stats.kmDriven.toFixed(1) + ' km'], ['Cops escaped', world.stats.copsEscaped],
    ['Longest chase', world.stats.longestChaseSec + 's'], ['Shots fired', world.stats.shotsFired],
    ['Mods bought', `${world.mods.engine + world.mods.armor + world.mods.tires}/9`], ['Play time', Math.floor(world.stats.playSeconds / 60) + ' min'],
  ];
  career.forEach((c, i) => {
    const y = 322 + i * 21;
    txt(ctx, c[0], rx, y, 12, '#e8e2d2');
    txt(ctx, String(c[1]), rx + 404, y, 12, '#ffd23e', true, 'right');
  });

  // Bottom: three save-slot cards + controls line.
  for (let s = 0; s < 3; s++) {
    const x = 24 + s * 344, y = 596;
    plate(ctx, x, y, 328, 76, 0.85);
    const d = slots[s];
    txt(ctx, `SAVE SLOT ${s + 1}`, x + 14, y + 22, 11.5, '#9fb2c8', true);
    if (d) {
      txt(ctx, `${d.act} · ${d.pct.toFixed(1)}% · Missions ${d.missionsDone}/5`, x + 14, y + 44, 12, '#f4f1e8');
      txt(ctx, `$${d.money.toLocaleString('en-US')} · ${d.time}`, x + 14, y + 64, 12, '#8be26a');
    } else {
      txt(ctx, 'EMPTY — progress saves automatically', x + 14, y + 44, 12, '#7d8ea3');
    }
  }
  txt(ctx, 'P / ESC — back to the street', 1256, 700, 11.5, '#9fb2c8', false, 'right');
}

// ---------------------------------------------------------------
// Title screen v2 + shop + end screens
// ---------------------------------------------------------------
export function drawTitleScreen(ctx, world, vw, vh, slots) {
  drawWorld(ctx, world, vw, vh);
  // Dusk gradient veil, lighter at the horizon.
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, 'rgba(24,10,40,0.55)');
  g.addColorStop(0.55, 'rgba(60,20,50,0.28)');
  g.addColorStop(1, 'rgba(10,8,24,0.62)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  // Gradient title.
  const tg = ctx.createLinearGradient(0, 92, 0, 168);
  tg.addColorStop(0, '#ffe259'); tg.addColorStop(0.55, '#ffa751'); tg.addColorStop(1, '#ff5e8a');
  ctx.fillStyle = tg;
  ctx.font = 'bold 74px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', vw / 2, 158);
  txt(ctx, 'An original open-world crime story on a coast that never existed', vw / 2, 190, 15.5, '#ffe9a8', false, 'center');
  txt(ctx, 'Five story jobs · 20 coins · 12 stashes · turf, races, chases — progress saves automatically', vw / 2, 214, 12.5, '#e8e2d2', false, 'center');
  // Menu.
  const menu = ['CONTINUE', 'NEW GAME', 'LOAD GAME', 'SETTINGS'];
  menu.forEach((m, i) => {
    const y = 268 + i * 42;
    if (i === 0) { plate(ctx, vw / 2 - 130, y - 26, 260, 34, 0.85); }
    txt(ctx, (i === 0 ? '▶ ' : '') + m, vw / 2, y, 17, i === 0 ? '#ffd23e' : '#e8e2d2', i === 0, 'center');
  });
  // Save-slot card (right of the menu).
  const d = slots[0];
  plate(ctx, vw - 356, 250, 330, 118, 0.85);
  txt(ctx, 'SAVE SLOT 1', vw - 340, 276, 11.5, '#9fb2c8', true);
  if (d) {
    txt(ctx, d.act, vw - 340, 300, 14.5, '#f4f1e8', true);
    txt(ctx, `${d.pct.toFixed(1)}% complete · Missions ${d.missionsDone}/5 · ${d.place}`, vw - 340, 322, 12, '#e8e2d2');
    txt(ctx, `$${d.money.toLocaleString('en-US')} · ${d.time}`, vw - 340, 344, 12.5, '#8be26a', true);
  } else {
    txt(ctx, 'No save yet — NEW GAME starts Rex\'s story', vw - 340, 300, 12.5, '#e8e2d2');
  }
  const p = world.player;
  txt(ctx, `Story ${world.stats.missionsDone}/5 · Coins ${coinsTaken(world)}/20 · Turf ${zonesHeld(world)}/5 — progress saves automatically`,
    vw / 2, 470, 13, '#ffe9a8', true, 'center');
  // Controls footer.
  plate(ctx, 24, vh - 52, vw - 48, 34, 0.8);
  txt(ctx, 'WASD drive · E enter/exit car · Mouse aim · Click shoot · R reload · F punch · 1/2/3 weapons · C/V crew · P map · M mute',
    vw / 2, vh - 30, 12.5, '#f4f1e8', false, 'center');
}

export function drawShopScreen(ctx, world, vw, vh, tracks, armourCost) {
  drawWorld(ctx, world, vw, vh);
  ctx.fillStyle = 'rgba(8,10,18,0.72)'; ctx.fillRect(0, 0, vw, vh);
  plate(ctx, vw / 2 - 330, 90, 660, 470, 0.94);
  txt(ctx, "LOU'S MOD SHOP", vw / 2, 140, 26, '#ffd23e', true, 'center');
  txt(ctx, `"Make her fast, make her tough." — $${world.player.money.toLocaleString('en-US')} in pocket`, vw / 2, 168, 13.5, '#e8e2d2', false, 'center');
  tracks.forEach((t, i) => {
    const y = 210 + i * 74;
    const lvl = world.mods[t.id];
    txt(ctx, t.name, vw / 2 - 290, y, 17, '#f4f1e8', true);
    txt(ctx, t.blurb, vw / 2 - 290, y + 20, 11.5, '#9fb2c8');
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = s < lvl ? '#ffd23e' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(vw / 2 + 60 + s * 30, y - 14, 22, 14);
    }
    txt(ctx, lvl >= 3 ? 'MAX' : `BUY $${t.costs[lvl]} — key ${i + 1}`, vw / 2 + 180, y, 13.5, lvl >= 3 ? '#8be26a' : '#ffd23e', true);
  });
  txt(ctx, `Armour refill to 100 — $${armourCost} — key 4`, vw / 2, 452, 14.5, '#7db8e8', true, 'center');
  txt(ctx, 'Walk out (E) when you are done', vw / 2, 528, 12.5, '#9fb2c8', false, 'center');
}

export function drawEndScreen(ctx, world, vw, vh, kind) {
  drawWorld(ctx, world, vw, vh);
  ctx.fillStyle = kind === 'wasted' ? 'rgba(60,4,4,0.55)' : 'rgba(6,10,40,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  txt(ctx, kind === 'wasted' ? 'WASTED' : 'BUSTED', vw / 2, vh / 2 - 10, 64, kind === 'wasted' ? '#ff5347' : '#7db8e8', true, 'center');
  txt(ctx, kind === 'wasted' ? 'Solmar General patched you up. The street is waiting.' : 'SCPD let you go — poorer and slower. The street is waiting.',
    vw / 2, vh / 2 + 30, 15, '#f4f1e8', false, 'center');
  txt(ctx, 'Press ENTER', vw / 2, vh / 2 + 66, 14, '#ffd23e', true, 'center');
}
