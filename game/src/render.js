// Solmar Heat — render.js
// Canvas renderer: extruded buildings, roads with lane dashes, cars,
// peds, police, effects, HUD and a live minimap, plus the title,
// pause, mod-shop, WASTED and BUSTED screens. Golden-hour wash.

import { WORLD_SIZE, BLOCK, ROAD_W } from './config.js';
import { dist } from './random.js';
import { roadCoord } from './world.js';
import { districtAt } from './landmarks.js';
import { formatClock, skyPhase } from './weather.js';
import { missionTargetPos, MISSIONS } from './missions.js';
import { modSummary } from './modshop.js';
import { zonesHeld } from './turf.js';

export function cameraFor(world, vw, vh) {
  const p = world.player;
  return { x: Math.max(0, Math.min(WORLD_SIZE - vw, p.x - vw / 2)), y: Math.max(0, Math.min(WORLD_SIZE - vh, p.y - vh / 2)) };
}
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

export function drawWorld(ctx, world, vw, vh) {
  const cam = cameraFor(world, vw, vh);
  const phase = skyPhase(world.weather.clock);
  const bg = phase === 'night' ? '#2c3550' : phase === 'dusk' ? '#c97a4e' : phase === 'golden' ? '#e8a860' : '#8fc7d9';
  rect(ctx, 0, 0, vw, vh, bg);
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  // Ground: blocks of grass / sand / plaza.
  rect(ctx, 0, 0, WORLD_SIZE, WORLD_SIZE, '#79a85b');
  rect(ctx, 2400, 400, 800, 800, '#eed9a4'); // beach block
  rect(ctx, 400, 2400, 800, 800, '#a8d08d'); // park block
  // Roads.
  for (let i = 0; i < 9; i++) {
    const c = roadCoord(i);
    rect(ctx, c - ROAD_W / 2, 0, ROAD_W, WORLD_SIZE, '#3c4148');
    rect(ctx, 0, c - ROAD_W / 2, WORLD_SIZE, ROAD_W, '#3c4148');
  }
  ctx.strokeStyle = '#e8e2b0'; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
  for (let i = 0; i < 9; i++) {
    const c = roadCoord(i);
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD_SIZE, c); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Canal Row canal + bridges.
  rect(ctx, 2480, 1560, 1040, 70, '#3d9db8'); rect(ctx, 2760, 1520, 60, 150, '#8a6f4d'); rect(ctx, 3160, 1520, 60, 150, '#8a6f4d');
  // Buildings with a simple extruded top.
  for (const b of world.buildings) {
    rect(ctx, b.x + 7, b.y + 9, b.w, b.h, 'rgba(0,0,0,0.22)');
    rect(ctx, b.x, b.y, b.w, b.h, b.hue);
    rect(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, phase === 'night' ? '#5a6274' : '#f2e3c2');
    ctx.fillStyle = phase === 'night' ? '#ffd76b' : '#7a94a8';
    for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++) ctx.fillRect(b.x + 12 + wx * 22, b.y + 12 + wy * 22, 9, 12);
  }
  // Park trees + beach umbrellas.
  ctx.fillStyle = '#3f7d33';
  for (let i = 0; i < 26; i++) { const x = 460 + (i * 97) % 680, y = 2460 + (i * 131) % 680; ctx.beginPath(); ctx.arc(x, y, 17, 0, 6.29); ctx.fill(); }
  // Landmark markers.
  ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
  for (const lm of world.landmarks) {
    ctx.fillStyle = lm.color; ctx.beginPath(); ctx.arc(lm.x, lm.y, 13, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#14202b'; ctx.fillText(lm.name, lm.x, lm.y - 20);
  }
  // Coins + pickups.
  for (const coin of world.collectibles.coins) if (!coin.taken) { ctx.fillStyle = '#ffd72e'; ctx.beginPath(); ctx.arc(coin.x, coin.y, 10, 0, 6.29); ctx.fill(); ctx.fillStyle = '#8a6d00'; ctx.fillText('$', coin.x, coin.y + 5); }
  for (const pk of world.collectibles.pickups) if (!pk.taken) rect(ctx, pk.x - 9, pk.y - 9, 18, 18, pk.kind === 'health' ? '#e23b3b' : '#3b78e2');
  // Roadblocks.
  for (const rb of world.roadblocks) { ctx.fillStyle = '#e86a2e'; for (let i = -2; i <= 2; i++) ctx.fillRect(rb.x + i * 22 - 8, rb.y - 6, 16, 12); }
  // Cars.
  for (const c of world.cars) drawCar(ctx, c, world);
  // Gang.
  for (const g of world.gang) {
    ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#2ee66b'; for (let i = 0; i < Math.ceil(g.hp / 10); i++) ctx.fillRect(g.x - 14 + i * 9, g.y - 26, 7, 4);
  }
  // Cops on foot.
  for (const cop of world.cops) if (!cop.inCar) { ctx.fillStyle = '#274b8f'; ctx.beginPath(); ctx.arc(cop.x, cop.y, 11, 0, 6.29); ctx.fill(); }
  // Peds.
  for (const ped of world.peds) { ctx.fillStyle = ped.color; ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, 6.29); ctx.fill(); }
  // Helicopter + shadow + searchlight.
  if (world.heli) {
    const h = world.heli;
    ctx.fillStyle = 'rgba(255,240,170,0.20)'; ctx.beginPath(); ctx.arc(h.x + 30, h.y + 60, 95, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(h.x + 14, h.y + 26, 30, 10, 0, 0, 6.29); ctx.fill();
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.angle);
    rect(ctx, -26, -9, 52, 18, '#eef2f5'); rect(ctx, -44, -3, 20, 6, '#274b8f'); rect(ctx, -4, -34, 8, 68, '#222');
    ctx.restore();
  }
  // Bullets + particles.
  ctx.fillStyle = '#ffe27a'; for (const b of world.bullets) ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
  for (const pt of world.particles) { ctx.fillStyle = pt.color; ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4); }
  // Player (on foot) — Rex in a red jacket.
  const p = world.player;
  if (!p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 12, 5, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#c0272d'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 6, 0, 6.29); ctx.fill();
  }
  // Mission beacon + vault circle.
  if (world.mission) {
    const step = MISSIONS[world.mission.idx].steps[world.mission.step];
    const pos = missionTargetPos(world, step);
    ctx.strokeStyle = '#ffd72e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 42 + Math.sin(world.time * 4) * 5, 0, 6.29); ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,46,0.13)'; ctx.beginPath(); ctx.moveTo(pos.x, pos.y - 900); ctx.lineTo(pos.x - 30, pos.y); ctx.lineTo(pos.x + 30, pos.y); ctx.fill();
    if (step.kind === 'vault') {
      ctx.strokeStyle = '#3ee66b'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 90, -1.57, -1.57 + (world.vaultProgress || 0) * 6.29); ctx.stroke();
    }
  }
  ctx.restore();
  drawWeatherFx(ctx, world, vw, vh);
  drawWarmWash(ctx, vw, vh, phase);
  return cam;
}
function drawCar(ctx, c, world) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 5, c.len, c.wid);
  ctx.fillStyle = c.wrecked ? '#555' : c.color; ctx.fillRect(-c.len / 2, -c.wid / 2, c.len, c.wid);
  ctx.fillStyle = c.police ? '#274b8f' : '#22303c'; ctx.fillRect(-c.len * 0.18, -c.wid / 2 + 3, c.len * 0.36, c.wid - 6);
  if (c.police) { ctx.fillStyle = (Math.sin(world.time * 9 + c.sirenPhase) > 0) ? '#ff4444' : '#4488ff'; ctx.fillRect(-4, -3, 8, 6); }
  if (c.isPlayerCar) { ctx.strokeStyle = '#ffd72e'; ctx.lineWidth = 3; ctx.strokeRect(-c.len / 2 - 3, -c.wid / 2 - 3, c.len + 6, c.wid + 6); }
  if (c.type === 'taxi') { ctx.fillStyle = '#14202b'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); }
  ctx.restore();
}
function drawWeatherFx(ctx, world, vw, vh) {
  if (world.weather.kind === 'rain') { ctx.strokeStyle = 'rgba(180,220,255,0.55)'; ctx.lineWidth = 1.5; for (const r of world.weather.rain) { ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 4, r.y + 13); ctx.stroke(); } }
  if (world.weather.fogAlpha > 0.02) { ctx.fillStyle = 'rgba(225,230,235,' + world.weather.fogAlpha + ')'; ctx.fillRect(0, 0, vw, vh); }
}
function drawWarmWash(ctx, vw, vh, phase) {
  if (phase === 'golden' || phase === 'dusk') { ctx.fillStyle = 'rgba(255,150,50,0.10)'; ctx.fillRect(0, 0, vw, vh); }
  if (phase === 'night') { ctx.fillStyle = 'rgba(10,15,40,0.22)'; ctx.fillRect(0, 0, vw, vh); }
  const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.42, vw / 2, vh / 2, vh * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,8,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
}
export function drawHUD(ctx, world, vw, vh) {
  const p = world.player;
  ctx.textAlign = 'left'; ctx.font = 'bold 20px system-ui';
  ctx.fillStyle = 'rgba(10,16,24,0.62)'; ctx.fillRect(14, 12, 252, 104);
  ctx.fillStyle = '#7ee787'; ctx.fillText('$' + p.money.toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#fff'; ctx.font = '14px system-ui';
  ctx.fillText('Score ' + p.score + '  Cars ' + p.carsStolen + '  Coins ' + p.coins + '/10', 24, 62);
  ctx.fillText(formatClock(world.weather.clock) + '  ' + world.weather.kind + '  Turf ' + zonesHeld(world.turf || { zones: [] }) + '/5', 24, 82);
  ctx.fillStyle = '#e23b3b'; ctx.fillRect(24, 92, 130, 10);
  ctx.fillStyle = '#3ee66b'; ctx.fillRect(24, 92, 130 * Math.max(0, p.health) / 100, 10);
  ctx.fillStyle = '#fff'; ctx.fillText('HP', 160, 102);
  // Wanted stars top-right.
  ctx.font = '30px system-ui'; ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < world.wanted.stars ? '#ffd72e' : 'rgba(255,255,255,0.25)'; ctx.fillText('★', vw - 18 - (4 - i) * 32, 40); }
  ctx.font = '14px system-ui'; ctx.fillStyle = '#fff';
  if (world.wanted.bust > 0) ctx.fillText('BUSTED IN ' + (1.6 - world.wanted.bust).toFixed(1), vw - 18, 62);
  // Objective banner.
  if (world.mission) {
    const step = MISSIONS[world.mission.idx].steps[world.mission.step];
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(10,16,24,0.66)'; ctx.fillRect(vw / 2 - 300, 14, 600, 46);
    ctx.fillStyle = '#ffd72e'; ctx.font = 'bold 16px system-ui';
    ctx.fillText(step.label + '  —  ' + (world.mission.distance || 0) + 'm', vw / 2, 43);
    drawEdgeArrow(ctx, world, vw, vh);
  } else if (world.storyDone) {
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '14px system-ui';
    ctx.fillText('Story complete — free roam. Races, fares, turf and Lou\'s Mod Shop stay open.', vw / 2, 30);
  }
  // Race HUD.
  if (world.race && world.race.active) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui';
    ctx.fillText('RACE ' + world.race.idx + '/' + world.race.active.points.length + '  ' + world.race.time.toFixed(1) + 's / par ' + world.race.active.par + 's', vw / 2, vh - 54);
  }
  // Vault progress bar.
  if (world.mission && MISSIONS[world.mission.idx].steps[world.mission.step].kind === 'vault') {
    ctx.fillStyle = 'rgba(10,16,24,0.66)'; ctx.fillRect(vw / 2 - 170, vh - 96, 340, 26);
    ctx.fillStyle = '#3ee66b'; ctx.fillRect(vw / 2 - 164, vh - 90, 328 * (world.vaultProgress || 0), 14);
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('VAULT ' + Math.round((world.vaultProgress || 0) * 100) + '%', vw / 2, vh - 58);
  }
  // Ammo + speed bottom-right.
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui';
  ctx.fillText(p.reloading > 0 ? 'RELOADING…' : 'AMMO ' + p.ammo + '/' + p.reserve, vw - 18, vh - 46);
  if (p.car) {
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.72) + ' KM/H', vw - 18, vh - 20);
    ctx.fillStyle = '#e8a33c'; ctx.fillRect(vw - 168, vh - 16, 120, 7);
    ctx.fillStyle = '#3ee66b'; ctx.fillRect(vw - 168, vh - 16, 120 * Math.max(0, p.car.hp) / p.car.maxHp, 7);
  }
  drawMinimap(ctx, world, vw, vh);
  // Banner (MISSION PASSED etc).
  if (world.banner && world.banner.t > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,16,24,0.72)'; ctx.fillRect(vw / 2 - 320, vh * 0.3, 640, 92);
    ctx.fillStyle = '#ffd72e'; ctx.font = 'bold 40px system-ui'; ctx.fillText(world.banner.text, vw / 2, vh * 0.3 + 48);
    ctx.fillStyle = '#fff'; ctx.font = '18px system-ui'; ctx.fillText(world.banner.sub || '', vw / 2, vh * 0.3 + 76);
  }
  // Dialogue line.
  if (world.dialogue && world.dialogue.length) {
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(10,16,24,0.7)'; ctx.fillRect(vw / 2 - 360, vh - 132, 720, 34);
    ctx.fillStyle = '#ffe9b0'; ctx.font = '15px system-ui'; ctx.fillText(world.dialogue[0], vw / 2, vh - 110);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '13px system-ui';
  ctx.fillText(districtAt(p.x, p.y), vw - 158, vh - 168);
}
function drawEdgeArrow(ctx, world, vw, vh) {
  const p = world.player; const step = MISSIONS[world.mission.idx].steps[world.mission.step];
  const pos = missionTargetPos(world, step);
  const a = Math.atan2(pos.y - p.y, pos.x - p.x);
  ctx.save(); ctx.translate(vw / 2 + Math.cos(a) * 120, 96 + Math.sin(a) * 26); ctx.rotate(a);
  ctx.fillStyle = '#ffd72e'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.fill(); ctx.restore();
}
export function drawMinimap(ctx, world, vw, vh) {
  const S = 148, X = vw - S - 14, Y = vh - S - 178; const k = S / WORLD_SIZE;
  ctx.fillStyle = 'rgba(14,22,18,0.8)'; ctx.fillRect(X, Y, S, S);
  ctx.strokeStyle = '#565d66'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const c = roadCoord(i) * k; ctx.beginPath(); ctx.moveTo(X + c, Y); ctx.lineTo(X + c, Y + S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X, Y + c); ctx.lineTo(X + S, Y + c); ctx.stroke(); }
  for (const coin of world.collectibles.coins) if (!coin.taken) { ctx.fillStyle = '#ffd72e'; ctx.fillRect(X + coin.x * k - 1.5, Y + coin.y * k - 1.5, 3, 3); }
  for (const cop of world.cops) { ctx.fillStyle = '#5e9bff'; ctx.fillRect(X + cop.x * k - 2, Y + cop.y * k - 2, 4, 4); }
  for (const lm of world.landmarks) { ctx.fillStyle = lm.color; ctx.fillRect(X + lm.x * k - 1.5, Y + lm.y * k - 1.5, 3, 3); }
  if (world.mission) { const pos = missionTargetPos(world, MISSIONS[world.mission.idx].steps[world.mission.step]); ctx.fillStyle = '#ffd72e'; ctx.beginPath(); ctx.arc(X + pos.x * k, Y + pos.y * k, 4.5, 0, 6.29); ctx.fill(); }
  const p = world.player;
  ctx.save(); ctx.translate(X + p.x * k, Y + p.y * k); ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.fill(); ctx.restore();
}
export function drawTitle(ctx, world, vw, vh) {
  drawWorld(ctx, world, vw, vh); drawHUD(ctx, world, vw, vh);
  ctx.fillStyle = 'rgba(16,8,4,0.45)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd72e'; ctx.font = 'bold 76px system-ui'; ctx.fillText('SOLMAR HEAT', vw / 2, vh * 0.34);
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', vw / 2, vh * 0.34 + 42);
  ctx.font = '16px system-ui'; ctx.fillStyle = '#ffe9b0';
  ctx.fillText('You are Rex Marlowe, back in Solmar with a jacket and a debt. Mama Lou has work.', vw / 2, vh * 0.34 + 74);
  ctx.fillStyle = '#fff';
  ctx.fillText('WASD drive · E steal/exit · Mouse aim + click shoot · R reload · F punch · Space handbrake', vw / 2, vh * 0.34 + 116);
  ctx.fillText('Shift sprint · T taxi fare · P pause · S save · M mute', vw / 2, vh * 0.34 + 140);
  ctx.fillStyle = '#7ee787'; ctx.font = 'bold 19px system-ui';
  ctx.fillText(world.hasSave ? 'Press ENTER to continue — or N for a new game' : 'Press ENTER to play', vw / 2, vh * 0.34 + 182);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '13px system-ui';
  ctx.fillText('3 story missions, races, turf wars, 10 hidden Solmar coins, taxi fares — progress saves automatically', vw / 2, vh - 54);
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', vw / 2, vh - 32);
  ctx.textAlign = 'left';
}
export function drawPause(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd72e'; ctx.font = 'bold 44px system-ui'; ctx.fillText('PAUSED', vw / 2, vh * 0.3);
  ctx.fillStyle = '#fff'; ctx.font = '17px system-ui';
  ctx.fillText('Missions done: ' + world.missionsDone + '/3   Story: ' + (world.storyDone ? 'complete' : 'in progress'), vw / 2, vh * 0.3 + 44);
  ctx.fillText('Races won: ' + Object.keys(world.raceDone || {}).length + '/3   Turf held: ' + zonesHeld(world.turf || { zones: [] }) + '/5   Mods bought: ' + (world.modBuys || 0), vw / 2, vh * 0.3 + 72);
  ctx.fillText('Press S to save · P or Esc to resume', vw / 2, vh * 0.3 + 108);
  ctx.textAlign = 'left';
}
export function drawModShop(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.78)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center'; ctx.fillStyle = '#e879f0'; ctx.font = 'bold 40px system-ui'; ctx.fillText("LOU'S MOD SHOP", vw / 2, vh * 0.24);
  ctx.fillStyle = '#fff'; ctx.font = '16px system-ui'; ctx.fillText('Cash: $' + world.player.money + ' — press 1 / 2 / 3 to buy, Esc to leave', vw / 2, vh * 0.24 + 36);
  modSummary(world).forEach((m, i) => {
    ctx.fillStyle = '#ffd72e'; ctx.font = 'bold 21px system-ui';
    ctx.fillText((i + 1) + '. ' + m.name + '  Lv ' + m.level + '/3' + (m.next ? '  —  $' + m.next : '  —  MAX'), vw / 2, vh * 0.24 + 84 + i * 36);
  });
  ctx.textAlign = 'left';
}
export function drawEndScreen(ctx, world, vw, vh, kind) {
  ctx.fillStyle = kind === 'wasted' ? 'rgba(90,6,6,0.66)' : 'rgba(10,20,70,0.66)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center'; ctx.fillStyle = kind === 'wasted' ? '#ff6b5e' : '#8fb8ff';
  ctx.font = 'bold 64px system-ui'; ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', vw / 2, vh * 0.44);
  ctx.fillStyle = '#fff'; ctx.font = '17px system-ui';
  ctx.fillText(kind === 'wasted' ? 'You wake up at Solmar General Hospital.' : 'Fine paid: $' + (world.lastFine || 0) + '. You walk out of the safehouse.', vw / 2, vh * 0.44 + 42);
  ctx.fillText('Press ENTER to continue', vw / 2, vh * 0.44 + 74);
  ctx.textAlign = 'left';
}
export { dist };
