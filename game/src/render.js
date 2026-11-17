// render.js — everything the player sees: the city, the cars, the people,
// the coins, the HUD, the minimap, the menus and the mission banners.
// Pure drawing, no game logic.
import { CITY, WORLD, COLORS, CARS, POLICE, MISSIONS, STORY, COINS } from './config.js';
import { roadCenter } from './world.js';
import { landmarkGlyph } from './landmarks.js';
import { coinsTaken } from './collectibles.js';

const BLOCK = CITY.block;
const ROAD = CITY.road;
const PITCH = BLOCK + ROAD;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  follow(x, y) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.camera.x = x - w / 2;
    this.camera.y = y - h / 2;
  }

  worldToScreen(x, y) {
    return { x: x - this.camera.x, y: y - this.camera.y };
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.camera.x, y: sy + this.camera.y };
  }

  // ---- city ------------------------------------------------------------------
  drawCity(world) {
    const ctx = this.ctx;
    const cam = this.camera;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    // parks
    for (const park of world.parks) {
      ctx.fillStyle = '#8fb573';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#7aa562';
      ctx.beginPath();
      ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    // roads
    ctx.fillStyle = COLORS.asphalt;
    for (let i = 0; i <= CITY.blocks; i++) {
      const c = roadCenter(i);
      ctx.fillRect(0, c - ROAD / 2, WORLD.width, ROAD);
      ctx.fillRect(c - ROAD / 2, 0, ROAD, WORLD.height);
    }
    // lane dashes
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (let i = 0; i <= CITY.blocks; i++) {
      const c = roadCenter(i);
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD.width, c); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD.height); ctx.stroke();
    }
    ctx.setLineDash([]);
    // sidewalks
    ctx.fillStyle = COLORS.sidewalk;
    for (let bx = 0; bx < CITY.blocks; bx++) {
      for (let by = 0; by < CITY.blocks; by++) {
        ctx.fillRect(ROAD + bx * PITCH, ROAD + by * PITCH, BLOCK, 6);
        ctx.fillRect(ROAD + bx * PITCH, ROAD + by * PITCH, 6, BLOCK);
      }
    }
    // buildings with sun-side shading and lit windows
    for (const b of world.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x, b.y, b.w, 5);
      ctx.fillStyle = 'rgba(20,30,60,0.55)';
      const cols = Math.max(2, Math.floor(b.w / 22));
      const rows = Math.max(2, Math.floor(b.h / 24));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if ((cx * 7 + cy * 3 + b.floors) % 5 === 0) continue;
          ctx.fillRect(b.x + 6 + cx * ((b.w - 12) / cols), b.y + 8 + cy * ((b.h - 12) / rows), 9, 11);
        }
      }
      if (b.roof === 'pool') {
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.4);
      } else if (b.roof === 'garden') {
        ctx.fillStyle = '#5d8a4a';
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      }
    }
    // palms
    for (const palm of world.palms) {
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x, palm.y - 12); ctx.stroke();
      ctx.fillStyle = COLORS.palm;
      ctx.beginPath();
      ctx.arc(palm.x, palm.y - 14, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // named places: paint-shop zone, bank, pier, hospital, HQ
    for (const l of world.landmarks) {
      if (l.kind === 'paint') {
        ctx.strokeStyle = 'rgba(240,192,64,0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(l.x, l.y, 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = l.kind === 'bank' ? '#3f7fd0'
        : l.kind === 'hospital' ? '#e0453a'
        : l.kind === 'pier' ? '#2fae7d'
        : l.kind === 'hq' ? '#1d2a44'
        : 'rgba(20,24,32,0.75)';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5eeda';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(landmarkGlyph(l.kind), l.x, l.y + 1);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = 'rgba(20,24,32,0.8)';
      ctx.fillText(l.name, l.x, l.y + 30);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    // warm golden-hour light wash
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,200,110,0.10)');
    grad.addColorStop(1, 'rgba(255,150,60,0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawCarShape(ctx, x, y, angle, color, isPolice = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-22, -11, 46, 26);
    ctx.fillStyle = isPolice ? '#1d2a44' : color;
    ctx.beginPath();
    ctx.roundRect(-21, -11, 42, 22, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(-4, -9, 12, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(15, -8, 4, 16);
    if (isPolice) {
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(-14, -11, 10, 22);
      ctx.fillStyle = '#e0453a';
      ctx.fillRect(-2, -11, 3, 4);
      ctx.fillStyle = '#3f7fd0';
      ctx.fillRect(2, -11, 3, 4);
    }
    ctx.restore();
  }

  drawPedestrian(ctx, ped) {
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, player) {
    const p = player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && Math.floor(p.invuln * 8) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 7, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0453a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5eeda';
    ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22262e';
    ctx.fillRect(8, -2, 7, 4);
    ctx.restore();
  }

  drawGangster(ctx, g) {
    const bob = Math.sin(g.walkPhase) * 2;
    ctx.save();
    ctx.translate(g.x, g.y + bob * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    // dark jacket, flat cap, gun in hand
    ctx.rotate(g.angle);
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath(); ctx.arc(2, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(8, -2, 9, 4);
    ctx.restore();
    // health pips above the head
    ctx.fillStyle = '#333';
    ctx.fillRect(g.x - 14, g.y - 20, 28, 4);
    ctx.fillStyle = g.health > 30 ? '#e0453a' : '#ff8c3a';
    ctx.fillRect(g.x - 14, g.y - 20, 28 * Math.max(0, g.health / 60), 4);
  }

  drawCoin(ctx, coin, time) {
    const pulse = 1 + Math.sin(time * 4 + coin.index) * 0.12;
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.fillStyle = 'rgba(240,192,64,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5a10';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  drawWorld(world) {
    const ctx = this.ctx;
    this.drawCity(world);
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    // mission marker
    if (world.mission && world.missionState === 'active' && world.missionTarget) {
      const t = world.missionTarget;
      const pulse = 1 + Math.sin(world.time * 5) * 0.15;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.label, t.x, t.y - 44);
    }
    // taxi fare: rider ring + destination ring
    if (world.side.fare) {
      const f = world.side.fare;
      ctx.strokeStyle = f.pickedUp ? '#2fae7d' : '#f5c542';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.pickedUp ? f.destX : f.rider.x, f.pickedUp ? f.destY : f.rider.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2b2118';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.pickedUp ? `FARE → ${f.destName} $${f.pay}` : 'RIDER — STOP HERE', f.pickedUp ? f.destX : f.rider.x, (f.pickedUp ? f.destY : f.rider.y) - 36);
    }
    // Solmar coins
    for (const coin of world.coins) {
      if (!coin.taken) this.drawCoin(ctx, coin, world.time);
    }
    // dropped cash bags
    for (const bag of world.side.bags) {
      if (bag.taken) continue;
      ctx.save();
      ctx.translate(bag.x, bag.y);
      ctx.fillStyle = '#2fae7d';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5eeda';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
    // pickups
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.fillStyle = pk.kind === 'health' ? '#e8e4d8' : COLORS.gold;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pk.kind === 'health' ? '#e0453a' : '#7a5a10';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'health' ? '+' : '$', 0, 1);
      ctx.restore();
    }
    // escort van
    if (world.escortVan) {
      const v = world.escortVan;
      this.drawCarShape(ctx, v.x, v.y, v.angle, '#c9c2ae');
      ctx.fillStyle = '#222';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAN', v.x, v.y - 24);
      ctx.fillStyle = '#333';
      ctx.fillRect(v.x - 20, v.y - 32, 40, 5);
      ctx.fillStyle = v.health > 40 ? '#2fae7d' : '#e0453a';
      ctx.fillRect(v.x - 20, v.y - 32, 40 * (v.health / 100), 5);
    }
    for (const car of world.traffic) this.drawCarShape(ctx, car.x, car.y, car.angle, car.color);
    for (const car of world.cars) {
      this.drawCarShape(ctx, car.x, car.y, car.angle, car.wrecked ? '#55504a' : car.color);
      if (car.wrecked) {
        ctx.fillStyle = '#222';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WRECKED', car.x, car.y - 26);
      }
    }
    for (const cop of world.police) {
      this.drawCarShape(ctx, cop.x, cop.y, cop.angle, '#1d2a44', true);
      const flash = Math.sin(cop.sirenPhase) > 0 ? '#e0453a' : '#3f7fd0';
      ctx.fillStyle = flash;
      ctx.beginPath(); ctx.arc(cop.x, cop.y, 5, 0, Math.PI * 2); ctx.fill();
      if (cop.block) {
        // striped barrier across the road behind the cruiser
        ctx.save();
        ctx.translate(cop.x, cop.y);
        ctx.rotate(cop.angle);
        ctx.fillStyle = '#f5eeda';
        ctx.fillRect(-30, 16, 60, 8);
        ctx.fillStyle = '#e0453a';
        for (let s = -30; s < 30; s += 12) ctx.fillRect(s, 16, 6, 8);
        ctx.restore();
        ctx.fillStyle = '#e0453a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ROADBLOCK', cop.x, cop.y - 30);
      }
    }
    for (const ped of world.pedestrians) this.drawPedestrian(ctx, ped);
    for (const g of world.gangsters) this.drawGangster(ctx, g);
    // bullets
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const b of world.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();
    }
    // enemy bullets fly red
    ctx.strokeStyle = '#ff6b5e';
    for (const b of world.enemyBullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();
    }
    // particles
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (world.player.onFoot) this.drawPlayer(ctx, world.player);
    ctx.restore();
  }

  // ---- HUD -------------------------------------------------------------------
  drawMinimap(world) {
    const ctx = this.ctx;
    const size = 168;
    const x0 = this.canvas.width - size - 16;
    const y0 = 16;
    const scale = size / WORLD.width;
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,32,0.78)';
    ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 8); ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath(); ctx.rect(x0, y0, size, size); ctx.clip();
    ctx.fillStyle = '#2c3038';
    ctx.fillRect(x0, y0, size, size);
    for (let i = 0; i <= CITY.blocks; i++) {
      const c = roadCenter(i) * scale;
      ctx.fillStyle = '#565e6a';
      ctx.fillRect(x0, y0 + c - 2, size, 4);
      ctx.fillRect(x0 + c - 2, y0, 4, size);
    }
    if (world.mission && world.missionState === 'active' && world.missionTarget) {
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(x0 + world.missionTarget.x * scale, y0 + world.missionTarget.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const l of world.landmarks) {
      ctx.fillStyle = l.kind === 'hospital' ? '#ff8c8c' : l.kind === 'bank' ? '#6fa8ff' : l.kind === 'hq' ? '#ff8c8c' : '#f0c040';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(landmarkGlyph(l.kind), x0 + l.x * scale, y0 + l.y * scale + 3);
    }
    for (const coin of world.coins) {
      if (coin.taken) continue;
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(x0 + coin.x * scale, y0 + coin.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    for (const cop of world.police) {
      ctx.fillStyle = cop.block ? '#e0453a' : '#6fa8ff';
      ctx.beginPath();
      ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = world.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x0 + p.x * scale, y0 + p.y * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0453a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // district name under the minimap
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(x0 - 6, y0 + size + 4, size + 12, 24, 6); ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.districtName().toUpperCase(), x0 + size / 2, y0 + size + 21);
    ctx.textAlign = 'left';
  }

  drawHud(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    // top-left: cash + stats + coins
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(14, 14, 340, 92, 8); ctx.fill();
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`$${world.cash.toLocaleString()}`, 26, 42);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText(`Cars stolen ${world.carsStolen}   •   Fares ${world.faresDone}   •   Near miss ${world.nearMisses}`, 26, 64);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`Solmar coins ${coinsTaken(world.coins)}/${COINS.total}   •   Score ${world.kills * 50 + world.cash}`, 26, 84);
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText(world.player.onFoot ? 'ON FOOT — press E near a car to steal it' : `DRIVING ${world.player.car ? world.player.car.name : ''} — E to get out`, 26, 102);
    // wanted stars — tucked under the minimap so nothing overlaps
    const wy = 232;
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(w - 250, wy, 236, 40, 8); ctx.fill();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText('WANTED', w - 238, wy + 26);
    for (let i = 0; i < POLICE.maxStars; i++) {
      ctx.fillStyle = i < world.wanted ? COLORS.danger : 'rgba(255,255,255,0.25)';
      this.drawStar(ctx, w - 168 + i * 30, wy + 16, 11);
    }
    // clock + rank, under the wanted bar
    const hour = Math.floor(17 + (world.timeOfDay - 0.42) * 60 + world.time / 120) % 24;
    const minute = Math.floor((world.time / 2) % 60);
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(w - 250, wy + 48, 236, 34, 8); ctx.fill();
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, w - 238, wy + 71);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(world.rankName(), w - 168, wy + 71);
    // ammo + speedometer, bottom right
    const ammo = world.ammo;
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(w - 250, this.canvas.height - 52, 236, 36, 8); ctx.fill();
    ctx.fillStyle = ammo.reloading > 0 ? '#ffb03a' : COLORS.hud;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(ammo.reloading > 0 ? 'RELOADING…' : `AMMO ${ammo.mag}/${ammo.reserve}`, w - 238, this.canvas.height - 30);
    if (!world.player.onFoot && world.player.car) {
      const mph = Math.round(Math.abs(world.player.car.speed) * 0.45);
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${mph} MPH`, w - 96, this.canvas.height - 30);
    }
    // mission countdown (Pier 9 getaway and the ledger escape)
    if (world.mission && (world.mission.id === 'm6' || world.mission.id === 'm7') && world.missionState === 'active'
      && (world.mission.id === 'm6' || world.missionStage === 'escape')) {
      const t = Math.max(0, Math.ceil(world.missionTimer));
      ctx.fillStyle = t <= 15 ? 'rgba(224,69,58,0.85)' : 'rgba(20,24,32,0.78)';
      ctx.beginPath(); ctx.roundRect(w / 2 - 90, 74, 180, 40, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⏱ ${t}s`, w / 2, 102);
      ctx.textAlign = 'left';
    }
    // taxi fare banner
    if (world.side.fare) {
      const f = world.side.fare;
      ctx.fillStyle = 'rgba(20,24,32,0.78)';
      ctx.beginPath(); ctx.roundRect(w / 2 - 260, this.canvas.height - 110, 520, 34, 8); ctx.fill();
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.pickedUp ? `TAXI FARE → ${f.destName} — $${f.pay} on arrival` : 'TAXI FARE — stop by the rider', w / 2, this.canvas.height - 88);
      ctx.textAlign = 'left';
    }
    // health bar + car condition, bottom left
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(14, this.canvas.height - 52, 230, 36, 8); ctx.fill();
    ctx.fillStyle = '#c9c2ae';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HEALTH', 26, this.canvas.height - 30);
    ctx.fillStyle = '#333';
    ctx.fillRect(84, this.canvas.height - 40, 140, 12);
    ctx.fillStyle = world.player.health > 40 ? '#2fae7d' : '#e0453a';
    ctx.fillRect(84, this.canvas.height - 40, 140 * (world.player.health / 100), 12);
    if (!world.player.onFoot && world.player.car) {
      const car = world.player.car;
      ctx.fillStyle = 'rgba(20,24,32,0.72)';
      ctx.beginPath(); ctx.roundRect(14, this.canvas.height - 96, 230, 36, 8); ctx.fill();
      ctx.fillStyle = '#c9c2ae';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('CAR', 26, this.canvas.height - 74);
      ctx.fillStyle = '#333';
      ctx.fillRect(84, this.canvas.height - 84, 140, 12);
      ctx.fillStyle = car.health > 40 ? '#2fae7d' : car.health > 0 ? '#ff8c3a' : '#e0453a';
      ctx.fillRect(84, this.canvas.height - 84, 140 * Math.max(0, car.health / 100), 12);
    }
    // mission banner
    if (world.mission && world.missionState === 'active') {
      ctx.fillStyle = 'rgba(20,24,32,0.78)';
      ctx.beginPath(); ctx.roundRect(w / 2 - 260, 14, 520, 52, 8); ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${world.mission.title} — ${world.mission.giver}`, w / 2, 34);
      ctx.fillStyle = COLORS.hud;
      ctx.font = '13px sans-serif';
      ctx.fillText(world.mission.objective, w / 2, 54);
      ctx.textAlign = 'left';
    }
    // flash message
    if (world.messageTimer > 0 && world.message) {
      ctx.globalAlpha = Math.min(1, world.messageTimer);
      ctx.fillStyle = 'rgba(20,24,32,0.85)';
      ctx.font = 'bold 15px sans-serif';
      const tw = ctx.measureText(world.message).width + 40;
      ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, this.canvas.height - 110, tw, 36, 8); ctx.fill();
      ctx.fillStyle = COLORS.hud;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(world.message, w / 2, this.canvas.height - 87);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    this.drawMinimap(world);
  }

  drawStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---- screens -----------------------------------------------------------------
  drawStart(world, saveExists) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    // backdrop: the city from above
    this.drawCity(world);
    ctx.fillStyle = 'rgba(24,16,8,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 76px sans-serif';
    ctx.fillText('SOLMAR HEAT', w / 2, h * 0.32);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime story — steal, drive, run, survive.', w / 2, h * 0.32 + 38);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#ffd27d';
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY', w / 2, h * 0.55);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#e8e4d8';
    const lines = [
      'WASD / arrows — move & drive   •   E — steal / exit car',
      'Mouse — aim & shoot   •   R — reload   •   F — punch   •   Space — handbrake',
      'T — taxi fare   •   Shift — sprint   •   P — pause   •   M — mute',
      '7 story jobs, 10 hidden Solmar coins, taxi fares, the paint shop — progress saves automatically',
    ];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.62 + i * 24));
    if (saveExists) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Saved progress found — press C to continue where you left off', w / 2, h * 0.62 + 3 * 24 + 14);
    }
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText('A wholly original game. No part of it comes from any commercial game.', w / 2, h - 24);
    ctx.textAlign = 'left';
  }

  drawPause(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', w / 2, h * 0.4);
    ctx.font = '17px sans-serif';
    ctx.fillText('P — resume      S — save progress      Q — quit to title', w / 2, h * 0.4 + 40);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText(`Cash $${world.cash.toLocaleString()}   •   Cars stolen ${world.carsStolen}   •   Missions done ${world.missionIndex}   •   Coins ${coinsTaken(world.coins)}/${COINS.total}`, w / 2, h * 0.4 + 74);
    ctx.textAlign = 'left';
  }

  drawMissionBoard(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = 'rgba(10,12,18,0.66)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('SOLMAR — THE CREW', w / 2, 80);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '16px sans-serif';
    ctx.fillText('Pick a job. Each one pays — and the police remember.', w / 2, 108);
    const cardW = 560;
    const cardH = 68;
    MISSIONS.forEach((m, i) => {
      const y = 128 + i * (cardH + 8);
      const done = i < world.missionIndex;
      const available = i === world.missionIndex;
      ctx.fillStyle = available ? 'rgba(240,192,64,0.16)' : 'rgba(20,24,32,0.8)';
      ctx.beginPath(); ctx.roundRect(w / 2 - cardW / 2, y, cardW, cardH, 10); ctx.fill();
      ctx.strokeStyle = available ? COLORS.gold : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = done ? '#2fae7d' : available ? COLORS.gold : '#8a8578';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${i + 1}. ${m.title} — ${m.giver}   $${m.reward}`, w / 2, y + 28);
      ctx.fillStyle = COLORS.hud;
      ctx.font = '13px sans-serif';
      const wrapped = this.wrapText(m.brief, 72);
      wrapped.forEach((line, li) => ctx.fillText(line, w / 2, y + 44 + li * 17));
      if (done) {
        ctx.fillStyle = '#2fae7d';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('DONE', w / 2 + cardW / 2 - 40, y + 28);
      }
    });
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Press 1–7 to start a job — Esc to keep roaming free', w / 2, 128 + MISSIONS.length * (cardH + 8) + 16);
    ctx.textAlign = 'left';
  }

  drawStory(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = 'rgba(10,12,18,0.8)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('SOLMAR', w / 2, h * 0.3);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '18px sans-serif';
    STORY.intro.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.3 + 44 + i * 30));
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Press ENTER to begin', w / 2, h * 0.3 + 44 + STORY.intro.length * 30 + 24);
    ctx.textAlign = 'left';
  }

  wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      if ((cur + ' ' + word).trim().length > maxChars) {
        lines.push(cur.trim());
        cur = word;
      } else {
        cur += ' ' + word;
      }
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines.slice(0, 2);
  }

  drawWasted(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = 'rgba(120,10,10,0.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', w / 2, h * 0.42);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#f5eeda';
    ctx.fillText('The Harbor Boys got the better of you — the medics dragged you to Solmar General.', w / 2, h * 0.42 + 40);
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Press ENTER to wake up at the hospital', w / 2, h * 0.42 + 76);
    ctx.textAlign = 'left';
  }

  drawComplete(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = 'rgba(10,12,18,0.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('SOLMAR LEGEND', w / 2, h * 0.3);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '18px sans-serif';
    STORY.finale.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.3 + 44 + i * 30));
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Cash $${world.cash.toLocaleString()}   •   Cars stolen ${world.carsStolen}   •   Fares ${world.faresDone}   •   Coins ${coinsTaken(world.coins)}/${COINS.total}   •   Press ENTER to keep roaming free`, w / 2, h * 0.3 + 44 + STORY.finale.length * 30 + 24);
    ctx.textAlign = 'left';
  }
}
