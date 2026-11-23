// Solmar Heat — the renderer. A canvas painter with three camera
// grammars: the plain top-down city, the round-16 perspective chase
// cam (the top-down frame warped through a vanishing point, hero car
// planted large in the foreground), and the ground-level over-shoulder
// framing for the vault hold. Plus the HUD, the pause map, the title
// vista, the mod shop, the end card and the victory screen.
// Everything in the world pass is view-culled so the frame stays cheap.

import { VIEW_W, VIEW_H, KMH_PER_UNIT, HEAT_MAX, rankFor, nextRank } from './config.js';
import { clamp, dist, hash2 } from './random.js';
import { LANDMARKS, DISTRICTS, BEACH, PARK, CANAL } from './landmarks.js';
import { skyPhase, weatherOf } from './weather.js';
import { WEAPONS } from './combat.js';
import { stationLabel } from './radio.js';
import { missionStage, missionTarget, victorySummary } from './missions.js';
import { coinsTaken, stashesTaken, jumpsDone } from './collectibles.js';
import { zonesHeld } from './turf.js';
import { racesWon } from './races.js';
import { MOD_TRACKS, PAINT_PRICE, modsBought } from './modshop.js';
import { starsOf } from './world.js';

const SHOP_SIGNS = ['CAFE SOL', 'GYM 24H', 'PAWN & CO', 'TATTOO', 'DELI', 'BAR SOL', 'OPTICA', 'PHONES', 'SNEAKERS', 'FLORIST'];

// ---------------------------------------------------------------- helpers

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

function plate(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(10, 14, 20, ${alpha === undefined ? 0.72 : alpha})`;
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const f = clamp(frac, 0, 1);
  if (f > 0) {
    ctx.fillStyle = color;
    rr(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fill();
  }
  ctx.restore();
}

function text(ctx, str, x, y, size, color, align, weight) {
  ctx.save();
  ctx.font = `${weight || 600} ${size}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = color || '#f2f4f6';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.restore();
}

function inView(view, x, y, pad) {
  const p = pad || 0;
  return x >= view.x0 - p && x <= view.x1 + p && y >= view.y0 - p && y <= view.y1 + p;
}

// ------------------------------------------------------------- pure logic

export function completionPct(world) {
  const kit = world.collectibles;
  const parts =
    (world.stats.missionsDone / 5) * 40 +
    (coinsTaken(kit) / kit.coins.length) * 15 +
    (stashesTaken(kit) / kit.stashes.length) * 10 +
    (jumpsDone(kit) / kit.jumps.length) * 10 +
    (racesWon(world) / 3) * 10 +
    (zonesHeld(world.turf) / world.turf.zones.length) * 15;
  return Math.round(clamp(parts, 0, 100));
}

// Perspective projection curves for the chase cam: rows near the
// horizon are squeezed thin and narrow; the road opens up toward the
// bottom of the frame.
export function perspRowScale(t) {
  return 0.22 + 0.78 * Math.pow(t, 1.6);
}

export function perspSrcY(t) {
  return 1 - Math.pow(1 - t, 1.7);
}

// A street-following route: out to the avenue through `from`, along it
// to the target's cross-street, then in to the door.
export function gpsRoute(from, to) {
  const sx = clamp(Math.round(from.x / 400) * 400, 0, 3600);
  const ty = clamp(Math.round(to.y / 400) * 400, 0, 3600);
  const raw = [
    { x: from.x, y: from.y },
    { x: sx, y: from.y },
    { x: sx, y: ty },
    { x: to.x, y: ty },
    { x: to.x, y: to.y },
  ];
  const pts = [];
  for (const pt of raw) {
    const lastPt = pts[pts.length - 1];
    if (!lastPt || lastPt.x !== pt.x || lastPt.y !== pt.y) pts.push(pt);
  }
  return pts;
}

export function routeLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
  return total;
}

// District lean by turf: the zone whose heart sits in the district
// speaks for it. 1 = Rex, -1 = Vipers, 0 = unclaimed ground.
export function districtStanding(world, dx, dy) {
  for (const zone of world.turf.zones) {
    const zx = Math.floor(zone.x / 1200);
    const zy = Math.floor(zone.y / 1200);
    if (zx === dx && zy === dy) return zone.owner === 'Rex' ? 1 : -1;
  }
  return 0;
}

// ------------------------------------------------------------ world paint

function paintGround(ctx, world, view) {
  ctx.fillStyle = '#8f9a7d';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

  // Block pavement, tinted per block so the grid never reads flat.
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const x = bx * 400;
      const y = by * 400;
      if (x + 400 < view.x0 || y + 400 < view.y0 || x > view.x1 || y > view.y1) continue;
      const tone = 0.92 + hash2(bx * 3 + 1, by * 5 + 2) * 0.16;
      ctx.fillStyle = `rgb(${Math.round(146 * tone)},${Math.round(138 * tone)},${Math.round(112 * tone)})`;
      ctx.fillRect(x + 62, y + 62, 276, 276);
    }
  }

  // Park green and its pond.
  ctx.fillStyle = '#5d8f4e';
  ctx.fillRect(PARK.x0, PARK.y0, PARK.x1 - PARK.x0, PARK.y1 - PARK.y0);
  ctx.fillStyle = '#3f7ea6';
  ctx.fillRect(520, 2520, 160, 160);

  // Beach sand, then the sea beyond the map's east edge.
  ctx.fillStyle = '#e3cf9e';
  ctx.fillRect(BEACH.x0, BEACH.y0, BEACH.x1 - BEACH.x0, BEACH.y1 - BEACH.y0);
  ctx.fillStyle = '#2e6d96';
  ctx.fillRect(3560, view.y0, view.x1 - 3560, view.y1 - view.y0);

  // Canal water strip.
  ctx.fillStyle = '#356f92';
  ctx.fillRect(CANAL.x0, CANAL.y0, CANAL.x1 - CANAL.x0, CANAL.y1 - CANAL.y0);
}

function paintStreets(ctx, world, view) {
  ctx.fillStyle = '#33373d';
  for (let i = 0; i <= 3600; i += 400) {
    if (i + 62 >= view.x0 && i - 62 <= view.x1) ctx.fillRect(i - 62, view.y0, 124, view.y1 - view.y0);
    if (i + 62 >= view.y0 && i - 62 <= view.y1) ctx.fillRect(view.x0, i - 62, view.x1 - view.x0, 124);
  }
  // Lane dashes, only where the camera can see them.
  ctx.fillStyle = '#d8c95a';
  const dashFrom = Math.max(20, Math.floor(view.y0 / 90) * 90);
  const dashTo = Math.min(3600, view.y1);
  const dashFromX = Math.max(20, Math.floor(view.x0 / 90) * 90);
  const dashToX = Math.min(3600, view.x1);
  for (let i = 0; i <= 3600; i += 400) {
    if (i >= view.x0 - 10 && i <= view.x1 + 10) {
      for (let at = dashFrom; at < dashTo; at += 90) ctx.fillRect(i - 2, at, 4, 44);
    }
    if (i >= view.y0 - 10 && i <= view.y1 + 10) {
      for (let at = dashFromX; at < dashToX; at += 90) ctx.fillRect(at, i - 2, 44, 4);
    }
  }
  // Crosswalk stripes at the intersections in frame.
  ctx.fillStyle = 'rgba(240,240,240,0.5)';
  for (let ix = 0; ix <= 3600; ix += 400) {
    for (let iy = 0; iy <= 3600; iy += 400) {
      if (ix + 70 < view.x0 || iy + 70 < view.y0 || ix - 70 > view.x1 || iy - 70 > view.y1) continue;
      for (let s = -48; s <= 48; s += 24) {
        ctx.fillRect(ix + s - 7, iy - 70, 14, 16);
        ctx.fillRect(ix + s - 7, iy + 54, 14, 16);
      }
    }
  }
}

const PROP_COLORS = ['#e2543e', '#3e7de2', '#39b06a', '#e2a93e', '#9a5fd0', '#e2703a'];

function paintProp(ctx, prop, phase) {
  const { x, y, kind } = prop;
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'lamp') {
    ctx.fillStyle = '#2c2f33';
    ctx.fillRect(-2, -2, 4, 4);
    if (phase === 'night' || phase === 'dusk') {
      ctx.fillStyle = 'rgba(255,196,92,0.28)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'palm') {
    const s = prop.s || 1;
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3 * s, -10 * s, 7 * s, -17 * s); ctx.stroke();
    ctx.strokeStyle = '#3f8f3a';
    ctx.lineWidth = 2.4 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(7 * s, -17 * s);
      ctx.quadraticCurveTo(7 * s + Math.cos(a) * 9 * s, -17 * s + Math.sin(a) * 5 * s - 3, 7 * s + Math.cos(a) * 15 * s, -17 * s + Math.sin(a) * 8 * s + 3);
      ctx.stroke();
    }
  } else if (kind === 'tree') {
    const s = prop.s || 1;
    ctx.fillStyle = '#6d5133';
    ctx.fillRect(-2 * s, -3 * s, 4 * s, 7 * s);
    ctx.fillStyle = '#3e7d33';
    ctx.beginPath(); ctx.arc(0, -9 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4c9440';
    ctx.beginPath(); ctx.arc(-4 * s, -13 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'bench') {
    ctx.fillStyle = '#7d5a34';
    ctx.fillRect(-10, -3, 20, 4);
    ctx.fillRect(-10, -8, 20, 3);
  } else if (kind === 'planter') {
    ctx.fillStyle = '#9a8a76';
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = '#4c9440';
    ctx.beginPath(); ctx.arc(0, -4, 7, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'hydrant') {
    ctx.fillStyle = '#c93a2e';
    ctx.fillRect(-3, -6, 6, 9);
    ctx.beginPath(); ctx.arc(0, -6, 3.4, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'newsbox') {
    ctx.fillStyle = '#2e6da8';
    ctx.fillRect(-6, -8, 12, 13);
    ctx.fillStyle = '#dcebf7';
    ctx.fillRect(-4, -6, 8, 5);
  } else if (kind === 'busstop') {
    ctx.fillStyle = '#444a50';
    ctx.fillRect(-12, -10, 3, 20);
    ctx.fillRect(9, -10, 3, 20);
    ctx.fillStyle = 'rgba(120,180,220,0.55)';
    ctx.fillRect(-12, -12, 24, 5);
  } else if (kind === 'crate') {
    ctx.fillStyle = '#a87f45';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#7d5a2c';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-8, -8, 16, 16);
  } else if (kind === 'barrel') {
    ctx.fillStyle = PROP_COLORS[prop.c % PROP_COLORS.length];
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'umbrella') {
    ctx.fillStyle = PROP_COLORS[prop.c % PROP_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(-11, 3);
    ctx.quadraticCurveTo(0, -11, 11, 3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 7); ctx.stroke();
  } else if (kind === 'towel') {
    ctx.fillStyle = PROP_COLORS[prop.c % PROP_COLORS.length];
    ctx.fillRect(-8, -4, 16, 8);
  }
  ctx.restore();
}

function paintBuildings(ctx, world, view) {
  for (const b of world.buildings) {
    if (b.x + b.w < view.x0 || b.y + b.h < view.y0 || b.x > view.x1 || b.y > view.y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.roof || '#8d7c62';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.hue || '#d9c9a8';
    const inset = 7;
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    // Window speckle, denser on taller towers.
    ctx.fillStyle = 'rgba(70,90,110,0.5)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 24));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (hash2(cx * 3 + b.x, cy * 5 + b.y) < 0.45) continue;
        ctx.fillRect(b.x + 10 + cx * 24, b.y + 10 + cy * 22, 9, 7);
      }
    }
    if (b.storefront) {
      const sign = b.sign || SHOP_SIGNS[Math.floor(hash2(b.x, b.y) * SHOP_SIGNS.length) % SHOP_SIGNS.length];
      ctx.fillStyle = '#20262e';
      const sw = Math.min(b.w - 16, 12 + sign.length * 7.4);
      ctx.fillRect(b.x + (b.w - sw) / 2, b.y + b.h - 20, sw, 15);
      text(ctx, sign, b.x + b.w / 2, b.y + b.h - 9, 10.5, '#ffd76a', 'center', 700);
    }
  }
}

function paintWheel(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(30,34,44,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-26, 60); ctx.lineTo(0, 0); ctx.lineTo(26, 60); ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(0, -38, 52, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(Math.cos(a) * 52, -38 + Math.sin(a) * 52);
    ctx.stroke();
    ctx.fillStyle = '#e2543e';
    ctx.fillRect(Math.cos(a) * 52 - 4, -38 + Math.sin(a) * 52 - 4, 8, 8);
  }
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(0, -38, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function paintCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.w;
  const W = car.h;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -L / 2 + 2, -W / 2 + 3, L, W, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -L / 2, -W / 2, L, W, 6);
  ctx.fill();
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18,26,36,0.88)';
  rr(ctx, -L * 0.16, -W / 2 + 3, L * 0.34, W - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,200,235,0.5)';
  ctx.fillRect(L * 0.16, -W / 2 + 4, 3.4, W - 8);
  // Nose and tail trim.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 2.4, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 2.4, 5);
  ctx.fillStyle = car.police ? '#c22e2e' : 'rgba(120,20,20,0.7)';
  ctx.fillRect(-L / 2 + 1, -W / 2 + 3, 2.4, 5);
  ctx.fillRect(-L / 2 + 1, W / 2 - 8, 2.4, 5);
  if (car.police) {
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(-L * 0.3, -3.4, L * 0.6, 6.8);
    const flash = Math.sin(time * 9 + (car.sirenPhase || 0)) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2e6de6';
    ctx.fillRect(-7, -3, 6, 6);
    ctx.fillStyle = flash ? '#2e6de6' : '#ff3b30';
    ctx.fillRect(1, -3, 6, 6);
    text(ctx, 'SCPD', 0, 3, 7.5, '#16202c', 'center', 800);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20262e';
    ctx.fillRect(-6, -4.4, 12, 8.8);
    text(ctx, 'TAXI', 0, 3, 6.4, '#ffd76a', 'center', 800);
  }
  ctx.restore();
  if (car.wrecked && car.smoke) {
    ctx.save();
    ctx.fillStyle = 'rgba(40,40,44,0.4)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(car.x - 6 + i * 7, car.y - 12 - i * 6, 6 + i * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,30,0.75)';
    ctx.beginPath(); ctx.arc(car.x + 8, car.y, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function paintFigure(ctx, f, isPlayer) {
  ctx.save();
  ctx.translate(f.x, f.y);
  // Legs in stride.
  ctx.strokeStyle = '#26262c';
  ctx.lineWidth = 3.4;
  const stride = (f.speed || 0) > 4 ? Math.sin(f.id * 7.3) * 4 : 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-3 - stride * 0.4, 6);
  ctx.moveTo(0, 0); ctx.lineTo(3 + stride * 0.4, 6);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = f.color || '#4e79d9';
  ctx.beginPath(); ctx.arc(0, 0, 6.6, 0, Math.PI * 2); ctx.fill();
  if (f.armsUp) {
    ctx.strokeStyle = f.skin || '#f0c08e';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-4, -2); ctx.lineTo(-8, -9);
    ctx.moveTo(4, -2); ctx.lineTo(8, -9);
    ctx.stroke();
  }
  // Head.
  ctx.fillStyle = f.skin || '#f0c08e';
  ctx.beginPath(); ctx.arc(0, -1.4, 3.6, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, -0.6, 9.4, 0, Math.PI * 2); ctx.stroke();
  }
  if (f.role === 'gang') {
    ctx.fillStyle = '#7a1f1f';
    ctx.fillRect(-5, -6.4, 10, 3);
  }
  if (f.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,214,90,0.95)';
    ctx.beginPath();
    ctx.arc(Math.cos(f.angle) * 15, Math.sin(f.angle) * 15, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderScene(ctx, world, cam, vw, vh) {
  const zoom = cam.zoom || 1;
  const view = {
    x0: cam.x - vw / 2 / zoom - 90,
    y0: cam.y - vh / 2 / zoom - 90,
    x1: cam.x + vw / 2 / zoom + 90,
    y1: cam.y + vh / 2 / zoom + 90,
  };
  const phase = skyPhase(world.weather.clock);
  const night = phase === 'night' || phase === 'dusk';

  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  paintGround(ctx, world, view);
  paintStreets(ctx, world, view);

  for (const prop of world.props) {
    if (!inView(view, prop.x, prop.y, 30)) continue;
    paintProp(ctx, prop, phase);
  }

  paintBuildings(ctx, world, view);
  if (inView(view, 3250, 950, 130)) paintWheel(ctx, 3250, 950);

  // Landmark nameplates.
  for (const lm of LANDMARKS) {
    if (!inView(view, lm.x, lm.y, 40)) continue;
    ctx.fillStyle = lm.color;
    ctx.beginPath(); ctx.arc(lm.x, lm.y - 58, 5, 0, Math.PI * 2); ctx.fill();
    text(ctx, lm.short, lm.x, lm.y - 68, 11, '#ffffff', 'center', 800);
  }

  // Collectibles and pickups.
  for (const coin of world.collectibles.coins) {
    if (coin.taken || !inView(view, coin.x, coin.y)) continue;
    ctx.fillStyle = '#f5c542';
    ctx.beginPath(); ctx.arc(coin.x, coin.y, 7, 0, Math.PI * 2); ctx.fill();
    text(ctx, '$', coin.x, coin.y + 3.6, 9, '#a87b12', 'center', 800);
  }
  for (const stash of world.collectibles.stashes) {
    if (stash.taken || !inView(view, stash.x, stash.y)) continue;
    ctx.fillStyle = '#e2703a';
    ctx.fillRect(stash.x - 6, stash.y - 6, 12, 12);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(stash.x - 2, stash.y - 6, 4, 12);
  }
  for (const jump of world.collectibles.jumps) {
    if (jump.done || !inView(view, jump.x, jump.y)) continue;
    ctx.strokeStyle = '#e2543e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(jump.x - 12, jump.y + 8);
    ctx.lineTo(jump.x, jump.y - 10);
    ctx.lineTo(jump.x + 12, jump.y + 8);
    ctx.stroke();
  }
  for (const pk of world.pickups) {
    if (pk.taken || !inView(view, pk.x, pk.y)) continue;
    ctx.fillStyle = pk.kind === 'ammo' ? '#3f9e4d' : '#e2e6ea';
    ctx.fillRect(pk.x - 7, pk.y - 7, 14, 14);
    text(ctx, pk.kind === 'ammo' ? 'A' : '+', pk.x, pk.y + 4, 10, pk.kind === 'ammo' ? '#fff' : '#c22e2e', 'center', 800);
  }

  // Mission target beacon.
  const target = missionTarget(world) || world.flags.target;
  if (target && inView(view, target.x, target.y, 60)) {
    ctx.strokeStyle = 'rgba(255,215,106,0.9)';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(target.x, target.y, 20 + Math.sin(world.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(target.x, target.y, 4.6, 0, Math.PI * 2); ctx.fill();
  }

  // Roadblock: barricade stripe, cones and a spike strip.
  if (world.roadblock && inView(view, world.roadblock.x, world.roadblock.y, 130)) {
    const rb = world.roadblock;
    ctx.save();
    ctx.translate(rb.x, rb.y);
    ctx.rotate(rb.angle || 0);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-6, -52, 12, 104);
    ctx.fillStyle = '#e2543e';
    for (let s = -52; s < 52; s += 20) ctx.fillRect(-6, s, 12, 10);
    ctx.fillStyle = '#e2703a';
    for (let s = -44; s <= 44; s += 22) {
      ctx.beginPath();
      ctx.moveTo(10, s - 5); ctx.lineTo(17, s + 5); ctx.lineTo(3, s + 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#555c63';
    ctx.fillRect(20, -46, 5, 92);
    ctx.restore();
  }

  // Vault ring and cash bags.
  if (world.flags.vaultRing) {
    const ring = world.flags.vaultRing;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (world.flags.overShoulder) ctx.ellipse(ring.x, ring.y, 96, 40, 0, 0, Math.PI * 2);
    else ctx.arc(ring.x, ring.y, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd76a';
    ctx.beginPath();
    if (world.flags.overShoulder) ctx.ellipse(ring.x, ring.y, 96, 40, 0, -Math.PI / 2, -Math.PI / 2 + (ring.pct / 100) * Math.PI * 2);
    else ctx.arc(ring.x, ring.y, 58, -Math.PI / 2, -Math.PI / 2 + (ring.pct / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (world.flags.cashBags) {
    for (const bag of world.flags.cashBags) {
      ctx.fillStyle = '#3f7d33';
      rr(ctx, bag.x - 10, bag.y - 8, 20, 16, 6);
      ctx.fill();
      text(ctx, '$', bag.x, bag.y + 4.4, 11, '#dff5d2', 'center', 800);
    }
  }

  for (const car of world.cars) {
    if (!inView(view, car.x, car.y, 70)) continue;
    if (world.player.car === car) continue;
    paintCar(ctx, car, world.time);
  }
  for (const cop of world.cops) {
    if (cop.wrecked) continue;
    if (world.cars.includes(cop)) continue;
    paintCar(ctx, cop, world.time);
  }

  for (const ped of world.peds) {
    if (!inView(view, ped.x, ped.y, 20)) continue;
    paintFigure(ctx, ped, false);
  }
  for (const g of world.gang) {
    if (!inView(view, g.x, g.y, 20)) continue;
    paintFigure(ctx, g, false);
  }
  for (const fc of world.footCops || []) {
    if (!inView(view, fc.x, fc.y, 20)) continue;
    paintFigure(ctx, fc, false);
  }

  // Bullets as tracer streaks.
  for (const b of world.bullets) {
    ctx.strokeStyle = b.from === 'player' ? 'rgba(255,230,130,0.95)' : 'rgba(255,120,90,0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // The player: in a car, the car; on foot, the figure.
  if (world.player.car) paintCar(ctx, world.player.car, world.time);
  else paintFigure(ctx, world.player, true);

  // AIR-1 and its searchlight.
  if (world.heli) {
    const h = world.heli;
    ctx.save();
    ctx.fillStyle = 'rgba(255,244,190,0.16)';
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x - 66, h.y + 190);
    ctx.lineTo(h.x + 66, h.y + 190);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.22)';
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 192, 62, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle + Math.PI / 2);
    ctx.fillStyle = '#22262e';
    rr(ctx, -11, -26, 22, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#3a4b5c';
    ctx.fillRect(-3, 22, 6, 22);
    ctx.strokeStyle = 'rgba(20,20,24,0.9)';
    ctx.lineWidth = 3.4;
    const ra = h.rotor || 0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ra) * 44, Math.sin(ra) * 44);
    ctx.lineTo(-Math.cos(ra) * 44, -Math.sin(ra) * 44);
    ctx.moveTo(Math.cos(ra + Math.PI / 2) * 44, Math.sin(ra + Math.PI / 2) * 44);
    ctx.lineTo(-Math.cos(ra + Math.PI / 2) * 44, -Math.sin(ra + Math.PI / 2) * 44);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // Sky grading + weather wash + vignette, in screen space.
  const tint = {
    dawn: 'rgba(255,150,90,0.10)', day: 'rgba(255,255,230,0.03)',
    golden: 'rgba(255,140,50,0.16)', dusk: 'rgba(90,60,140,0.20)',
    night: 'rgba(8,14,40,0.34)',
  }[phase] || 'rgba(0,0,0,0)';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, vw, vh);
  const wNow = weatherOf(world.weather);
  if (wNow.id === 'fog') {
    ctx.fillStyle = 'rgba(200,205,210,0.24)';
    ctx.fillRect(0, 0, vw, vh);
  }
  if (wNow.id === 'rain') {
    ctx.strokeStyle = 'rgba(170,200,235,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const rx = hash2(i * 3, Math.floor(world.time * 9)) * vw;
      const ry = hash2(i * 7, Math.floor(world.time * 9) + 1) * vh;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 13);
    }
    ctx.stroke();
  }
  if (night) {
    const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.36, vw / 2, vh / 2, vh * 0.86);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
  }
}

// Foreground hero car for the perspective chase frame: big, low, rear
// three-quarter, light bar reflections playing across the paint.
function paintHeroCar(ctx, world, vw, vh) {
  const car = world.player.car;
  const cx = vw / 2 + Math.sin(world.time * 1.4) * 7;
  const cy = vh * 0.8;
  const w = 330;
  const h = 148;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0, h * 0.44, w * 0.52, 17, 0, 0, Math.PI * 2); ctx.fill();
  const bodyGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  const base = car ? car.color : '#e8b13c';
  bodyGrad.addColorStop(0, base);
  bodyGrad.addColorStop(1, '#5c1f16');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.32);
  ctx.lineTo(-w * 0.42, -h * 0.2);
  ctx.lineTo(-w * 0.3, -h * 0.42);
  ctx.lineTo(w * 0.3, -h * 0.42);
  ctx.lineTo(w * 0.42, -h * 0.2);
  ctx.lineTo(w / 2, h * 0.32);
  ctx.quadraticCurveTo(0, h * 0.5, -w / 2, h * 0.32);
  ctx.closePath();
  ctx.fill();
  // Rear glass and spoiler.
  ctx.fillStyle = 'rgba(14,22,32,0.92)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.4);
  ctx.lineTo(w * 0.3, -h * 0.4);
  ctx.lineTo(w * 0.36, -h * 0.16);
  ctx.lineTo(-w * 0.36, -h * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#20242a';
  ctx.fillRect(-w * 0.44, -h * 0.52, w * 0.88, 9);
  ctx.fillRect(-w * 0.4, -h * 0.52, 8, 16);
  ctx.fillRect(w * 0.4 - 8, -h * 0.52, 8, 16);
  // Tail light bar with police reflections.
  const flash = Math.sin(world.time * 9) > 0;
  ctx.fillStyle = '#7d1420';
  ctx.fillRect(-w * 0.44, h * 0.1, w * 0.88, 13);
  ctx.fillStyle = flash ? 'rgba(255,60,50,0.85)' : 'rgba(60,110,255,0.7)';
  ctx.fillRect(-w * 0.44, h * 0.1, w * 0.3, 13);
  ctx.fillStyle = flash ? 'rgba(60,110,255,0.7)' : 'rgba(255,60,50,0.85)';
  ctx.fillRect(w * 0.14, h * 0.1, w * 0.3, 13);
  // Plate, exhausts, wheels.
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(-34, h * 0.24, 68, 19);
  text(ctx, 'SOLMAR', 0, h * 0.24 + 14, 12.5, '#22262e', 'center', 800);
  ctx.fillStyle = '#33383f';
  ctx.beginPath(); ctx.arc(-w * 0.36, h * 0.4, 21, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.36, h * 0.4, 21, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#888f98';
  ctx.beginPath(); ctx.arc(-w * 0.36, h * 0.4, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.36, h * 0.4, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#565d66';
  ctx.fillRect(-52, h * 0.34, 17, 8);
  ctx.fillRect(35, h * 0.34, 17, 8);
  ctx.restore();

  // Speed streaks at the frame edges.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 7; i++) {
    const y = vh * (0.52 + i * 0.07);
    const len = 60 + hash2(i, 4) * 90;
    ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(24 + len, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vw - 24 - len, y + 9); ctx.lineTo(vw - 24, y + 9); ctx.stroke();
  }
  ctx.restore();
}

// Over-shoulder foreground: Rex's shoulder, head and SMG arm, large in
// the lower-left, with a muzzle flash while the ring is hot.
function paintOverShoulder(ctx, world, vw, vh) {
  ctx.save();
  const flashOn = world.gang.some((g) => g.muzzle > 0) || world.bullets.length > 0;
  // Shoulder and back, rim-lit so the silhouette reads at night.
  ctx.beginPath();
  ctx.moveTo(-30, vh + 30);
  ctx.quadraticCurveTo(vw * 0.1, vh * 0.52, vw * 0.3, vh * 0.66);
  ctx.quadraticCurveTo(vw * 0.36, vh * 0.78, vw * 0.3, vh + 30);
  ctx.closePath();
  ctx.fillStyle = '#15181d';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,155,180,0.55)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = '#7a1f1f';
  ctx.beginPath();
  ctx.moveTo(-30, vh + 30);
  ctx.quadraticCurveTo(vw * 0.1, vh * 0.6, vw * 0.28, vh * 0.7);
  ctx.quadraticCurveTo(vw * 0.2, vh * 0.86, vw * 0.12, vh + 30);
  ctx.closePath();
  ctx.fill();
  // Head, low-left.
  ctx.fillStyle = '#15181d';
  ctx.beginPath(); ctx.arc(vw * 0.13, vh * 0.6, 37, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c98a54';
  ctx.beginPath(); ctx.arc(vw * 0.13, vh * 0.6, 29, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1d22';
  ctx.beginPath(); ctx.arc(vw * 0.13, vh * 0.575, 29.5, Math.PI, Math.PI * 2); ctx.fill();
  // Arm driving out to the SMG at centre-frame.
  ctx.strokeStyle = '#15181d';
  ctx.lineWidth = 27;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(vw * 0.2, vh * 0.82);
  ctx.lineTo(vw * 0.42, vh * 0.62);
  ctx.stroke();
  ctx.save();
  ctx.translate(vw * 0.42, vh * 0.62);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#22262e';
  ctx.fillRect(0, -7, 118, 14);
  ctx.fillRect(96, -4.4, 40, 6);
  ctx.fillRect(26, 6, 13, 24);
  ctx.fillRect(64, 5, 9, 17);
  ctx.fillStyle = '#3c434c';
  ctx.fillRect(8, -10, 30, 5);
  ctx.restore();
  if (flashOn) {
    ctx.fillStyle = 'rgba(255,216,90,0.95)';
    ctx.beginPath();
    ctx.arc(vw * 0.42 + 142, vh * 0.62 - 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,0.5)';
    ctx.beginPath();
    ctx.arc(vw * 0.42 + 142, vh * 0.62 - 2, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWorld(outCtx, world, cam, vw, vh) {
  const useCam = cam || { x: world.player.x, y: world.player.y, zoom: 1 };
  const wantsPersp = useCam.persp || world.flags.perspCam;

  if (wantsPersp && typeof document !== 'undefined') {
    const off = document.createElement('canvas');
    off.width = vw;
    off.height = vh;
    const offCtx = off.getContext('2d');
    renderScene(offCtx, world, { x: useCam.x, y: useCam.y, zoom: useCam.zoom || 1 }, vw, vh);

    // Sky above the horizon, then the warped city below it.
    const horizon = Math.round(vh * 0.38);
    const skyGrad = outCtx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#2c3e63');
    skyGrad.addColorStop(0.7, '#c65f3d');
    skyGrad.addColorStop(1, '#e8975a');
    outCtx.fillStyle = skyGrad;
    outCtx.fillRect(0, 0, vw, horizon);
    paintSkylineLayer(outCtx, vw, horizon, 1, 'rgba(40,40,66,0.75)', 0.4);
    outCtx.fillStyle = '#3a3f45';
    outCtx.fillRect(0, horizon, vw, vh - horizon);

    const strip = 4;
    for (let y = horizon; y < vh; y += strip) {
      const t = (y - horizon) / (vh - horizon);
      const srcY = perspSrcY(t) * vh;
      const srcH = Math.max(1.4, (perspSrcY(Math.min(1, t + strip / (vh - horizon))) - perspSrcY(t)) * vh);
      const scale = perspRowScale(t);
      const destW = vw * (0.3 + 0.7 * scale);
      outCtx.drawImage(off, 0, srcY, vw, srcH, (vw - destW) / 2, y, destW, strip + 0.6);
    }
    paintHeroCar(outCtx, world, vw, vh);
    if (world.flags.overShoulder) paintOverShoulder(outCtx, world, vw, vh);
    return;
  }

  renderScene(outCtx, world, useCam, vw, vh);
  if (world.flags.overShoulder) paintOverShoulder(outCtx, world, vw, vh);
}

// ------------------------------------------------------------------- HUD

export function drawHUD(ctx, world, vw, vh) {
  const p = world.player;
  const stars = starsOf(world);
  const stage = missionStage(world);

  // Mission panel, top-left.
  plate(ctx, 12, 12, 302, stage ? 106 : 62);
  if (stage) {
    text(ctx, stage.title.toUpperCase(), 24, 36, 15.5, '#ffd76a', 'left', 800);
    for (let i = 0; i < stage.steps; i++) {
      ctx.fillStyle = i < stage.step ? '#39b06a' : i === stage.step ? '#ffd76a' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(31 + i * 17, 52, 5.4, 0, Math.PI * 2); ctx.fill();
    }
    text(ctx, `STEP ${stage.step + 1}/${stage.steps} · ${Math.max(0, Math.ceil(stage.timer))}s`, 24 + stage.steps * 17 + 12, 56, 11.5, '#c8cfd8');
    text(ctx, stage.label, 24, 76, 12.5, '#f2f4f6');
    if (stage.nextLabel) text(ctx, 'NEXT: ' + stage.nextLabel, 24, 96, 11, '#9fb4c8');
    if (stage.kind === 'hold') bar(ctx, 24, 102, 200, 6, (world.mission.holdTimer || 0) / 20, '#ffd76a');
  } else {
    text(ctx, 'SOLMAR BAY — FREE ROAM', 24, 38, 14.5, '#ffd76a', 'left', 800);
    text(ctx, 'Press N for the next job', 24, 60, 11.5, '#c8cfd8');
  }

  // Heat panel under it.
  plate(ctx, 12, 126, 302, 56);
  let starStr = '';
  for (let i = 0; i < 5; i++) starStr += i < stars ? '★' : '☆';
  text(ctx, starStr, 24, 152, 19, stars > 0 ? '#ffd76a' : '#5c6672', 'left', 800);
  text(ctx, world.sighted ? 'IN SIGHT' : 'UNSEEN', 118, 151, 11.5, world.sighted ? '#ff7a5c' : '#39b06a', 'left', 800);
  bar(ctx, 196, 141, 104, 9, world.heat / HEAT_MAX, '#e2543e');
  text(ctx, `HEAT ${Math.round(world.heat)}`, 196, 172, 10, '#9fb4c8');

  // Weapon slots, top-right.
  plate(ctx, vw - 280, 12, 268, 56);
  WEAPONS.forEach((gun, i) => {
    const x = vw - 268 + i * 86;
    const active = p.weapon === i;
    ctx.fillStyle = active ? 'rgba(255,215,106,0.22)' : 'rgba(255,255,255,0.06)';
    rr(ctx, x, 20, 78, 40, 6);
    ctx.fill();
    text(ctx, gun.slot + ' ' + gun.name.toUpperCase(), x + 6, 37, 10.5, active ? '#ffd76a' : '#c8cfd8', 'left', 700);
    const ammoStr = gun.speed === 0 ? '—' : i === p.weapon ? `${p.ammo} / ${p.reserve}` : `${gun.ammo}`;
    text(ctx, ammoStr, x + 6, 54, 10.5, '#9fb4c8');
  });
  if (p.reloading > 0) text(ctx, 'RELOADING…', vw - 24, 84, 11, '#ffd76a', 'right', 800);

  // SCPD response panel.
  const units = [];
  for (const cop of world.cops) {
    if (cop.wrecked) continue;
    units.push({ label: 'SCPD CRUISER', tactic: cop.behaviour || 'PURSUIT', d: dist(p.x, p.y, cop.x, cop.y) });
  }
  if (world.heli) units.push({ label: 'AIR-1', tactic: 'SPOTLIGHT', d: dist(p.x, p.y, world.heli.x, world.heli.y) });
  if (world.roadblock) units.push({ label: 'ROADBLOCK', tactic: 'SPIKES', d: dist(p.x, p.y, world.roadblock.x, world.roadblock.y) });
  for (const fc of world.footCops || []) units.push({ label: 'FOOT UNIT', tactic: fc.behaviour || 'FOOT CHASE', d: dist(p.x, p.y, fc.x, fc.y) });
  units.sort((a, b) => a.d - b.d);
  const shown = units.slice(0, 4);
  if (shown.length) {
    plate(ctx, vw - 280, 76, 268, 30 + shown.length * 21);
    text(ctx, 'SCPD RESPONSE', vw - 268, 95, 11.5, '#ff9a7a', 'left', 800);
    shown.forEach((u, i) => {
      const y = 114 + i * 21;
      text(ctx, u.label, vw - 268, y, 11, '#f2f4f6');
      ctx.fillStyle = 'rgba(226,84,62,0.3)';
      rr(ctx, vw - 168, y - 10, 74, 14, 7);
      ctx.fill();
      text(ctx, u.tactic, vw - 131, y, 9, '#ffb59d', 'center', 700);
      text(ctx, `${Math.round(u.d / 4)} m`, vw - 24, y, 11, '#ffd76a', 'right', 700);
    });
  }

  // Crew card strip under the response panel.
  const crewY = 76 + (shown.length ? 38 + shown.length * 21 : 8);
  plate(ctx, vw - 280, crewY, 268, 46);
  text(ctx, 'CREW', vw - 268, crewY + 17, 10.5, '#9fb4c8', 'left', 800);
  text(ctx, 'Lena · wheel', vw - 268, crewY + 35, 11.5, '#f2f4f6');
  text(ctx, 'Kane · vault', vw - 150, crewY + 35, 11.5, '#f2f4f6');

  // Player plate, bottom-left.
  plate(ctx, 12, vh - 118, 302, 106);
  ctx.fillStyle = '#7a1f1f';
  rr(ctx, 22, vh - 106, 44, 44, 6);
  ctx.fill();
  text(ctx, 'RK', 44, vh - 78, 17, '#ffd9c9', 'center', 800);
  text(ctx, 'REX KANE', 76, vh - 92, 13.5, '#f2f4f6', 'left', 800);
  const rank = rankFor(world.stats.rp);
  const next = nextRank(world.stats.rp);
  text(ctx, rank.name + (next ? ` · next at ${next.rp} RP` : ' · max rank'), 76, vh - 74, 10.5, '#9fb4c8');
  text(ctx, 'HP', 22, vh - 44, 10.5, '#9fb4c8');
  bar(ctx, 52, vh - 52, 150, 9, p.hp / 100, '#39b06a');
  text(ctx, 'ARM', 22, vh - 27, 10.5, '#9fb4c8');
  bar(ctx, 52, vh - 35, 150, 9, p.armour / 100, '#4d9de0');
  text(ctx, `$${world.stats.money}`, 300, vh - 44, 15, '#7dd87d', 'right', 800);
  text(ctx, stationLabel(world.radioIdx), 300, vh - 27, 10, '#9fb4c8', 'right');

  // Dialogue, bottom-centre.
  if (world.dialogue && world.time < world.dialogue.until) {
    const d = world.dialogue;
    plate(ctx, vw / 2 - 262, vh - 96, 524, 80, 0.82);
    text(ctx, `${d.who} — ${d.role}`, vw / 2 - 246, vh - 70, 12, '#ffd76a', 'left', 800);
    text(ctx, d.line, vw / 2 - 246, vh - 46, 13, '#f2f4f6');
  }

  // Minimap, bottom-right: a round window on the whole city.
  const mmX = vw - 104;
  const mmY = vh - 104;
  const mmR = 86;
  ctx.save();
  ctx.beginPath(); ctx.arc(mmX, mmY, mmR, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#20262e';
  ctx.fillRect(mmX - mmR, mmY - mmR, mmR * 2, mmR * 2);
  const toMap = (wx, wy) => [mmX + (wx / 3600 - 0.5) * mmR * 1.84, mmY + (wy / 3600 - 0.5) * mmR * 1.84];
  for (let dx = 0; dx < 3; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      const standing = districtStanding(world, dx, dy);
      ctx.fillStyle = standing > 0 ? 'rgba(70,170,90,0.35)' : standing < 0 ? 'rgba(200,70,50,0.28)' : 'rgba(140,150,160,0.2)';
      const [cx0, cy0] = toMap(dx * 1200, dy * 1200);
      const [cx1, cy1] = toMap(dx * 1200 + 1200, dy * 1200 + 1200);
      ctx.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3600; i += 400) {
    const [gx] = toMap(i, 0);
    ctx.beginPath(); ctx.moveTo(gx, mmY - mmR); ctx.lineTo(gx, mmY + mmR); ctx.stroke();
    const [, gy] = toMap(0, i);
    ctx.beginPath(); ctx.moveTo(mmX - mmR, gy); ctx.lineTo(mmX + mmR, gy); ctx.stroke();
  }
  ctx.fillStyle = '#ff5c48';
  for (const cop of world.cops) {
    if (cop.wrecked) continue;
    const [cx, cy] = toMap(cop.x, cop.y);
    ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  const tgt = missionTarget(world) || world.flags.target;
  if (tgt) {
    const [tx, ty] = toMap(tgt.x, tgt.y);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(tx, ty, 4.4, 0, Math.PI * 2); ctx.fill();
  }
  const [px, py] = toMap(p.x, p.y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px, py - 6);
  ctx.lineTo(px - 4.4, py + 5);
  ctx.lineTo(px + 4.4, py + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mmX, mmY, mmR, 0, Math.PI * 2); ctx.stroke();

  // Speed block, left of the minimap.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * KMH_PER_UNIT);
    text(ctx, `${kmh}`, vw - 216, vh - 58, 37, '#f2f4f6', 'right', 800);
    text(ctx, 'km/h', vw - 210, vh - 58, 12, '#9fb4c8');
    text(ctx, `${p.car.name} · ${Math.max(0, Math.round(p.car.hp))}%`, vw - 216, vh - 34, 11.5, '#c8cfd8', 'right');
  }

  // Centre flash + controls hint.
  if (world.flash && world.time < world.flash.until) {
    text(ctx, world.flash.text, vw / 2, vh * 0.3, 25, '#ffd76a', 'center', 800);
  }
  text(ctx, 'WASD drive · E enter · mouse aim · click shoot · P map', vw / 2, vh - 6, 10, 'rgba(220,228,238,0.55)', 'center');
}

// ------------------------------------------------------------- map screen

function paintRing(ctx, x, y, r, pct, color, label) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2); ctx.stroke();
  text(ctx, `${Math.round(pct)}%`, x, y + 7, 21, '#f2f4f6', 'center', 800);
  if (label) text(ctx, label, x, y + r + 20, 10.5, '#9fb4c8', 'center', 700);
  ctx.restore();
}

export function drawMap(ctx, world, vw, vh, saveInfo) {
  ctx.fillStyle = 'rgba(6,9,14,0.9)';
  ctx.fillRect(0, 0, vw, vh);
  plate(ctx, 64, 40, vw - 128, vh - 80, 0.94);

  text(ctx, 'SOLMAR BAY', 96, 84, 21, '#ffd76a', 'left', 800);
  // Tab bar.
  const tabs = ['MAP', 'STATS', 'SAVE'];
  tabs.forEach((tab, i) => {
    const x = 320 + i * 104;
    ctx.fillStyle = i === 0 ? 'rgba(255,215,106,0.25)' : 'rgba(255,255,255,0.07)';
    rr(ctx, x, 60, 94, 30, 6);
    ctx.fill();
    text(ctx, tab, x + 47, 80, 12.5, i === 0 ? '#ffd76a' : '#c8cfd8', 'center', 800);
  });
  text(ctx, `DAY ${1 + Math.floor(world.stats.playTime / 240)} · ${weatherOf(world.weather).label}`, vw - 96, 84, 12, '#9fb4c8', 'right', 700);

  // The city map.
  const mapX = 96;
  const mapY = 118;
  const mapS = 452;
  const cell = mapS / 3;
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const standing = districtStanding(world, dx, dy);
      ctx.fillStyle = standing > 0 ? 'rgba(70,170,90,0.4)' : standing < 0 ? 'rgba(200,70,50,0.34)' : 'rgba(130,140,155,0.3)';
      ctx.fillRect(mapX + dx * cell + 2, mapY + dy * cell + 2, cell - 4, cell - 4);
      text(ctx, DISTRICTS[dy * 3 + dx], mapX + dx * cell + cell / 2, mapY + dy * cell + 24, 12, '#ffffff', 'center', 800);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 9; i++) {
    const gx = mapX + (i / 9) * mapS;
    ctx.beginPath(); ctx.moveTo(gx, mapY); ctx.lineTo(gx, mapY + mapS); ctx.stroke();
    const gy = mapY + (i / 9) * mapS;
    ctx.beginPath(); ctx.moveTo(mapX, gy); ctx.lineTo(mapX + mapS, gy); ctx.stroke();
  }
  const toMap = (wx, wy) => [mapX + (wx / 3600) * mapS, mapY + (wy / 3600) * mapS];
  for (const lm of LANDMARKS) {
    const [lx, ly] = toMap(lm.x, lm.y);
    ctx.fillStyle = lm.color;
    ctx.beginPath(); ctx.arc(lx, ly, 4.6, 0, Math.PI * 2); ctx.fill();
    text(ctx, lm.short, lx, ly - 8, 9, '#e8edf2', 'center', 700);
  }
  // GPS route to the active target.
  const target = missionTarget(world) || world.flags.target;
  if (target) {
    const route = gpsRoute(world.player, target);
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    route.forEach((pt, i) => {
      const [rx2, ry2] = toMap(pt.x, pt.y);
      if (i === 0) ctx.moveTo(rx2, ry2);
      else ctx.lineTo(rx2, ry2);
    });
    ctx.stroke();
    const [tx, ty] = toMap(target.x, target.y);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(tx, ty, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20262e';
    ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
    text(ctx, `GPS ${(routeLength(route) / 1000).toFixed(1)} km`, tx, ty - 27, 10.5, '#ffd76a', 'center', 800);
  }
  const [ppx, ppy] = toMap(world.player.x, world.player.y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ppx, ppy, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20262e';
  ctx.beginPath(); ctx.arc(ppx, ppy, 2.6, 0, Math.PI * 2); ctx.fill();
  text(ctx, '■ Rex ground   ■ Viper ground   ◆ landmark   ● you', mapX, mapY + mapS + 22, 11, '#c8cfd8');

  // Right column: completion, checklist, career grid.
  const rx = 592;
  paintRing(ctx, rx + 58, 176, 44, completionPct(world), '#ffd76a', 'COMPLETE');
  const stage = missionStage(world);
  text(ctx, stage ? `ON JOB: ${stage.title}` : 'NO ACTIVE JOB', rx + 128, 158, 13, '#f2f4f6', 'left', 800);
  text(ctx, stage ? stage.label : 'Pick up work with N', rx + 128, 180, 11.5, '#9fb4c8');
  text(ctx, `CASH $${world.stats.money} · SCORE ${world.stats.score}`, rx + 128, 202, 12, '#7dd87d', 'left', 700);

  const kit = world.collectibles;
  const checks = [
    ['Story jobs', `${world.stats.missionsDone} / 5`],
    ['Solmar coins', `${coinsTaken(kit)} / ${kit.coins.length}`],
    ['Lantern stashes', `${stashesTaken(kit)} / ${kit.stashes.length}`],
    ['Stunt jumps', `${jumpsDone(kit)} / ${kit.jumps.length}`],
    ['Street races', `${racesWon(world)} / 3`],
    ['Turf held', `${zonesHeld(world.turf)} / ${world.turf.zones.length}`],
    ['Car mods', `${modsBought(world.mods)} / 9`],
  ];
  text(ctx, 'CHECKLIST', rx, 262, 12.5, '#ffd76a', 'left', 800);
  checks.forEach((row, i) => {
    const y = 286 + i * 22;
    text(ctx, row[0], rx, y, 12, '#e8edf2');
    text(ctx, row[1], rx + 190, y, 12, '#ffd76a', 'right', 700);
  });

  const s = world.stats;
  const career = [
    ['Rank', rankFor(s.rp).name],
    ['Reputation', `${s.rp} RP`],
    ['Cars stolen', `${s.carsStolen}`],
    ['Taxi fares', `${s.fares}`],
    ['Deliveries', `${s.deliveries}`],
    ['Near misses', `${s.nearMisses}`],
    ['Distance', `${s.kmDriven.toFixed(1)} km`],
    ['Escapes', `${s.copsEscaped}`],
    ['Longest chase', `${s.longestChase}s`],
    ['Shots fired', `${s.shotsFired}`],
  ];
  text(ctx, 'CAREER', rx + 250, 262, 12.5, '#ffd76a', 'left', 800);
  career.forEach((row, i) => {
    const y = 286 + i * 22;
    text(ctx, row[0], rx + 250, y, 12, '#e8edf2');
    text(ctx, row[1], rx + 478, y, 12, '#ffd76a', 'right', 700);
  });

  // Save strip along the bottom of the panel.
  const slotText = saveInfo && saveInfo.exists
    ? `AUTOSAVE · ${saveInfo.missionsDone || 0} jobs done · $${saveInfo.money || 0} banked`
    : 'AUTOSAVE · no save recorded yet this session';
  plate(ctx, 96, vh - 108, vw - 192, 42, 0.6);
  text(ctx, slotText, 112, vh - 81, 12, '#c8cfd8');
  text(ctx, 'P / ESC to return', vw - 112, vh - 81, 12, '#9fb4c8', 'right', 700);
}

export const drawMapScreen = drawMap;

// ---------------------------------------------------------- victory + end

export function drawVictoryScreen(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(24,14,4,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  plate(ctx, vw / 2 - 400, 56, 800, vh - 112, 0.95);
  const cx = vw / 2;
  text(ctx, 'STORY COMPLETE', cx, 116, 33, '#ffd76a', 'center', 800);
  text(ctx, 'The vault is empty, the crew is paid, Solmar is yours.', cx, 142, 13.5, '#e8dcc0', 'center');

  const sum = victorySummary(world);
  sum.grades.forEach((g, i) => {
    const y = 182 + i * 40;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
    rr(ctx, cx - 360, y - 24, 720, 34, 6);
    ctx.fill();
    text(ctx, `${i + 1}. ${g.title}`, cx - 344, y, 14, '#f2f4f6', 'left', 700);
    text(ctx, g.done ? `$${g.pay}` : '—', cx + 190, y, 13, '#7dd87d', 'right', 700);
    text(ctx, g.grade || '—', cx + 330, y, 17, '#ffd76a', 'right', 800);
  });

  const yBase = 182 + 5 * 40 + 16;
  text(ctx, `FINAL SCORE ${sum.finalScore}`, cx - 360, yBase, 16, '#f2f4f6', 'left', 800);
  text(ctx, `BANKED $${sum.money}`, cx + 360, yBase, 16, '#7dd87d', 'right', 800);
  paintRing(ctx, cx + 296, yBase + 58, 30, completionPct(world), '#ffd76a', '');

  text(ctx, 'FEATS OF THE MILE', cx - 360, yBase + 34, 12.5, '#ffd76a', 'left', 800);
  if (sum.feats.length) {
    sum.feats.slice(0, 4).forEach((feat, i) => {
      text(ctx, '◆ ' + feat, cx - 360, yBase + 58 + i * 20, 12.5, '#e8edf2');
    });
  } else {
    text(ctx, 'No feats recorded.', cx - 360, yBase + 58, 12.5, '#9fb4c8');
  }
  text(ctx, 'Press Enter to keep roaming Solmar', cx, vh - 76, 12, '#9fb4c8', 'center', 700);
}

export function drawEndScreen(ctx, world, vw, vh, busted) {
  ctx.fillStyle = busted ? 'rgba(10,16,34,0.78)' : 'rgba(30,4,4,0.78)';
  ctx.fillRect(0, 0, vw, vh);
  const cx = vw / 2;
  text(ctx, busted ? 'BUSTED' : 'WASTED', cx, vh * 0.4, 64, busted ? '#7db4ff' : '#ff5c48', 'center', 800);
  const s = world.stats;
  text(ctx, `Score ${s.score} · $${Math.max(0, s.money - 150)} after the bill · ${s.missionsDone} jobs done`, cx, vh * 0.4 + 44, 14.5, '#e8edf2', 'center');
  text(ctx, busted ? 'The SCPD thanks you for stopping.' : 'Solmar General patched you up — $150, no questions.', cx, vh * 0.4 + 70, 12.5, '#9fb4c8', 'center');
  text(ctx, 'Press Enter to respawn', cx, vh * 0.4 + 108, 13, '#ffd76a', 'center', 800);
}

// ------------------------------------------------------------------ title

function paintSkylineLayer(ctx, vw, baseY, layer, color, alphaScale) {
  ctx.save();
  ctx.globalAlpha = alphaScale === undefined ? 1 : alphaScale;
  ctx.fillStyle = color;
  const n = 16 + layer * 5;
  for (let i = 0; i < n; i++) {
    const bw = vw / n;
    const bh = (26 + hash2(i * 7, layer * 13) * 74) * (0.7 + layer * 0.3);
    ctx.fillRect(i * bw - 2, baseY - bh, bw + 3, bh);
    ctx.fillStyle = 'rgba(255,205,100,0.75)';
    for (let wy = 0; wy < Math.floor(bh / 15); wy++) {
      for (let wx = 0; wx < 3; wx++) {
        if (hash2(i * 31 + wx, layer * 17 + wy) < 0.5) continue;
        ctx.fillRect(i * bw + 4 + wx * (bw / 3.4), baseY - bh + 6 + wy * 15, 4.6, 6);
      }
    }
    ctx.fillStyle = color;
  }
  ctx.restore();
}

export function drawTitle(ctx, world, vw, vh, best) {
  const phase = skyPhase(world.weather.clock);
  const sky = ctx.createLinearGradient(0, 0, 0, vh);
  if (phase === 'night') {
    sky.addColorStop(0, '#060a1c'); sky.addColorStop(0.55, '#1c2a52'); sky.addColorStop(1, '#4a3060');
  } else if (phase === 'day') {
    sky.addColorStop(0, '#3f7ec2'); sky.addColorStop(0.55, '#9fc6e8'); sky.addColorStop(1, '#e8d9ae');
  } else {
    sky.addColorStop(0, '#2c3e63'); sky.addColorStop(0.5, '#c65f3d'); sky.addColorStop(1, '#f0a35e');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, vh);

  const horizonY = Math.round(vh * 0.62);
  paintSkylineLayer(ctx, vw, horizonY, 1, 'rgba(52,48,84,0.65)');
  paintSkylineLayer(ctx, vw, horizonY, 2, 'rgba(30,30,52,0.85)');
  paintSkylineLayer(ctx, vw, horizonY + 4, 3, '#141422');

  // Sea with a sparkle band, right of the beach.
  ctx.fillStyle = '#2e6d96';
  ctx.fillRect(vw * 0.45, horizonY, vw * 0.55, vh - horizonY);
  ctx.fillStyle = 'rgba(255,230,160,0.5)';
  for (let i = 0; i < 46; i++) {
    const sx = vw * 0.48 + hash2(i, 8) * vw * 0.48;
    const sy = horizonY + 8 + hash2(i, 9) * (vh - horizonY - 18);
    ctx.fillRect(sx, sy, 9 + hash2(i, 10) * 16, 1.8);
  }
  // Beach foreground across the lower frame.
  const sandGrad = ctx.createLinearGradient(0, horizonY + 30, 0, vh);
  sandGrad.addColorStop(0, '#e8d29e');
  sandGrad.addColorStop(1, '#c9ab6d');
  ctx.fillStyle = sandGrad;
  ctx.beginPath();
  ctx.moveTo(0, vh);
  ctx.lineTo(0, horizonY + 44);
  ctx.quadraticCurveTo(vw * 0.3, horizonY + 12, vw * 0.58, horizonY + 40);
  ctx.lineTo(vw * 0.58, vh);
  ctx.closePath();
  ctx.fill();

  // Logotype.
  const titleGrad = ctx.createLinearGradient(0, 120, 0, 220);
  titleGrad.addColorStop(0, '#ffe9a8');
  titleGrad.addColorStop(0.55, '#ffb13c');
  titleGrad.addColorStop(1, '#e2543e');
  ctx.save();
  ctx.font = "800 84px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = titleGrad;
  ctx.fillText('SOLMAR HEAT', 64, 208);
  ctx.restore();
  text(ctx, 'An open-world crime story in Solmar Bay', 68, 240, 16.5, '#ffffff', 'left', 700);
  text(ctx, 'Five jobs. One vault. Every cop in the county.', 68, 264, 13, 'rgba(255,255,255,0.85)');

  // Menu.
  const menu = ['CONTINUE — roam Solmar', 'NEW GAME — fresh heat', 'MAP & RECORD — press P in game'];
  menu.forEach((item, i) => {
    const y = 330 + i * 42;
    ctx.fillStyle = i === 0 ? 'rgba(255,215,106,0.28)' : 'rgba(10,14,20,0.45)';
    rr(ctx, 64, y - 24, 330, 34, 7);
    ctx.fill();
    text(ctx, item, 80, y, 14, i === 0 ? '#ffd76a' : '#e8edf2', 'left', 700);
  });
  text(ctx, 'Press Enter to play', 68, 330 + 3 * 42 + 6, 12.5, '#ffd76a', 'left', 800);

  // Save-slot cards, right side.
  const cardX = vw - 336;
  for (let i = 0; i < 3; i++) {
    const y = 300 + i * 92;
    plate(ctx, cardX, y, 272, 80, 0.66);
    text(ctx, `SLOT ${i + 1}`, cardX + 16, y + 24, 11.5, '#9fb4c8', 'left', 800);
    if (i === 0 && best) {
      text(ctx, `${best.missionsDone || 0} jobs · $${best.money || 0}`, cardX + 16, y + 48, 13, '#f2f4f6', 'left', 700);
      text(ctx, `Score ${best.score || 0}`, cardX + 16, y + 68, 11, '#9fb4c8');
    } else if (i === 0) {
      text(ctx, `${world.stats.missionsDone} jobs · $${world.stats.money}`, cardX + 16, y + 48, 13, '#f2f4f6', 'left', 700);
      text(ctx, `Score ${world.stats.score} · ${rankFor(world.stats.rp).name}`, cardX + 16, y + 68, 11, '#9fb4c8');
    } else {
      text(ctx, 'Empty', cardX + 16, y + 48, 13, '#77808c', 'left', 700);
    }
  }
  text(ctx, 'SOLMAR HEAT · build r16 · a make.fun story', 68, vh - 18, 11, 'rgba(255,255,255,0.75)');
}

// --------------------------------------------------------------- mod shop

export function drawModShop(ctx, world, vw, vh) {
  ctx.fillStyle = 'rgba(6,9,14,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  plate(ctx, vw / 2 - 330, 120, 660, 430, 0.95);
  const cx = vw / 2;
  text(ctx, "LOU'S MOD SHOP", cx, 172, 24, '#ffd76a', 'center', 800);
  text(ctx, `Cash on hand: $${world.stats.money} · press 1 / 2 / 3 to buy · E to leave`, cx, 198, 12.5, '#9fb4c8', 'center');

  MOD_TRACKS.forEach((track, i) => {
    const y = 236 + i * 74;
    const level = world.mods[track.id];
    plate(ctx, cx - 290, y, 580, 62, 0.6);
    text(ctx, `${i + 1}  ${track.name.toUpperCase()}`, cx - 272, y + 26, 15, '#f2f4f6', 'left', 800);
    for (let pip = 0; pip < 3; pip++) {
      ctx.fillStyle = pip < level ? '#ffd76a' : 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.arc(cx - 264 + pip * 19, y + 46, 5.6, 0, Math.PI * 2); ctx.fill();
    }
    const priceStr = level >= 3 ? 'MAXED' : `$${track.prices[level]} for level ${level + 1}`;
    text(ctx, priceStr, cx + 272, y + 38, 13.5, level >= 3 ? '#39b06a' : '#ffd76a', 'right', 700);
  });

  plate(ctx, cx - 290, 236 + 3 * 74, 580, 62, 0.6);
  text(ctx, `PAINT SHOP — $${PAINT_PRICE}`, cx - 272, 236 + 3 * 74 + 26, 15, '#f2f4f6', 'left', 800);
  text(ctx, 'Fresh paint, fixed panels, heat wiped. Press E outside by the paint sign.', cx - 272, 236 + 3 * 74 + 48, 11.5, '#9fb4c8');
  text(ctx, `Mods fitted: ${modsBought(world.mods)} / 9`, cx, 236 + 3 * 74 + 92, 12, '#c8cfd8', 'center', 700);
}
