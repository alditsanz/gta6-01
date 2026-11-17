// Rendering for Solmar Heat: the city, the cars, the people, the HUD
// with its minimap, and every screen. One canvas, one fixed logical
// view (1280x720) scaled to the window.

import { VIEW, WORLD, COLORS, LANDMARKS, MISSIONS, RANKS, roadAt, districtAt } from './config.js';
import { LANDMARK_LIST } from './landmarks.js';
import { guardPips } from './combat.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BOARD = 'board';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

/** Mission board card rectangles, shared by the renderer and the click test. */
export function boardCardRects() {
  const rects = [];
  for (let i = 0; i < 7; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    rects.push({ x: 60 + col * 300, y: 170 + row * 210, w: 280, h: 190, mission: i + 1 });
  }
  return rects;
}

/** Create the renderer for a canvas element. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  /** Camera top-left in world coords, following the player. */
  function cameraFor(state) {
    const px = state.player.x;
    const py = state.player.y;
    return {
      x: Math.max(0, Math.min(WORLD.size - VIEW.width, px - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.size - VIEW.height, py - VIEW.height / 2)),
    };
  }

  function drawRoads(cam) {
    ctx.fillStyle = COLORS.roadEdge;
    for (let i = 0; i < WORLD.roads; i++) {
      const r = roadAt(i);
      ctx.fillRect(r - WORLD.roadWidth / 2 - 4 - cam.x, -cam.y, WORLD.roadWidth + 8, WORLD.size);
      ctx.fillRect(-cam.x, r - WORLD.roadWidth / 2 - 4 - cam.y, WORLD.size, WORLD.roadWidth + 8);
    }
    ctx.fillStyle = COLORS.road;
    for (let i = 0; i < WORLD.roads; i++) {
      const r = roadAt(i);
      ctx.fillRect(r - WORLD.roadWidth / 2 - cam.x, -cam.y, WORLD.roadWidth, WORLD.size);
      ctx.fillRect(-cam.x, r - WORLD.roadWidth / 2 - cam.y, WORLD.size, WORLD.roadWidth);
    }
    // Dashed centre lines.
    ctx.fillStyle = COLORS.lane;
    for (let i = 0; i < WORLD.roads; i++) {
      const r = roadAt(i);
      for (let d = 0; d < WORLD.size; d += 64) {
        ctx.fillRect(r - 2 - cam.x, d - cam.y, 4, 30);
        ctx.fillRect(d - cam.x, r - 2 - cam.y, 30, 4);
      }
    }
  }

  function drawCity(state, cam) {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Marina water along the south-west shore.
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(-cam.x, 2260 - cam.y, 900, 180);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(-cam.x, 2240 - cam.y, 900, 22);
    for (const p of state.city.parks) {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(p.x - p.w / 2 - cam.x, p.y - p.h / 2 - cam.y, p.w, p.h);
    }
    drawRoads(cam);
    for (const b of state.city.buildings) {
      ctx.fillStyle = '#00000022';
      ctx.fillRect(b.x - b.w / 2 + 5 - cam.x, b.y - b.h / 2 + 6 - cam.y, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.w / 2 - cam.x, b.y - b.h / 2 - cam.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - b.w / 2 + 6 - cam.x, b.y - b.h / 2 + 6 - cam.y, b.w - 12, b.h - 12);
      ctx.fillStyle = '#ffffff55';
      for (let wx = -1; wx <= 1; wx++) {
        for (let wy = -1; wy <= 1; wy++) {
          ctx.fillRect(b.x + wx * b.w * 0.28 - 4 - cam.x, b.y + wy * b.h * 0.28 - 3 - cam.y, 8, 6);
        }
      }
    }
    // Trees.
    for (const t of state.city.trees) {
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath();
      ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5da24a';
      ctx.beginPath();
      ctx.arc(t.x - 2 - cam.x, t.y - 2 - cam.y, t.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    drawLandmarks(state, cam);
  }

  function drawLandmarks(state, cam) {
    // SCPD Headquarters: a big dark-blue block with a badge.
    const hq = LANDMARKS.hq;
    ctx.fillStyle = '#2b3a55';
    ctx.fillRect(hq.x - 90 - cam.x, hq.y - 70 - cam.y, 180, 140);
    ctx.fillStyle = '#d8e2f0';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', hq.x - cam.x, hq.y - 8 - cam.y);
    ctx.font = '12px Arial';
    ctx.fillText('HEADQUARTERS', hq.x - cam.x, hq.y + 12 - cam.y);
    // Lou's Paint Shop: a striped garage.
    const ps = LANDMARKS.paint;
    ctx.fillStyle = '#8a2f2f';
    ctx.fillRect(ps.x - 70 - cam.x, ps.y - 50 - cam.y, 140, 100);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(ps.x - 70 - cam.x, ps.y - 50 - cam.y, 140, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial';
    ctx.fillText("LOU'S PAINT", ps.x - cam.x, ps.y + 6 - cam.y);
    // Pier 9: wooden planks into the water.
    const pier = LANDMARKS.pier;
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(pier.x - 26 - cam.x, pier.y - 110 - cam.y, 52, 220);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('PIER 9', pier.x - cam.x, pier.y - 118 - cam.y);
    // Marina docks.
    const mar = LANDMARKS.marina;
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(mar.x - 90 - cam.x, mar.y - 12 - cam.y, 180, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('MARINA', mar.x - cam.x, mar.y - 22 - cam.y);
    // Cactus Court Plaza: a pale circle with a fountain dot.
    const pz = LANDMARKS.plaza;
    ctx.fillStyle = '#d8cfae';
    ctx.beginPath();
    ctx.arc(pz.x - cam.x, pz.y - cam.y, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.water;
    ctx.beginPath();
    ctx.arc(pz.x - cam.x, pz.y - cam.y, 16, 0, Math.PI * 2);
    ctx.fill();
    // Hospital cross.
    const hosp = LANDMARKS.hospital;
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(hosp.x - 60 - cam.x, hosp.y - 44 - cam.y, 120, 88);
    ctx.fillStyle = '#d43d3d';
    ctx.fillRect(hosp.x - 8 - cam.x, hosp.y - 26 - cam.y, 16, 52);
    ctx.fillRect(hosp.x - 26 - cam.x, hosp.y - 8 - cam.y, 52, 16);
  }

  function drawCarShape(x, y, angle, color, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(-20 * scale, -11 * scale + 3, 40 * scale, 22 * scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-20 * scale, -11 * scale, 40 * scale, 22 * scale, 6 * scale);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6 * scale, -9 * scale, 12 * scale, 18 * scale);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(16 * scale, -8 * scale, 3 * scale, 5 * scale);
    ctx.fillRect(16 * scale, 3 * scale, 3 * scale, 5 * scale);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-20 * scale, -8 * scale, 3 * scale, 5 * scale);
    ctx.fillRect(-20 * scale, 3 * scale, 3 * scale, 5 * scale);
    ctx.restore();
  }

  function drawWorld(state, cam) {
    drawCity(state, cam);
    const t = state.time;
    // Coins.
    for (const c of state.coins) {
      if (c.taken) continue;
      const bob = Math.sin(t * 3 + c.bob) * 3;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(c.x - cam.x, c.y + bob - cam.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('S', c.x - cam.x, c.y + 4 + bob - cam.y);
    }
    // Ammo pickups.
    for (const p of state.pickups) {
      if (p.taken) continue;
      ctx.fillStyle = '#58d68d';
      ctx.fillRect(p.x - 9 - cam.x, p.y - 9 - cam.y, 18, 18);
      ctx.fillStyle = '#101318';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', p.x - cam.x, p.y + 4 - cam.y);
    }
    // Taxi fare markers.
    if (state.fare) {
      const f = state.fare;
      const tx = f.state === 'waiting' ? f.pickup.x : f.dest.x;
      const ty = f.state === 'waiting' ? f.pickup.y : f.dest.y;
      const pulse = 1 + Math.sin(t * 5) * 0.15;
      ctx.strokeStyle = f.state === 'waiting' ? '#58d68d' : '#ffd23e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx - cam.x, ty - cam.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('$', tx - cam.x, ty + 6 - cam.y);
    }
    // Mission target marker.
    if (state.mission && state.mission.target) {
      const tg = state.mission.target;
      const pulse = 1 + Math.sin(t * 6) * 0.2;
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tg.x - cam.x, tg.y - cam.y, 30 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.moveTo(tg.x - cam.x, tg.y - 44 - cam.y);
      ctx.lineTo(tg.x - 10 - cam.x, tg.y - 62 - cam.y);
      ctx.lineTo(tg.x + 10 - cam.x, tg.y - 62 - cam.y);
      ctx.closePath();
      ctx.fill();
    }
    // Parked cars.
    for (const car of state.cars) {
      if (car.wrecked) {
        drawCarShape(car.x - cam.x, car.y - cam.y, car.angle, '#3a3a3a', 1);
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(car.x - 14 - cam.x, car.y - 10 - cam.y);
        ctx.lineTo(car.x + 14 - cam.x, car.y + 10 - cam.y);
        ctx.moveTo(car.x + 14 - cam.x, car.y - 10 - cam.y);
        ctx.lineTo(car.x - 14 - cam.x, car.y + 10 - cam.y);
        ctx.stroke();
        continue;
      }
      drawCarShape(car.x - cam.x, car.y - cam.y, car.angle, car.color, 1);
      if (car.taxi) {
        ctx.fillStyle = '#101318';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(car.x - cam.x, car.y - cam.y);
        ctx.rotate(car.angle);
        ctx.fillText('TAXI', 0, 3);
        ctx.restore();
      }
    }
    // Traffic.
    for (const tr of state.traffic) {
      drawCarShape(tr.x - cam.x, tr.y - cam.y, tr.angle, tr.color, 0.92);
    }
    // Police cars.
    for (const pc of state.police) {
      drawCarShape(pc.x - cam.x, pc.y - cam.y, pc.angle, '#1c2f57', 1);
      const flash = Math.sin(pc.siren) > 0 ? '#ff3b30' : '#2f7bff';
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(pc.x - cam.x, pc.y - 4 - cam.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(pc.x - cam.x, pc.y - cam.y);
      ctx.rotate(pc.angle);
      ctx.fillText('SCPD', 0, 3);
      ctx.restore();
    }
    // Roadblocks: two parked cruisers and striped barriers across the road.
    for (const rb of state.roadblocks) {
      ctx.save();
      ctx.translate(rb.x - cam.x, rb.y - cam.y);
      ctx.rotate(rb.angle);
      ctx.fillStyle = '#1c2f57';
      ctx.fillRect(-46, -34, 30, 20);
      ctx.fillRect(16, 14, 30, 20);
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(-52, -14, 104, 10);
      ctx.fillStyle = '#101318';
      for (let s = -52; s < 52; s += 16) ctx.fillRect(s, -14, 8, 10);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ROADBLOCK', rb.x - cam.x, rb.y - 44 - cam.y);
    }
    // Pedestrians.
    for (const p of state.peds) {
      const swing = Math.sin(p.walkPhase) * 3;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - 4 - cam.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - cam.x, p.y + 5 - cam.y);
      ctx.lineTo(p.x + swing - cam.x, p.y + 13 - cam.y);
      ctx.stroke();
      if (p.fare) {
        ctx.fillStyle = '#58d68d';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('$', p.x - cam.x, p.y - 14 - cam.y);
      }
    }
    // Guards with health pips.
    for (const g of state.guards) {
      if (!g.alive) continue;
      ctx.fillStyle = '#20242c';
      ctx.beginPath();
      ctx.arc(g.x - cam.x, g.y - cam.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9d2de';
      ctx.beginPath();
      ctx.arc(g.x - cam.x, g.y - 3 - cam.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GUARD', g.x - cam.x, g.y - 22 - cam.y);
      const pips = guardPips(g);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < pips ? '#ff4d4d' : '#00000055';
        ctx.fillRect(g.x - 18 + i * 10 - cam.x, g.y + 18 - cam.y, 8, 5);
      }
    }
    // The ledger, when it is lying at HQ waiting to be grabbed.
    if (state.mission && state.mission.phase === 'grab') {
      const lx = LANDMARKS.hq.x;
      const ly = LANDMARKS.hq.y + 40;
      const glow = 1 + Math.sin(t * 5) * 0.2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(lx - cam.x, ly - cam.y, 13 * glow, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101318';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('L', lx - cam.x, ly + 4 - cam.y);
    }
    // Player.
    const pl = state.player;
    if (!pl.inCar) {
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath();
      ctx.arc(pl.x - cam.x, pl.y - cam.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a4d00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pl.x - cam.x, pl.y - cam.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      // Aim direction.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pl.x - cam.x, pl.y - cam.y);
      ctx.lineTo(pl.x + Math.cos(pl.angle) * 22 - cam.x, pl.y + Math.sin(pl.angle) * 22 - cam.y);
      ctx.stroke();
      // Gun in hand.
      ctx.fillStyle = '#20242c';
      ctx.fillRect(pl.x + Math.cos(pl.angle) * 14 - 3 - cam.x, pl.y + Math.sin(pl.angle) * 14 - 3 - cam.y, 6, 6);
    }
    // Bullets.
    ctx.fillStyle = '#ffe9a8';
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Courier car for mission 4 gets a marker.
    if (state.mission && state.mission.courier) {
      const c = state.mission.courier;
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x - cam.x, c.y - cam.y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMinimap(state) {
    const size = 176;
    const mx = VIEW.width - size - 14;
    const my = 14;
    const scale = size / WORLD.size;
    ctx.fillStyle = '#101318cc';
    ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
    ctx.fillStyle = '#2c3e2a';
    ctx.fillRect(mx, my, size, size);
    ctx.strokeStyle = '#5a5f6a';
    ctx.lineWidth = 1;
    for (let i = 0; i < WORLD.roads; i++) {
      const r = roadAt(i) * scale;
      ctx.beginPath();
      ctx.moveTo(mx + r, my);
      ctx.lineTo(mx + r, my + size);
      ctx.moveTo(mx, my + r);
      ctx.lineTo(mx + size, my + r);
      ctx.stroke();
    }
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const lm of LANDMARK_LIST) dot(lm.x, lm.y, '#9fb4d8', 2.5);
    for (const c of state.coins) if (!c.taken) dot(c.x, c.y, '#ffd23e', 2.5);
    for (const car of state.cars) if (!car.wrecked) dot(car.x, car.y, '#f5c542', 2.5);
    for (const pc of state.police) dot(pc.x, pc.y, '#2f7bff', 3);
    if (state.fare) {
      const f = state.fare;
      dot(f.state === 'waiting' ? f.pickup.x : f.dest.x, f.state === 'waiting' ? f.pickup.y : f.dest.y, '#58d68d', 3.5);
    }
    if (state.mission && state.mission.target) {
      const pulse = 3 + Math.sin(state.time * 6) * 1.2;
      dot(state.mission.target.x, state.mission.target.y, '#ff4d4d', pulse);
    }
    dot(state.player.x, state.player.y, '#ffffff', 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + state.player.x * scale, my + state.player.y * scale, 6, 0, Math.PI * 2);
    ctx.stroke();
    // District name under the minimap.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(districtAt(state.player.x, state.player.y), VIEW.width - 14, my + size + 22);
    const near = LANDMARK_LIST.find((lm) => Math.hypot(state.player.x - lm.x, state.player.y - lm.y) < 170);
    if (near) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = '13px Arial';
      ctx.fillText(near.name, VIEW.width - 14, my + size + 40);
    }
  }

  function drawHud(state) {
    // Top-left: money, score, rank, counters.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#101318cc';
    ctx.fillRect(12, 12, 300, 118);
    ctx.fillStyle = '#58d68d';
    ctx.font = 'bold 26px Arial';
    ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 24, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px Arial';
    ctx.fillText(`Score ${state.score.toLocaleString('en-US')}   •   ${RANKS[state.rank]}`, 24, 68);
    ctx.fillStyle = '#d8dce4';
    ctx.font = '14px Arial';
    ctx.fillText(`Cars stolen ${state.carsStolen}   Fares ${state.faresDone}   Near-miss ${state.nearMisses}`, 24, 90);
    ctx.fillText(`Solmar coins ${state.coins.filter((c) => c.taken).length}/10`, 24, 112);
    // Wanted stars, top-centre.
    const stars = state.stars;
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Arial';
    let starText = '';
    for (let i = 0; i < 5; i++) starText += i < stars ? '★' : '☆';
    ctx.fillStyle = stars > 0 ? COLORS.star : '#ffffff88';
    ctx.fillText(starText, VIEW.width / 2, 44);
    // Objective banner.
    if (state.mission) {
      ctx.fillStyle = '#101318cc';
      const banner = state.mission.def.banner;
      ctx.font = 'bold 15px Arial';
      const w = ctx.measureText(banner).width + 28;
      ctx.fillRect(VIEW.width / 2 - w / 2, 54, w, 30);
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(banner, VIEW.width / 2, 75);
      if (state.mission.t > 0) {
        ctx.fillStyle = state.mission.t < 15 ? '#ff4d4d' : '#ffffff';
        ctx.font = 'bold 22px Arial';
        const mm = Math.floor(state.mission.t / 60);
        const ss = Math.floor(state.mission.t % 60).toString().padStart(2, '0');
        ctx.fillText(`${mm}:${ss}`, VIEW.width / 2, 112);
      }
    } else if (state.fare && state.fare.state === 'riding') {
      ctx.fillStyle = '#101318cc';
      ctx.font = 'bold 15px Arial';
      const banner = 'Drive the passenger to the destination.';
      const w = ctx.measureText(banner).width + 28;
      ctx.fillRect(VIEW.width / 2 - w / 2, 54, w, 30);
      ctx.fillStyle = '#58d68d';
      ctx.fillText(banner, VIEW.width / 2, 75);
    }
    // Bottom-left: health + car condition + speed.
    const pl = state.player;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#101318cc';
    ctx.fillRect(12, VIEW.height - 86, 280, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('HEALTH', 24, VIEW.height - 64);
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(24, VIEW.height - 56, 180, 12);
    ctx.fillStyle = pl.health > 30 ? '#58d68d' : '#ff4d4d';
    ctx.fillRect(24, VIEW.height - 56, Math.max(0, 180 * (pl.health / 100)), 12);
    if (pl.inCar && pl.car) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CAR', 24, VIEW.height - 34);
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(24, VIEW.height - 26, 180, 12);
      ctx.fillStyle = pl.car.health > 30 ? '#ffb02e' : '#ff4d4d';
      ctx.fillRect(24, VIEW.height - 26, Math.max(0, 180 * (pl.car.health / 100)), 12);
      const kmh = Math.round(Math.abs(pl.car.speed) * 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial';
      ctx.fillText(`${kmh}`, 224, VIEW.height - 30);
      ctx.font = '12px Arial';
      ctx.fillText('km/h', 224, VIEW.height - 14);
      ctx.font = '13px Arial';
      ctx.fillText(pl.car.model, 224, VIEW.height - 64);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px Arial';
      ctx.fillText('On foot — press E near a car to steal it', 24, VIEW.height - 26);
    }
    // Bottom-right: ammo + toast area.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#101318cc';
    ctx.fillRect(VIEW.width - 212, VIEW.height - 56, 200, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    const w = state.weapon;
    ctx.fillText(w.reloading > 0 ? 'RELOADING…' : `${w.mag}/${w.reserve}`, VIEW.width - 24, VIEW.height - 26);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#d8dce4';
    ctx.fillText('AMMO  •  R reload  •  F punch', VIEW.width - 24, VIEW.height - 40);
    // Toast message.
    if (state.toast && state.time - state.toast.t < 3.2) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px Arial';
      const tw = ctx.measureText(state.toast.text).width + 32;
      ctx.fillStyle = '#101318dd';
      ctx.fillRect(VIEW.width / 2 - tw / 2, VIEW.height - 150, tw, 36);
      ctx.fillStyle = state.toast.good ? '#58d68d' : '#ffd23e';
      ctx.fillText(state.toast.text, VIEW.width / 2, VIEW.height - 125);
    }
    drawMinimap(state);
  }

  function drawTitle(state) {
    const cam = { x: 600, y: 120 };
    drawCity(state, cam);
    ctx.fillStyle = '#101318b8';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 84px Arial';
    ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 170);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 22px Arial';
    ctx.fillText('An open-world crime story — steal, drive, run, survive.', VIEW.width / 2, 212);
    ctx.font = '17px Arial';
    ctx.fillStyle = '#d8dce4';
    const lines = [
      'WASD / arrows — move & drive      E — steal / exit car      Mouse — aim & shoot',
      'R — reload      F — punch      Space — handbrake      T — taxi fare      Shift — sprint',
      'P — pause      M — mute',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW.width / 2, 268 + i * 26));
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 17px Arial';
    ctx.fillText('7 story jobs, 10 hidden Solmar coins, taxi fares, the paint shop — progress saves automatically', VIEW.width / 2, 380);
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Arial';
      ctx.fillText('Click or press Enter to play', VIEW.width / 2, 450);
    }
    ctx.fillStyle = '#9aa0ab';
    ctx.font = '14px Arial';
    ctx.fillText('A wholly original game. No part of it comes from any commercial game.', VIEW.width / 2, 640);
    if (state.saveExists) {
      ctx.fillStyle = '#58d68d';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`Saved progress found — $${state.money.toLocaleString('en-US')}, ${state.missionsDone.filter(Boolean).length}/7 jobs done. Press Enter to continue.`, VIEW.width / 2, 500);
    }
  }

  function drawBoard(state) {
    ctx.fillStyle = '#141a26';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 44px Arial';
    ctx.fillText('MISSION BOARD', VIEW.width / 2, 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    ctx.fillText(`$${state.money.toLocaleString('en-US')}   •   ${RANKS[state.rank]}   •   Click a job or press its number to start`, VIEW.width / 2, 122);
    const rects = boardCardRects();
    MISSIONS.forEach((m, i) => {
      const r = rects[i];
      const done = state.missionsDone[i];
      const unlocked = i === 0 || state.missionsDone[i - 1];
      ctx.fillStyle = done ? '#1f3d2b' : unlocked ? '#232a38' : '#1a1d24';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = done ? '#58d68d' : unlocked ? '#ffb02e' : '#3a3f47';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 15px Arial';
      ctx.fillText(`JOB ${m.id}`, r.x + 16, r.y + 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      const title = m.title.length > 26 ? m.title.slice(0, 25) + '…' : m.title;
      ctx.fillText(title, r.x + 16, r.y + 58);
      ctx.fillStyle = '#d8dce4';
      ctx.font = '13px Arial';
      wrapText(m.brief, r.x + 16, r.y + 82, r.w - 32, 17);
      ctx.fillStyle = done ? '#58d68d' : unlocked ? '#ffffff' : '#7a7f88';
      ctx.font = 'bold 15px Arial';
      ctx.fillText(done ? '✓ DONE' : unlocked ? `Payout $${m.payout.toLocaleString('en-US')}` : '🔒 Complete the previous job', r.x + 16, r.y + r.h - 16);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa0ab';
    ctx.font = '15px Arial';
    ctx.fillText('Esc — back to the title screen', VIEW.width / 2, 660);
  }

  function wrapText(text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function drawPaused() {
    ctx.fillStyle = '#101318b8';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px Arial';
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.font = '18px Arial';
    ctx.fillText('P or Esc — resume      M — mute', VIEW.width / 2, 380);
  }

  function drawWasted(state) {
    ctx.fillStyle = '#3d0a0aee';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 92px Arial';
    ctx.fillText('WASTED', VIEW.width / 2, 320);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('You were taken to Solmar General. The heat is off you — for now.', VIEW.width / 2, 380);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Press Enter to get back on the streets', VIEW.width / 2, 430);
  }

  function drawComplete(state) {
    ctx.fillStyle = '#101318ee';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 54px Arial';
    ctx.fillText('SOLMAR LEGEND', VIEW.width / 2, 260);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    ctx.fillText('Kane’s ledger is yours. The story is complete.', VIEW.width / 2, 310);
    ctx.font = '18px Arial';
    ctx.fillText(`Final take: $${state.money.toLocaleString('en-US')}   •   Score ${state.score.toLocaleString('en-US')}`, VIEW.width / 2, 350);
    ctx.fillStyle = '#58d68d';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Press Enter to keep roaming Solmar', VIEW.width / 2, 410);
  }

  function draw(state) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (state.screen === SCREEN_TITLE) {
      drawTitle(state);
      return;
    }
    if (state.screen === SCREEN_BOARD) {
      drawBoard(state);
      return;
    }
    const cam = cameraFor(state);
    drawWorld(state, cam);
    drawHud(state);
    if (state.screen === SCREEN_PAUSED) drawPaused();
    if (state.screen === SCREEN_WASTED) drawWasted(state);
    if (state.screen === SCREEN_COMPLETE) drawComplete(state);
  }

  return { draw, cameraFor };
}
