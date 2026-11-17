// render.js — everything the player sees: the city, the cars, the people, the HUD,
// the minimap, the menus and the mission banners. Pure drawing, no game logic.
import { CITY, WORLD, COLORS, CARS, POLICE, MISSIONS, STORY } from './config.js';
import { roadCenter } from './world.js';

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
    // ground
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
    // buildings with sun-side shading
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
    ctx.restore();
    // warm sun tint
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
    for (const car of world.cars) this.drawCarShape(ctx, car.x, car.y, car.angle, car.color);
    for (const cop of world.police) {
      this.drawCarShape(ctx, cop.x, cop.y, cop.angle, '#1d2a44', true);
      const flash = Math.sin(cop.sirenPhase) > 0 ? '#e0453a' : '#3f7fd0';
      ctx.fillStyle = flash;
      ctx.beginPath(); ctx.arc(cop.x, cop.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (const ped of world.pedestrians) this.drawPedestrian(ctx, ped);
    // bullets
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const b of world.bullets) {
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
    for (const cop of world.police) {
      ctx.fillStyle = '#6fa8ff';
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
  }

  drawHud(world) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    // top-left: cash + stats
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(14, 14, 250, 74, 8); ctx.fill();
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`$${world.cash.toLocaleString()}`, 26, 42);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText(`Cars stolen ${world.carsStolen}   •   Score ${world.kills * 50 + world.cash}`, 26, 64);
    ctx.fillText(world.player.onFoot ? 'ON FOOT — press E near a car to steal it' : `DRIVING ${world.player.car ? world.player.car.name : ''} — E to get out`, 26, 82);
    // wanted stars — tucked under the minimap so nothing overlaps
    const wy = 200;
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(w - 250, wy, 236, 40, 8); ctx.fill();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText('WANTED', w - 238, wy + 26);
    for (let i = 0; i < POLICE.maxStars; i++) {
      ctx.fillStyle = i < world.wanted ? COLORS.danger : 'rgba(255,255,255,0.25)';
      this.drawStar(ctx, w - 168 + i * 30, wy + 16, 11);
    }
    // health bar
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath(); ctx.roundRect(14, this.canvas.height - 52, 230, 36, 8); ctx.fill();
    ctx.fillStyle = '#c9c2ae';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HEALTH', 26, this.canvas.height - 30);
    ctx.fillStyle = '#333';
    ctx.fillRect(84, this.canvas.height - 40, 140, 12);
    ctx.fillStyle = world.player.health > 40 ? '#2fae7d' : '#e0453a';
    ctx.fillRect(84, this.canvas.height - 40, 140 * (world.player.health / 100), 12);
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
      'Mouse — aim & shoot   •   F — punch   •   Shift — sprint',
      'P — pause   •   M — mute   •   Progress saves automatically',
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
    ctx.fillText(`Cash $${world.cash.toLocaleString()}   •   Cars stolen ${world.carsStolen}   •   Missions done ${world.missionIndex}`, w / 2, h * 0.4 + 74);
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
    ctx.fillText('SOLMAR — THE CREW', w / 2, 90);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '16px sans-serif';
    ctx.fillText('Pick a job. Each one pays — and the police remember.', w / 2, 122);
    const cardW = 560;
    const cardH = 108;
    MISSIONS.forEach((m, i) => {
      const y = 160 + i * (cardH + 16);
      const done = i < world.missionIndex;
      const available = i === world.missionIndex;
      ctx.fillStyle = available ? 'rgba(240,192,64,0.16)' : 'rgba(20,24,32,0.8)';
      ctx.beginPath(); ctx.roundRect(w / 2 - cardW / 2, y, cardW, cardH, 10); ctx.fill();
      ctx.strokeStyle = available ? COLORS.gold : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = done ? '#2fae7d' : available ? COLORS.gold : '#8a8578';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(`${i + 1}. ${m.title} — ${m.giver}   $${m.reward}`, w / 2, y + 30);
      ctx.fillStyle = COLORS.hud;
      ctx.font = '14px sans-serif';
      const wrapped = this.wrapText(m.brief, 66);
      wrapped.forEach((line, li) => ctx.fillText(line, w / 2, y + 56 + li * 19));
      if (done) {
        ctx.fillStyle = '#2fae7d';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('DONE', w / 2 + cardW / 2 - 40, y + 30);
      }
    });
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Press 1, 2 or 3 to start a job — Esc to keep roaming free', w / 2, 160 + 3 * (cardH + 16) + 8);
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
    return lines.slice(0, 3);
  }
}
