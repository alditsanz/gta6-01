// Solmar Heat — combat.js
// Shooting, punching and guards. Bullets are tested against every target
// along the segment they travel in a frame — not just their endpoint —
// so a fast bullet can never tunnel straight past a thin guard.

export const BULLET_SPEED = 620; // units per second
export const BULLET_RANGE = 520; // a bullet dies after this far
export const PUNCH_RANGE = 42;
export const PUNCH_DAMAGE = 1;
export const AMMO_MAG = 12; // rounds per magazine
export const AMMO_RESERVE_START = 48;

// A bullet flies from (x, y) along angle, remembering where it started
// so the segment test can cover the whole step.
export function fireBullet(bullets, x, y, angle) {
  bullets.push({
    x,
    y,
    px: x,
    py: y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    travelled: 0,
    dead: false,
  });
}

// Segment-vs-circle test: does the segment (x1,y1)-(x2,y2) pass within
// radius r of (cx, cy)? This is the anti-tunnelling check.
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return Math.hypot(cx - px, cy - py) <= r;
}

// Step every bullet, test it against guards (and hostile crew), and drop
// it when it has flown its range or hit something. Returns a list of
// hit events { guard, damage } for the caller to apply.
export function updateBullets(bullets, dt, targets) {
  const hits = [];
  for (const b of bullets) {
    if (b.dead) continue;
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    if (b.travelled > BULLET_RANGE) {
      b.dead = true;
      continue;
    }
    for (const t of targets) {
      if (t.dead || t.hp <= 0) continue;
      if (segmentHitsCircle(b.px, b.py, b.x, b.y, t.x, t.y, t.radius || 18)) {
        b.dead = true;
        hits.push({ target: t, damage: 1 });
        break;
      }
    }
  }
  // Compact the list in place.
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].dead) bullets.splice(i, 1);
  }
  return hits;
}

// A punch: the nearest living target inside punch range takes damage.
// Returns the target hit, or null.
export function punch(targets, px, py, facingAngle) {
  let best = null;
  let bestD = PUNCH_RANGE + 1;
  for (const t of targets) {
    if (t.dead || t.hp <= 0) continue;
    const d = Math.hypot(t.x - px, t.y - py);
    if (d > PUNCH_RANGE) continue;
    const ang = Math.atan2(t.y - py, t.x - px);
    let diff = Math.abs(ang - facingAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 1.2) continue; // must be roughly in front of the player
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (best) best.hp -= PUNCH_DAMAGE;
  return best;
}

// Spawn the three SCPD guards for the final job around the HQ.
export function spawnHqGuards() {
  return [
    { x: 1143, y: 1085, hp: 3, maxHp: 3, radius: 18, dead: false, kind: 'guard' },
    { x: 1200, y: 1143, hp: 3, maxHp: 3, radius: 18, dead: false, kind: 'guard' },
    { x: 1085, y: 1200, hp: 3, maxHp: 3, radius: 18, dead: false, kind: 'guard' },
  ];
}

// A rival crew member for turf fights.
export function spawnRival(x, y) {
  return { x, y, hp: 2, maxHp: 2, radius: 16, dead: false, kind: 'rival' };
}
