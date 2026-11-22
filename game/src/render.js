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
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) {
    ctx.fillStyle = `rgba(${132 + dx * 26},${122 + dy * 18},${78 + (dx + dy) * 10},0.44)`;
    ctx.fillRect(mx(dx * 1200), my(dy * 1200), 1200 / 3600 * mapS, 1200 / 3600 * mapS);
    // District name in the cell's top-left corner, on its own plate, so
    // landmark labels at block centres never collide with it.
    const label = DISTRICTS[dy * 3 + dx].toUpperCase();
    ctx.font = 'bold 11px system-ui';
    const lw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(8,11,16,0.66)';
    ctx.fillRect(mx(dx * 1200) + 7, my(dy * 1200) + 7, lw, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.textAlign = 'left';
    ctx.fillText(label, mx(dx * 1200) + 13, my(dy * 1200) + 19);
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
  // Dashed route player → target.
  const target = world.flags.target;
  if (target) {
    ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(mx(p.x), my(p.y)); ctx.lineTo(mx(target.x), my(target.y)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5d5d'; ctx.beginPath(); ctx.arc(mx(target.x), my(target.y), 6, 0, 7); ctx.fill();
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
  // Legend.
  plate(ctx, mapX, mapY + mapS + 10, mapS, 30, 0.5);
  ctx.fillStyle = '#e8ecf2'; ctx.font = '12px system-ui';
  ctx.fillText('● LANDMARK   ▲ YOU   ● TARGET   — COAST ROAD   ▓ BEACH / PARK / WATER', mapX + 12, mapY + mapS + 29);
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
