// render.js — everything drawn: the city, the cars, the police, the HUD,
// the minimap, the day/night sky, rain and fog, and the menu screens.

let canvas = null;
let ctx = null;
const VIEW_W = 1280;
const VIEW_H = 720;

function initCanvas() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  installInput(canvas);
}

function viewScale() {
  return (VIEW_W / 1000) * viewRange();
}

function worldToScreen(x, y) {
  const s = viewScale();
  return { x: (x - G.camX) * s + VIEW_W / 2, y: (y - G.camY) * s + VIEW_H / 2 };
}

function drawCarShape(x, y, angle, color, w, h, taxi) {
  const p = worldToScreen(x, y);
  const s = viewScale();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w * s / 2 + 3, -h * s / 2 + 4, w * s, h * s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w * s / 2, -h * s / 2, w * s, h * s, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.fillRect(-w * s * 0.18, -h * s * 0.32, w * s * 0.36, h * s * 0.64);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w * s * 0.42, -h * s * 0.38, 3, 4);
  ctx.fillRect(w * s * 0.42, h * s * 0.38 - 4, 3, 4);
  if (taxi) {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

function drawWorld() {
  const s = viewScale();
  const x0 = G.camX - VIEW_W / 2 / s - 40, x1 = G.camX + VIEW_W / 2 / s + 40;
  const y0 = G.camY - VIEW_H / 2 / s - 40, y1 = G.camY + VIEW_H / 2 / s + 40;
  // Ground.
  ctx.fillStyle = '#8fae6d';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Roads.
  ctx.fillStyle = '#3a3f47';
  for (const r of CFG.roads) {
    if (r > y0 && r < y1) ctx.fillRect(0, (r - CFG.roadHalf - G.camY) * s + VIEW_H / 2, VIEW_W, CFG.roadHalf * 2 * s);
    if (r > x0 && r < x1) ctx.fillRect((r - CFG.roadHalf - G.camX) * s + VIEW_W / 2, 0, CFG.roadHalf * 2 * s, VIEW_H);
  }
  // Dashed centre lines.
  ctx.fillStyle = '#e8d44d';
  for (const r of CFG.roads) {
    for (let v = 0; v < CFG.world; v += 60) {
      if (r > y0 && r < y1 && v > x0 && v < x1) ctx.fillRect((v - G.camX) * s + VIEW_W / 2, (r - G.camY) * s + VIEW_H / 2 - 1, 26 * s, 2);
      if (r > x0 && r < x1 && v > y0 && v < y1) ctx.fillRect((r - G.camX) * s + VIEW_W / 2 - 1, (v - G.camY) * s + VIEW_H / 2, 2, 26 * s);
    }
  }
  // Canals (water) with bridges.
  for (const c of CANALS) {
    const a = worldToScreen(c.x0, c.y0), b = worldToScreen(c.x1, c.y1);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(a.x, a.y + 6, b.x - a.x, 2);
  }
  for (const br of BRIDGES) {
    const a = worldToScreen(br.x - br.half, br.y0), b = worldToScreen(br.x + br.half, br.y1);
    ctx.fillStyle = '#6b5a43';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  // Buildings and parks.
  for (const b of BUILDINGS) {
    if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue;
    const a = worldToScreen(b.x0, b.y0), c = worldToScreen(b.x1, b.y1);
    if (b.park) {
      ctx.fillStyle = '#6da35a';
      ctx.fillRect(a.x, a.y, c.x - a.x, c.y - a.y);
    } else {
      ctx.fillStyle = 'hsl(' + b.hue + ',32%,58%)';
      ctx.fillRect(a.x, a.y, c.x - a.x, c.y - a.y);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(a.x, a.y, c.x - a.x, 6);
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(2, Math.floor((c.x - a.x) / 26));
      const rows = Math.max(2, Math.floor((c.y - a.y) / 26));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.seed) % 3 === 0) ctx.fillRect(a.x + 8 + i * 26, a.y + 10 + j * 26, 8, 6);
      }
    }
  }
  // Trees.
  for (const t of TREES) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    const p = worldToScreen(t.x, t.y);
    ctx.fillStyle = '#2f7a33';
    ctx.beginPath(); ctx.arc(p.x, p.y, t.s * s, 0, Math.PI * 2); ctx.fill();
  }
  drawLandmarks();
}

function drawLandmarks() {
  const s = viewScale();
  const lm = (x, y, label, color, r) => {
    const p = worldToScreen(x, y);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, p.y - (r + 8) * s);
  };
  lm(LANDMARKS.hq.x, LANDMARKS.hq.y, 'SCPD HQ', '#27408b', 26);
  lm(LANDMARKS.paint.x, LANDMARKS.paint.y, "Lou's Paint Shop", '#c25e00', 22);
  lm(LANDMARKS.marina.x, LANDMARKS.marina.y, 'Marina', '#0e7a6b', 22);
  lm(LANDMARKS.pier.x, LANDMARKS.pier.y, 'Pier 9', '#7a4a21', 22);
  lm(LANDMARKS.plaza.x, LANDMARKS.plaza.y, 'Plaza', '#5b7a2f', 20);
  lm(LANDMARKS.hospital.x, LANDMARKS.hospital.y, 'Hospital', '#b03030', 20);
  lm(LANDMARKS.depot.x, LANDMARKS.depot.y, 'Depot', '#5b4a7a', 20);
}

function drawCoins() {
  const s = viewScale();
  for (let i = 0; i < COIN_CELLS.length; i++) {
    if (coinTaken(i)) continue;
    const c = COIN_CELLS[i];
    const p = worldToScreen(c.x, c.y);
    const bob = Math.sin(G.time * 3 + i) * 3;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, 9 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a87c00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#a87c00';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('S', p.x, p.y + bob + 3);
  }
}

function drawEntities() {
  // Taxi fare marker.
  if (G.taxi) {
    const t = G.taxi.state === 'riding' ? G.taxi.dest : { x: G.taxi.x, y: G.taxi.y };
    const p = worldToScreen(t.x, t.y);
    ctx.fillStyle = G.taxi.state === 'riding' ? '#37d67a' : '#ffd23f';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.taxi.state === 'riding' ? '▼' : '$', p.x, p.y - 14);
  }
  // Delivery marker.
  if (G.delivery) {
    const d = G.delivery.state === 'pickup' ? { x: G.delivery.x, y: G.delivery.y } : G.delivery.dest;
    const p = worldToScreen(d.x, d.y);
    ctx.fillStyle = '#ff9f1c';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▣', p.x, p.y - 14);
  }
  // Race flags and checkpoints.
  for (const r of RACES) {
    const p = worldToScreen(r.start.x, r.start.y);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⚑', p.x, p.y - 12);
  }
  if (G.race) {
    const cp = G.race.checkpoints[G.race.index];
    if (cp) {
      const p = worldToScreen(cp.x, cp.y);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 * viewScale(), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CP ' + (G.race.index + 1) + '/' + G.race.checkpoints.length, p.x, p.y - 32);
    }
  }
  // Mission target.
  if (G.mission) {
    const m = G.mission;
    const tx = m.stage === 'pickup' && m.def.pickup ? m.def.pickup.x : m.def.target.x;
    const ty = m.stage === 'pickup' && m.def.pickup ? m.def.pickup.y : m.def.target.y;
    const p = worldToScreen(tx, ty);
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30 * viewScale(), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff4d6d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★ TARGET', p.x, p.y - 36);
  }
  // Ledger pickup marker during job 7.
  if (G.mission && G.mission.def.id === 7 && G.mission.stage === 'ledger') {
    const p = worldToScreen(LANDMARKS.hq.x, LANDMARKS.hq.y);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⬢ LEDGER', p.x, p.y - 40);
  }
  // Pickups.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const p = worldToScreen(pk.x, pk.y);
    ctx.fillStyle = '#37d67a';
    ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('AMMO', p.x, p.y + 4);
  }
  // Parked cars.
  for (const c of G.cars) {
    if (c.totaled) {
      drawCarShape(c.x, c.y, c.angle, '#3a3a3a', 46, 24, false);
      const p = worldToScreen(c.x, c.y);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('WRECK', p.x, p.y - 22);
    } else {
      drawCarShape(c.x, c.y, c.angle, c.color, 46, 24, !!CARS[c.id].taxi);
    }
  }
  // Traffic.
  for (const t of G.traffic) drawCarShape(t.x, t.y, t.angle, t.color, 44, 22, false);
  // Pedestrians.
  for (const p of G.peds) {
    const s = worldToScreen(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, 7 * viewScale(), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(s.x, s.y - 9 * viewScale(), 4 * viewScale(), 0, Math.PI * 2); ctx.fill();
  }
  // Roadblocks: two cruisers + striped barrier ahead of the player.
  for (const rb of G.roadblocks) {
    drawCarShape(rb.x - 26, rb.y, rb.angle, '#27408b', 44, 22, false);
    drawCarShape(rb.x + 26, rb.y, rb.angle, '#27408b', 44, 22, false);
    const p = worldToScreen(rb.x, rb.y);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(p.x - 40, p.y - 5, 80, 10);
    ctx.fillStyle = '#111';
    for (let i = 0; i < 5; i++) ctx.fillRect(p.x - 40 + i * 16, p.y - 5, 8, 10);
  }
  // Police cars.
  for (const pc of G.police) {
    if (pc.disabled) continue;
    drawCarShape(pc.x, pc.y, pc.angle, '#27408b', 46, 24, false);
    const p = worldToScreen(pc.x, pc.y);
    ctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath(); ctx.arc(p.x, p.y - 12, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Helicopter + shadow + searchlight.
  if (G.heli) {
    const h = G.heli;
    const sh = worldToScreen(h.x + 26, h.y + 26);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    const p = worldToScreen(h.x, h.y);
    ctx.fillStyle = 'rgba(255,255,220,0.18)';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 90, p.y + 150); ctx.lineTo(p.x + 90, p.y + 150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d2b3a';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 24, 11, h.angle, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9fb6c9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 26, p.y); ctx.lineTo(p.x + 26, p.y); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SCPD HELI', p.x, p.y - 20);
  }
  // Guards with health pips.
  for (const g of G.guards) {
    if (g.hp <= 0) continue;
    const p = worldToScreen(g.x, g.y);
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5a5a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(p.x - 12 + i * 12, p.y - 18, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < Math.ceil(g.hp / 34) ? '#ff5a5a' : 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
  }
  // Turf attackers.
  if (G.turfChallenge) {
    for (const a of G.turfChallenge.attackers) {
      if (a.hp <= 0) continue;
      const p = worldToScreen(a.x, a.y);
      ctx.fillStyle = '#c22e6b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(G.turfChallenge.crew, p.x, p.y - 14);
    }
  }
  // Bullets.
  ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 3;
  for (const b of G.bullets) {
    const a = worldToScreen(b.px, b.py), c = worldToScreen(b.x, b.y);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  // Particles.
  for (const pt of G.particles) {
    const p = worldToScreen(pt.x, pt.y);
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    ctx.globalAlpha = 1;
  }
  // Player.
  const pp = worldToScreen(G.player.x, G.player.y);
  if (G.player.onFoot) {
    ctx.fillStyle = '#e33f2f';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 10 * viewScale(), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pp.x, pp.y);
    ctx.lineTo(pp.x + Math.cos(G.player.angle) * 18, pp.y + Math.sin(G.player.angle) * 18); ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(pp.x, pp.y - 4, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    const car = G.cars[G.player.carId];
    if (car) drawCarShape(car.x, car.y, car.angle, car.color, 48, 25, !!CARS[car.id].taxi);
  }
}

function drawSkyAndWeather() {
  const phase = skyPhaseForHour(G.clockHours);
  if (phase === 'dusk') {
    ctx.fillStyle = 'rgba(255,120,40,0.16)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else if (phase === 'night') {
    ctx.fillStyle = 'rgba(8,12,40,0.42)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Streetlight pools.
    for (const r of CFG.roads) {
      for (let v = 120; v < CFG.world; v += 530) {
        const p1 = worldToScreen(r, v), p2 = worldToScreen(v, r);
        ctx.fillStyle = 'rgba(255,220,120,0.10)';
        ctx.beginPath(); ctx.arc(p1.x, p1.y, 46, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(p2.x, p2.y, 46, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  if (G.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = (i * 137 + G.time * 900) % VIEW_W;
      const ry = (i * 211 + G.time * 1400) % VIEW_H;
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 18);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,150,200,0.08)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (G.weather === 'fog') {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 140, VIEW_W / 2, VIEW_H / 2, 520);
    g.addColorStop(0, 'rgba(200,210,220,0)');
    g.addColorStop(1, 'rgba(200,210,220,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawMinimap() {
  const mw = 190, mh = 190, mx = VIEW_W - mw - 14, my = 14;
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
  ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12);
  const sx = mw / CFG.world, sy = mh / CFG.world;
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  // Turf zones by owner colour.
  for (const z of TURF_ZONES) {
    ctx.fillStyle = G.turf[z.id] === 'player' ? 'rgba(55,214,122,0.35)' : 'rgba(194,46,107,0.30)';
    ctx.fillRect(mx + z.x0 * sx, my + z.y0 * sy, (z.x1 - z.x0) * sx, (z.y1 - z.y0) * sy);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  for (const r of CFG.roads) {
    ctx.beginPath(); ctx.moveTo(mx + r * sx, my); ctx.lineTo(mx + r * sx, my + mh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + r * sy); ctx.lineTo(mx + mw, my + r * sy); ctx.stroke();
  }
  for (let i = 0; i < COIN_CELLS.length; i++) if (!coinTaken(i)) dot(COIN_CELLS[i].x, COIN_CELLS[i].y, '#ffd23f', 3);
  for (const c of G.cars) if (!c.totaled) dot(c.x, c.y, '#7ec8ff', 3);
  if (G.mission) {
    const m = G.mission;
    const tx = m.stage === 'pickup' && m.def.pickup ? m.def.pickup.x : m.def.target.x;
    const ty = m.stage === 'pickup' && m.def.pickup ? m.def.pickup.y : m.def.target.y;
    dot(tx, ty, '#ff4d6d', 5);
  }
  if (G.race) { const cp = G.race.checkpoints[G.race.index]; if (cp) dot(cp.x, cp.y, '#ffd23f', 5); }
  for (const r of RACES) dot(r.start.x, r.start.y, '#fff', 3);
  for (const p of G.police) dot(p.x, p.y, '#ff2d2d', 3);
  dot(G.player.x, G.player.y, '#37d67a', 5);
  // District name under the minimap.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(districtAt(G.player.x, G.player.y), mx + mw / 2, my + mh + 26);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '13px sans-serif';
  ctx.fillText('Turf: ' + turfHeldCount() + '/' + TURF_ZONES.length + ' held', mx + mw / 2, my + mh + 44);
}

function drawHUD() {
  ctx.textAlign = 'left';
  // Top-left money panel.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  ctx.fillRect(12, 12, 300, 118);
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('$' + Math.floor(G.money), 24, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('Score ' + Math.floor(G.score) + '   Cars ' + G.carsStolen + '   Fares ' + G.faresDone, 24, 68);
  ctx.fillText('Near-miss ' + G.nearMisses + '   Coins ' + G.coinsGot.length + '/10', 24, 90);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('Rank: ' + RANKS[G.rankIndex].name, 24, 112);
  // Wanted stars.
  ctx.font = 'bold 30px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wantedStars() ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 34, 158);
  }
  // Clock + weather + turf income.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  ctx.fillRect(12, 170, 300, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  const wIcon = G.weather === 'rain' ? '☂ Rain' : G.weather === 'fog' ? '≈ Fog' : '☀ Clear';
  ctx.fillText('🕐 ' + clockText() + '   ' + wIcon, 24, 196);
  ctx.fillStyle = '#37d67a';
  ctx.font = '15px sans-serif';
  ctx.fillText('Turf income: $' + turfIncomePerHour() + '/hr' + (turfAllHeld() ? '  ★ ALL ZONES' : ''), 24, 220);
  // Health + car bars (bottom-left).
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  ctx.fillRect(12, VIEW_H - 84, 260, 72);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEALTH', 22, VIEW_H - 62);
  ctx.fillStyle = '#333'; ctx.fillRect(90, VIEW_H - 74, 160, 12);
  ctx.fillStyle = G.player.hp > 30 ? '#37d67a' : '#ff2d2d';
  ctx.fillRect(90, VIEW_H - 74, 160 * clamp(G.player.hp / 100, 0, 1), 12);
  const car = !G.player.onFoot && G.player.carId >= 0 ? G.cars[G.player.carId] : null;
  ctx.fillStyle = '#fff';
  ctx.fillText('CAR', 22, VIEW_H - 38);
  ctx.fillStyle = '#333'; ctx.fillRect(90, VIEW_H - 50, 160, 12);
  if (car) {
    ctx.fillStyle = car.health > 30 ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(90, VIEW_H - 50, 160 * clamp(car.health / 100, 0, 1), 12);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText(car.model + '  ' + Math.round(Math.abs(G.player.speed)) + ' mph', 22, VIEW_H - 20);
  } else {
    ctx.fillStyle = '#aaa'; ctx.font = '13px sans-serif';
    ctx.fillText('On foot — press E near a car', 90, VIEW_H - 38);
  }
  // Ammo (bottom-right).
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  ctx.fillRect(VIEW_W - 212, VIEW_H - 60, 200, 48);
  ctx.fillStyle = '#ffe66d'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('AMMO ' + G.ammo + '/' + G.ammoReserve, VIEW_W - 26, VIEW_H - 28);
  ctx.textAlign = 'left';
  // Mission objective banner.
  if (G.mission) {
    const m = G.mission;
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(VIEW_W / 2 - 330, 12, 660, 56);
    ctx.fillStyle = '#ff4d6d'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.def.name + ' — ' + m.objective, VIEW_W / 2, 34);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⏱ ' + Math.max(0, Math.ceil(m.timeLeft)) + 's', VIEW_W / 2, 56);
    ctx.textAlign = 'left';
  } else if (G.race) {
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(VIEW_W / 2 - 330, 12, 660, 56);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.race.name + ' — checkpoint ' + (G.race.index + 1) + '/' + G.race.checkpoints.length, VIEW_W / 2, 34);
    ctx.fillText('⏱ ' + Math.max(0, Math.ceil(G.race.timeLeft)) + 's  (par ' + G.race.par + 's)', VIEW_W / 2, 56);
    ctx.textAlign = 'left';
  } else if (G.turfChallenge) {
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(VIEW_W / 2 - 330, 12, 660, 56);
    ctx.fillStyle = '#c22e6b'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TURF: hold ' + G.turfChallenge.zoneName + ' vs the ' + G.turfChallenge.crew, VIEW_W / 2, 34);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⏱ ' + Math.max(0, Math.ceil(G.turfChallenge.timeLeft)) + 's', VIEW_W / 2, 56);
    ctx.textAlign = 'left';
  }
  // Transient message.
  if (G.message && G.time - G.messageAt < 4) {
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(VIEW_W / 2 - 300, VIEW_H - 152, 600, 36);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.message, VIEW_W / 2, VIEW_H - 129);
    ctx.textAlign = 'left';
  }
  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD drive/walk · E steal/exit · Mouse shoot · R reload · F punch · Space handbrake · T taxi · C turf · P pause · M mute', 12, VIEW_H - 96);
}

function drawTitle() {
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath(); ctx.arc(1085, 125, 88, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e33f2f';
  ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', 640, 200);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', 640, 250);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('7 story jobs, 10 hidden Solmar coins, taxi fares, the paint shop — progress saves automatically', 640, 300);
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '17px sans-serif';
  const lines = [
    'WASD / arrows — move & drive      E — steal / exit car      Mouse — aim & shoot',
    'R — reload      F — punch      Space — handbrake      T — taxi fare      C — turf challenge',
    'Shift — sprint      P — pause      M — mute',
    '',
    'Street races, deliveries, turf wars, day & night, rain and fog — and rush-hour traffic.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 640, 350 + i * 28));
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('▶ Click or press Enter to play', 640, 560);
  ctx.fillStyle = '#8a97ad';
  ctx.font = '14px sans-serif';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', 640, 610);
  ctx.textAlign = 'left';
}

function drawBoard() {
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('MISSION BOARD', 640, 60);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('Story jobs — click a card (or press 1–7) to start. Races below — press Q/W/E to start one.', 640, 92);
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    const x = 90 + (i % 4) * 290, y = 120 + Math.floor(i / 4) * 150;
    const done = G.missionDone[i];
    ctx.fillStyle = done ? 'rgba(55,214,122,0.25)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, 270, 130);
    ctx.strokeStyle = done ? '#37d67a' : '#ffd23f'; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 270, 130);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText((i + 1) + '. ' + m.name, x + 14, y + 30);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#cfe3ff';
    wrapText(m.brief, x + 14, y + 54, 242, 17);
    ctx.fillStyle = '#37d67a'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('$' + m.payout + (m.guardPay ? ' +$' + m.guardPay + ' drops' : '') + (done ? '   ✓ DONE' : ''), x + 14, y + 112);
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('STREET RACES', 640, 470);
  for (let i = 0; i < RACES.length; i++) {
    const r = RACES[i];
    const x = 190 + i * 320, y = 490;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, 290, 90);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, 290, 90);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(r.name + ' (' + r.diff + ')', x + 14, y + 28);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#cfe3ff';
    ctx.fillText(r.checkpoints.length + ' checkpoints · par ' + r.par + 's · $' + r.payout, x + 14, y + 52);
    ctx.fillStyle = G.racesWon.includes(r.id) ? '#37d67a' : '#ffd23f';
    ctx.fillText(G.racesWon.includes(r.id) ? '✓ WON' : 'Press ' + ['Q', 'W', 'E'][i] + ' to race', x + 14, y + 74);
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('TURF — ' + turfHeldCount() + '/' + TURF_ZONES.length + ' zones held · income $' + turfIncomePerHour() + '/hr', 640, 620);
  ctx.font = '15px sans-serif'; ctx.fillStyle = '#cfe3ff';
  ctx.fillText(TURF_ZONES.map((z) => z.name + ': ' + (G.turf[z.id] === 'player' ? 'YOU' : z.crew)).join('   ·   '), 640, 648);
  ctx.fillStyle = '#8a97ad'; ctx.font = '14px sans-serif';
  ctx.fillText('Press B to go back · Esc to play', 640, 690);
  ctx.textAlign = 'left';
}

function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) { ctx.fillText(line, x, yy); line = ''; yy += lh; }
    line += w + ' ';
  }
  ctx.fillText(line, x, yy);
}

function drawPause() {
  ctx.fillStyle = 'rgba(8,12,24,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', 640, 160);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#cfe3ff';
  const lines = [
    'Money $' + Math.floor(G.money) + ' · Score ' + Math.floor(G.score) + ' · Rank ' + RANKS[G.rankIndex].name,
    'Story: ' + G.missionDone.filter(Boolean).length + '/7 jobs done' + (G.storyDone ? ' — STORY COMPLETE' : ''),
    'Races won: ' + (G.racesWon.join(', ') || 'none') + ' · Turf held: ' + turfHeldCount() + '/' + TURF_ZONES.length,
    'Coins ' + G.coinsGot.length + '/10 · Fares ' + G.faresDone + ' · Time ' + clockText() + ' · ' + G.weather,
    '',
    'P / Esc — resume · B — mission board · M — mute',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 640, 230 + i * 32));
  ctx.textAlign = 'left';
}

function drawWasted() {
  ctx.fillStyle = 'rgba(20,4,4,0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ff2d2d'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WASTED', 640, 300);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText('You woke up at Solmar General Hospital. -$' + CFG.wastedFine, 640, 360);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Click or press Enter to get back out there', 640, 420);
  ctx.textAlign = 'left';
}

function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (G.screen === 'title') { drawTitle(); return; }
  if (G.screen === 'board') { drawBoard(); return; }
  if (G.screen === 'wasted') { drawWasted(); return; }
  drawWorld();
  drawCoins();
  drawEntities();
  drawSkyAndWeather();
  drawMinimap();
  drawHUD();
  if (G.screen === 'pause') drawPause();
}
