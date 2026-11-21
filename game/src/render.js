// render.js — everything the player sees: the city (roads, block
// ground treatments, buildings, props), figures and vehicles, the
// helicopter, weather and light, the full HUD grammar (mission
// header with STAGE + NEXT, SCPD RESPONSE panel, radio, rank,
// vehicle identity), the minimap, and the title / map / shop /
// wasted screens.

import { BLOCK, DISTRICTS, ROAD_W, WORLD_SIZE } from './config.js';
import { districtAt, starsOf } from './world.js';
import { missionStage } from './missions.js';
import { skyPhase, formatClock } from './weather.js';
import { stationAt } from './radio.js';
import { LANDMARKS } from './landmarks.js';
import { hash2 } from './random.js';

export function drawFigure(ctx, x, y, color, opts) {
  const o = opts || {};
  const bob = Math.sin((o.phase || 0) + (o.time || 0) * 6) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 9, 8, 3.4, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - 4.5, y - 3 + bob * 0.3, 9, 13, 3); ctx.fill();
  if (o.flee) { // arms up: two small lines
    ctx.strokeStyle = color; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 9, y - 8); ctx.moveTo(x + 4, y); ctx.lineTo(x + 9, y - 8); ctx.stroke();
  }
  ctx.fillStyle = o.skin || '#e8b98a';
  ctx.beginPath(); ctx.arc(x + Math.cos(o.angle || 0) * 2, y - 7 + bob * 0.3, 4, 0, 6.29); ctx.fill();
  if (o.cap) { ctx.fillStyle = o.cap; ctx.beginPath(); ctx.arc(x, y - 8, 4.4, Math.PI, 6.29); ctx.fill(); }
  if (o.hp !== undefined && o.maxHp) {
    for (let i = 0; i < o.maxHp; i++) {
      ctx.fillStyle = i < o.hp ? '#e84e3a' : 'rgba(255,255,255,0.3)';
      ctx.fillRect(x - 9 + i * 6, y - 18, 4.6, 3);
    }
  }
}

export function drawCar(ctx, car, time, phase) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  const L = car.len; const W = car.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.roundRect(-L / 2 + 3, -W / 2 + 4, L, W, 6); ctx.fill();
  if (phase === 'dusk' || phase === 'night' || phase === 'golden') {
    ctx.fillStyle = 'rgba(255,244,190,0.20)';
    ctx.beginPath(); ctx.moveTo(L / 2, -5); ctx.lineTo(L / 2 + 44, -13); ctx.lineTo(L / 2 + 44, 13); ctx.lineTo(L / 2, 5); ctx.fill();
  }
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = '#14181d';
  for (const [wx, wy] of [[-L / 2 + 8, -W / 2 - 2], [L / 2 - 12, -W / 2 - 2], [-L / 2 + 8, W / 2 - 2], [L / 2 - 12, W / 2 - 2]]) ctx.fillRect(wx, wy, 7, 4);
  if (car.type === 'truck') {
    ctx.fillStyle = '#dfe5ea'; ctx.fillRect(-L / 2 + 16, -W / 2 + 2, L - 20, W - 4);
    ctx.fillStyle = '#9fd4e8'; ctx.fillRect(-L / 2 + 2, -W / 2 + 3, 10, W - 6);
  } else if (car.type === 'van') {
    ctx.fillStyle = '#9fd4e8'; ctx.fillRect(-L / 4, -W / 2 + 3, L / 2, W - 6);
  } else if (car.type === 'falco' || car.type === 'coupe') {
    ctx.fillStyle = '#20262e'; ctx.fillRect(-8, -W / 2 + 3, 20, W - 6); // open cockpit band
  } else {
    ctx.fillStyle = '#bfe2f2'; ctx.fillRect(-4, -W / 2 + 3, 13, W - 6);
    ctx.fillStyle = '#8fb8cc'; ctx.fillRect(-L / 2 + 7, -W / 2 + 3, 7, W - 6);
  }
  if (car.type === 'limo') { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(6, -W / 2 + 2, 2, W - 4); }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#fff6cf'; ctx.fillRect(-6, -6, 13, 12);
    ctx.fillStyle = '#14181d'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 2.5);
  }
  if (car.police) {
    ctx.fillStyle = '#274b8f'; ctx.fillRect(-L / 2, -3, L, 6);
    ctx.fillStyle = '#fff'; ctx.fillRect(-9, -W / 2 + 2, 16, W - 4);
    ctx.fillStyle = '#14181d'; ctx.font = 'bold 6.5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SCPD', -1, 2.4);
    const on = Math.sin(time * 9 + car.sirenPhase) > 0;
    ctx.fillStyle = on ? '#ff4444' : '#4466ff';
    ctx.fillRect(-7, -4, 14, 8);
    ctx.fillStyle = on ? '#4466ff' : '#ff4444'; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#ffd9a0'; ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 4); ctx.fillRect(L / 2 - 2, W / 2 - 6, 3, 4);
  ctx.fillStyle = '#e33'; ctx.fillRect(-L / 2 - 1, -W / 2 + 2, 3, 4); ctx.fillRect(-L / 2 - 1, W / 2 - 6, 3, 4);
  ctx.restore();
}

function drawProp(ctx, p, phase) {
  ctx.save(); ctx.translate(p.x, p.y);
  switch (p.kind) {
    case 'lamp':
      ctx.fillStyle = '#3c4652'; ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
      if (phase === 'dusk' || phase === 'night') {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
        g.addColorStop(0, 'rgba(255,230,150,0.5)'); g.addColorStop(1, 'rgba(255,230,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 6.29); ctx.fill();
      }
      break;
    case 'crosswalk':
      ctx.fillStyle = 'rgba(240,240,235,0.75)';
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * 11 - 3, -ROAD_W / 2 + 6, 6, 16);
      break;
    case 'palm': case 'tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(3, 4, 10, 5, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -7); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.6;
      for (let i = 0; i < 6; i++) { const a = p.angle + i * 1.05; ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(2 + Math.cos(a) * 13, -7 + Math.sin(a) * 7); ctx.stroke(); }
      break;
    }
    case 'umbrella':
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI, 6.29); ctx.fill();
      ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
      break;
    case 'towel': ctx.fillStyle = p.color; ctx.save(); ctx.rotate(p.angle); ctx.fillRect(-9, -5, 18, 10); ctx.restore(); break;
    case 'bench': ctx.fillStyle = p.color; ctx.save(); ctx.rotate(p.angle); ctx.fillRect(-10, -3, 20, 6); ctx.restore(); break;
    case 'planter': ctx.fillStyle = '#6b4a30'; ctx.fillRect(-8, -6, 16, 12); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.29); ctx.fill(); break;
    case 'crate': ctx.fillStyle = p.color; ctx.save(); ctx.rotate(p.angle); ctx.fillRect(-9, -9, 18, 18); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(-9, -9, 18, 18); ctx.restore(); break;
    case 'barrel': ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 6.29); ctx.fill(); break;
    case 'hydrant': ctx.fillStyle = '#d94f3d'; ctx.fillRect(-3, -4, 6, 8); break;
    case 'newsbox': ctx.fillStyle = '#4e7fc9'; ctx.fillRect(-5, -4, 10, 8); break;
    case 'busstop': ctx.fillStyle = '#374151'; ctx.fillRect(-2, -9, 4, 18); ctx.fillStyle = '#f2c230'; ctx.fillRect(-6, -12, 12, 5); break;
    case 'awning': ctx.fillStyle = p.color; ctx.save(); ctx.rotate(p.angle); ctx.fillRect(-13, -5, 26, 10); ctx.restore(); break;
    default: break;
  }
  ctx.restore();
}

function blockKind(bx, by) {
  if (bx >= 6 && by <= 2) return 'beach';
  if (bx === 1 && by === 6) return 'park';
  if ((bx === 2 && by === 1) || (bx === 4 && by === 4)) return 'plaza';
  if ((bx + by) % 4 === 0) return 'parking';
  return 'plain';
}

export function drawWorld(ctx, world, camX, camY, vw, vh) {
  const phase = skyPhase(world.clock);
  const sky = { morning: '#bfe3f2', day: '#a8d8ea', golden: '#f7c98a', dusk: '#e88a6a', night: '#2c3550' }[phase];
  ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, vh);
  ctx.save(); ctx.translate(-camX, -camY);
  // Block ground treatments.
  const bx0 = Math.max(0, Math.floor(camX / BLOCK) - 1); const bx1 = Math.min(8, Math.ceil((camX + vw) / BLOCK));
  const by0 = Math.max(0, Math.floor(camY / BLOCK) - 1); const by1 = Math.min(8, Math.ceil((camY + vh) / BLOCK));
  for (let bx = bx0; bx <= bx1; bx++) for (let by = by0; by <= by1; by++) {
    const x = bx * BLOCK; const y = by * BLOCK; const kind = blockKind(bx, by);
    const tint = 0.92 + hash2(bx, by) * 0.16;
    const base = kind === 'beach' ? '#ecd28f' : kind === 'park' ? '#79b96a' : kind === 'plaza' ? '#cfc4ae' : kind === 'parking' ? '#9aa0a6' : '#8fc474';
    ctx.fillStyle = shade(base, tint);
    ctx.fillRect(x, y, BLOCK, BLOCK);
    if (kind === 'beach') {
      ctx.fillStyle = '#c9a86a';
      for (let px = x + 100; px < x + 148; px += 14) ctx.fillRect(px, y, 8, BLOCK); // boardwalk planks, west edge only
      ctx.fillStyle = '#57b8d6'; ctx.fillRect(x + BLOCK - 26, y, 26, BLOCK); // water strip
      ctx.fillStyle = '#bfeef7'; ctx.fillRect(x + BLOCK - 32, y, 6, BLOCK); // foam edge
    }
    if (kind === 'park') {
      ctx.strokeStyle = '#d9c9a3'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x, y + 200); ctx.lineTo(x + BLOCK, y + 200); ctx.moveTo(x + 200, y); ctx.lineTo(x + 200, y + BLOCK); ctx.stroke();
      ctx.fillStyle = '#6fb7d9'; ctx.beginPath(); ctx.ellipse(x + 270, y + 120, 52, 32, 0, 0, 6.29); ctx.fill();
    }
    if (kind === 'plaza') {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) ctx.fillRect(x + i * 80, y + j * 80, 80, 80);
    }
    if (kind === 'parking') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + 120, y + i * 58); ctx.lineTo(x + 380, y + i * 58); ctx.stroke(); }
    }
    // Sidewalk border strips.
    ctx.fillStyle = '#d8d2c2';
    ctx.fillRect(x, y, BLOCK, 10); ctx.fillRect(x, y + BLOCK - 10, BLOCK, 10);
    ctx.fillRect(x, y, 10, BLOCK); ctx.fillRect(x + BLOCK - 10, y, 10, BLOCK);
  }
  // Roads.
  ctx.fillStyle = '#454a52';
  for (let i = 0; i <= 9; i++) {
    ctx.fillRect(i * BLOCK, 0, ROAD_W, WORLD_SIZE);
    ctx.fillRect(0, i * BLOCK, WORLD_SIZE, ROAD_W);
  }
  ctx.strokeStyle = 'rgba(255,235,170,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath(); ctx.moveTo(i * BLOCK + ROAD_W / 2, 0); ctx.lineTo(i * BLOCK + ROAD_W / 2, WORLD_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * BLOCK + ROAD_W / 2); ctx.lineTo(WORLD_SIZE, i * BLOCK + ROAD_W / 2); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Canal Row water channels with bridge decks.
  ctx.fillStyle = '#4fa8c9'; ctx.fillRect(1600, 2400, 90, 1200);
  ctx.fillStyle = '#8a6a45'; for (let y = 2520; y < 3500; y += 320) ctx.fillRect(1588, y, 114, 46);
  // Props behind actors.
  for (const p of world.props) {
    if (p.x < camX - 60 || p.x > camX + vw + 60 || p.y < camY - 60 || p.y > camY + vh + 60) continue;
    drawProp(ctx, p, phase);
  }
  // Buildings with roof detail and storefronts.
  for (const b of world.buildings) {
    if (b.x < camX - 120 || b.x > camX + vw + 60 || b.y < camY - 120 || b.y > camY + vh + 60) continue;
    const shadow = (phase === 'golden' || phase === 'dusk') ? 16 : 8;
    ctx.fillStyle = 'rgba(60,40,20,0.3)'; ctx.fillRect(b.x + shadow, b.y + shadow, b.w, b.h);
    ctx.fillStyle = '#efe6d0'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade('#d9c9a8', 0.85 + b.hue * 0.3); ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = '#9fd4e8';
    const rows = Math.min(5, b.floors);
    for (let r = 0; r < rows; r++) for (let cix = 0; cix < Math.floor(b.w / 18); cix++) ctx.fillRect(b.x + 8 + cix * 18, b.y + 9 + r * 11, 9, 6);
    if (b.roof === 'ac') { ctx.fillStyle = '#9aa3ad'; ctx.fillRect(b.x + b.w - 26, b.y + 8, 16, 12); }
    if (b.roof === 'tank') { ctx.fillStyle = '#8a6a45'; ctx.beginPath(); ctx.arc(b.x + 16, b.y + 16, 9, 0, 6.29); ctx.fill(); }
    if (b.roof === 'vent') { ctx.fillStyle = '#6b7280'; ctx.fillRect(b.x + 10, b.y + b.h - 20, 12, 9); }
  }
  // Landmark labels.
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  for (const l of LANDMARKS) {
    if (l.x < camX - 80 || l.x > camX + vw + 80 || l.y < camY - 60 || l.y > camY + vh + 60) continue;
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    const w = ctx.measureText(l.name).width + 16;
    ctx.beginPath(); ctx.roundRect(l.x - w / 2, l.y - 52, w, 20, 5); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.fillText(l.name, l.x, l.y - 38);
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(l.x, l.y - 20, 5, 0, 6.29); ctx.fill();
  }
  // Coins and pickups.
  for (const c of world.coins) if (!c.taken) {
    ctx.fillStyle = '#ffd34e'; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#a87b12'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('S', c.x, c.y + 3.5);
  }
  for (const pk of world.pickups) if (!pk.taken) {
    ctx.fillStyle = pk.kind === 'ammo' ? '#374151' : '#e8f4e8'; ctx.fillRect(pk.x - 8, pk.y - 8, 16, 16);
    ctx.fillStyle = pk.kind === 'ammo' ? '#ffd34e' : '#d33'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(pk.kind === 'ammo' ? 'A' : '+', pk.x, pk.y + 4);
  }
  // Vault ring during the bank hold.
  if (world.vaultProgress > 0 && world.vaultProgress < 1) {
    const bank = LANDMARKS.find((l) => l.key === 'bank');
    ctx.strokeStyle = '#57e85e'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(bank.x, bank.y, 62, -Math.PI / 2, -Math.PI / 2 + world.vaultProgress * Math.PI * 2); ctx.stroke();
  }
  // Cars, roadblock, peds, gang, cops, player.
  for (const c of world.cars) if (c !== world.player.car) drawCar(ctx, c, world.time, phase);
  if (world.roadblock) for (const rc of world.roadblock.cars) {
    drawCar(ctx, { ...rc, type: 'cruiser', name: 'SCPD Cruiser', color: '#eef1f4', len: 46, wid: 20, angle: Math.PI / 2, police: true, sirenPhase: 1, wrecked: false }, world.time, phase);
    ctx.fillStyle = '#e86a3a'; ctx.fillRect(rc.x - 30, rc.y - 4, 60, 8);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) ctx.fillRect(rc.x - 28 + i * 12, rc.y - 4, 6, 8);
  }
  for (const ped of world.peds) drawFigure(ctx, ped.x, ped.y, ped.color, { angle: ped.angle, skin: ped.skin, phase: ped.phase, time: world.time, flee: ped.flee });
  for (const g of world.gang) drawFigure(ctx, g.x, g.y, '#7a1f1f', { angle: 0, skin: '#d99e63', hp: g.hp, maxHp: g.maxHp, time: world.time });
  for (const f of world.footCops) drawFigure(ctx, f.x, f.y, '#33507e', { angle: 0, skin: '#e8b98a', cap: '#1d3355', time: world.time });
  for (const c of world.cops) drawCar(ctx, c, world.time, phase);
  if (world.heli) {
    const h = world.heli;
    ctx.fillStyle = 'rgba(255,250,190,0.18)';
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x - 90, h.y + 190); ctx.lineTo(h.x + 110, h.y + 200); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(h.x + 14, h.y + 26, 26, 9, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#22262e'; ctx.beginPath(); ctx.roundRect(h.x - 22, h.y - 9, 46, 18, 8); ctx.fill();
    ctx.strokeStyle = '#22262e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(h.x - 42, h.y); ctx.lineTo(h.x + 42, h.y); ctx.stroke();
    ctx.fillStyle = '#9fd4e8'; ctx.fillRect(h.x + 8, h.y - 6, 12, 12);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('AIR-1', h.x, h.y + 3);
  }
  for (const b of world.combat.bullets) { ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 6.29); ctx.fill(); }
  for (const tr of world.combat.tracers) { ctx.strokeStyle = 'rgba(255,220,90,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke(); }
  for (const pt of world.combat.particles) { ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, 6.29); ctx.fill(); }
  const p = world.player;
  if (p.car) drawCar(ctx, { ...p.car, x: p.x, y: p.y, angle: p.car.angle }, world.time, phase);
  drawFigure(ctx, p.x, p.y, '#c22e2e', { angle: p.angle, skin: '#d99e63', time: world.time });
  ctx.restore();
  // Light washes.
  if (phase === 'golden') { ctx.fillStyle = 'rgba(255,160,60,0.16)'; ctx.fillRect(0, 0, vw, vh); }
  if (phase === 'dusk') { ctx.fillStyle = 'rgba(120,50,90,0.18)'; ctx.fillRect(0, 0, vw, vh); }
  if (phase === 'night') { ctx.fillStyle = 'rgba(10,16,40,0.34)'; ctx.fillRect(0, 0, vw, vh); }
  if (world.weatherState.kind === 'rain') {
    ctx.strokeStyle = 'rgba(190,220,255,0.5)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 60; i++) { const x = (i * 67 + world.time * 420) % vw; const y = (i * 41 + world.time * 640) % vh; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 15); ctx.stroke(); }
  }
  if (world.weatherState.kind === 'fog') { ctx.fillStyle = 'rgba(225,232,238,0.4)'; ctx.fillRect(0, 0, vw, vh); }
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.45, vw / 2, vh / 2, vh * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function plate(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(13,17,24,0.78)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
}

export function drawMinimap(ctx, world, x, y, size, full) {
  const s = size / WORLD_SIZE;
  ctx.fillStyle = '#20262e'; ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.clip();
  ctx.fillStyle = '#7fae6d'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#ecd28f'; ctx.fillRect(x + 2400 * s, y, 1200 * s, 1600 * s);
  ctx.strokeStyle = '#565d66'; ctx.lineWidth = Math.max(2, ROAD_W * s * 0.7);
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * BLOCK * s + 20 * s, y); ctx.lineTo(x + i * BLOCK * s + 20 * s, y + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + i * BLOCK * s + 20 * s); ctx.lineTo(x + size, y + i * BLOCK * s + 20 * s); ctx.stroke();
  }
  if (full) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `bold ${Math.max(9, size * 0.021)}px sans-serif`; ctx.textAlign = 'center';
    for (let cx = 0; cx < 3; cx++) for (let cy = 0; cy < 3; cy++) ctx.fillText(DISTRICTS[cy * 3 + cx], x + (cx * 1200 + 600) * s, y + (cy * 1200 + 600) * s);
    for (const z of world.turf) { ctx.fillStyle = z.owner === 'Rex' ? 'rgba(87,232,94,0.3)' : 'rgba(232,78,58,0.22)'; ctx.beginPath(); ctx.arc(x + z.x * s, y + z.y * s, z.r * s, 0, 6.29); ctx.fill(); }
  }
  for (const l of LANDMARKS) {
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(x + l.x * s, y + l.y * s, full ? 4 : 2.6, 0, 6.29); ctx.fill();
    if (full) { ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.fillText(l.name.split(' ').map((w) => w[0]).join('').slice(0, 3), x + l.x * s, y + l.y * s - 7); }
  }
  for (const c of world.coins) if (!c.taken) { ctx.fillStyle = '#ffd34e'; ctx.beginPath(); ctx.arc(x + c.x * s, y + c.y * s, 2.6, 0, 6.29); ctx.fill(); }
  for (const c of world.cops) { ctx.fillStyle = '#5f8dff'; ctx.beginPath(); ctx.arc(x + c.x * s, y + c.y * s, 3, 0, 6.29); ctx.fill(); }
  const st = missionStage(world);
  if (st && st.target) { ctx.fillStyle = '#ff5f4e'; ctx.beginPath(); ctx.arc(x + st.target.x * s, y + st.target.y * s, 5, 0, 6.29); ctx.fill(); }
  const p = world.player;
  ctx.save(); ctx.translate(x + p.x * s, y + p.y * s); ctx.rotate(p.angle);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.4); ctx.lineTo(-5, 4.4); ctx.fill(); ctx.restore();
  ctx.restore();
}

export function drawHUD(ctx, world, vw, vh) {
  const p = world.player;
  ctx.textAlign = 'left';
  // Top-left plate: money block + rank.
  plate(ctx, 14, 14, 252, 104);
  ctx.fillStyle = '#ffd34e'; ctx.font = 'bold 21px sans-serif'; ctx.fillText(`$${p.money}`, 26, 42);
  ctx.fillStyle = '#e8ecf1'; ctx.font = '13px sans-serif';
  ctx.fillText(`Score ${p.score} · Cars ${world.stats.carsStolen} · Coins ${world.stats.coinsFound}/10`, 26, 64);
  ctx.fillText(`${formatClock(world.clock)} · ${world.weatherState.kind.toUpperCase()} · Turf ${world.stats.turfHeld}/5`, 26, 84);
  ctx.fillText(`Rank: ${p.rank}`, 26, 104);
  // Wanted stars top-centre.
  const stars = starsOf(world);
  ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < stars ? '#ffd34e' : 'rgba(255,255,255,0.35)'; ctx.fillText('★', vw / 2 - 56 + i * 28, 40); }
  // Mission header.
  const st = missionStage(world);
  if (st) {
    const line1 = `MISSION ${st.missionIdx + 1}/3 — ${st.title} · STAGE ${st.stepIdx + 1}/${st.stepCount}`;
    ctx.font = 'bold 14px sans-serif';
    const w = Math.max(330, ctx.measureText(line1).width + 28);
    plate(ctx, vw / 2 - w / 2, 52, w, 44);
    ctx.fillStyle = '#ffe9a8'; ctx.fillText(line1, vw / 2, 72);
    ctx.font = '12.5px sans-serif'; ctx.fillStyle = '#e8ecf1';
    ctx.fillText(`${st.stepLabel} — ${st.dist}m${st.nextShort ? ` · NEXT: ${st.nextShort}` : ''}`, vw / 2, 90);
    // Edge arrow toward target.
    if (st.target) {
      const a = Math.atan2(st.target.y - p.y, st.target.x - p.x);
      ctx.save(); ctx.translate(vw / 2 + Math.cos(a) * 120, 140 + Math.sin(a) * 30); ctx.rotate(a);
      ctx.fillStyle = '#ff5f4e'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7); ctx.fill(); ctx.restore();
    }
  }
  ctx.textAlign = 'left';
  // SCPD RESPONSE panel (right, under where stars end; clear of minimap).
  if (stars >= 1) {
    const units = [];
    world.cops.forEach((c, i) => units.push({ call: `SCPD-${i + 1}`, d: Math.round(Math.hypot(c.x - p.x, c.y - p.y)), b: 'PURSUIT' }));
    world.footCops.forEach((f, i) => units.push({ call: `SCPD-F${i + 1}`, d: Math.round(Math.hypot(f.x - p.x, f.y - p.y)), b: 'FOOT CHASE' }));
    if (world.roadblock) units.push({ call: 'SCPD-RB', d: Math.round(Math.hypot(world.roadblock.x - p.x, world.roadblock.y - p.y)), b: 'ROADBLOCK' });
    if (world.heli) units.push({ call: 'AIR-1', d: Math.round(Math.hypot(world.heli.x - p.x, world.heli.y - p.y)), b: 'SPOTLIGHT' });
    units.sort((a, b) => a.d - b.d);
    const rows = units.slice(0, 5);
    plate(ctx, vw - 286, 52, 272, 30 + rows.length * 19);
    ctx.fillStyle = '#ff9a8a'; ctx.font = 'bold 12.5px sans-serif';
    ctx.fillText(`SCPD RESPONSE — ${units.length} UNITS · ${stars}★`, vw - 274, 72);
    ctx.font = '12px monospace'; ctx.fillStyle = '#e8ecf1';
    rows.forEach((u, i) => ctx.fillText(`${u.call}  ${u.d}m  ${u.b}`, vw - 274, 94 + i * 19));
  }
  // Minimap bottom-left + district under it.
  drawMinimap(ctx, world, 14, vh - 204, 168, false);
  ctx.fillStyle = 'rgba(13,17,24,0.78)'; ctx.beginPath(); ctx.roundRect(14, vh - 32, 168, 20, 5); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(districtAt(p.x, p.y), 14 + 84, vh - 18);
  ctx.textAlign = 'left';
  // HP bar bottom-centre-left.
  ctx.fillStyle = 'rgba(13,17,24,0.78)'; ctx.fillRect(200, vh - 32, 170, 13);
  ctx.fillStyle = p.hp > 30 ? '#57e85e' : '#e84e3a'; ctx.fillRect(202, vh - 30, 166 * Math.max(0, p.hp) / 100, 9);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10.5px sans-serif'; ctx.fillText('HEALTH', 200, vh - 36);
  // Vault bar.
  if (world.vaultProgress > 0 && world.vaultProgress < 1) {
    plate(ctx, vw / 2 - 170, vh - 96, 340, 26);
    ctx.fillStyle = '#57e85e'; ctx.fillRect(vw / 2 - 164, vh - 90, 328 * world.vaultProgress, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`VAULT ${Math.round(world.vaultProgress * 100)}%`, vw / 2, vh - 79);
    ctx.textAlign = 'left';
  }
  // Dialogue line.
  if (world.dialogue) {
    plate(ctx, vw / 2 - 320, vh - 132, 640, 28);
    ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12.5px sans-serif';
    ctx.fillText(`${world.dialogue.who}: `, vw / 2 - 308, vh - 113);
    const wWho = ctx.measureText(`${world.dialogue.who}: `).width;
    ctx.fillStyle = '#e8ecf1'; ctx.font = '12.5px sans-serif';
    ctx.fillText(world.dialogue.text, vw / 2 - 308 + wWho, vh - 113);
  }
  // Bottom-right stack: radio, vehicle identity, car HP, speed, ammo.
  // Starts high enough that the radio line clears the dialogue plate.
  let ry = vh - 140;
  ctx.textAlign = 'right';
  if (p.car) {
    ctx.fillStyle = '#9fd4e8'; ctx.font = '13px sans-serif';
    ctx.fillText(`♪ ${stationAt(world.radioIdx).name}`, vw - 16, ry); ry += 20;
    ctx.fillStyle = '#e8ecf1'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${p.car.name} · ${Math.max(0, Math.round(p.car.hp))}% CONDITION`, vw - 16, ry); ry += 8;
    ctx.fillStyle = 'rgba(13,17,24,0.78)'; ctx.fillRect(vw - 186, ry, 170, 11);
    ctx.fillStyle = '#57b8e8'; ctx.fillRect(vw - 184, ry + 2, 166 * Math.max(0, p.car.hp) / 100, 7);
    ry += 26;
    ctx.fillStyle = '#ffd34e'; ctx.font = 'bold 19px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed || 0) * 1.35)} KM/H`, vw - 16, ry); ry += 22;
  }
  ctx.fillStyle = '#e8ecf1'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`AMMO ${p.ammo}/${p.reserve}${p.reloadT > 0 ? ' · RELOADING' : ''}`, vw - 16, ry);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(16,10,24,0.45)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34e'; ctx.font = 'bold 74px sans-serif';
  ctx.fillText('SOLMAR HEAT', vw / 2, vh * 0.36);
  ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', vw / 2, vh * 0.36 + 40);
  ctx.font = '16px sans-serif'; ctx.fillStyle = '#ffe9a8';
  ctx.fillText('WASD drive · E enter/exit car · Mouse aim, click shoot · R reload · F punch · Q radio · P pause · M mute', vw / 2, vh * 0.36 + 76);
  ctx.fillText('3 story jobs, races, taxi fares, deliveries, turf wars, Lou\'s Mod Shop — 10 hidden Solmar coins', vw / 2, vh * 0.36 + 102);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press ENTER to play', vw / 2, vh * 0.36 + 140);
  ctx.font = '14.5px sans-serif'; ctx.fillStyle = '#cfe8ff';
  ctx.fillText(`Story ${world.stats.missionsDone}/3 · Coins ${world.stats.coinsFound}/10 · Turf ${world.stats.turfHeld}/5 — progress saves automatically`, vw / 2, vh * 0.36 + 168);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12.5px sans-serif';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', vw / 2, vh - 26);
  ctx.textAlign = 'left';
}

export function drawMapScreen(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(10,13,20,0.93)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd34e'; ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR — MAP & RECORD', 36, 48);
  drawMinimap(ctx, world, 36, 70, 560, true);
  const colX = [640, 950]; let ys = [96, 96];
  const line = (ci, text, color, bold) => {
    ctx.fillStyle = color || '#e8ecf1'; ctx.font = `${bold ? 'bold ' : ''}14.5px sans-serif`;
    ctx.fillText(text, colX[ci], ys[ci]); ys[ci] += 24;
  };
  const s = world.stats; const p = world.player;
  line(0, 'STORY MISSIONS', '#ffe9a8', true);
  ['Wheels for Lou', 'The Palms Package', 'National Bank Job'].forEach((n, i) => line(0, `${n} — ${world.missions.done[i] ? 'DONE' : i === world.stats.missionsDone ? 'NEXT' : 'LOCKED'}`));
  line(0, `Story progress: ${s.missionsDone}/3`, '#9fd4e8');
  line(0, 'ACTIVITIES', '#ffe9a8', true);
  line(0, `Races won: ${s.racesWon}/3`);
  line(0, `Turf zones held: ${s.turfHeld}/5`);
  line(0, `Solmar coins: ${s.coinsFound}/10`);
  line(0, `Cars stolen: ${s.carsStolen}`);
  line(1, 'CAREER', '#ffe9a8', true);
  line(1, `Taxi fares: ${s.fares}`);
  line(1, `Deliveries: ${s.deliveries}`);
  line(1, `Near misses: ${s.nearMisses}`);
  line(1, `Mods bought: ${s.modsBought}/9`);
  line(1, `Rank: ${p.rank}`);
  line(1, `Money: $${p.money}`);
  line(1, `Play time: ${Math.floor(s.playTime / 60)}m ${Math.floor(s.playTime % 60)}s`);
  ctx.fillStyle = '#cfe8ff'; ctx.font = '14px sans-serif';
  ctx.fillText('Save exists: yes · Progress saves automatically', 36, vh - 48);
  ctx.fillText('P / Esc resume · WASD drive · E car · R reload · Q radio', 640, vh - 48);
}

export function drawWasted(ctx, world, vw, vh, busted) {
  ctx.fillStyle = 'rgba(30,4,4,0.66)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = busted ? '#7fb2ff' : '#e84e3a'; ctx.font = 'bold 64px sans-serif';
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', vw / 2, vh / 2);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
  ctx.fillText(busted ? 'The SCPD got Rex. He wakes up outside HQ, lighter in the pocket.' : 'Rex wakes up at Solmar General Hospital.', vw / 2, vh / 2 + 36);
  ctx.textAlign = 'left';
}

export function drawModShop(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(10,13,20,0.9)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd34e'; ctx.font = 'bold 28px sans-serif';
  ctx.fillText("LOU'S MOD SHOP", 60, 70);
  ctx.fillStyle = '#e8ecf1'; ctx.font = '16px sans-serif';
  ctx.fillText(`Money: $${world.player.money} — keys 1/2/3 buy the next level, Esc leaves.`, 60, 104);
}
