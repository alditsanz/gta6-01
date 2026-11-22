// Solmar Heat — render.js
// Everything the player sees: the city (ground, streets, props,
// buildings with roofs and lit windows), figures, cars, the helicopter,
// weather light, the full HUD, the map & record screen and the title.
// Rendering reads world state only — it never mutates the game.

import { VIEW_W, VIEW_H, CAR_TYPES, KMH_PER_UNIT, rankFor, nextRank } from './config.js';
import { clamp, dist, hash2 } from './random.js';
import { LANDMARKS, DISTRICTS, districtAt, BEACH, PARK, CANAL } from './landmarks.js';
import { skyPhase, weatherOf } from './weather.js';
import { WEAPONS } from './combat.js';
import { stationLabel } from './radio.js';
import { missionStage } from './missions.js';
import { coinsTaken, stashesTaken, jumpsDone } from './collectibles.js';
import { zonesHeld } from './turf.js';
import { racesWon } from './races.js';
import { modsBought } from './modshop.js';
import { starsOf } from './world.js';

function plate(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(10,14,20,${alpha === undefined ? 0.62 : alpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back || 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

export function completionPct(world) {
  const s = world.stats;
  let pct = (s.missionsDone / 5) * 40
    + (coinsTaken(world.collectibles) / 20) * 15
    + (stashesTaken(world.collectibles) / 12) * 10
    + (jumpsDone(world.collectibles) / 5) * 10
    + (zonesHeld(world.turf) / 5) * 10
    + (racesWon(world) / 3) * 10
    + (modsBought(world.mods) / 9) * 5;
  return Math.round(clamp(pct, 0, 100) * 10) / 10;
}

// ---------------------------------------------------------------- world ---

export function drawWorld(ctx, world, cam, vw, vh) {
  const z = cam.zoom || 1;
  const phase = skyPhase(world.weather.clock);
  world.weather.phase = phase;
  const toX = (wx) => (wx - cam.x) * z + vw / 2;
  const toY = (wy) => (wy - cam.y) * z + vh / 2;
  const view = { x0: cam.x - vw / 2 / z - 80, y0: cam.y - vh / 2 / z - 80, x1: cam.x + vw / 2 / z + 80, y1: cam.y + vh / 2 / z + 80 };

  // Sky/ground base by phase.
  const groundTone = { dawn: '#8fa36a', day: '#9db873', golden: '#a8a05e', dusk: '#7d7a58', night: '#44503c' }[phase];
  ctx.fillStyle = groundTone;
  ctx.fillRect(0, 0, vw, vh);

  // The sea beyond the east edge, with a foam line.
  const seaX = toX(3600);
  if (seaX < vw) {
    const grad = ctx.createLinearGradient(seaX, 0, vw, 0);
    grad.addColorStop(0, '#3f8ea6'); grad.addColorStop(1, '#1d5d7a');
    ctx.fillStyle = grad; ctx.fillRect(seaX, 0, vw - seaX, vh);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = -20; y < vh + 20; y += 26) {
      const wob = Math.sin((y + world.time * 30) * 0.05) * 5;
      ctx.moveTo(seaX + 6 + wob, y); ctx.lineTo(seaX + 26 + wob, y + 8);
    }
    ctx.stroke();
  }

  // District ground tints + beach + park + canal.
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) {
    const gx = dx * 1200, gy = dy * 1200;
    if (gx > view.x1 || gy > view.y1 || gx + 1200 < view.x0 || gy + 1200 < view.y0) continue;
    ctx.fillStyle = `rgba(${140 + dx * 22},${128 + dy * 16},${86 + (dx + dy) * 9},0.20)`;
    ctx.fillRect(toX(gx), toY(gy), 1200 * z, 1200 * z);
  }
  // Beach: sand, boardwalk planks on its west edge, umbrella dots handled as props.
  ctx.fillStyle = phase === 'night' ? '#8a7a58' : '#ecd9a0';
  ctx.fillRect(toX(BEACH.x0), toY(BEACH.y0), (BEACH.x1 - BEACH.x0) * z, (BEACH.y1 - BEACH.y0) * z);
  ctx.fillStyle = '#b08d5a';
  ctx.fillRect(toX(BEACH.x0), toY(BEACH.y0), 46 * z, (BEACH.y1 - BEACH.y0) * z);
  ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = BEACH.y0; y < BEACH.y1; y += 22) { ctx.moveTo(toX(BEACH.x0), toY(y)); ctx.lineTo(toX(BEACH.x0 + 46), toY(y)); }
  ctx.stroke();
  // Park: lawn, crossing paths, pond.
  ctx.fillStyle = phase === 'night' ? '#3d5c33' : '#6fae56';
  ctx.fillRect(toX(PARK.x0), toY(PARK.y0), 400 * z, 400 * z);
  ctx.fillStyle = '#cbb98d';
  ctx.fillRect(toX(PARK.x0), toY(2588), 400 * z, 24 * z);
  ctx.fillRect(toX(588), toY(PARK.y0), 24 * z, 400 * z);
  ctx.fillStyle = '#4d90b8';
  ctx.beginPath(); ctx.ellipse(toX(600), toY(2600), 80 * z, 80 * z, 0, 0, 7); ctx.fill();
  // Canal water with bridge decks where streets cross.
  ctx.fillStyle = '#3d7ea3';
  ctx.fillRect(toX(CANAL.x0), toY(CANAL.y0), (CANAL.x1 - CANAL.x0) * z, (CANAL.y1 - CANAL.y0) * z);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  for (let x = CANAL.x0 + 30; x < CANAL.x1; x += 90) { ctx.moveTo(toX(x), toY(1800)); ctx.lineTo(toX(x + 34), toY(1800)); }
  ctx.stroke();

  drawStreets(ctx, world, toX, toY, z, view, phase);
  drawProps(ctx, world, toX, toY, z, view, phase);
  drawBuildings(ctx, world, toX, toY, z, view, phase);
  drawLandmarkMarkers(ctx, world, toX, toY, z, view, phase);

  // Collectibles.
  for (const coin of world.collectibles.coins) {
    if (coin.taken || coin.x < view.x0 || coin.x > view.x1 || coin.y < view.y0 || coin.y > view.y1) continue;
    const bob = Math.sin(world.time * 3 + coin.x) * 2;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(toX(coin.x), toY(coin.y) + bob, 7 * z, 0, 7); ctx.fill();
    ctx.fillStyle = '#a87f14'; ctx.font = `bold ${Math.round(9 * z)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText('S', toX(coin.x), toY(coin.y) + bob + 3 * z);
  }
  for (const stash of world.collectibles.stashes) {
    if (stash.taken || stash.x < view.x0 || stash.x > view.x1 || stash.y < view.y0 || stash.y > view.y1) continue;
    ctx.fillStyle = '#ff9d3c';
    ctx.fillRect(toX(stash.x) - 5 * z, toY(stash.y) - 8 * z, 10 * z, 13 * z);
    ctx.fillStyle = 'rgba(255,157,60,0.25)';
    ctx.beginPath(); ctx.arc(toX(stash.x), toY(stash.y), 16 * z, 0, 7); ctx.fill();
  }
  for (const jump of world.collectibles.jumps) {
    if (jump.done || jump.x < view.x0 || jump.x > view.x1 || jump.y < view.y0 || jump.y > view.y1) continue;
    ctx.fillStyle = '#e8e8e8';
    for (let i = 0; i < 3; i++) ctx.fillRect(toX(jump.x) - 14 * z + i * 10 * z, toY(jump.y) - 4 * z, 7 * z, 8 * z);
  }
  // Turf zone tint.
  for (const zone of world.turf.zones) {
    ctx.fillStyle = zone.owner === 'Rex' ? 'rgba(80,200,120,0.10)' : 'rgba(220,70,70,0.08)';
    ctx.beginPath(); ctx.arc(toX(zone.x), toY(zone.y), zone.r * z, 0, 7); ctx.fill();
  }
  // Vault hold ring (bank job + staged shots).
  const ring = world.flags.vaultRing;
  if (ring) {
    const rx = toX(ring.x), ry = toY(ring.y), rr = 95 * z;
    ctx.strokeStyle = 'rgba(57,231,95,0.5)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#39e75f'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + (ring.pct / 100) * Math.PI * 2); ctx.stroke();
  }
  // Roadblock: two cruisers + striped barrier.
  if (world.roadblock) {
    const rb = world.roadblock;
    ctx.save();
    ctx.translate(toX(rb.x), toY(rb.y)); ctx.rotate(rb.angle); ctx.scale(z, z);
    ctx.fillStyle = '#e33'; ctx.fillRect(-6, -52, 12, 104);
    ctx.fillStyle = '#fff';
    for (let i = -48; i < 100; i += 24) ctx.fillRect(-6, i, 12, 12);
    ctx.restore();
  }
  // Cars, figures, heli, bullets.
  for (const car of world.cars) {
    if (car.x < view.x0 || car.x > view.x1 || car.y < view.y0 || car.y > view.y1) continue;
    drawCar(ctx, world, car, toX(car.x), toY(car.y), z, phase);
  }
  for (const ped of world.peds) drawFigure(ctx, world, ped, toX, toY, z, phase, {});
  for (const g of world.gang) drawFigure(ctx, world, g, toX, toY, z, phase, { gang: true });
  for (const fc of world.footCops || []) drawFigure(ctx, world, fc, toX, toY, z, phase, { cop: true });
  if (!world.player.car) drawFigure(ctx, world, world.player, toX, toY, z, phase, { player: true });
  if (world.heli) drawHeli(ctx, world, toX, toY, z, phase);
  // Tracers: bright streaks with a glow pass.
  for (const b of world.bullets) {
    ctx.strokeStyle = 'rgba(255,190,60,0.38)'; ctx.lineWidth = 4.6 * z;
    ctx.beginPath(); ctx.moveTo(toX(b.x - b.vx * 0.045), toY(b.y - b.vy * 0.045)); ctx.lineTo(toX(b.x), toY(b.y)); ctx.stroke();
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2 * z;
    ctx.beginPath(); ctx.moveTo(toX(b.x - b.vx * 0.045), toY(b.y - b.vy * 0.045)); ctx.lineTo(toX(b.x), toY(b.y)); ctx.stroke();
  }
  // Cash bags staged at the vault.
  if (world.flags.cashBags) {
    for (const bag of world.flags.cashBags) {
      ctx.fillStyle = '#5d7a3a';
      ctx.beginPath(); ctx.ellipse(toX(bag.x), toY(bag.y), 9 * z, 7 * z, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#dff2c8'; ctx.font = `bold ${Math.round(10 * z)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText('$', toX(bag.x), toY(bag.y) + 3 * z);
    }
  }
  drawLighting(ctx, world, vw, vh, phase);
}

function drawStreets(ctx, world, toX, toY, z, view, phase) {
  const asphalt = phase === 'night' ? '#3a3f46' : '#565d66';
  ctx.fillStyle = asphalt;
  for (let i = 0; i <= 3600; i += 400) {
    if (i > view.x0 - 70 && i < view.x1 + 70) ctx.fillRect(toX(i - 62), toY(-70), 124 * z, 3740 * z);
    if (i > view.y0 - 70 && i < view.y1 + 70) ctx.fillRect(toX(-70), toY(i - 62), 3740 * z, 124 * z);
  }
  // Canal bridges (decks over the water strip).
  ctx.fillStyle = asphalt;
  for (let i = 0; i <= 3600; i += 400) {
    if (i < CANAL.x0 - 60) continue;
    ctx.fillRect(toX(i - 62), toY(CANAL.y0), 124 * z, (CANAL.y1 - CANAL.y0) * z);
  }
  // Sidewalk strips.
  ctx.fillStyle = phase === 'night' ? '#6a6f66' : '#c9c2ae';
  for (let i = 0; i <= 3600; i += 400) {
    if (i > view.x0 - 80 && i < view.x1 + 80) {
      ctx.fillRect(toX(i - 70), toY(-70), 8 * z, 3740 * z);
      ctx.fillRect(toX(i + 62), toY(-70), 8 * z, 3740 * z);
    }
    if (i > view.y0 - 80 && i < view.y1 + 80) {
      ctx.fillRect(toX(-70), toY(i - 70), 3740 * z, 8 * z);
      ctx.fillRect(toX(-70), toY(i + 62), 3740 * z, 8 * z);
    }
  }
  // Dashed lane lines + crosswalks.
  ctx.strokeStyle = 'rgba(240,230,160,0.55)'; ctx.lineWidth = Math.max(1, 2 * z);
  ctx.setLineDash([16 * z, 14 * z]);
  ctx.beginPath();
  for (let i = 0; i <= 3600; i += 400) {
    if (i > view.x0 && i < view.x1) { ctx.moveTo(toX(i), toY(view.y0)); ctx.lineTo(toX(i), toY(view.y1)); }
    if (i > view.y0 && i < view.y1) { ctx.moveTo(toX(view.x0), toY(i)); ctx.lineTo(toX(view.x1), toY(i)); }
  }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let ix = 0; ix <= 3600; ix += 400) for (let iy = 0; iy <= 3600; iy += 400) {
    if (ix < view.x0 - 60 || ix > view.x1 + 60 || iy < view.y0 - 60 || iy > view.y1 + 60) continue;
    for (let s = -44; s < 50; s += 15) ctx.fillRect(toX(ix + s) - 4 * z, toY(iy - 58), 8 * z, 10 * z);
  }
}

function drawProps(ctx, world, toX, toY, z, view, phase) {
  const night = phase === 'night' || phase === 'dusk';
  for (const prop of world.props) {
    if (prop.x < view.x0 || prop.x > view.x1 || prop.y < view.y0 || prop.y > view.y1) continue;
    const x = toX(prop.x), y = toY(prop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x + 3 * z, y + 4 * z, 6 * z, 3 * z, 0, 0, 7); ctx.fill();
    if (prop.kind === 'lamp') {
      ctx.fillStyle = '#3c4046'; ctx.fillRect(x - 1.4 * z, y - 10 * z, 2.8 * z, 12 * z);
      ctx.fillStyle = night ? '#ffd98a' : '#e8e4d2';
      ctx.beginPath(); ctx.arc(x, y - 11 * z, 3 * z, 0, 7); ctx.fill();
      if (night) {
        const g = ctx.createRadialGradient(x, y - 8 * z, 2, x, y - 8 * z, 44 * z);
        g.addColorStop(0, 'rgba(255,205,110,0.30)'); g.addColorStop(1, 'rgba(255,205,110,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 8 * z, 44 * z, 0, 7); ctx.fill();
      }
    } else if (prop.kind === 'palm') {
      const s = (prop.s || 1) * z;
      ctx.strokeStyle = '#7a5c38'; ctx.lineWidth = 3.4 * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3 * s, y - 10 * s, x + 6 * s, y - 17 * s); ctx.stroke();
      ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 2.4 * s;
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + prop.x;
        ctx.beginPath(); ctx.moveTo(x + 6 * s, y - 17 * s);
        ctx.quadraticCurveTo(x + 6 * s + Math.cos(a) * 8 * s, y - 17 * s + Math.sin(a) * 3 * s - 2 * s, x + 6 * s + Math.cos(a) * 12 * s, y - 17 * s + Math.sin(a) * 6 * s + 2 * s);
        ctx.stroke();
      }
    } else if (prop.kind === 'tree') {
      const s = (prop.s || 1) * z;
      ctx.fillStyle = '#6d4c2f'; ctx.fillRect(x - 1.6 * s, y - 4 * s, 3.2 * s, 7 * s);
      ctx.fillStyle = phase === 'night' ? '#2e6b34' : '#43a047';
      ctx.beginPath(); ctx.arc(x, y - 9 * s, 10 * s, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(x - 3 * s, y - 12 * s, 4.4 * s, 0, 7); ctx.fill();
    } else if (prop.kind === 'umbrella') {
      const cols = ['#e5534b', '#f2c230', '#4e9fd9', '#5cb85c', '#e07fc0', '#f2803c'];
      ctx.fillStyle = cols[prop.c % cols.length];
      ctx.beginPath(); ctx.arc(x, y, 11 * z, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#8a6a42'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6 * z); ctx.stroke();
    } else if (prop.kind === 'towel') {
      const cols = ['#e5534b', '#4e9fd9', '#f2c230', '#5cb85c'];
      ctx.fillStyle = cols[prop.c % cols.length];
      ctx.fillRect(x - 8 * z, y - 4 * z, 16 * z, 8 * z);
    } else if (prop.kind === 'bench') {
      ctx.fillStyle = '#8a6a42'; ctx.fillRect(x - 9 * z, y - 3 * z, 18 * z, 5 * z);
    } else if (prop.kind === 'planter') {
      ctx.fillStyle = '#9a8f7a'; ctx.fillRect(x - 8 * z, y - 5 * z, 16 * z, 10 * z);
      ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x, y - 4 * z, 6 * z, 0, 7); ctx.fill();
    } else if (prop.kind === 'hydrant') {
      ctx.fillStyle = '#d23c2e'; ctx.fillRect(x - 2.6 * z, y - 6 * z, 5.2 * z, 8 * z);
    } else if (prop.kind === 'newsbox') {
      ctx.fillStyle = '#3366aa'; ctx.fillRect(x - 5 * z, y - 7 * z, 10 * z, 9 * z);
    } else if (prop.kind === 'busstop') {
      ctx.fillStyle = '#3c4046'; ctx.fillRect(x - 2 * z, y - 16 * z, 3 * z, 17 * z);
      ctx.fillStyle = '#f2c230'; ctx.fillRect(x - 8 * z, y - 17 * z, 15 * z, 6 * z);
    } else if (prop.kind === 'crate') {
      ctx.fillStyle = '#a5804f'; ctx.fillRect(x - 7 * z, y - 7 * z, 14 * z, 14 * z);
      ctx.strokeStyle = '#7a5c30'; ctx.strokeRect(x - 7 * z, y - 7 * z, 14 * z, 14 * z);
    } else if (prop.kind === 'barrel') {
      ctx.fillStyle = ['#7a8894', '#b0522f', '#3f6d8e', '#6d8e3f'][prop.c % 4];
      ctx.beginPath(); ctx.arc(x, y, 6 * z, 0, 7); ctx.fill();
    }
  }
}

function drawBuildings(ctx, world, toX, toY, z, view, phase) {
  const night = phase === 'night' || phase === 'dusk';
  const longShadow = phase === 'golden' || phase === 'dusk' || phase === 'dawn';
  const sox = longShadow ? 26 : 9, soy = longShadow ? 15 : 8;
  for (const b of world.buildings) {
    if (b.x + b.w < view.x0 || b.x > view.x1 || b.y + b.h < view.y0 || b.y > view.y1) continue;
    const x = toX(b.x), y = toY(b.y), w = b.w * z, h = b.h * z;
    ctx.fillStyle = 'rgba(20,16,8,0.30)';
    ctx.fillRect(x + sox * z, y + soy * z, w, h);
    ctx.fillStyle = b.hue;
    ctx.fillRect(x, y, w, h);
    // Roof inset + rooftop furniture.
    ctx.fillStyle = b.roof;
    ctx.fillRect(x + 7 * z, y + 7 * z, w - 14 * z, h - 14 * z);
    ctx.strokeStyle = 'rgba(60,48,32,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 7 * z, y + 7 * z, w - 14 * z, h - 14 * z);
    const seed = hash2(Math.round(b.x), Math.round(b.y));
    if (seed > 0.35) {
      ctx.fillStyle = 'rgba(70,72,78,0.85)';
      ctx.fillRect(x + w * (0.2 + seed * 0.4), y + h * 0.24, 16 * z, 11 * z);
    }
    if (seed > 0.62) {
      ctx.fillStyle = 'rgba(120,130,140,0.8)';
      ctx.beginPath(); ctx.arc(x + w * 0.7, y + h * 0.66, 7 * z, 0, 7); ctx.fill();
    }
    // Window grid — lit at night.
    const rows = Math.min(6, b.floors), cols = Math.max(2, Math.floor(b.w / 26));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = hash2(Math.round(b.x) + c * 3, Math.round(b.y) + r * 7) > 0.45;
      ctx.fillStyle = night ? (lit ? 'rgba(255,205,110,0.95)' : 'rgba(40,48,60,0.9)') : 'rgba(70,95,115,0.55)';
      ctx.fillRect(x + 10 * z + c * ((w - 18 * z) / cols), y + 10 * z + r * ((h - 18 * z) / Math.max(1, rows)), 7 * z, 5 * z);
    }
    // Storefront band + awning + sign plate.
    if (b.storefront) {
      ctx.fillStyle = 'rgba(30,34,40,0.9)';
      ctx.fillRect(x, y + h - 15 * z, w, 15 * z);
      ctx.fillStyle = ['#c94f43', '#3f7fb8', '#43a047', '#d9a03c'][Math.floor(seed * 4) % 4];
      ctx.beginPath();
      for (let s = 0; s < 6; s++) ctx.arc(x + (s + 0.5) * (w / 6), y + h - 15 * z, w / 12, 0, Math.PI);
      ctx.fill();
      if (b.sign) {
        ctx.fillStyle = 'rgba(12,14,18,0.92)';
        const label = b.sign;
        ctx.font = `bold ${Math.round(11 * z)}px system-ui`;
        const tw = ctx.measureText(label).width + 12 * z;
        ctx.fillRect(x + w / 2 - tw / 2, y + h - 34 * z, tw, 16 * z);
        ctx.fillStyle = '#ffd94d'; ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + h - 22 * z);
      }
    }
  }
}

function drawLandmarkMarkers(ctx, world, toX, toY, z, view, phase) {
  for (const lm of LANDMARKS) {
    if (lm.x < view.x0 || lm.x > view.x1 || lm.y < view.y0 || lm.y > view.y1) continue;
    const x = toX(lm.x), y = toY(lm.y);
    if (phase === 'night' || phase === 'dusk') {
      const g = ctx.createRadialGradient(x, y, 2, x, y, 60 * z);
      g.addColorStop(0, 'rgba(255,220,140,0.20)'); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 60 * z, 0, 7); ctx.fill();
    }
    ctx.fillStyle = lm.color;
    ctx.beginPath(); ctx.arc(x, y - 66 * z, 6 * z, 0, 7); ctx.fill();
    ctx.font = `bold ${Math.round(12 * z)}px system-ui`; ctx.textAlign = 'center';
    const label = lm.name.toUpperCase();
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(10,12,16,0.72)';
    ctx.fillRect(x - tw / 2 - 6, y - 62 * z, tw + 12, 17 * z);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, y - 49 * z);
  }
}

export function drawFigure(ctx, world, f, toX, toY, z, phase, opts) {
  const x = toX(f.x), y = toY(f.y);
  const bob = f.speed ? Math.sin(world.time * 11 + f.id * 2) * 1.4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 6 * z, 8 * z, 3.4 * z, 0, 0, 7); ctx.fill();
  // Legs + body + head, facing along f.angle.
  ctx.fillStyle = '#33383f';
  ctx.fillRect(x - 5 * z, y + 1 * z + bob * 0.3, 4 * z, 6 * z);
  ctx.fillRect(x + 1 * z, y + 1 * z - bob * 0.3, 4 * z, 6 * z);
  ctx.fillStyle = opts.player ? '#c33d2e' : f.color;
  ctx.beginPath(); ctx.roundRect(x - 5.4 * z, y - 8 * z + bob, 10.8 * z, 11 * z, 3 * z); ctx.fill();
  if (opts.cop) {
    ctx.fillStyle = '#d8dee6'; ctx.fillRect(x - 5.4 * z, y - 3 * z + bob, 10.8 * z, 3 * z);
  }
  ctx.fillStyle = f.skin || '#e8b98d';
  ctx.beginPath(); ctx.arc(x + Math.cos(f.angle || 0) * 2.4 * z, y - 11 * z + bob, 4.2 * z, 0, 7); ctx.fill();
  if (opts.cop) {
    ctx.fillStyle = '#1d3355';
    ctx.beginPath(); ctx.arc(x, y - 12.4 * z + bob, 4.4 * z, Math.PI, 0); ctx.fill();
  }
  if (f.armsUp) {
    ctx.strokeStyle = f.skin || '#e8b98d'; ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(x - 5 * z, y - 6 * z + bob); ctx.lineTo(x - 9 * z, y - 14 * z + bob);
    ctx.moveTo(x + 5 * z, y - 6 * z + bob); ctx.lineTo(x + 9 * z, y - 14 * z + bob);
    ctx.stroke();
  }
  if (f.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,210,90,0.95)';
    ctx.beginPath(); ctx.arc(x + Math.cos(f.angle) * 15 * z, y + Math.sin(f.angle) * 15 * z, 5 * z, 0, 7); ctx.fill();
  }
  if (opts.gang && f.maxHp) {
    const pips = Math.ceil((f.hp / f.maxHp) * 5);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < pips ? '#e33' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(x - 10 * z + i * 4.6 * z, y - 22 * z, 3.6 * z, 3 * z);
    }
  }
  if (opts.player) {
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 1.6 * z;
    ctx.beginPath(); ctx.arc(x, y - 3 * z, 13 * z, 0, 7); ctx.stroke();
  }
}

export function drawCar(ctx, world, car, sx, sy, z, phase) {
  const night = phase === 'night' || phase === 'dusk';
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  ctx.scale(z, z);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 5, car.w, car.h);
  // Headlight cones at night.
  if (night) {
    const g = ctx.createLinearGradient(car.w / 2, 0, car.w / 2 + 66, 0);
    g.addColorStop(0, 'rgba(255,240,190,0.30)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(car.w / 2, -7); ctx.lineTo(car.w / 2 + 66, -17); ctx.lineTo(car.w / 2 + 66, 17); ctx.lineTo(car.w / 2, 7);
    ctx.fill();
  }
  ctx.fillStyle = car.wrecked ? '#4a4a4a' : car.color;
  ctx.beginPath(); ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(15,15,20,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
  // Wheels.
  ctx.fillStyle = '#17181c';
  const ww = 8, wh = 4.6;
  ctx.fillRect(-car.w / 2 + 4, -car.h / 2 - 1.6, ww, wh);
  ctx.fillRect(car.w / 2 - 12, -car.h / 2 - 1.6, ww, wh);
  ctx.fillRect(-car.w / 2 + 4, car.h / 2 - 3, ww, wh);
  ctx.fillRect(car.w / 2 - 12, car.h / 2 - 3, ww, wh);
  // Cabin glass.
  ctx.fillStyle = 'rgba(28,42,56,0.92)';
  if (car.type === 'truck') {
    ctx.fillRect(car.w / 2 - 17, -car.h / 2 + 3, 11, car.h - 6);
    ctx.fillStyle = '#c8ccd2'; ctx.fillRect(-car.w / 2 + 2, -car.h / 2 + 2, car.w - 22, car.h - 4);
  } else if (car.type === 'van' || car.type === 'limo') {
    ctx.fillRect(-car.w / 2 + 8, -car.h / 2 + 3.4, car.w - 16, car.h - 6.8);
  } else {
    ctx.fillRect(-3, -car.h / 2 + 3, 15, car.h - 6);
    ctx.fillStyle = 'rgba(28,42,56,0.7)';
    ctx.fillRect(-car.w / 2 + 6, -car.h / 2 + 3.6, 6, car.h - 7.2);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(-6, -5, 13, 10);
    ctx.fillStyle = '#222'; ctx.font = 'bold 6.4px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0.5, 2.4);
  }
  if (car.police) {
    ctx.fillStyle = '#274b8f'; ctx.fillRect(-car.w / 2, -3.4, car.w, 6.8);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 6.8px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, 2.6);
    const flash = Math.sin(world.time * 11 + car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff4444' : '#3355ff';
    ctx.fillRect(-7, -4.6, 6, 9.2);
    ctx.fillStyle = flash ? '#3355ff' : '#ff4444';
    ctx.fillRect(1, -4.6, 6, 9.2);
  }
  if (car === world.player.car) {
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-car.w / 2 - 2.6, -car.h / 2 - 2.6, car.w + 5.2, car.h + 5.2, 6); ctx.stroke();
  }
  // Lights.
  ctx.fillStyle = night ? '#fff6c8' : '#e8e2c0';
  ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 2.4, 2.4, 4.4);
  ctx.fillRect(car.w / 2 - 2, car.h / 2 - 6.8, 2.4, 4.4);
  ctx.fillStyle = '#d23c2e';
  ctx.fillRect(-car.w / 2 - 0.4, -car.h / 2 + 2.4, 2.4, 4.4);
  ctx.fillRect(-car.w / 2 - 0.4, car.h / 2 - 6.8, 2.4, 4.4);
  ctx.restore();
  // Wreck smoke + fire.
  if (car.wrecked || car.smoke > 0) {
    const t = world.time * 2 + car.id;
    for (let i = 0; i < 3; i++) {
      const rise = ((t + i * 0.7) % 2.1);
      ctx.fillStyle = `rgba(70,70,70,${0.4 - rise * 0.16})`;
      ctx.beginPath(); ctx.arc(sx + Math.sin(t + i) * 5 * z, sy - rise * 17 * z, (5 + rise * 6) * z, 0, 7); ctx.fill();
    }
    if (car.smoke > 0.4) {
      ctx.fillStyle = 'rgba(255,130,30,0.85)';
      ctx.beginPath(); ctx.arc(sx, sy - 4 * z, (5 + Math.sin(world.time * 13) * 1.6) * z, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,60,0.9)';
      ctx.beginPath(); ctx.arc(sx, sy - 5 * z, 3 * z, 0, 7); ctx.fill();
    }
  }
  // Tire smoke wisps for the player's car when sliding fast.
  if (car === world.player.car && Math.abs(car.speed) > 200 && world.flags.sliding) {
    ctx.fillStyle = 'rgba(240,240,240,0.35)';
    ctx.beginPath(); ctx.arc(sx - Math.cos(car.angle) * 26 * z, sy - Math.sin(car.angle) * 26 * z, 8 * z, 0, 7); ctx.fill();
  }
}

function drawHeli(ctx, world, toX, toY, z, phase) {
  const h = world.heli;
  const x = toX(h.x), y = toY(h.y);
  const px = toX(world.player.x), py = toY(world.player.y);
  // Searchlight cone + pool on the player.
  const grad = ctx.createLinearGradient(x, y, px, py);
  grad.addColorStop(0, 'rgba(255,246,200,0.34)'); grad.addColorStop(1, 'rgba(255,246,200,0.10)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 16 * z, y); ctx.lineTo(x + 16 * z, y);
  ctx.lineTo(px + 46 * z, py + 20 * z); ctx.lineTo(px - 46 * z, py + 20 * z);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,248,205,0.30)';
  ctx.beginPath(); ctx.ellipse(px, py + 8 * z, 52 * z, 26 * z, 0, 0, 7); ctx.fill();
  // Ground shadow, then the airframe big.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(x + 26 * z, y + 30 * z, 30 * z, 11 * z, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(h.angle); ctx.scale(z * 1.5, z * 1.5);
  ctx.fillStyle = '#2c3540';
  ctx.beginPath(); ctx.ellipse(0, 0, 21, 9.6, 0, 0, 7); ctx.fill();
  ctx.fillRect(-34, -2.4, 20, 4.8);
  ctx.fillRect(-36, -7, 3.4, 14);
  ctx.fillStyle = '#9fd4e8';
  ctx.beginPath(); ctx.ellipse(9, 0, 8, 6.4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#eef1f4'; ctx.font = 'bold 6.6px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('AIR-1', -2, 2.4);
  const ra = h.rotor;
  ctx.strokeStyle = 'rgba(220,230,240,0.75)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * -24, Math.sin(ra) * -6); ctx.lineTo(Math.cos(ra) * 24, Math.sin(ra) * 6);
  ctx.moveTo(Math.cos(ra + Math.PI / 2) * -24, Math.sin(ra + Math.PI / 2) * -6); ctx.lineTo(Math.cos(ra + Math.PI / 2) * 24, Math.sin(ra + Math.PI / 2) * 6);
  ctx.stroke();
  ctx.restore();
}

function drawLighting(ctx, world, vw, vh, phase) {
  if (phase === 'golden') {
    ctx.fillStyle = 'rgba(255,150,50,0.15)'; ctx.fillRect(0, 0, vw, vh);
  } else if (phase === 'dusk') {
    ctx.fillStyle = 'rgba(90,50,110,0.20)'; ctx.fillRect(0, 0, vw, vh);
  } else if (phase === 'dawn') {
    ctx.fillStyle = 'rgba(255,180,120,0.10)'; ctx.fillRect(0, 0, vw, vh);
  } else if (phase === 'night') {
    ctx.fillStyle = 'rgba(8,12,40,0.34)'; ctx.fillRect(0, 0, vw, vh);
  }
  const w = weatherOf(world.weather);
  if (w.id === 'rain') {
    ctx.strokeStyle = 'rgba(190,220,255,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 173 + world.time * 640) % (vw + 60)) - 30;
      const ry = ((i * 257 + world.time * 880) % (vh + 40)) - 20;
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 13);
    }
    ctx.stroke();
  } else if (w.id === 'fog') {
    ctx.fillStyle = 'rgba(220,226,232,0.20)'; ctx.fillRect(0, 0, vw, vh);
  }
  // Vignette.
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.42, vw / 2, vh / 2, vh * 0.86);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
}

// ------------------------------------------- perspective scenes (round 16) ---
// The "camera round": the two staged gameplay shots are drawn through a
// perspective camera instead of the top-down world view. The engine,
// logic and HUD are untouched — this is a second renderer for the
// screenshot staging path (world.flags.scene), projecting the same
// staged world state (player car, cops, roadblock, heli, gang, peds)
// into a chase-cam / ground-level frame in our own drawn style.

const SCENE_HOR = 274; // horizon at ~38% of the 720px frame

// Ground projector for the east-facing chase camera: d = metres ahead
// of the camera, l = lateral offset (+ = south, the frame's right).
function projGround(d, l, cx) {
  const s = 175 / (175 + Math.max(0, d));
  return { x: cx + l * 3.4 * s, y: SCENE_HOR + (VIEW_H - SCENE_HOR) * s, s };
}

function shadowBlob(ctx, x, y, w, len) {
  ctx.fillStyle = 'rgba(24,10,4,0.34)';
  ctx.beginPath(); ctx.ellipse(x - w * 0.34, y + len * 0.24, w * 0.72, len, 0.35, 0, 7); ctx.fill();
}

// Rear 3/4 car: rear panel, roof shifted for the three-quarter read,
// spoiler, light bar / taillights, reflections. Used for the hero,
// the flankers, roadblock cars and projected traffic alike.
function drawCarRear(ctx, x, groundY, w, opts) {
  const h = w * 0.60;
  const top = groundY - h;
  shadowBlob(ctx, x, groundY, w * 0.55, h * 0.16);
  // Side sliver (the visible flank, right side) + main rear panel.
  ctx.fillStyle = opts.color;
  ctx.beginPath(); ctx.roundRect(x - w / 2, top + h * 0.16, w, h * 0.84, w * 0.07); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.30, top + h * 0.20); ctx.lineTo(x + w * 0.52, top + h * 0.34);
  ctx.lineTo(x + w * 0.52, top + h * 0.92); ctx.lineTo(x + w * 0.30, top + h * 0.97);
  ctx.closePath(); ctx.fill();
  // Roof + rear glass, offset up-left for the 3/4 stance.
  ctx.fillStyle = opts.color;
  ctx.beginPath(); ctx.roundRect(x - w * 0.36, top, w * 0.66, h * 0.34, w * 0.06); ctx.fill();
  ctx.fillStyle = 'rgba(22,34,48,0.95)';
  ctx.beginPath(); ctx.roundRect(x - w * 0.31, top + h * 0.07, w * 0.56, h * 0.20, w * 0.04); ctx.fill();
  ctx.fillStyle = 'rgba(190,225,255,0.35)';
  ctx.fillRect(x - w * 0.26, top + h * 0.10, w * 0.20, h * 0.05);
  // Spoiler on two struts.
  ctx.fillStyle = 'rgba(18,18,22,0.9)';
  ctx.fillRect(x - w * 0.30, top + h * 0.30, w * 0.05, h * 0.12);
  ctx.fillRect(x + w * 0.22, top + h * 0.30, w * 0.05, h * 0.12);
  ctx.beginPath(); ctx.roundRect(x - w * 0.44, top + h * 0.24, w * 0.88, h * 0.075, w * 0.03); ctx.fill();
  // Rear light bar + plate + bumper + exhausts + wheels.
  ctx.fillStyle = '#d23c2e';
  ctx.fillRect(x - w * 0.44, top + h * 0.52, w * 0.88, h * 0.085);
  ctx.fillStyle = 'rgba(255,120,110,0.85)';
  ctx.fillRect(x - w * 0.44, top + h * 0.52, w * 0.88, h * 0.028);
  ctx.fillStyle = '#eef1f4';
  ctx.beginPath(); ctx.roundRect(x - w * 0.13, top + h * 0.66, w * 0.26, h * 0.15, 2); ctx.fill();
  ctx.fillStyle = '#22262c'; ctx.font = `bold ${Math.round(h * 0.11)}px system-ui`; ctx.textAlign = 'center';
  ctx.fillText(opts.police ? 'SCPD' : 'SOLMAR', x, top + h * 0.775);
  ctx.fillStyle = 'rgba(12,12,16,0.85)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, top + h * 0.88, w, h * 0.12, w * 0.04); ctx.fill();
  ctx.fillStyle = '#c8ccd2';
  ctx.beginPath(); ctx.arc(x - w * 0.30, top + h * 0.90, w * 0.035, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.30, top + h * 0.90, w * 0.035, 0, 7); ctx.fill();
  ctx.fillStyle = '#101114';
  ctx.beginPath(); ctx.roundRect(x - w * 0.52, top + h * 0.78, w * 0.11, h * 0.22, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x + w * 0.41, top + h * 0.78, w * 0.11, h * 0.22, 3); ctx.fill();
  if (opts.police) {
    // White/blue livery band + roof light bar with a live flash.
    ctx.fillStyle = '#274b8f';
    ctx.fillRect(x - w * 0.5, top + h * 0.36, w, h * 0.13);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(h * 0.115)}px system-ui`;
    ctx.fillText('SCPD', x, top + h * 0.465);
    const flash = Math.sin(opts.time * 11 + x) > 0;
    ctx.fillStyle = flash ? '#ff4444' : '#3355ff';
    ctx.beginPath(); ctx.roundRect(x - w * 0.20, top - h * 0.075, w * 0.19, h * 0.085, 3); ctx.fill();
    ctx.fillStyle = flash ? '#3355ff' : '#ff4444';
    ctx.beginPath(); ctx.roundRect(x + w * 0.01, top - h * 0.075, w * 0.19, h * 0.085, 3); ctx.fill();
    const glow = ctx.createRadialGradient(x, top, 4, x, top, w * 0.5);
    glow.addColorStop(0, flash ? 'rgba(255,80,80,0.30)' : 'rgba(90,120,255,0.30)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - w * 0.5, top - w * 0.5, w, w);
  }
  ctx.textAlign = 'left';
}

// A standing figure in perspective: legs, torso, head, optional arms-up
// / crouch / muzzle. h is the full standing height in pixels.
function drawFigurePersp(ctx, x, groundY, h, color, opts) {
  const o = opts || {};
  const crouch = o.crouch ? 0.72 : 1;
  const hh = h * crouch;
  const top = groundY - hh;
  shadowBlob(ctx, x, groundY, h * 0.20, h * 0.05);
  ctx.fillStyle = '#2c3036';
  ctx.fillRect(x - h * 0.085, groundY - hh * 0.34, h * 0.065, hh * 0.34);
  ctx.fillRect(x + h * 0.02, groundY - hh * 0.34, h * 0.065, hh * 0.34);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - h * 0.13, top + hh * 0.22, h * 0.26, hh * 0.46, h * 0.05); ctx.fill();
  ctx.fillStyle = o.skin || '#e8b98d';
  ctx.beginPath(); ctx.arc(x, top + hh * 0.11, h * 0.085, 0, 7); ctx.fill();
  if (o.cop) {
    ctx.fillStyle = '#1d3355';
    ctx.beginPath(); ctx.arc(x, top + hh * 0.075, h * 0.09, Math.PI, 0); ctx.fill();
  }
  if (o.armsUp) {
    ctx.strokeStyle = o.skin || '#e8b98d'; ctx.lineWidth = Math.max(1.6, h * 0.028);
    ctx.beginPath();
    ctx.moveTo(x - h * 0.11, top + hh * 0.30); ctx.lineTo(x - h * 0.22, top + hh * 0.02);
    ctx.moveTo(x + h * 0.11, top + hh * 0.30); ctx.lineTo(x + h * 0.22, top + hh * 0.02);
    ctx.stroke();
  }
  if (o.muzzle) {
    ctx.fillStyle = 'rgba(255,214,100,0.95)';
    ctx.beginPath(); ctx.arc(x + h * 0.30, top + hh * 0.34, h * 0.07, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,0.55)';
    ctx.beginPath(); ctx.arc(x + h * 0.30, top + hh * 0.34, h * 0.13, 0, 7); ctx.fill();
  }
  if (o.pips !== undefined && o.maxHp) {
    const n = Math.ceil((o.pips / o.maxHp) * 5);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < n ? '#e33' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(x - h * 0.13 + i * h * 0.058, top - h * 0.055, h * 0.046, h * 0.032);
    }
  }
}

function drawSkylineSilhouette(ctx, vw, baseY, color, seedBase, minH, maxH) {
  ctx.fillStyle = color;
  let x = -20;
  let i = 0;
  while (x < vw + 20) {
    const wdt = 46 + hash2(seedBase + i * 3, seedBase) * 90;
    const hgt = minH + hash2(seedBase, i * 7) * (maxH - minH);
    ctx.fillRect(x, baseY - hgt, wdt, hgt);
    if (hash2(i * 13, seedBase) > 0.6) ctx.fillRect(x + wdt * 0.3, baseY - hgt - 12, wdt * 0.24, 12);
    x += wdt + 6 + hash2(i, seedBase * 2) * 26;
    i += 1;
  }
}

function drawFacadeRow(ctx, world, cx, side) {
  // Depth-sorted street facades: far segments first, near ones last.
  const hues = ['#e8dcc4', '#dcc7a8', '#cfe0e4', '#e4c9b8', '#d8d2e8'];
  const signs = side < 0
    ? { 1: 'CAFE SOLMAR', 3: 'MARINA PAWN' }
    : { 1: 'HOTEL PALMS', 4: 'SURF & RENT' };
  for (let i = 7; i >= 0; i--) {
    const d0 = i * 85, d1 = d0 + 82;
    const a = projGround(d0, side * 182, cx), b = projGround(d1, side * 182, cx);
    const hgt = (120 + hash2(i * 7, side * 31) * 190) * ((a.s + b.s) / 2);
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    const baseY = Math.max(a.y, b.y);
    ctx.fillStyle = hues[Math.floor(hash2(i * 3, side * 17) * 5) % 5];
    ctx.fillRect(x0, baseY - hgt, x1 - x0, hgt);
    ctx.fillStyle = 'rgba(70,50,30,0.35)';
    ctx.fillRect(x0, baseY - hgt, x1 - x0, 4);
    // Lit windows, denser on the near segments.
    const cols = Math.max(2, Math.floor((x1 - x0) / 17));
    const rows = Math.max(2, Math.floor(hgt / 24));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = hash2(i * 41 + c * 3, r * 7 + (side < 0 ? 1 : 2)) > 0.42;
      ctx.fillStyle = lit ? 'rgba(255,205,110,0.92)' : 'rgba(52,60,74,0.85)';
      ctx.fillRect(x0 + 5 + c * ((x1 - x0 - 9) / cols), baseY - hgt + 8 + r * ((hgt - 14) / rows), 7, 5);
    }
    // Ground-floor storefront + a readable sign on picked segments.
    ctx.fillStyle = 'rgba(28,32,38,0.92)';
    const shopH = Math.max(10, 34 * a.s);
    ctx.fillRect(x0, baseY - shopH, x1 - x0, shopH);
    if (signs[i] && x1 - x0 > 44) {
      const label = signs[i];
      ctx.font = `bold ${Math.max(9, Math.round(21 * a.s))}px system-ui`;
      const tw = ctx.measureText(label).width + 12;
      const sx = (x0 + x1) / 2, sy = baseY - shopH - Math.max(12, 20 * a.s);
      ctx.fillStyle = 'rgba(10,12,16,0.94)';
      ctx.fillRect(sx - tw / 2, sy - Math.max(11, 17 * a.s), tw, Math.max(15, 23 * a.s));
      ctx.fillStyle = '#ffd94d'; ctx.textAlign = 'center';
      ctx.fillText(label, sx, sy);
      ctx.textAlign = 'left';
    }
  }
}

function drawChaseScene(ctx, world, vw, vh) {
  const p = world.player;
  const cx = vw / 2 - 30;               // vanishing point, a touch left
  const camX = p.x - 90;                // camera rides 90 units behind Rex
  const phase = skyPhase(world.weather.clock);
  void phase;
  // Golden-hour sky + sun glow + far skyline.
  const sky = ctx.createLinearGradient(0, 0, 0, SCENE_HOR + 30);
  sky.addColorStop(0, '#31205c'); sky.addColorStop(0.45, '#a03d63');
  sky.addColorStop(0.78, '#ff8a3c'); sky.addColorStop(1, '#ffd94d');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, SCENE_HOR + 2);
  const sun = ctx.createRadialGradient(cx + 330, SCENE_HOR - 26, 8, cx + 330, SCENE_HOR - 26, 240);
  sun.addColorStop(0, 'rgba(255,236,170,0.95)'); sun.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, vw, SCENE_HOR + 2);
  drawSkylineSilhouette(ctx, vw, SCENE_HOR, 'rgba(70,36,84,0.75)', 5, 34, 96);
  // The Solmar skywheel, a landmark silhouette left of the vanishing point.
  const wx = cx - 348, wy = SCENE_HOR - 64;
  ctx.strokeStyle = 'rgba(38,20,58,0.9)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(wx, wy, 62, 0, 7); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * 62, wy + Math.sin(a) * 62); ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,120,0.9)';
    ctx.beginPath(); ctx.arc(wx + Math.cos(a) * 62, wy + Math.sin(a) * 62, 3.4, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(38,20,58,0.9)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(wx - 26, SCENE_HOR); ctx.lineTo(wx, wy + 18); ctx.lineTo(wx + 26, SCENE_HOR); ctx.stroke();
  // Ground base, then the beach + water wedge on the right third.
  ctx.fillStyle = '#8d7a52'; ctx.fillRect(0, SCENE_HOR, vw, vh - SCENE_HOR);
  const sandNear = projGround(0, 96, cx), sandFar = projGround(680, 96, cx);
  ctx.fillStyle = '#ecd9a0';
  ctx.beginPath();
  ctx.moveTo(sandFar.x, SCENE_HOR); ctx.lineTo(vw, SCENE_HOR); ctx.lineTo(vw, vh); ctx.lineTo(sandNear.x + 130, vh);
  ctx.closePath(); ctx.fill();
  const water = ctx.createLinearGradient(900, 0, vw, 0);
  water.addColorStop(0, '#3f8ea6'); water.addColorStop(1, '#1d5d7a');
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.moveTo(sandFar.x + 128, SCENE_HOR); ctx.lineTo(vw, SCENE_HOR); ctx.lineTo(vw, vh); ctx.lineTo(sandNear.x + 300, vh);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const d = 40 + i * 55, pr = projGround(d, 250 + (i % 3) * 40, cx);
    ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 22 * pr.s + 6, pr.y);
  }
  ctx.stroke();
  // Sidewalks + the converging road.
  for (const side of [-1, 1]) {
    const n0 = projGround(0, side * 66, cx), n1 = projGround(0, side * 178, cx);
    const f0 = projGround(680, side * 66, cx), f1 = projGround(680, side * 178, cx);
    ctx.fillStyle = '#c9c2ae';
    ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineTo(n1.x, n1.y); ctx.closePath(); ctx.fill();
  }
  const rN = projGround(0, -62, cx), rN2 = projGround(0, 62, cx);
  const rF = projGround(680, -62, cx), rF2 = projGround(680, 62, cx);
  ctx.fillStyle = '#4c525b';
  ctx.beginPath(); ctx.moveTo(rN.x, rN.y); ctx.lineTo(rF.x, rF.y); ctx.lineTo(rF2.x, rF2.y); ctx.lineTo(rN2.x, rN2.y); ctx.closePath(); ctx.fill();
  // Lane dashes that shrink with depth + edge lines.
  ctx.fillStyle = 'rgba(240,230,160,0.75)';
  for (let d = 26; d < 660; d += 46) {
    const a = projGround(d, 0, cx), b = projGround(d + 20, 0, cx);
    ctx.beginPath();
    ctx.moveTo(a.x - 3.2 * a.s * 3, a.y); ctx.lineTo(b.x - 3.2 * b.s * 3, b.y);
    ctx.lineTo(b.x + 3.2 * b.s * 3, b.y); ctx.lineTo(a.x + 3.2 * a.s * 3, a.y);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    const a = projGround(0, side * 58, cx), b = projGround(680, side * 58, cx);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  drawFacadeRow(ctx, world, cx, -1);
  drawFacadeRow(ctx, world, cx, 1);
  // Palms marching down both sidewalks.
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const d = 60 + i * 108 + (side > 0 ? 40 : 0);
    const pr = projGround(d, side * 148, cx);
    const ph = 128 * pr.s;
    ctx.strokeStyle = '#7a5c38'; ctx.lineWidth = Math.max(1.4, 5 * pr.s);
    ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.quadraticCurveTo(pr.x + 5 * pr.s, pr.y - ph * 0.6, pr.x + 10 * pr.s, pr.y - ph); ctx.stroke();
    ctx.strokeStyle = '#2f7d3c'; ctx.lineWidth = Math.max(1.2, 3.4 * pr.s);
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI - Math.PI * 0.95;
      ctx.beginPath(); ctx.moveTo(pr.x + 10 * pr.s, pr.y - ph);
      ctx.quadraticCurveTo(pr.x + 10 * pr.s + Math.cos(a) * 15 * pr.s, pr.y - ph + Math.sin(a) * 6 * pr.s - 3, pr.x + 10 * pr.s + Math.cos(a) * 24 * pr.s, pr.y - ph + Math.sin(a) * 12 * pr.s + 5 * pr.s);
      ctx.stroke();
    }
  }
  // Beach life: umbrellas, towels and a lifeguard stand on the sand.
  for (let i = 0; i < 4; i++) {
    const pr = projGround(120 + i * 130, 150 + (i % 2) * 46, cx);
    const cols = ['#e5534b', '#f2c230', '#4e9fd9', '#5cb85c'];
    ctx.fillStyle = cols[i % 4];
    ctx.beginPath(); ctx.arc(pr.x, pr.y - 16 * pr.s, 17 * pr.s + 3, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(pr.x, pr.y - 16 * pr.s); ctx.lineTo(pr.x, pr.y); ctx.stroke();
    ctx.fillStyle = cols[(i + 1) % 4];
    ctx.fillRect(pr.x + 12 * pr.s, pr.y - 3, 20 * pr.s + 4, 6 * pr.s + 2);
  }
  const lg = projGround(215, 196, cx);
  ctx.fillStyle = '#e8e3d8';
  ctx.fillRect(lg.x - 4, lg.y - 44 * lg.s, 8, 44 * lg.s);
  ctx.fillRect(lg.x - 15 * lg.s, lg.y - 52 * lg.s, 30 * lg.s + 6, 12 * lg.s + 3);
  ctx.fillStyle = '#d23c2e'; ctx.fillRect(lg.x - 15 * lg.s, lg.y - 52 * lg.s, 30 * lg.s + 6, 4);
  // World-driven actors, far to near: traffic, wreck, roadblock, peds.
  const actors = [];
  for (const car of world.cars) {
    if (car === p.car || car.police) continue;
    const d = car.x - camX, l = car.y - p.y;
    if (d > 240 && d < 660 && Math.abs(l) < 80) actors.push({ kind: 'car', d, l, car });
    if (car.wrecked && d > 120 && d < 660) actors.push({ kind: 'wreck', d, l, car });
  }
  for (const ped of world.peds) {
    const d = ped.x - camX, l = ped.y - p.y;
    if (d > 30 && d < 660 && Math.abs(l) > 58 && Math.abs(l) < 250) actors.push({ kind: 'ped', d, l, ped });
  }
  actors.sort((a, b) => b.d - a.d);
  for (const a of actors) {
    const pr = projGround(a.d, a.l, cx);
    if (a.kind === 'car') {
      drawCarRear(ctx, pr.x, pr.y, 400 * pr.s, { color: a.car.color, time: world.time });
      ctx.fillStyle = 'rgba(255,246,200,0.9)';
      ctx.fillRect(pr.x - 170 * pr.s, pr.y - 60 * pr.s, 16 * pr.s + 2, 8 * pr.s + 2);
      ctx.fillRect(pr.x + 154 * pr.s, pr.y - 60 * pr.s, 16 * pr.s + 2, 8 * pr.s + 2);
    } else if (a.kind === 'wreck') {
      drawCarRear(ctx, pr.x, pr.y, 380 * pr.s, { color: '#4a4a4a', time: world.time });
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(70,70,70,${0.42 - i * 0.1})`;
        ctx.beginPath(); ctx.arc(pr.x + Math.sin(i * 2.1) * 8, pr.y - 60 * pr.s - i * 22 * pr.s, (10 + i * 7) * pr.s + 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,130,30,0.9)';
      ctx.beginPath(); ctx.arc(pr.x, pr.y - 34 * pr.s, 9 * pr.s + 2, 0, 7); ctx.fill();
    } else {
      drawFigurePersp(ctx, pr.x, pr.y, 158 * pr.s, a.ped.color, { skin: a.ped.skin, armsUp: a.ped.armsUp });
    }
  }
  // Roadblock + spike strip at the focal point.
  if (world.roadblock) {
    const dRb = world.roadblock.x - camX;
    const pr = projGround(dRb, world.roadblock.y - p.y, cx);
    const roadHalf = 62 * 3.4 * pr.s;
    const spike = projGround(dRb - 26, 0, cx);
    ctx.fillStyle = '#22242a';
    ctx.fillRect(spike.x - roadHalf * 0.92, spike.y - 3, roadHalf * 1.84, 5);
    ctx.fillStyle = '#d8dde6';
    for (let i = 0; i < 12; i++) {
      const sxp = spike.x - roadHalf * 0.88 + i * (roadHalf * 1.76 / 12);
      ctx.beginPath(); ctx.moveTo(sxp, spike.y - 3); ctx.lineTo(sxp + 3.4, spike.y - 9 * pr.s - 2); ctx.lineTo(sxp + 6.8, spike.y - 3); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e33';
    ctx.fillRect(pr.x - roadHalf, pr.y - 26 * pr.s - 6, roadHalf * 2, 9 * pr.s + 4);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) ctx.fillRect(pr.x - roadHalf + i * (roadHalf * 2 / 7) + 3, pr.y - 26 * pr.s - 6, roadHalf * 2 / 14, 9 * pr.s + 4);
    drawCarRear(ctx, pr.x - roadHalf * 1.04, pr.y, 300 * pr.s, { color: '#eef1f4', police: true, time: world.time });
    drawCarRear(ctx, pr.x + roadHalf * 1.04, pr.y, 300 * pr.s, { color: '#eef1f4', police: true, time: world.time });
  }
  // AIR-1 top-centre: wide spotlight cone pooling ahead of the hero.
  const pool = projGround(228, 4, cx);
  ctx.fillStyle = 'rgba(255,248,205,0.30)';
  ctx.beginPath(); ctx.ellipse(pool.x, pool.y, 128, 27, 0, 0, 7); ctx.fill();
  const heliX = cx + 46, heliY = 118;
  const cone = ctx.createLinearGradient(heliX, heliY, pool.x, pool.y);
  cone.addColorStop(0, 'rgba(255,246,200,0.34)'); cone.addColorStop(1, 'rgba(255,246,200,0.08)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(heliX - 17, heliY + 8); ctx.lineTo(heliX + 17, heliY + 8);
  ctx.lineTo(pool.x + 118, pool.y + 12); ctx.lineTo(pool.x - 118, pool.y + 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(heliX + 30, heliY + 44, 44, 12, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(heliX, heliY); ctx.rotate(0.06);
  ctx.fillStyle = '#2c3540';
  ctx.beginPath(); ctx.ellipse(0, 0, 56, 24, 0, 0, 7); ctx.fill();
  ctx.fillRect(-92, -6, 44, 12); ctx.fillRect(-96, -17, 8, 34);
  ctx.fillStyle = '#9fd4e8';
  ctx.beginPath(); ctx.ellipse(30, -2, 17, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#eef1f4'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('AIR-1', -22, 6);
  ctx.strokeStyle = 'rgba(220,230,240,0.8)'; ctx.lineWidth = 3;
  const ra = world.heli ? world.heli.rotor : 0.7;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * -62, Math.sin(ra) * -13); ctx.lineTo(Math.cos(ra) * 62, Math.sin(ra) * 13);
  ctx.moveTo(Math.cos(ra + Math.PI / 2) * -62, Math.sin(ra + Math.PI / 2) * -13); ctx.lineTo(Math.cos(ra + Math.PI / 2) * 62, Math.sin(ra + Math.PI / 2) * 13);
  ctx.stroke();
  ctx.restore();
  // The two flanking cruisers at ~55% of the hero's scale.
  const flankL = projGround(38, -104, cx), flankR = projGround(38, 104, cx);
  drawCarRear(ctx, flankL.x, flankL.y + 26, 138, { color: '#eef1f4', police: true, time: world.time });
  drawCarRear(ctx, flankR.x, flankR.y + 26, 138, { color: '#eef1f4', police: true, time: world.time });
  // Hero Vento, rear 3/4, low-centre at ~28% of frame height.
  const hero = projGround(96, -6, cx);
  drawCarRear(ctx, hero.x, hero.y + 118, 252, { color: '#e8b13c', time: world.time });
  ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const ly = 330 + i * 74;
    ctx.beginPath(); ctx.moveTo(6, ly); ctx.lineTo(120 - i * 14, ly + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vw - 6, ly + 30); ctx.lineTo(vw - 104 + i * 10, ly + 38); ctx.stroke();
  }
  drawLighting(ctx, world, vw, vh, 'golden');
}

function drawVaultScene(ctx, world, vw, vh) {
  const bank = { x: 1800, y: 1800 };
  const ringCx = 640, ringCy = 566;
  const mapX = (wx) => ringCx + (wx - bank.x) * 2.9;
  const mapY = (wy) => 560 + (wy - bank.y) * 0.95;
  // Night sky + side silhouettes.
  const sky = ctx.createLinearGradient(0, 0, 0, 470);
  sky.addColorStop(0, '#070b18'); sky.addColorStop(1, '#1a2745');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, vh);
  drawSkylineSilhouette(ctx, vw, 300, 'rgba(16,22,38,0.9)', 11, 60, 190);
  // Solmar National Bank facade filling the background.
  const fx0 = 252, fx1 = 1028, fTop = 62, fBase = 452;
  ctx.fillStyle = '#3d4658'; ctx.fillRect(fx0, fTop, fx1 - fx0, fBase - fTop);
  ctx.fillStyle = '#4c586e'; ctx.fillRect(fx0, fTop, fx1 - fx0, 34);
  ctx.fillStyle = 'rgba(12,14,18,0.92)';
  ctx.fillRect(ringCx - 218, fTop + 8, 436, 40);
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 25px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('SOLMAR NATIONAL BANK', ringCx, fTop + 36);
  ctx.textAlign = 'left';
  for (let i = 0; i < 6; i++) {
    const colX = fx0 + 58 + i * ((fx1 - fx0 - 116) / 5);
    ctx.fillStyle = '#5d6b82'; ctx.fillRect(colX - 15, fTop + 108, 30, fBase - fTop - 132);
    ctx.fillStyle = '#71809a'; ctx.fillRect(colX - 19, fTop + 100, 38, 10);
    ctx.fillRect(colX - 19, fBase - 34, 38, 10);
  }
  // Lit windows on the facade wings.
  for (let r = 0; r < 3; r++) for (let c = 0; c < 16; c++) {
    if (c > 6 && c < 9) continue;
    const lit = hash2(c * 3, r * 7 + 4) > 0.4;
    ctx.fillStyle = lit ? 'rgba(255,205,110,0.92)' : 'rgba(30,38,52,0.9)';
    ctx.fillRect(fx0 + 26 + c * ((fx1 - fx0 - 52) / 16), fTop + 58 + r * 15, 16, 8);
  }
  // Glowing doors + steps down to the street.
  ctx.fillStyle = 'rgba(255,214,130,0.95)';
  ctx.fillRect(ringCx - 44, fBase - 96, 88, 72);
  ctx.fillStyle = 'rgba(120,80,30,0.9)';
  ctx.fillRect(ringCx - 3, fBase - 96, 6, 72);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#39424f' : '#454f61';
    ctx.fillRect(fx0 + 90 - i * 16, fBase - 24 + i * 7, (fx1 - fx0) - 180 + i * 32, 7);
  }
  // Street plane with perspective fan lines.
  ctx.fillStyle = '#232830'; ctx.fillRect(0, fBase, vw, vh - fBase);
  ctx.strokeStyle = 'rgba(200,210,225,0.13)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -6; i <= 6; i++) { ctx.moveTo(ringCx + i * 26, fBase); ctx.lineTo(ringCx + i * 150, vh); }
  ctx.stroke();
  // AIR-1 cone from the top edge, pooling on the ring. The airframe
  // sits right of the mission plate so its label stays readable.
  ctx.fillStyle = 'rgba(255,248,205,0.20)';
  ctx.beginPath(); ctx.ellipse(ringCx + 60, ringCy - 22, 168, 36, 0, 0, 7); ctx.fill();
  const cone = ctx.createLinearGradient(1064, 30, ringCx + 60, ringCy);
  cone.addColorStop(0, 'rgba(255,246,200,0.30)'); cone.addColorStop(1, 'rgba(255,246,200,0.05)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(1046, 44); ctx.lineTo(1082, 44);
  ctx.lineTo(ringCx + 60 + 158, ringCy - 8); ctx.lineTo(ringCx + 60 - 158, ringCy - 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2c3540';
  ctx.beginPath(); ctx.ellipse(1064, 36, 40, 15, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#eef1f4'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('AIR-1', 1064, 40); ctx.textAlign = 'left';
  // The vault hold ring as a ground ellipse, 70% arc lit.
  ctx.strokeStyle = 'rgba(57,231,95,0.32)'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.ellipse(ringCx, ringCy, 305, 80, 0, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#39e75f'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.ellipse(ringCx, ringCy, 305, 80, 0, -Math.PI / 2, -Math.PI / 2 + 0.7 * Math.PI * 2); ctx.stroke();
  // Planters with crouched civilians at mid-depth.
  for (const px of [196, 1084]) {
    ctx.fillStyle = '#9a8f7a'; ctx.fillRect(px - 52, 496, 104, 30);
    ctx.fillStyle = '#2f7d3c';
    ctx.beginPath(); ctx.ellipse(px, 494, 52, 13, 0, 0, 7); ctx.fill();
    drawFigurePersp(ctx, px - 24, 500, 74, '#d96f4e', { crouch: true, armsUp: true });
    drawFigurePersp(ctx, px + 26, 502, 70, '#4e79d9', { crouch: true });
  }
  // Civilians from the staged crowd, mapped around the bank.
  for (const ped of world.peds) {
    const sx = mapX(ped.x), sy = mapY(ped.y);
    if (sx < 60 || sx > vw - 60 || sy < 470 || sy > 668) continue;
    if (Math.abs(sx - ringCx) < 330 && Math.abs(sy - ringCy) < 95) continue;
    drawFigurePersp(ctx, sx, sy, 64, ped.color, { skin: ped.skin, armsUp: ped.armsUp, crouch: ped.flee });
  }
  // Vipers around the ring at depth-scaled sizes, pips + muzzles.
  for (const g of world.gang) {
    const sx = mapX(g.x), sy = mapY(g.y);
    const h = Math.max(62, Math.min(132, 100 + (g.y - bank.y) * 0.55));
    drawFigurePersp(ctx, sx, sy, h, g.color, { skin: g.skin, muzzle: g.muzzle > 0, pips: g.hp, maxHp: g.maxHp });
  }
  // Foot cops advancing at the edges.
  for (const fc of world.footCops || []) {
    drawFigurePersp(ctx, mapX(fc.x), mapY(fc.y) + 6, 96, '#274b8f', { cop: true });
  }
  // Cruisers at both frame edges, light bars live.
  drawCarRear(ctx, 128, 596, 196, { color: '#eef1f4', police: true, time: world.time });
  drawCarRear(ctx, 1152, 596, 196, { color: '#eef1f4', police: true, time: world.time });
  // Cash bags at the ring's near edge.
  if (world.flags.cashBags) {
    for (const bag of world.flags.cashBags) {
      const sx = mapX(bag.x), sy = mapY(bag.y) + 34;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(sx + 4, sy + 4, 24, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5d7a3a';
      ctx.beginPath(); ctx.ellipse(sx, sy, 25, 19, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#dff2c8'; ctx.font = 'bold 19px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('$', sx, sy + 7); ctx.textAlign = 'left';
    }
  }
  // Tracers from the staged bullets, mapped through the same plane.
  for (const b of world.bullets) {
    ctx.strokeStyle = 'rgba(255,190,60,0.4)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(mapX(b.x - b.vx * 0.045), mapY(b.y - b.vy * 0.045)); ctx.lineTo(mapX(b.x), mapY(b.y)); ctx.stroke();
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(mapX(b.x - b.vx * 0.045), mapY(b.y - b.vy * 0.045)); ctx.lineTo(mapX(b.x), mapY(b.y)); ctx.stroke();
  }
  // Rex, over-shoulder: big in the lower-centre-left, Viper raised.
  const rexX = 408, rexBase = 706, rexH = 224;
  shadowBlob(ctx, rexX, rexBase, 92, 13);
  ctx.fillStyle = '#26262b';
  ctx.fillRect(rexX - 44, rexBase - 74, 30, 74);
  ctx.fillRect(rexX + 16, rexBase - 74, 30, 74);
  ctx.fillStyle = '#c33d2e';
  ctx.beginPath(); ctx.roundRect(rexX - 62, rexBase - rexH + 52, 124, 128, 16); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.roundRect(rexX - 62, rexBase - rexH + 52, 40, 128, 16); ctx.fill();
  ctx.fillStyle = '#e8b98d';
  ctx.beginPath(); ctx.arc(rexX, rexBase - rexH + 30, 27, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a2019';
  ctx.beginPath(); ctx.arc(rexX, rexBase - rexH + 22, 27, Math.PI, 0); ctx.fill();
  // Raised right arm + Viper, angled up toward the bank steps.
  ctx.strokeStyle = '#c33d2e'; ctx.lineWidth = 21;
  ctx.beginPath(); ctx.moveTo(rexX + 48, rexBase - rexH + 84); ctx.lineTo(rexX + 108, rexBase - rexH + 52); ctx.stroke();
  ctx.strokeStyle = '#17181c'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(rexX + 100, rexBase - rexH + 55); ctx.lineTo(rexX + 196, rexBase - rexH + 22); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(rexX + 150, rexBase - rexH + 38); ctx.lineTo(rexX + 158, rexBase - rexH + 58); ctx.stroke();
  // Muzzle flash + tracer streaks toward the steps.
  const mxp = rexX + 202, myp = rexBase - rexH + 20;
  ctx.fillStyle = 'rgba(255,214,100,0.95)';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 9 : 21;
    const pxp = mxp + Math.cos(a) * r, pyp = myp + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(pxp, pyp); else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,60,0.45)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(mxp, myp); ctx.lineTo(742, 428); ctx.stroke();
  ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(mxp, myp); ctx.lineTo(742, 428); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mxp, myp + 6); ctx.lineTo(690, 446); ctx.stroke();
  drawLighting(ctx, world, vw, vh, 'night');
}

// Screenshot staging dispatcher: perspective for the two gameplay
// shots, the classic top-down world for everything else.
export function drawScene(ctx, world, cam, vw, vh) {
  if (world.flags.scene === 'chase') { drawChaseScene(ctx, world, vw, vh); return; }
  if (world.flags.scene === 'vault') { drawVaultScene(ctx, world, vw, vh); return; }
  drawWorld(ctx, world, cam, vw, vh);
}

// ------------------------------------------------------------------ HUD ---

export function drawHUD(ctx, world, vw, vh) {
  const s = world.stats, p = world.player;
  const stars = starsOf(world);
  const clock = world.weather.clock;
  const w = weatherOf(world.weather);
  ctx.textAlign = 'left';
  // Top-left stat plate.
  plate(ctx, 12, 12, 252, 118);
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 21px system-ui';
  ctx.fillText('$' + s.money.toLocaleString('en-US'), 24, 38);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '13px system-ui';
  ctx.fillText(`SCORE ${s.score} · STOLEN ${s.carsStolen}`, 24, 60);
  ctx.fillText(`COINS ${coinsTaken(world.collectibles)}/20 · STASH ${stashesTaken(world.collectibles)}/12 · JUMPS ${jumpsDone(world.collectibles)}/5`, 24, 79);
  const rank = rankFor(s.rp), next = nextRank(s.rp);
  ctx.fillText(`RANK: ${rank.name.toUpperCase()}`, 24, 98);
  bar(ctx, 24, 106, 150, 6, next ? (s.rp - rank.rp) / (next.rp - rank.rp) : 1, '#b088e0');
  ctx.fillStyle = '#aab4c2'; ctx.font = '11px system-ui';
  ctx.fillText(next ? `${s.rp}/${next.rp} RP` : `${s.rp} RP · MAX`, 180, 113);
  // Crew line under the plate.
  plate(ctx, 12, 138, 252, 24, 0.5);
  ctx.fillStyle = '#ffd9a8'; ctx.font = '12px system-ui';
  const crewReady = world.time - (world.flags.crewUsedAt || -99) > 45;
  ctx.fillText(`CREW — Lena Voss · Getaway Driver · ${crewReady ? 'READY' : 'COOLDOWN'}`, 20, 154);
  // Top-right: stars, clock, minimap, district, SCPD panel.
  ctx.textAlign = 'right';
  ctx.font = '26px system-ui';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', vw - 16 - (4 - i) * 27, 38);
  }
  const hh = String(Math.floor(clock)).padStart(2, '0'), mm = String(Math.floor((clock % 1) * 60)).padStart(2, '0');
  ctx.fillStyle = '#e8ecf2'; ctx.font = 'bold 15px system-ui';
  ctx.fillText(`${hh}:${mm} · ${w.icon} ${w.label}`, vw - 16, 62);
  if (stars > 0) {
    const sightFrac = world.sighted ? 1 : Math.max(0, 1 - (world.flags.hideTime || 0) / 4);
    ctx.font = '11px system-ui'; ctx.fillStyle = world.sighted ? '#ff9d6b' : '#9fd48f';
    ctx.fillText(world.sighted ? 'IN SIGHT' : 'SEARCHING', vw - 16, 82);
    bar(ctx, vw - 166, 88, 150, 6, sightFrac, world.sighted ? '#ff7b4d' : '#7db86b', 'rgba(255,255,255,0.15)');
  }
  drawMinimap(ctx, world, vw - 92, 178, 76);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui';
  ctx.fillText(districtAt(p.x, p.y).toUpperCase(), vw - 16, 268);
  if (stars >= 1) drawScpdPanel(ctx, world, vw, stars);
  drawObjective(ctx, world, vw);
  // Bottom-left: health/armour + weapon slots.
  plate(ctx, 12, vh - 96, 236, 84);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '11px system-ui';
  ctx.fillText('HEALTH', 24, vh - 76);
  bar(ctx, 76, vh - 84, 158, 9, p.hp / 100, '#e5534b');
  ctx.fillText('ARMOUR', 24, vh - 58);
  bar(ctx, 76, vh - 66, 158, 9, p.armour / 100, '#7d9fd8');
  const weapon = WEAPONS[p.weapon];
  for (let i = 0; i < 3; i++) {
    const x = 24 + i * 74, y = vh - 48;
    ctx.fillStyle = i === p.weapon ? 'rgba(255,217,77,0.30)' : 'rgba(255,255,255,0.10)';
    ctx.fillRect(x, y, 66, 30);
    ctx.fillStyle = i === p.weapon ? '#ffd94d' : '#c8cfd8';
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`${WEAPONS[i].slot} ${WEAPONS[i].name.toUpperCase()}`, x + 6, y + 13);
    ctx.font = '10px system-ui';
    ctx.fillText(i === 0 ? '—' : (i === p.weapon ? `${p.ammo}/${p.reserve}` : 'holstered'), x + 6, y + 25);
  }
  if (p.reloading > 0) {
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 12px system-ui';
    ctx.fillText('RELOADING…', 24, vh - 106);
  }
  // Bottom-right: vehicle block + radio.
  if (p.car) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd9a8'; ctx.font = '13px system-ui';
    ctx.fillText(stationLabel(world.radioIdx), vw - 16, vh - 108);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(`${p.car.name} · ${Math.max(0, Math.round(p.car.hp))}% CONDITION`, vw - 16, vh - 88);
    bar(ctx, vw - 176, vh - 80, 160, 7, p.car.hp / 100, '#7db86b');
    const kmh = Math.round(Math.abs(p.car.speed) * KMH_PER_UNIT);
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 30px system-ui';
    ctx.fillText(`${kmh}`, vw - 62, vh - 44);
    ctx.fillStyle = '#e8ecf2'; ctx.font = '12px system-ui';
    ctx.fillText('KM/H', vw - 16, vh - 44);
    ctx.font = '11px system-ui'; ctx.fillStyle = '#aab4c2';
    ctx.fillText(`ODO ${s.kmDriven.toFixed(1)} KM · NEAR MISS ${s.nearMisses}`, vw - 16, vh - 20);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#aab4c2'; ctx.font = '12px system-ui';
    ctx.fillText('ON FOOT — E: ENTER CAR · F: PUNCH · CLICK: SHOOT', vw - 16, vh - 20);
  }
  // Dialogue plate (bottom-centre) and vault bar (above it, never overlapping).
  if (world.dialogue && world.dialogue.until > world.time) {
    const d = world.dialogue;
    const text = `${d.who} (${d.role}): ${d.line}`;
    ctx.font = '13px system-ui';
    const tw = Math.min(620, ctx.measureText(text).width + 28);
    plate(ctx, vw / 2 - tw / 2, vh - 64, tw, 34, 0.78);
    ctx.fillStyle = '#ffd9a8'; ctx.textAlign = 'left';
    ctx.fillText(text, vw / 2 - tw / 2 + 14, vh - 42);
  }
  const stage = missionStage(world);
  if (stage && stage.kind === 'hold' && world.mission && world.mission.def.steps[world.mission.step].vault) {
    plate(ctx, vw / 2 - 170, vh - 108, 340, 30, 0.8);
    ctx.fillStyle = '#39e75f'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`VAULT ${Math.floor(stage.vaultPct)}%`, vw / 2 - 156, vh - 88);
    bar(ctx, vw / 2 - 66, vh - 100, 210, 10, stage.vaultPct / 100, '#39e75f');
  }
  // Centre flash messages.
  if (world.flash && world.flash.until > world.time) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const label = world.flash.text;
    ctx.fillText(label, vw / 2 + 2, 150 + 2);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(label, vw / 2, 150);
  }
  ctx.textAlign = 'left';
}

function drawScpdPanel(ctx, world, vw, stars) {
  const units = [];
  const sorted = world.cops.filter((c) => !c.wrecked)
    .map((c) => ({ c, d: dist(c.x, c.y, world.player.x, world.player.y) }))
    .sort((a, b) => a.d - b.d).slice(0, 5);
  sorted.forEach((u, i) => units.push(`SCPD-${11 + i}  ${Math.round(u.d / 4)}m  ${u.c.behaviour || 'PURSUIT'}`));
  if (world.heli) units.push('AIR-1  SPOTLIGHT');
  if (world.roadblock) units.push(`SCPD-RB  ${Math.round(dist(world.roadblock.x, world.roadblock.y, world.player.x, world.player.y) / 4)}m  ROADBLOCK`);
  const h = 30 + units.length * 17;
  plate(ctx, vw - 246, 282, 230, h, 0.66);
  ctx.fillStyle = '#ff9d6b'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(`SCPD RESPONSE — ${sorted.length + (world.heli ? 1 : 0)} UNITS · ${stars}★`, vw - 234, 301);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '12px system-ui';
  units.forEach((line, i) => ctx.fillText(line, vw - 234, 320 + i * 17));
}

function drawObjective(ctx, world, vw) {
  const stage = missionStage(world);
  ctx.textAlign = 'center';
  if (stage) {
    const mins = Math.max(0, Math.floor(stage.timer / 60)), secs = Math.max(0, Math.floor(stage.timer % 60));
    const line1 = `MISSION ${stage.idx + 1}/5 — ${stage.title.toUpperCase()} · STAGE ${stage.step + 1}/${stage.steps}`;
    const line2 = `${stage.label} · ${mins}:${String(secs).padStart(2, '0')}` + (stage.nextLabel ? ` · NEXT: ${stage.nextLabel}` : '');
    ctx.font = 'bold 14px system-ui';
    const w2 = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 34;
    plate(ctx, vw / 2 - w2 / 2, 12, w2, 52, 0.72);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(line1, vw / 2, 33);
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui';
    ctx.fillText(line2, vw / 2, 54);
  } else if (world.race) {
    const r = world.race;
    ctx.font = 'bold 14px system-ui';
    const label = `RACE — ${r.def.name.toUpperCase()} · CHECKPOINT ${Math.min(r.idx + 1, r.def.points.length)}/${r.def.points.length} · ${Math.max(0, r.timer).toFixed(0)}s`;
    const w2 = ctx.measureText(label).width + 34;
    plate(ctx, vw / 2 - w2 / 2, 12, w2, 34, 0.72);
    ctx.fillStyle = '#9fd4ff';
    ctx.fillText(label, vw / 2, 34);
  } else if (world.fare) {
    ctx.font = 'bold 14px system-ui';
    const label = world.fare.phase === 'pickup' ? 'TAXI — PICK UP THE FARE' : `TAXI — DRIVE TO ${world.fare.name.toUpperCase()} · ${Math.max(0, Math.floor(world.fare.timer))}s`;
    const w2 = ctx.measureText(label).width + 34;
    plate(ctx, vw / 2 - w2 / 2, 12, w2, 34, 0.72);
    ctx.fillStyle = '#f2c230';
    ctx.fillText(label, vw / 2, 34);
  } else if (world.delivery) {
    ctx.font = 'bold 14px system-ui';
    const label = world.delivery.phase === 'pickup' ? 'DELIVERY — COLLECT THE PACKAGE AT THE MARINA' : `DELIVERY — RUN IT TO ${world.delivery.name.toUpperCase()} · ${Math.max(0, Math.floor(world.delivery.timer))}s`;
    const w2 = ctx.measureText(label).width + 34;
    plate(ctx, vw / 2 - w2 / 2, 12, w2, 34, 0.72);
    ctx.fillStyle = '#c8a2ff';
    ctx.fillText(label, vw / 2, 34);
  }
  // Edge arrow toward the active target.
  const target = world.flags.target;
  if (target) {
    const p = world.player;
    const dx = target.x - p.x, dy = target.y - p.y;
    if (Math.abs(dx) > 560 || Math.abs(dy) > 320) {
      const a = Math.atan2(dy, dx);
      const ax = vw / 2 + Math.cos(a) * 300, ay = VIEW_H / 2 + Math.sin(a) * 190;
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
      ctx.fillText(`${Math.round(Math.sqrt(dx * dx + dy * dy) / 4)}m`, ax, ay - 14);
    }
  }
  ctx.textAlign = 'left';
}

export function drawMinimap(ctx, world, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
  ctx.fillStyle = '#20262e'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const scale = (r * 2) / 3600;
  const mx = (wx) => cx - r + wx * scale;
  const my = (wy) => cy - r + wy * scale;
  ctx.fillStyle = '#3d7ea3'; ctx.fillRect(mx(BEACH.x0), my(0), (3600 - BEACH.x0) * scale, 1200 * scale);
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(mx(BEACH.x0), my(0), 60 * scale, 1200 * scale);
  ctx.strokeStyle = 'rgba(200,205,215,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 3600; i += 400) {
    ctx.moveTo(mx(i), my(0)); ctx.lineTo(mx(i), my(3600));
    ctx.moveTo(mx(0), my(i)); ctx.lineTo(mx(3600), my(i));
  }
  ctx.stroke();
  for (const coin of world.collectibles.coins) {
    if (coin.taken) continue;
    ctx.fillStyle = '#ffd94d'; ctx.fillRect(mx(coin.x) - 1.6, my(coin.y) - 1.6, 3.2, 3.2);
  }
  for (const lm of LANDMARKS) {
    ctx.fillStyle = lm.color; ctx.fillRect(mx(lm.x) - 2, my(lm.y) - 2, 4, 4);
  }
  for (const cop of world.cops) {
    if (cop.wrecked) continue;
    ctx.fillStyle = '#5b8cff'; ctx.fillRect(mx(cop.x) - 2, my(cop.y) - 2, 4, 4);
  }
  const target = world.flags.target;
  if (target) {
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath(); ctx.arc(mx(target.x), my(target.y), 4, 0, 7); ctx.fill();
  }
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(mx(p.x), my(p.y)); ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
}

// ------------------------------------------------------------- map screen ---

export function drawMapScreen(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(8,11,16,0.96)'; ctx.fillRect(0, 0, vw, vh);
  const s = world.stats, p = world.player;
  // Tabs.
  const tabs = ['MAP', 'STORY', 'STATS', 'CREW', 'SAVE'];
  ctx.textAlign = 'left';
  tabs.forEach((tab, i) => {
    const x = 36 + i * 118;
    ctx.fillStyle = i === 0 ? '#ffd94d' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(x, 22, 104, 32, 6); ctx.fill();
    ctx.fillStyle = i === 0 ? '#1a1405' : '#c8cfd8';
    ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(tab, x + 52, 44);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 19px system-ui';
  ctx.fillText('SOLMAR — CITY MAP & RECORD', 36, 86);
  // Left: the island map, roads as polylines + a curved coast road.
  const mapX = 36, mapY = 104, mapS = 520;
  const mx = (wx) => mapX + (wx / 3600) * mapS;
  const my = (wy) => mapY + (wy / 3600) * mapS;
  ctx.fillStyle = '#232a33'; ctx.fillRect(mapX, mapY, mapS, mapS);
  // District standing, read off the real turf table: a district with a
  // Rex-held zone washes friendly green, a Viper-held zone washes wary
  // red, every other district stays neutral slate.
  const standingOf = (dx, dy) => {
    let wary = false;
    for (const z of world.turf.zones) {
      const zdx = Math.min(2, Math.floor(z.x / 1200)), zdy = Math.min(2, Math.floor(z.y / 1200));
      if (zdx === dx && zdy === dy) {
        if (z.owner === 'Rex') return 'friendly';
        wary = true;
      }
    }
    return wary ? 'wary' : 'neutral';
  };
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) {
    ctx.fillStyle = `rgba(${132 + dx * 26},${122 + dy * 18},${78 + (dx + dy) * 10},0.44)`;
    ctx.fillRect(mx(dx * 1200), my(dy * 1200), 1200 / 3600 * mapS, 1200 / 3600 * mapS);
    const standing = standingOf(dx, dy);
    ctx.fillStyle = standing === 'friendly' ? 'rgba(64,199,110,0.30)'
      : standing === 'wary' ? 'rgba(224,72,72,0.28)' : 'rgba(148,163,184,0.13)';
    ctx.fillRect(mx(dx * 1200), my(dy * 1200), 1200 / 3600 * mapS, 1200 / 3600 * mapS);
  }
  ctx.textAlign = 'left';
  // Water: sea edge + canal + park pond, with wave ticks.
  ctx.fillStyle = '#3d7ea3';
  ctx.fillRect(mx(3360), my(0), 240 / 3600 * mapS, 1200 / 3600 * mapS);
  ctx.fillRect(mx(CANAL.x0), my(CANAL.y0), (CANAL.x1 - CANAL.x0) / 3600 * mapS, (CANAL.y1 - CANAL.y0) / 3600 * mapS);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  for (let y = 30; y < 170; y += 22) { ctx.moveTo(mx(3400), my(y * 7)); ctx.lineTo(mx(3480), my(y * 7)); }
  ctx.stroke();
  // Beach strip with umbrella dots.
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(mx(BEACH.x0), my(0), 120 / 3600 * mapS, 1200 / 3600 * mapS);
  ctx.fillStyle = '#e5534b';
  for (let i = 0; i < 9; i++) ctx.fillRect(mx(2980 + (i % 3) * 90), my(120 + Math.floor(i / 3) * 260), 4, 4);
  // Park.
  ctx.fillStyle = '#4d8a3f'; ctx.fillRect(mx(PARK.x0), my(PARK.y0), 400 / 3600 * mapS, 400 / 3600 * mapS);
  // Roads: grid polylines + the curved coast road.
  ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 3600; i += 400) {
    ctx.moveTo(mx(i), my(0)); ctx.lineTo(mx(i), my(3600));
    ctx.moveTo(mx(0), my(i)); ctx.lineTo(mx(3600), my(i));
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let t = 0; t <= 1.001; t += 0.05) {
    const wx = 3050 + Math.sin(t * Math.PI * 0.9) * 260;
    const wy = t * 3500 + 40;
    if (t === 0) ctx.moveTo(mx(wx), my(wy)); else ctx.lineTo(mx(wx), my(wy));
  }
  ctx.stroke();
  // District names LAST (on their own plates, top-left of each cell) so
  // the park, water and road art can never clip the text.
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) {
    const label = DISTRICTS[dy * 3 + dx].toUpperCase();
    ctx.font = 'bold 11px system-ui';
    const lw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(8,11,16,0.66)';
    ctx.fillRect(mx(dx * 1200) + 7, my(dy * 1200) + 7, lw, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.textAlign = 'left';
    ctx.fillText(label, mx(dx * 1200) + 13, my(dy * 1200) + 19);
  }
  // GPS route: safehouse → active mission target, following the street
  // grid in accent blue with a casing, waypoint dots and a pin.
  const target = world.flags.target;
  if (target) {
    const home = LANDMARKS[0]; // Rex's Safehouse
    const route = [
      { x: home.x, y: home.y },
      { x: target.x, y: home.y },
      { x: target.x, y: target.y },
    ];
    ctx.lineJoin = 'round';
    for (const pass of [{ w: 5.5, col: 'rgba(8,11,16,0.75)' }, { w: 3, col: '#35c8ff' }]) {
      ctx.strokeStyle = pass.col; ctx.lineWidth = pass.w;
      ctx.beginPath();
      route.forEach((pt, i) => { if (i === 0) ctx.moveTo(mx(pt.x), my(pt.y)); else ctx.lineTo(mx(pt.x), my(pt.y)); });
      ctx.stroke();
    }
    ctx.fillStyle = '#bdefff';
    for (const pt of route.slice(1, -1)) { ctx.beginPath(); ctx.arc(mx(pt.x), my(pt.y), 3, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.arc(mx(home.x), my(home.y), 4.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8.6px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('GPS', mx(route[1].x), my(route[1].y) - 7);
    ctx.textAlign = 'left';
    // Destination pin: teardrop + white core over the target ring.
    ctx.fillStyle = '#ff5d5d'; ctx.beginPath(); ctx.arc(mx(target.x), my(target.y), 6, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mx(target.x) - 6.5, my(target.y) - 6);
    ctx.lineTo(mx(target.x) + 6.5, my(target.y) - 6);
    ctx.lineTo(mx(target.x), my(target.y) + 3);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(mx(target.x), my(target.y) - 6, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx(target.x), my(target.y) - 6, 3, 0, 7); ctx.fill();
  }
  for (const lm of LANDMARKS) {
    ctx.fillStyle = lm.color; ctx.beginPath(); ctx.arc(mx(lm.x), my(lm.y), 4.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8.6px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(lm.short, mx(lm.x), my(lm.y) - 7);
  }
  ctx.textAlign = 'left';
  ctx.save();
  ctx.translate(mx(p.x), my(p.y)); ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Legend (two lines: symbols, then the district-standing tints).
  plate(ctx, mapX, mapY + mapS + 10, mapS, 48, 0.5);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '12px system-ui';
  ctx.fillText('● LANDMARK   ▲ YOU   ● TARGET   — COAST ROAD   ▓ BEACH / PARK / WATER', mapX + 12, mapY + mapS + 27);
  ctx.fillStyle = '#8fe3ae'; ctx.fillText('▓ FRIENDLY', mapX + 12, mapY + mapS + 44);
  ctx.fillStyle = '#c3cedd'; ctx.fillText('▓ NEUTRAL', mapX + 108, mapY + mapS + 44);
  ctx.fillStyle = '#ff9d9d'; ctx.fillText('▓ WARY', mapX + 192, mapY + mapS + 44);
  ctx.fillStyle = '#e8ecf2';
  ctx.fillText('— GPS ROUTE: SAFEHOUSE → ACTIVE MISSION', mapX + 262, mapY + mapS + 44);
  // Right column: completion ring + story + career.
  const rx = 596;
  const pct = completionPct(world);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.arc(rx + 62, 168, 46, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#ffd94d';
  ctx.beginPath(); ctx.arc(rx + 62, 168, 46, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 21px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(pct.toFixed(1) + '%', rx + 62, 176);
  ctx.font = '11px system-ui'; ctx.fillStyle = '#aab4c2';
  ctx.fillText('COMPLETE', rx + 62, 194);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 15px system-ui';
  ctx.fillText('STORY — GRADES', rx + 150, 128);
  ctx.font = '13px system-ui';
  const missionNames = ['Wheels for Lou', 'The Palms Package', 'Neon Night Run', 'Canal Row Ambush', 'National Bank Job'];
  missionNames.forEach((name, i) => {
    const done = world.flags['done_m' + (i + 1)];
    const grade = world.flags['grade_m' + (i + 1)];
    ctx.fillStyle = done ? '#9fd48f' : (i === s.missionsDone ? '#ffd94d' : '#7d8794');
    ctx.fillText(`${i + 1}. ${name} — ${done ? 'DONE · GRADE ' + grade : (i === s.missionsDone ? 'NEXT' : 'LOCKED')}`, rx + 150, 152 + i * 21);
  });
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 15px system-ui';
  ctx.fillText('CAREER', rx, 262);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '13px system-ui';
  const career = [
    `Cash $${s.money.toLocaleString('en-US')} · Rank ${rankFor(s.rp).name} (${s.rp} RP)`,
    `Cars stolen ${s.carsStolen} · Taxi fares ${s.fares} · Deliveries ${s.deliveries}`,
    `Races won ${racesWon(world)}/3 · Turf held ${zonesHeld(world.turf)}/5`,
    `Coins ${coinsTaken(world.collectibles)}/20 · Stashes ${stashesTaken(world.collectibles)}/12 · Jumps ${jumpsDone(world.collectibles)}/5`,
    `Distance ${s.kmDriven.toFixed(1)} km · Near misses ${s.nearMisses}`,
    `Cops escaped ${s.copsEscaped} · Longest chase ${s.longestChase}s · Mods ${modsBought(world.mods)}/9`,
    `Play time ${Math.floor(s.playTime / 60)}m ${Math.floor(s.playTime % 60)}s · Score ${s.score}`,
    `Turf: ${world.turf.zones.map((z) => `${z.name.replace(' Turf', '')} — ${z.owner}`).join(' · ')}`,
    `Crew: Lena Voss (Getaway Driver) · Mama Lou (Fixer) · Kane (Boss)`,
  ];
  career.forEach((line, i) => ctx.fillText(line, rx, 284 + i * 20));
  // Save-slot cards.
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 15px system-ui';
  ctx.fillText('SAVE SLOTS', rx, 470);
  for (let i = 0; i < 3; i++) {
    const x = rx + i * 218, y = 484;
    ctx.fillStyle = i === 0 ? 'rgba(255,217,77,0.14)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(x, y, 204, 96, 8); ctx.fill();
    ctx.strokeStyle = i === 0 ? '#ffd94d' : 'rgba(255,255,255,0.25)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui';
    ctx.fillText(i === 0 ? 'SLOT 1 — REX KANE' : `SLOT ${i + 1} — EMPTY`, x + 12, y + 24);
    ctx.font = '12px system-ui'; ctx.fillStyle = '#c8cfd8';
    if (i === 0) {
      const hh = String(Math.floor(world.weather.clock)).padStart(2, '0');
      ctx.fillText(`Act: ${s.missionsDone >= 5 ? 'FINALE' : 'Chapter ' + (s.missionsDone + 1)} · ${pct.toFixed(1)}% complete`, x + 12, y + 46);
      ctx.fillText(`Missions ${s.missionsDone}/5 · Cash $${s.money.toLocaleString('en-US')}`, x + 12, y + 65);
      ctx.fillText(`Saved ${hh}:${String(Math.floor((world.weather.clock % 1) * 60)).padStart(2, '0')} · ${districtAt(p.x, p.y)}`, x + 12, y + 84);
    } else {
      ctx.fillText('No save recorded', x + 12, y + 46);
      ctx.fillText('Progress saves automatically', x + 12, y + 65);
    }
  }
  ctx.fillStyle = '#7d8794'; ctx.font = '12px system-ui';
  ctx.fillText('P / ESC — RESUME · PROGRESS SAVES AUTOMATICALLY', rx, 606);
}

// ------------------------------------------------------------- title etc. ---

export function drawTitle(ctx, world, vw, vh) {
  // Translucent dusk wash so the vista reads behind the menu.
  ctx.fillStyle = 'rgba(24,10,34,0.42)'; ctx.fillRect(0, 0, vw, vh);
  // Round 16 vista deepening: a dusk sky band across the top carrying
  // three skyline layers (far/mid/near, nearest darkest, all with lit
  // windows), so the logotype sits over a real city depth stack while
  // the beach view keeps the lower frame.
  const skyBand = ctx.createLinearGradient(0, 0, 0, 212);
  skyBand.addColorStop(0, '#241243'); skyBand.addColorStop(0.6, '#7a2d5e'); skyBand.addColorStop(1, '#e8763a');
  ctx.fillStyle = skyBand; ctx.fillRect(0, 0, vw, 212);
  const vistaLayers = [
    { color: 'rgba(122,74,128,0.85)', seed: 21, min: 40, max: 104, winA: 0.35 },
    { color: 'rgba(74,40,96,0.92)', seed: 33, min: 66, max: 148, winA: 0.55 },
    { color: 'rgba(34,20,54,0.98)', seed: 47, min: 96, max: 196, winA: 0.85 },
  ];
  for (const layer of vistaLayers) {
    drawSkylineSilhouette(ctx, vw, 212, layer.color, layer.seed, layer.min, layer.max);
    ctx.fillStyle = `rgba(255,205,110,${layer.winA})`;
    let bx = 8;
    let bi = 0;
    while (bx < vw - 10) {
      const bw = 40 + hash2(layer.seed + bi * 3, layer.seed) * 84;
      const bh = layer.min + hash2(layer.seed, bi * 7) * (layer.max - layer.min);
      for (let r = 0; r < Math.floor(bh / 17); r++) for (let c = 0; c < Math.floor(bw / 13); c++) {
        if (hash2(bi * 31 + c * 5, r * 11 + layer.seed) > 0.52) {
          ctx.fillRect(bx + 5 + c * 13, 212 - bh + 8 + r * 17, 5.4, 7);
        }
      }
      bx += bw + 6 + hash2(bi, layer.seed * 2) * 26;
      bi += 1;
    }
  }
  // Water sparkle band: deterministic glints scattered over the sea
  // strip on the right of the beach view.
  ctx.fillStyle = 'rgba(255,244,200,0.75)';
  for (let i = 0; i < 90; i++) {
    const sx = 1122 + hash2(i * 7, 91) * 148;
    const sy = 226 + hash2(91, i * 13) * 468;
    const len = 3 + hash2(i, 7) * 8;
    ctx.fillRect(sx, sy, len, 1.7);
  }
  ctx.fillStyle = 'rgba(160,225,255,0.5)';
  for (let i = 0; i < 46; i++) {
    const sx = 1118 + hash2(i * 11, 57) * 152;
    const sy = 230 + hash2(57, i * 17) * 460;
    ctx.fillRect(sx, sy, 2.4, 2.4);
  }
  const grad = ctx.createLinearGradient(0, 60, 0, 240);
  grad.addColorStop(0, '#ffd94d'); grad.addColorStop(0.55, '#ff8a3c'); grad.addColorStop(1, '#e5534b');
  ctx.textAlign = 'center';
  ctx.font = '900 86px system-ui';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText('SOLMAR HEAT', vw / 2 + 3, 143);
  ctx.fillStyle = grad;
  ctx.fillText('SOLMAR HEAT', vw / 2, 140);
  ctx.fillStyle = '#fff'; ctx.font = '17px system-ui';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', vw / 2, 176);
  // Menu.
  const items = ['CONTINUE', 'NEW GAME', 'LOAD GAME', 'SETTINGS'];
  items.forEach((item, i) => {
    const y = 226 + i * 44;
    ctx.fillStyle = i === 0 ? 'rgba(255,217,77,0.92)' : 'rgba(10,14,20,0.66)';
    ctx.beginPath(); ctx.roundRect(vw / 2 - 130, y - 26, 260, 36, 8); ctx.fill();
    ctx.fillStyle = i === 0 ? '#1a1405' : '#e8ecf2';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText((i === 0 ? '▶ ' : '') + item, vw / 2, y);
  });
  // Save-slot card.
  const s = world.stats;
  plate(ctx, vw / 2 - 250, 424, 500, 74, 0.78);
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('SAVE SLOT 1 — REX KANE', vw / 2 - 232, 448);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '13px system-ui';
  ctx.fillText(`Chapter ${Math.min(5, s.missionsDone + 1)} · ${completionPct(world).toFixed(1)}% · Missions ${s.missionsDone}/5 · ${districtAt(world.player.x, world.player.y)} · $${s.money.toLocaleString('en-US')}`, vw / 2 - 232, 470);
  ctx.fillStyle = '#aab4c2'; ctx.font = '12px system-ui';
  ctx.fillText(`Story ${s.missionsDone}/5 · Coins ${coinsTaken(world.collectibles)}/20 · Turf ${zonesHeld(world.turf)}/5 — progress saves automatically`, vw / 2 - 232, 489);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui';
  ctx.fillText('CLICK OR PRESS ENTER TO PLAY', vw / 2, 536);
  ctx.fillStyle = 'rgba(232,236,242,0.85)'; ctx.font = '12.6px system-ui';
  ctx.fillText('WASD drive · E enter/exit car · mouse aim · click shoot · F punch · R reload · T taxi · B delivery · P map · M mute', vw / 2, 566);
  ctx.fillStyle = 'rgba(232,236,242,0.6)'; ctx.font = '11.6px system-ui';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', vw / 2, 590);
  ctx.textAlign = 'left';
}

export function drawModShop(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(8,11,16,0.9)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#b088e0'; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'center';
  ctx.fillText("LOU'S MOD SHOP", vw / 2, 120);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '15px system-ui';
  ctx.fillText(`Cash $${world.stats.money.toLocaleString('en-US')} — press 1/2/3 to buy, ESC to leave`, vw / 2, 152);
  const tracks = [
    { name: 'ENGINE', level: world.mods.engine, prices: [250, 450, 800], blurb: '+9% top speed / level' },
    { name: 'ARMOR', level: world.mods.armor, prices: [200, 400, 700], blurb: 'car shrugs off damage' },
    { name: 'TIRES', level: world.mods.tires, prices: [180, 350, 600], blurb: '+8% grip / level' },
  ];
  tracks.forEach((t, i) => {
    const x = vw / 2 - 330 + i * 230, y = 210;
    plate(ctx, x, y, 200, 190, 0.85);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 19px system-ui';
    ctx.fillText(t.name, x + 100, y + 40);
    ctx.font = '13px system-ui'; ctx.fillStyle = '#c8cfd8';
    ctx.fillText(t.blurb, x + 100, y + 66);
    ctx.fillText('LEVEL ' + t.level + '/3', x + 100, y + 96);
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = l < t.level ? '#b088e0' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 40 + l * 44, y + 112, 36, 12);
    }
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 15px system-ui';
    ctx.fillText(t.level >= 3 ? 'MAXED' : `NEXT: $${t.prices[t.level]}`, x + 100, y + 158);
  });
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, world, vw, vh, busted) {
  ctx.fillStyle = busted ? 'rgba(20,30,70,0.72)' : 'rgba(70,8,8,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = busted ? '#9fd4ff' : '#ff6b5e';
  ctx.font = '900 84px system-ui';
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', vw / 2, vh / 2 - 10);
  ctx.fillStyle = '#fff'; ctx.font = '16px system-ui';
  ctx.fillText(busted ? 'The SCPD got their man. You wake up outside HQ, lighter in the pocket.' : 'You wake up at Solmar General. The city keeps your car keys and $150.', vw / 2, vh / 2 + 30);
  ctx.fillText('PRESS ENTER TO CONTINUE', vw / 2, vh / 2 + 62);
  ctx.textAlign = 'left';
}

export { CAR_TYPES };
