// render.js — everything the player sees: the city, the actors, the
// HUD and the screens.
// One job: draw. It reads world state and never changes it. The world
// pass paints ground/roads/props, then a y-sorted entity pass draws
// buildings, cars and figures so nothing important hides behind a
// rooftop; weather, light and the HUD go on top.

import {
  WORLD_SIZE, BLOCK, ROAD_W, VIEW_W, VIEW_H, clamp, dist,
} from './config.js';
import { hash2 } from './random.js';
import { LANDMARKS, districtAt, districtIndexAt } from './landmarks.js';
import { skyPhase, clockText } from './weather.js';
import { CAR_TYPES, wantedStars } from './world.js';
import { missionStage, missionTarget, vaultProgress } from './missions.js';
import { raceTarget } from './races.js';
import { sidejobTarget } from './sidejobs.js';
import { zonesHeld, zoneAt } from './turf.js';
import { coinsTaken } from './collectibles.js';
import { modsBought, MOD_TRACKS } from './modshop.js';
import { stationName } from './radio.js';

export function cameraFor(world) {
  const p = world.player;
  return {
    x: clamp(p.x - VIEW_W / 2, 0, WORLD_SIZE - VIEW_W),
    y: clamp(p.y - VIEW_H / 2, 0, WORLD_SIZE - VIEW_H),
  };
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function plate(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10, 14, 20, ${alpha})`;
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
}

// ------------------------------------------------------------ figures

// A person, drawn as a small oriented figure: shadow, stepping legs,
// torso in their colour, skin-tone head toward facing, optional cap,
// optional hands-up (fleeing), optional gang hp pips overhead.
export function drawFigure(ctx, x, y, o) {
  const bob = Math.sin(o.walk || 0) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 7, 8, 3.4, 0, 0, 6.29); ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.angle + Math.PI / 2);
  // legs
  ctx.fillStyle = 'rgba(20,22,28,0.85)';
  ctx.fillRect(-5.4, 2 + bob * 0.4, 4.4, 6.5);
  ctx.fillRect(1, 2 - bob * 0.4, 4.4, 6.5);
  // torso
  ctx.fillStyle = o.color;
  rr(ctx, -6.4, -5.4, 12.8, 11.4, 4); ctx.fill();
  // arms up (fleeing civilian)
  if (o.armsUp) {
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-5, -2); ctx.lineTo(-10, -10);
    ctx.moveTo(5, -2); ctx.lineTo(10, -10);
    ctx.stroke();
  }
  // head toward facing (-y in local space after rotation)
  ctx.fillStyle = o.skin || '#d9a066';
  ctx.beginPath(); ctx.arc(0, -6.4, 4.1, 0, 6.29); ctx.fill();
  if (o.cap) {
    ctx.fillStyle = o.cap;
    ctx.beginPath(); ctx.arc(0, -6.9, 4.2, Math.PI, 6.29); ctx.fill();
  }
  ctx.restore();
  // gang health pips
  if (o.hp !== undefined && o.maxHp) {
    const n = 4, lit = Math.ceil((o.hp / o.maxHp) * n);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < lit ? '#ff5d5d' : 'rgba(255,93,93,0.3)';
      ctx.fillRect(x - 9 + i * 5, y - 20, 3.6, 3.6);
    }
  }
}

// ---------------------------------------------------------------- cars

export function drawCar(ctx, car, world) {
  const spec = CAR_TYPES[car.type];
  const L = spec.len, W = spec.wid;
  const phase = skyPhase(world.clock);
  const dark = phase === 'dusk' || phase === 'night';
  ctx.save();
  ctx.translate(car.x, car.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, -L / 2 + 4, -W / 2 + 6, L, W, 7); ctx.fill();
  ctx.rotate(car.angle);
  // headlight glow
  if (dark) {
    const g = ctx.createRadialGradient(L / 2 + 8, 0, 2, L / 2 + 8, 0, 44);
    g.addColorStop(0, 'rgba(255,240,180,0.30)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(L / 2 - 4, -26, 56, 52);
  }
  // body
  ctx.fillStyle = car.wrecked ? '#3a3d42' : car.color;
  rr(ctx, -L / 2, -W / 2, L, W, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.4;
  rr(ctx, -L / 2, -W / 2, L, W, 6); ctx.stroke();
  // wheels
  ctx.fillStyle = '#14161a';
  const wx = L / 2 - 9, wy = W / 2 - 1;
  ctx.fillRect(-wx - 4, -wy - 2.4, 8, 4.6);
  ctx.fillRect(wx - 4, -wy - 2.4, 8, 4.6);
  ctx.fillRect(-wx - 4, wy - 2.2, 8, 4.6);
  ctx.fillRect(wx - 4, wy - 2.2, 8, 4.6);
  // type-specific dressing
  if (car.type === 'truck') {
    ctx.fillStyle = '#c9cdd2'; // cargo box
    rr(ctx, -L / 2 + 2, -W / 2 + 2.4, L * 0.58, W - 4.8, 3); ctx.fill();
    ctx.fillStyle = 'rgba(38,52,66,0.9)'; // cab glass
    rr(ctx, L * 0.18, -W / 2 + 3.4, L * 0.2, W - 6.8, 3); ctx.fill();
  } else if (car.type === 'van') {
    ctx.fillStyle = 'rgba(38,52,66,0.85)';
    rr(ctx, -L * 0.3, -W / 2 + 3, L * 0.62, W - 6, 3); ctx.fill();
  } else if (car.type === 'sports') {
    ctx.fillStyle = '#191d24'; // open cockpit
    rr(ctx, -L * 0.16, -W / 2 + 4, L * 0.34, W - 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    rr(ctx, L * 0.26, -W / 2 + 3, L * 0.14, W - 6, 3); ctx.fill();
  } else {
    // windshield + rear glass + roof
    ctx.fillStyle = 'rgba(38,52,66,0.9)';
    rr(ctx, L * 0.06, -W / 2 + 3.2, L * 0.16, W - 6.4, 3); ctx.fill();
    rr(ctx, -L * 0.3, -W / 2 + 3.2, L * 0.13, W - 6.4, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    rr(ctx, -L * 0.17, -W / 2 + 3.6, L * 0.22, W - 7.2, 3); ctx.fill();
  }
  if (car.type === 'muscle') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(L * 0.08, -2.4, L * 0.4, 4.8);
  }
  if (car.type === 'limo') {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(-L * 0.02, -W / 2 + 2); ctx.lineTo(-L * 0.02, W / 2 - 2); ctx.stroke();
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#fff6d8';
    rr(ctx, -5, -5.4, 10, 10.8, 2); ctx.fill();
    ctx.fillStyle = '#7a5b00';
    ctx.font = 'bold 6.4px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0.4);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#2b50c8';
    ctx.fillRect(-L / 2 + 3, -3.4, L - 6, 6.8);
    ctx.fillStyle = '#233043';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SCPD', -L * 0.22, 0.4);
    // lightbar: red/blue flash from the deterministic siren phase
    const on = Math.sin(world.time * 9 + car.sirenPhase) > 0;
    ctx.fillStyle = on ? '#ff4040' : '#701818';
    ctx.fillRect(-6, -W / 2 + 1.6, 6.4, 4.6);
    ctx.fillStyle = on ? '#4878ff' : '#182a70';
    ctx.fillRect(0.4, -W / 2 + 1.6, 6.4, 4.6);
    ctx.fillStyle = on ? '#4878ff' : '#182a70';
    ctx.fillRect(-6, W / 2 - 6.2, 6.4, 4.6);
    ctx.fillStyle = on ? '#ff4040' : '#701818';
    ctx.fillRect(0.4, W / 2 - 6.2, 6.4, 4.6);
  }
  // lights
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(L / 2 - 2.4, -W / 2 + 2.6, 2.6, 4.4);
  ctx.fillRect(L / 2 - 2.4, W / 2 - 7, 2.6, 4.4);
  ctx.fillStyle = '#d92b2b';
  ctx.fillRect(-L / 2 - 0.2, -W / 2 + 2.6, 2.6, 4.4);
  ctx.fillRect(-L / 2 - 0.2, W / 2 - 7, 2.6, 4.4);
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(10,10,12,0.45)';
    rr(ctx, -L / 2, -W / 2, L, W, 6); ctx.fill();
  }
  ctx.restore();
  // the player's ride wears a gold outline
  if (car.driver === 'player') {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.4;
    rr(ctx, -L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 8); ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------- props

function drawProp(ctx, pr, world) {
  const phase = skyPhase(world.clock);
  switch (pr.kind) {
    case 'lamp': {
      ctx.fillStyle = '#2e3138';
      ctx.fillRect(pr.x - 1.6, pr.y - 1.6, 3.2, 3.2);
      ctx.fillStyle = phase === 'night' || phase === 'dusk' ? '#ffd98c' : '#8f959e';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.4, 0, 6.29); ctx.fill();
      break;
    }
    case 'palm': case 'tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(pr.x + 5, pr.y + 7, 13, 5.4, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#7a5b38';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y + 5); ctx.lineTo(pr.x + 1.6, pr.y - 3); ctx.stroke();
      ctx.fillStyle = pr.kind === 'palm' ? '#3f9e4d' : '#4d8f3a';
      for (let i = 0; i < 6; i++) {
        const a = pr.angle + (i / 6) * 6.28;
        ctx.beginPath();
        ctx.ellipse(pr.x + Math.cos(a) * 8, pr.y - 4 + Math.sin(a) * 5.4, 10.6, 4.6, a, 0, 6.29);
        ctx.fill();
      }
      break;
    }
    case 'umbrella': {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(pr.x + 3, pr.y + 4, 13, 5, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 12.6, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, 6.29); ctx.fill();
      break;
    }
    case 'towel': {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.angle);
      ctx.fillStyle = pr.color; ctx.fillRect(-9, -4.6, 18, 9.2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-9, -1.4, 18, 2.8);
      ctx.restore();
      break;
    }
    case 'bench': {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.angle);
      ctx.fillStyle = '#8a6a44'; ctx.fillRect(-10, -3.4, 20, 6.8);
      ctx.fillStyle = '#6e5434'; ctx.fillRect(-10, -1.2, 20, 2.4);
      ctx.restore();
      break;
    }
    case 'planter': {
      ctx.fillStyle = '#9aa0a6'; rr(ctx, pr.x - 8, pr.y - 6, 16, 12, 3); ctx.fill();
      ctx.fillStyle = '#4d8f3a';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 5.6, 0, 6.29); ctx.fill();
      break;
    }
    case 'crate': {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.angle);
      ctx.fillStyle = '#a87f4a'; ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = '#7d5c30'; ctx.lineWidth = 2;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, 9); ctx.moveTo(9, -9); ctx.lineTo(-9, 9); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'barrel': {
      ctx.fillStyle = '#5d7fa8';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 6.4, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 6.4, 0, 6.29); ctx.stroke();
      break;
    }
    case 'busstop': {
      ctx.fillStyle = '#37414f'; ctx.fillRect(pr.x - 1.6, pr.y - 8, 3.2, 16);
      ctx.fillStyle = '#3d7bd9'; rr(ctx, pr.x - 7, pr.y - 13, 14, 9, 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 6px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('BUS', pr.x, pr.y - 6);
      break;
    }
    case 'hydrant': {
      ctx.fillStyle = '#d23b2e';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 3.6, 0, 6.29); ctx.fill();
      break;
    }
    case 'newsbox': {
      ctx.fillStyle = pr.color || '#3d7bd9';
      rr(ctx, pr.x - 5, pr.y - 4, 10, 9, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(pr.x - 3.4, pr.y - 2, 6.8, 3);
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------- ground

const DISTRICT_TINTS = [
  '#7cab5e', '#8aa860', '#79a85b', '#86a75e', '#7fa65c',
  '#74a29a', '#83ac60', '#6fa8a0', '#93a763',
];
const BEACH_BLOCKS = new Set(['6,1', '7,1', '6,2', '7,2']);
const WATER_BLOCKS = new Set(['8,1', '8,2']);
const COMMERCIAL = new Set([1, 2, 4]); // Cactus Court, Neon Strip, Downtown

function drawCrosswalk(ctx, x, y) {
  ctx.fillStyle = 'rgba(240,240,235,0.75)';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(x + i * 17 - 5, y - 54, 10, 15);
    ctx.fillRect(x + i * 17 - 5, y + 39, 10, 15);
    ctx.fillRect(x - 54, y + i * 17 - 5, 15, 10);
    ctx.fillRect(x + 39, y + i * 17 - 5, 15, 10);
  }
}

function drawBuilding(ctx, b, world, index) {
  const phase = skyPhase(world.clock);
  const golden = phase === 'golden' || phase === 'dusk';
  const sh = golden ? 17 : 10;
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(b.x + sh, b.y + sh + 4, b.w, b.h);
  // walls + roof inset
  ctx.fillStyle = `hsl(${b.hue}, 34%, 74%)`;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = `hsl(${b.hue}, 28%, ${58 + (hash2(index, 7) * 10) | 0}%)`;
  const inset = 9;
  ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
  // rooftop clutter by deterministic hash
  const h1 = hash2(index, 21);
  ctx.fillStyle = 'rgba(90,95,102,0.8)';
  if (h1 < 0.45) ctx.fillRect(b.x + b.w * 0.16, b.y + b.h * 0.16, 17, 12); // AC box
  if (h1 >= 0.45 && h1 < 0.7 && b.floors >= 4) { // water tower
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.7, b.y + b.h * 0.3, 8.6, 0, 6.29); ctx.fill();
  }
  if (h1 >= 0.7) ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.6, 10, 8); // vent
  // window grid: rows follow floors
  const rows = Math.min(6, b.floors);
  const cols = Math.max(2, Math.floor(b.w / 21));
  const night = phase === 'night' || phase === 'dusk';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = night && hash2(index * 31 + r * 7, c * 13) > 0.45;
      ctx.fillStyle = lit ? 'rgba(255,205,110,0.95)' : 'rgba(40,55,75,0.55)';
      ctx.fillRect(
        b.x + 7 + c * ((b.w - 14) / cols),
        b.y + 7 + r * ((b.h - 14) / Math.max(1, rows)),
        Math.min(8, (b.w - 14) / cols - 4), 5.4,
      );
    }
  }
  // storefront band + sign plate in commercial districts
  if (COMMERCIAL.has(districtIndexAt(b.x + b.w / 2, b.y + b.h / 2))) {
    ctx.fillStyle = `hsl(${b.hue}, 45%, 42%)`;
    ctx.fillRect(b.x + 3, b.y + b.h - 13, b.w - 6, 10);
    const signW = Math.min(52, b.w * 0.5);
    if (night) {
      ctx.save();
      ctx.shadowColor = `hsl(${b.hue}, 90%, 65%)`;
      ctx.shadowBlur = 13;
      ctx.fillStyle = `hsl(${b.hue}, 85%, 68%)`;
      ctx.fillRect(b.x + b.w / 2 - signW / 2, b.y + b.h - 11.4, signW, 7);
      ctx.restore();
    } else {
      ctx.fillStyle = `hsl(${b.hue}, 70%, 80%)`;
      ctx.fillRect(b.x + b.w / 2 - signW / 2, b.y + b.h - 11.4, signW, 7);
    }
    // awning stripes
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let s = 0; s < b.w - 8; s += 12) ctx.fillRect(b.x + 5 + s, b.y + b.h - 13, 5, 10);
  }
}

function drawWorld(ctx, world) {
  const cam = cameraFor(world);
  const phase = skyPhase(world.clock);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // asphalt base (the road network shows wherever no block covers it)
  ctx.fillStyle = '#43464c';
  ctx.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);

  const bi0 = Math.max(0, Math.floor(cam.x / BLOCK)), bi1 = Math.min(8, Math.floor((cam.x + VIEW_W) / BLOCK));
  const bj0 = Math.max(0, Math.floor(cam.y / BLOCK)), bj1 = Math.min(8, Math.floor((cam.y + VIEW_H) / BLOCK));
  for (let bi = bi0; bi <= bi1; bi++) {
    for (let bj = bj0; bj <= bj1; bj++) {
      const x0 = bi * BLOCK, y0 = bj * BLOCK, key = `${bi},${bj}`;
      // sidewalk apron
      ctx.fillStyle = '#b7b9bc';
      ctx.fillRect(x0 + 37, y0 + 37, BLOCK - 74, BLOCK - 74);
      // block ground
      if (WATER_BLOCKS.has(key)) {
        ctx.fillStyle = '#2e7fb8';
        ctx.fillRect(x0 + 46, y0 + 46, BLOCK - 92, BLOCK - 92);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x0 + 46, y0 + 46, 5, BLOCK - 92); // foam edge
      } else if (BEACH_BLOCKS.has(key)) {
        ctx.fillStyle = '#e8d09a';
        ctx.fillRect(x0 + 46, y0 + 46, BLOCK - 92, BLOCK - 92);
      } else if (key === '1,6') {
        ctx.fillStyle = '#86b364'; // park green
        ctx.fillRect(x0 + 46, y0 + 46, BLOCK - 92, BLOCK - 92);
      } else if (key === '2,2') {
        // plaza checker paving
        const cell = 38;
        for (let cx = 0; cx < 8; cx++) for (let cy = 0; cy < 8; cy++) {
          ctx.fillStyle = (cx + cy) % 2 ? '#c9c2b2' : '#bdb5a2';
          ctx.fillRect(x0 + 46 + cx * cell, y0 + 46 + cy * cell, cell, cell);
        }
      } else {
        ctx.fillStyle = DISTRICT_TINTS[districtIndexAt(x0 + 200, y0 + 200)];
        ctx.fillRect(x0 + 46, y0 + 46, BLOCK - 92, BLOCK - 92);
        // parking-lot blocks: asphalt patch with painted bays
        if (hash2(bi, bj) < 0.22) {
          ctx.fillStyle = '#55575c';
          ctx.fillRect(x0 + 60, y0 + 60, BLOCK - 120, BLOCK - 120);
          ctx.strokeStyle = 'rgba(240,240,235,0.5)';
          ctx.lineWidth = 1.6;
          for (let s = 0; s < 6; s++) {
            ctx.strokeRect(x0 + 74 + s * 42, y0 + 78, 34, 58);
            ctx.strokeRect(x0 + 74 + s * 42, y0 + BLOCK - 136, 34, 58);
          }
        }
      }
      // Canal Row water band
      if (bj === 4 && bi >= 6) {
        ctx.fillStyle = '#2e7fb8';
        ctx.fillRect(x0 + 46, y0 + 168, BLOCK - 92, 64);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x0 + 46, y0 + 168, BLOCK - 92, 3);
      }
    }
  }
  // park paths + pond
  ctx.fillStyle = '#d8cdb2';
  ctx.fillRect(578, 2446, 44, 308);
  ctx.fillRect(446, 2578, 308, 44);
  ctx.fillStyle = '#3f8fbf';
  ctx.beginPath(); ctx.ellipse(700, 2700, 48, 32, 0, 0, 6.29); ctx.fill();
  // plaza fountain
  ctx.fillStyle = '#8f959e';
  ctx.beginPath(); ctx.arc(1020, 1020, 30, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#3f8fbf';
  ctx.beginPath(); ctx.arc(1020, 1020, 24, 0, 6.29); ctx.fill();
  // beach boardwalk (west edge of the sand) + marina pier planks
  ctx.fillStyle = '#a87f4a';
  ctx.fillRect(2452, 446, 44, 708);
  ctx.fillRect(3200, 998, 320, 44);
  ctx.strokeStyle = 'rgba(80,55,25,0.5)';
  ctx.lineWidth = 1.4;
  for (let y = 452; y < 1154; y += 15) { ctx.beginPath(); ctx.moveTo(2452, y); ctx.lineTo(2496, y); ctx.stroke(); }
  for (let x = 3206; x < 3520; x += 15) { ctx.beginPath(); ctx.moveTo(x, 998); ctx.lineTo(x, 1042); ctx.stroke(); }

  // lane dashes on road centrelines
  ctx.fillStyle = 'rgba(245,220,120,0.65)';
  for (let line = 0; line <= WORLD_SIZE; line += BLOCK) {
    for (let t = 14; t < WORLD_SIZE; t += 46) {
      if (line >= cam.x - 60 && line <= cam.x + VIEW_W + 60 && t >= cam.y - 60 && t <= cam.y + VIEW_H + 60) {
        ctx.fillRect(line - 2, t, 4, 24);
        ctx.fillRect(t, line - 2, 24, 4);
      }
    }
  }
  // crosswalks
  for (const pr of world.props) {
    if (pr.kind === 'crosswalk' && pr.x > cam.x - 80 && pr.x < cam.x + VIEW_W + 80 && pr.y > cam.y - 80 && pr.y < cam.y + VIEW_H + 80) {
      drawCrosswalk(ctx, pr.x, pr.y);
    }
  }

  // turf zone rings
  for (const z of world.turf.zones) {
    ctx.fillStyle = z.owner === 'Player' ? 'rgba(89,194,232,0.10)' : 'rgba(224,85,85,0.08)';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.29); ctx.fill();
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([12, 9]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.29); ctx.stroke();
    ctx.setLineDash([]);
  }

  // coins + pickups
  for (const c of world.coins) {
    if (c.taken) continue;
    const bob = Math.sin(world.time * 3 + c.x) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 8, 9, 3.4, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(c.x, c.y + bob, 9.4, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#a87b00';
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', c.x, c.y + bob + 0.6);
  }
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'health' ? '#e8e8e8' : pk.kind === 'armor' ? '#3d5a99' : '#7a5b2e';
    rr(ctx, pk.x - 10, pk.y - 10, 20, 20, 4); ctx.fill();
    ctx.fillStyle = pk.kind === 'armor' ? '#fff' : pk.kind === 'health' ? '#d23b2e' : '#ffe9a8';
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '≡', pk.x, pk.y + 1);
  }

  // target markers
  const drawMarker = (t, color) => {
    if (!t) return;
    const pr2 = 24 + Math.sin(world.time * 4) * 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, pr2, 0, 6.29); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(t.x, t.y, 4.6, 0, 6.29); ctx.fill();
  };
  drawMarker(missionTarget(world), '#ffd76a');
  drawMarker(raceTarget(world), '#7ee787');
  drawMarker(sidejobTarget(world), '#4dd0e1');

  // the vault circle while the bank job is live: grey ring, green arc
  const vpRing = vaultProgress(world);
  if (vpRing >= 0) {
    const t = missionTarget(world);
    if (t) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, 52, 0, 6.29); ctx.stroke();
      ctx.strokeStyle = '#59c24d';
      ctx.lineWidth = 5.4;
      ctx.beginPath(); ctx.arc(t.x, t.y, 52, -Math.PI / 2, -Math.PI / 2 + vpRing * 6.29); ctx.stroke();
    }
  }

  // roadblock barrier strip
  if (world.roadblock) {
    const rb = world.roadblock;
    ctx.save();
    ctx.translate(rb.x, rb.y);
    const horiz = rb.cars.length && Math.abs(rb.cars[0].angle - Math.PI / 2) < 0.2;
    if (!horiz) ctx.rotate(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f2f2f2' : '#ff7847';
      ctx.fillRect(-4, -48 + i * 16, 8, 16);
    }
    ctx.restore();
  }

  // -------- entity pass, y-sorted --------
  const items = [];
  world.buildings.forEach((b, i) => {
    if (b.x + b.w < cam.x - 60 || b.x > cam.x + VIEW_W + 60 || b.y + b.h < cam.y - 60 || b.y > cam.y + VIEW_H + 60) return;
    items.push({ y: b.y + b.h, f: () => drawBuilding(ctx, b, world, i) });
  });
  for (const pr of world.props) {
    if (pr.kind === 'crosswalk' || pr.kind === 'towel') continue;
    if (pr.x < cam.x - 50 || pr.x > cam.x + VIEW_W + 50 || pr.y < cam.y - 50 || pr.y > cam.y + VIEW_H + 50) continue;
    items.push({ y: pr.y + 4, f: () => drawProp(ctx, pr, world) });
  }
  // towels lie flat: draw them before everything else in the pass
  for (const pr of world.props) {
    if (pr.kind === 'towel') drawProp(ctx, pr, world);
  }
  for (const car of world.cars) {
    items.push({ y: car.y + 12, f: () => drawCar(ctx, car, world) });
  }
  for (const g of world.gang) {
    items.push({ y: g.y + 6, f: () => drawFigure(ctx, g.x, g.y, { color: '#7a1f1f', skin: '#c98d54', angle: g.angle, walk: g.walk, hp: g.hp, maxHp: g.maxHp }) });
  }
  for (const ped of world.peds) {
    items.push({
      y: ped.y + 6,
      f: () => drawFigure(ctx, ped.x, ped.y, { color: ped.color, skin: ped.skin, angle: ped.angle, walk: ped.walk, armsUp: ped.flee }),
    });
  }
  for (const cop of world.copsFoot) {
    items.push({ y: cop.y + 6, f: () => drawFigure(ctx, cop.x, cop.y, { color: '#2b3f66', skin: '#d9a066', angle: cop.angle, walk: cop.walk, cap: '#1c2a45' }) });
  }
  if (world.farePed) {
    const fp = world.farePed;
    items.push({ y: fp.y + 6, f: () => drawFigure(ctx, fp.x, fp.y, { color: fp.color, skin: fp.skin, angle: -Math.PI / 2, walk: 0 }) });
  }
  const p = world.player;
  if (!p.car) {
    items.push({ y: p.y + 6, f: () => drawFigure(ctx, p.x, p.y, { color: '#c22e2e', skin: '#e8b98a', angle: p.angle, walk: p.walk }) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();

  // bullets + particles + floaters
  ctx.lineWidth = 2.2;
  for (const b of world.bullets) {
    ctx.strokeStyle = b.from === 'player' ? 'rgba(255,230,150,0.95)' : 'rgba(255,140,120,0.95)';
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life * 3, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // helicopter: shadow, searchlight, body
  if (world.heli) {
    const h = world.heli;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(h.x + 26, h.y + 34, 30, 11, 0, 0, 6.29); ctx.fill();
    const grd = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 86);
    grd.addColorStop(0, 'rgba(255,244,190,0.30)');
    grd.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, 86, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#233043';
    rr(ctx, -21, -8.4, 42, 16.8, 8); ctx.fill();
    ctx.fillStyle = '#3d5a99';
    rr(ctx, 4, -6, 13, 12, 4); ctx.fill();
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-30, -2.2, 12, 4.4);
    ctx.strokeStyle = 'rgba(20,22,26,0.85)';
    ctx.lineWidth = 3;
    const ra = world.time * 40;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ra) * 24, Math.sin(ra) * 24);
    ctx.lineTo(-Math.cos(ra) * 24, -Math.sin(ra) * 24);
    ctx.stroke();
    ctx.restore();
  }

  // landmark labels
  ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of LANDMARKS) {
    if (l.x < cam.x - 60 || l.x > cam.x + VIEW_W + 60 || l.y < cam.y - 40 || l.y > cam.y + VIEW_H + 40) continue;
    const w = ctx.measureText(l.name).width + 14;
    plate(ctx, l.x - w / 2, l.y - 34, w, 17, 0.45);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(l.name, l.x, l.y - 25);
  }

  ctx.restore();

  // -------- light + weather overlays (screen space) --------
  if (phase === 'golden') { ctx.fillStyle = 'rgba(255,150,50,0.16)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (phase === 'dusk') { ctx.fillStyle = 'rgba(214,96,128,0.13)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (phase === 'morning') { ctx.fillStyle = 'rgba(255,224,170,0.06)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (phase === 'night') { ctx.fillStyle = 'rgba(8,14,52,0.34)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

  if (phase === 'dusk' || phase === 'night') {
    // street-lamp glow pools
    for (const pr of world.props) {
      if (pr.kind !== 'lamp') continue;
      const sx = pr.x - cam.x, sy = pr.y - cam.y;
      if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) continue;
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 36);
      g.addColorStop(0, 'rgba(255,196,96,0.20)');
      g.addColorStop(1, 'rgba(255,196,96,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 36, sy - 36, 72, 72);
    }
  }

  if (world.weather.kind === 'rain') {
    ctx.strokeStyle = 'rgba(190,215,245,0.4)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const x = ((i * 97.31 + world.time * 430) % (VIEW_W + 60)) - 30;
      const y = ((i * 61.73 + world.time * 680) % (VIEW_H + 60)) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3.4, y + 11);
    }
    ctx.stroke();
  }
  if (world.weather.kind === 'fog') {
    const px = p.x - cam.x, py = p.y - cam.y;
    const g = ctx.createRadialGradient(px, py, world.weather.viewRange * 0.5, px, py, world.weather.viewRange);
    g.addColorStop(0, 'rgba(198,206,216,0)');
    g.addColorStop(1, 'rgba(198,206,216,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // vignette
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.52, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.98);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.20)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

import { VAULT_SECONDS } from './missions.js';

// ---------------------------------------------------------------- HUD

function txt(ctx, s, x, y, { size = 13, color = '#fff', align = 'left', bold = false, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth, size) {
  ctx.font = `${size}px system-ui, sans-serif`;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// The SCPD RESPONSE panel data: nearest units with live behaviour.
function scpdUnits(world) {
  const p = world.player;
  const units = [];
  let ci = 0, fi = 0;
  for (const c of world.cars) {
    if (c.driver !== 'cop') continue;
    ci += 1;
    const d = Math.round(dist(p.x, p.y, c.x, c.y));
    units.push({ name: `SCPD-${ci}`, d, b: c.role === 'roadblock' ? 'ROADBLOCK' : d < 72 ? 'RAMMING' : 'PURSUIT' });
  }
  for (const f of world.copsFoot) {
    fi += 1;
    units.push({ name: `SCPD-F${fi}`, d: Math.round(dist(p.x, p.y, f.x, f.y)), b: 'FOOT CHASE' });
  }
  units.sort((a, b) => a.d - b.d);
  const lines = units.slice(0, 5);
  if (world.heli) {
    lines.push({ name: 'AIR-1', d: Math.round(dist(p.x, p.y, world.heli.x, world.heli.y)), b: 'SPOTLIGHT' });
  }
  return { total: units.length + (world.heli ? 1 : 0), lines };
}

function drawMinimap(ctx, world) {
  const S = 148, X = 12, Y = VIEW_H - 200;
  const s = S / WORLD_SIZE;
  plate(ctx, X - 4, Y - 4, S + 8, S + 8, 0.6);
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, S, S); ctx.clip();
  ctx.fillStyle = '#1d2836';
  ctx.fillRect(X, Y, S, S);
  // beach + sea + park
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(X + 2400 * s, Y + 400 * s, 800 * s, 800 * s);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(X + 3200 * s, Y + 400 * s, 400 * s, 800 * s);
  ctx.fillStyle = '#4d7a3a';
  ctx.fillRect(X + 400 * s, Y + 2400 * s, 400 * s, 400 * s);
  // roads
  ctx.strokeStyle = 'rgba(200,205,215,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= WORLD_SIZE; i += BLOCK) {
    ctx.beginPath(); ctx.moveTo(X + i * s, Y); ctx.lineTo(X + i * s, Y + S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X, Y + i * s); ctx.lineTo(X + S, Y + i * s); ctx.stroke();
  }
  // turf zones
  for (const z of world.turf.zones) {
    ctx.fillStyle = z.color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(X + z.x * s, Y + z.y * s, 3.4, 0, 6.29); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const dot = (x, y, color, r = 2.4) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(X + x * s, Y + y * s, r, 0, 6.29); ctx.fill();
  };
  for (const c of world.coins) if (!c.taken) dot(c.x, c.y, '#ffd23e', 2);
  for (const l of LANDMARKS) dot(l.x, l.y, '#e8e8e8', 1.8);
  for (const g of world.gang) dot(g.x, g.y, '#ff5d5d', 2.4);
  for (const c of world.cars) if (c.driver === 'cop') dot(c.x, c.y, '#6ea8ff', 2.4);
  for (const f of world.copsFoot) dot(f.x, f.y, '#6ea8ff', 2.2);
  const tgt = missionTarget(world) || raceTarget(world) || sidejobTarget(world);
  if (tgt) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(X + tgt.x * s, Y + tgt.y * s, 4.6, 0, 6.29); ctx.stroke();
  }
  // player arrow
  const p = world.player;
  const px = X + p.x * s, py = Y + p.y * s;
  const a = p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(a);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0); ctx.lineTo(-4.4, -4); ctx.lineTo(-4.4, 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // district name under the minimap, right-aligned to its edge
  txt(ctx, districtAt(p.x, p.y), X + S, VIEW_H - 34, { size: 13.5, bold: true, align: 'right', color: '#ffe9a8' });
  // ammo line under that
  const ammo = p.reloading > 0 ? `AMMO ${p.ammo} / ${p.reserve} — RELOADING` : `AMMO ${p.ammo} / ${p.reserve}`;
  txt(ctx, ammo, X, VIEW_H - 12, { size: 12.5, color: '#dfe6ee' });
}

export function drawHUD(ctx, world) {
  const p = world.player;
  const stars = wantedStars(world);

  // ---- top-left plate: money / score / hp / rank ----
  plate(ctx, 10, 10, 218, 98, 0.55);
  txt(ctx, `$${p.money.toLocaleString('en-US')}`, 20, 40, { size: 23, bold: true, color: '#ffd76a' });
  txt(ctx, `Score ${p.score.toLocaleString('en-US')} · Cars ${p.carsStolen} · Coins ${coinsTaken(world)}/10`, 20, 60, { size: 12, color: '#dfe6ee' });
  // hp bar (+ armor overlay)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(ctx, 20, 68, 150, 9, 4); ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#59c24d' : '#e05555';
  rr(ctx, 20, 68, Math.max(0, 150 * (p.hp / 100)), 9, 4); ctx.fill();
  if (p.armor > 0) {
    ctx.fillStyle = 'rgba(110,168,255,0.8)';
    rr(ctx, 20, 79, 150 * (p.armor / 100), 4.6, 2); ctx.fill();
  }
  txt(ctx, `Rank: ${p.rank}`, 20, 100, { size: 12, color: '#ffe9a8' });

  // ---- top-right: wanted stars + clock plate ----
  ctx.save();
  ctx.font = '26px system-ui';
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 3;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', VIEW_W - 16 - (4 - i) * 27, 36);
  }
  ctx.restore();
  plate(ctx, VIEW_W - 196, 46, 186, 40, 0.5);
  txt(ctx, `${clockText(world.clock)} · ${world.weather.kind}`, VIEW_W - 20, 63, { size: 12.5, align: 'right', color: '#dfe6ee' });
  txt(ctx, `Turf ${zonesHeld(world.turf)}/5 · +$${zonesHeld(world.turf) * 6} income`, VIEW_W - 20, 79, { size: 12.5, align: 'right', color: '#dfe6ee' });

  // ---- SCPD RESPONSE panel (wanted only) ----
  if (stars >= 1) {
    const { total, lines } = scpdUnits(world);
    const pw = 244, ph = 30 + lines.length * 17 + 6;
    const px = VIEW_W - 14 - pw, py = 94;
    plate(ctx, px, py, pw, ph, 0.62);
    txt(ctx, `SCPD RESPONSE — ${total} UNITS · ${stars}★`, px + 10, py + 19, { size: 12, bold: true, color: '#ffb3a0' });
    lines.forEach((u, i) => {
      txt(ctx, `${u.name}  ${u.d}m  ${u.b}`, px + 10, py + 38 + i * 17, { size: 12, color: '#dfe6ee' });
    });
  }

  // ---- objective banner (top centre) ----
  const stage = missionStage(world);
  if (stage) {
    const tgt = missionTarget(world);
    const l1 = `MISSION ${stage.idx + 1}/${stage.total} — ${stage.title} · STAGE ${stage.step + 1}/${stage.steps}`;
    let l2 = tgt ? `${stage.label} — ${tgt.dist}m` : stage.label;
    if (stage.nextShort) l2 += ` · NEXT: ${stage.nextShort}`;
    ctx.font = 'bold 13.5px system-ui';
    const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 34;
    plate(ctx, (VIEW_W - w) / 2, 12, w, 46, 0.6);
    txt(ctx, l1, VIEW_W / 2, 31, { size: 13.5, bold: true, align: 'center', color: '#ffd76a' });
    txt(ctx, l2, VIEW_W / 2, 50, { size: 12.5, align: 'center', color: '#ffffff' });
  } else if (world.storyDone) {
    plate(ctx, VIEW_W / 2 - 190, 12, 380, 30, 0.5);
    txt(ctx, 'STORY COMPLETE — Solmar is yours, Legend', VIEW_W / 2, 32, { size: 13, bold: true, align: 'center', color: '#ffd76a' });
  }
  // race / side-job line under the banner
  const rt = raceTarget(world);
  const st = !rt ? sidejobTarget(world) : null;
  if (rt || st) {
    const t = rt || st;
    const extra = rt ? ` · ${(world.race.t).toFixed(0)}s / par ${world.race.par}s` : '';
    txt(ctx, `${t.label}${extra}`, VIEW_W / 2, 78, { size: 12.5, align: 'center', color: rt ? '#7ee787' : '#4dd0e1' });
  }
  // edge arrow toward the current target
  const tgt = missionTarget(world) || rt || st;
  if (tgt) {
    const cam = cameraFor(world);
    const sx = tgt.x - cam.x, sy = tgt.y - cam.y;
    if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) {
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      const ax = clamp(p.x - cam.x + Math.cos(a) * 120, 40, VIEW_W - 40);
      const ay = clamp(p.y - cam.y + Math.sin(a) * 120, 60, VIEW_H - 60);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(13, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      txt(ctx, `${Math.round(dist(p.x, p.y, tgt.x, tgt.y))}m`, ax, ay - 16, { size: 11.5, align: 'center', color: '#ffd76a' });
    }
  }

  drawMinimap(ctx, world);

  // ---- bottom-right: radio / vehicle / speed stack ----
  if (p.car) {
    const car = p.car;
    txt(ctx, `♪ ${stationName(world)}`, VIEW_W - 14, VIEW_H - 118, { size: 12, align: 'right', color: '#b8e6ff' });
    txt(ctx, `${car.name} · ${Math.max(0, Math.round(car.hp))}% CONDITION`, VIEW_W - 14, VIEW_H - 98, { size: 12.5, align: 'right', bold: true });
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, VIEW_W - 184, VIEW_H - 88, 170, 8, 4); ctx.fill();
    ctx.fillStyle = car.hp > 30 ? '#59c24d' : '#e05555';
    rr(ctx, VIEW_W - 184, VIEW_H - 88, 170 * clamp(car.hp / 100, 0, 1), 8, 4); ctx.fill();
    txt(ctx, `${Math.round(Math.abs(car.speed) * 1.5)} KM/H`, VIEW_W - 14, VIEW_H - 44, { size: 29, bold: true, align: 'right', color: '#ffffff' });
  } else {
    txt(ctx, 'ON FOOT', VIEW_W - 14, VIEW_H - 44, { size: 15, bold: true, align: 'right', color: '#dfe6ee', alpha: 0.8 });
  }

  // ---- bust meter ----
  if (world.bust > 0.02) {
    const w = 240;
    plate(ctx, (VIEW_W - w) / 2, VIEW_H - 196, w, 20, 0.6);
    ctx.fillStyle = '#e05555';
    rr(ctx, (VIEW_W - w) / 2 + 4, VIEW_H - 192, (w - 8) * world.bust, 12, 4); ctx.fill();
    txt(ctx, 'BUSTED', VIEW_W / 2, VIEW_H - 182, { size: 11, bold: true, align: 'center' });
  }

  // ---- vault / turf hold bars (above the dialogue slot) ----
  const vp = vaultProgress(world);
  const turf = world.turf;
  const zi = turf.active;
  if (vp >= 0) {
    const w = 340, x = (VIEW_W - w) / 2, y = VIEW_H - 170;
    plate(ctx, x, y, w, 22, 0.65);
    ctx.fillStyle = '#59c24d';
    rr(ctx, x + 3, y + 3, (w - 6) * vp, 16, 5); ctx.fill();
    txt(ctx, `VAULT ${Math.round(vp * 100)}%`, VIEW_W / 2, y + 16, { size: 12.5, bold: true, align: 'center' });
  } else if (zi >= 0) {
    const w = 340, x = (VIEW_W - w) / 2, y = VIEW_H - 170;
    const frac = clamp(turf.holdT / 12, 0, 1);
    plate(ctx, x, y, w, 22, 0.65);
    ctx.fillStyle = '#59b06a';
    rr(ctx, x + 3, y + 3, (w - 6) * frac, 16, 5); ctx.fill();
    txt(ctx, `HOLDING ${turf.zones[zi].name.toUpperCase()} ${Math.round(frac * 100)}%`, VIEW_W / 2, y + 16, { size: 12, bold: true, align: 'center' });
  }

  // ---- interaction prompt ----
  if (world.prompt) {
    ctx.font = '12.5px system-ui';
    const w = ctx.measureText(world.prompt).width + 26;
    plate(ctx, (VIEW_W - w) / 2, VIEW_H - 224, w, 22, 0.55);
    txt(ctx, world.prompt, VIEW_W / 2, VIEW_H - 209, { size: 12.5, align: 'center', color: '#ffe9a8' });
  }

  // ---- dialogue (bottom centre) ----
  if (world.dialogue) {
    const d = world.dialogue;
    const lines = wrapText(ctx, d.text, 600, 13.5);
    const w = 660, h = 44 + lines.length * 17;
    const x = (VIEW_W - w) / 2, y = VIEW_H - 132;
    plate(ctx, x, y, w, h, 0.62);
    txt(ctx, d.who, x + 14, y + 19, { size: 12.5, bold: true, color: '#ffd76a' });
    lines.forEach((ln, i) => txt(ctx, ln, x + 14, y + 40 + i * 17, { size: 13.5 }));
  }

  // ---- centre notice ----
  if (world.notice) {
    const n = world.notice;
    const a = clamp(n.t, 0, 1);
    txt(ctx, n.text, VIEW_W / 2, VIEW_H * 0.3, { size: 42, bold: true, align: 'center', color: '#ffd76a', alpha: a });
    if (n.sub) txt(ctx, n.sub, VIEW_W / 2, VIEW_H * 0.3 + 30, { size: 16.5, align: 'center', alpha: a });
  }
}

// -------------------------------------------------------------- screens

export function drawTitle(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(24,8,28,0.58)');
  g.addColorStop(0.45, 'rgba(24,8,28,0.12)');
  g.addColorStop(1, 'rgba(24,8,28,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const tg = ctx.createLinearGradient(0, 96, 0, 176);
  tg.addColorStop(0, '#ffe259');
  tg.addColorStop(0.55, '#ffa751');
  tg.addColorStop(1, '#ff5d8f');
  ctx.save();
  ctx.font = '900 82px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = tg;
  ctx.fillText('SOLMAR HEAT', VIEW_W / 2, 168);
  ctx.restore();
  txt(ctx, 'An original open-world crime story — steal, drive, run, survive.', VIEW_W / 2, 202, { size: 16.5, align: 'center', color: '#ffe9d0' });

  const pulse = 0.72 + Math.sin(world.time * 3) * 0.28;
  txt(ctx, 'PRESS ENTER OR CLICK TO PLAY', VIEW_W / 2, 452, { size: 19, bold: true, align: 'center', color: '#ffffff', alpha: pulse });
  txt(ctx, 'WASD / arrows — move & drive · E — enter / exit car · Mouse — aim, click — shoot', VIEW_W / 2, 492, { size: 13.5, align: 'center', color: '#dfe6ee' });
  txt(ctx, 'F — punch · R — reload · T — taxi fare · Space — handbrake · Shift — sprint · Q — radio · P — map & pause', VIEW_W / 2, 514, { size: 13.5, align: 'center', color: '#dfe6ee' });
  txt(ctx, '3 story missions · 3 street races · taxi fares · deliveries · turf wars · 10 hidden coins · Lou\u2019s Mod Shop', VIEW_W / 2, 556, { size: 13.5, align: 'center', color: '#b8e6ff' });

  const storyN = world.mission ? Math.min(3, world.mission.idx + (world.storyDone ? 1 : 0)) : 0;
  const storyDone = world.storyDone ? 3 : storyN;
  txt(ctx, `Story ${storyDone}/3 · Coins ${coinsTaken(world)}/10 · Turf ${zonesHeld(world.turf)}/5 — progress saves automatically`,
    VIEW_W / 2, 584, { size: 14, bold: true, align: 'center', color: '#ffd76a' });
  txt(ctx, 'A wholly original game. No part of it comes from any commercial game.', VIEW_W / 2, 692, { size: 11, align: 'center', alpha: 0.75 });
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function drawMapScreen(ctx, world) {
  ctx.fillStyle = 'rgba(6,10,16,0.94)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  txt(ctx, 'SOLMAR — MAP & RECORD', 36, 54, { size: 29, bold: true, color: '#ffd76a' });
  txt(ctx, `${clockText(world.clock)} · ${world.weather.kind} · ${districtAt(world.player.x, world.player.y)}`, 36, 76, { size: 13, color: '#b8c4d4' });

  // ---- the island map (left) ----
  const MX = 36, MY = 92, MS = 548, s = MS / WORLD_SIZE;
  ctx.fillStyle = '#223140';
  rr(ctx, MX, MY, MS, MS, 10); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(MX, MY, MS, MS); ctx.clip();
  // district shades + names
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      ctx.fillStyle = `hsl(${205 + (gy * 3 + gx) * 9}, 24%, ${17 + ((gy * 3 + gx) % 3) * 2}%)`;
      ctx.fillRect(MX + gx * (MS / 3), MY + gy * (MS / 3), MS / 3, MS / 3);
    }
  }
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(MX + 2400 * s, MY + 400 * s, 800 * s, 800 * s);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(MX + 3200 * s, MY + 400 * s, 400 * s, 800 * s);
  ctx.fillStyle = '#3f7040';
  ctx.fillRect(MX + 400 * s, MY + 2400 * s, 400 * s, 400 * s);
  ctx.strokeStyle = 'rgba(210,218,228,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= WORLD_SIZE; i += BLOCK) {
    ctx.beginPath(); ctx.moveTo(MX + i * s, MY); ctx.lineTo(MX + i * s, MY + MS); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MX, MY + i * s); ctx.lineTo(MX + MS, MY + i * s); ctx.stroke();
  }
  // turf zones
  for (const z of world.turf.zones) {
    ctx.fillStyle = z.owner === 'Player' ? 'rgba(89,194,232,0.25)' : 'rgba(224,85,85,0.22)';
    ctx.beginPath(); ctx.arc(MX + z.x * s, MY + z.y * s, z.r * s, 0, 6.29); ctx.fill();
    ctx.strokeStyle = z.color;
    ctx.beginPath(); ctx.arc(MX + z.x * s, MY + z.y * s, z.r * s, 0, 6.29); ctx.stroke();
  }
  // landmarks: dot + initials
  ctx.font = 'bold 8.6px system-ui';
  ctx.textAlign = 'center';
  for (const l of LANDMARKS) {
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(MX + l.x * s, MY + l.y * s, 3.2, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(l.short, MX + l.x * s, MY + l.y * s - 6);
  }
  // mission target
  const tgt = missionTarget(world);
  if (tgt) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(MX + tgt.x * s, MY + tgt.y * s, 7, 0, 6.29); ctx.stroke();
  }
  // district names
  ctx.font = 'bold 11.5px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const names = ['Sunset Mile', 'Cactus Court', 'Neon Strip', 'Old Market', 'Downtown', 'Canal Row', 'Palm Heights', 'The Marina', 'Pier 9'];
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      ctx.fillText(names[gy * 3 + gx], MX + (gx + 0.5) * (MS / 3), MY + (gy + 0.5) * (MS / 3) + 26);
    }
  }
  // player arrow
  const p = world.player;
  ctx.save();
  ctx.translate(MX + p.x * s, MY + p.y * s);
  ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-5.4, -5); ctx.lineTo(-5.4, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, MX, MY, MS, MS, 10); ctx.stroke();

  // ---- stats (right, two columns) ----
  const col = (x, header, rows) => {
    txt(ctx, header, x, 118, { size: 15, bold: true, color: '#ffd76a' });
    rows.forEach((r, i) => {
      txt(ctx, r[0], x, 146 + i * 25, { size: 13.5, color: '#dfe6ee' });
      txt(ctx, r[1], x + 292, 146 + i * 25, { size: 13.5, bold: true, align: 'right', color: r[2] || '#ffffff' });
    });
  };
  const mIdx = world.mission ? world.mission.idx : 0;
  const mNames = ['Wheels for Lou', 'The Palms Package', 'National Bank Job'];
  const mRows = mNames.map((n, i) => {
    const st = world.storyDone || i < mIdx ? 'DONE' : i === mIdx ? 'NEXT' : 'LOCKED';
    return [n, st, st === 'DONE' ? '#7ee787' : st === 'NEXT' ? '#ffd76a' : '#8a93a0'];
  });
  col(628, 'STORY & ACTIVITIES', [
    ...mRows,
    ['Street races won', `${world.raceWins}/3`],
    ['Turf zones held', `${zonesHeld(world.turf)}/5`],
    ['Solmar coins', `${coinsTaken(world)}/10`],
    ['Taxi fares', `${p.fares}`],
    ['Deliveries', `${p.deliveries}`],
  ]);
  col(952, 'CAREER', [
    ['Cars stolen', `${p.carsStolen}`],
    ['Near misses', `${p.nearMisses}`],
    ['Shots fired', `${p.shots}`],
    ['Mods bought', `${modsBought(world.mods)}/9`],
    ['Rank', p.rank],
    ['Money', `$${p.money.toLocaleString('en-US')}`],
    ['Score', `${p.score.toLocaleString('en-US')}`],
    ['Play time', fmtTime(world.playTime)],
  ]);

  // ---- turf ledger + mod levels (fills the lower-right) ----
  txt(ctx, 'TURF LEDGER', 628, 428, { size: 15, bold: true, color: '#ffd76a' });
  world.turf.zones.forEach((z, i) => {
    const y = 456 + i * 25;
    txt(ctx, z.name, 628, y, { size: 13.5, color: '#dfe6ee' });
    txt(ctx, z.owner === 'Player' ? 'YOURS' : z.owner.toUpperCase(), 1216, y,
      { size: 13.5, bold: true, align: 'right', color: z.owner === 'Player' ? '#59c2e8' : '#e08a8a' });
  });
  txt(ctx, `Lou's Mod Shop — Engine ${world.mods.engine}/3 · Armor ${world.mods.armor}/3 · Tires ${world.mods.tires}/3`,
    628, 600, { size: 13.5, color: '#b8e6ff' });

  txt(ctx, `Save exists: ${world.saveExists ? 'yes' : 'no'} · Progress saves automatically`, 36, 676, { size: 12.5, color: '#b8c4d4' });
  txt(ctx, 'WASD drive · E enter/exit · F punch · R reload · T taxi · P/Esc resume', 36, 698, { size: 12.5, color: '#b8c4d4' });
}

export function drawModShop(ctx, world) {
  const X = 330, Y = 138, W = 620, H = 424;
  plate(ctx, X, Y, W, H, 0.93);
  txt(ctx, "LOU'S MOD SHOP", X + 28, Y + 48, { size: 26, bold: true, color: '#ffd76a' });
  txt(ctx, `Your money: $${world.player.money.toLocaleString('en-US')} · Upgrades apply to every car you drive`, X + 28, Y + 76, { size: 13, color: '#dfe6ee' });
  MOD_TRACKS.forEach((t, i) => {
    const y = Y + 116 + i * 84;
    const lvl = world.mods[t.key];
    txt(ctx, `${i + 1} · ${t.name}`, X + 28, y, { size: 18, bold: true });
    txt(ctx, t.blurb, X + 28, y + 22, { size: 12.5, color: '#b8c4d4' });
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < lvl ? '#ffd76a' : 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(X + 300 + k * 24, y - 6, 8, 0, 6.29); ctx.fill();
    }
    const cost = lvl >= 3 ? null : t.costs[lvl];
    txt(ctx, cost === null ? 'MAX LEVEL' : `Next: $${cost} — press ${i + 1}`, X + W - 28, y, { size: 14.5, bold: true, align: 'right', color: cost === null ? '#7ee787' : '#ffd76a' });
  });
  txt(ctx, 'Esc / P — back to the street', X + 28, Y + H - 22, { size: 12.5, color: '#b8c4d4' });
}

export function drawEndScreen(ctx, world, kind) {
  ctx.fillStyle = kind === 'wasted' ? 'rgba(60,4,4,0.5)' : 'rgba(4,10,50,0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  txt(ctx, kind === 'wasted' ? 'WASTED' : 'BUSTED', VIEW_W / 2, VIEW_H / 2 - 10,
    { size: 76, bold: true, align: 'center', color: kind === 'wasted' ? '#ff5d5d' : '#7ea8ff' });
  txt(ctx, kind === 'wasted'
    ? 'Press Enter — wake up at Solmar General Hospital'
    : 'Press Enter — released from SCPD Headquarters, lighter of pocket',
  VIEW_W / 2, VIEW_H / 2 + 34, { size: 15.5, align: 'center' });
}

// ------------------------------------------------------------- frame

export function renderFrame(ctx, world, state) {
  drawWorld(ctx, world);
  if (state === 'title') { drawTitle(ctx, world); return; }
  if (state === 'pause') { drawMapScreen(ctx, world); return; }
  drawHUD(ctx, world);
  if (state === 'modshop') drawModShop(ctx, world);
  if (state === 'wasted') drawEndScreen(ctx, world, 'wasted');
  if (state === 'busted') drawEndScreen(ctx, world, 'busted');
}
