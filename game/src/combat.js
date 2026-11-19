// Solmar Heat — combat.js
// Shooting, punching and the guards of the final job. Bullets are tested
// against every target along their whole travel segment, not just their
// endpoint, so fast bullets cannot tunnel past a thin target.

export const BULLET_SPEED = 620;
export const BULLET_RANGE = 520;
export const PUNCH_RANGE = 34;
export const PUNCH_DAMAGE = 20;
export const BULLET_DAMAGE = 34;
export const RELOAD_TIME = 1.1;
export const MAG_SIZE = 12;

/** Fresh combat state for the player. */
export function createCombat() {
  return {
    ammo: MAG_SIZE, // in the magazine
    reserve: 48, // spare ammo
    reloading: 0, // seconds left on the reload, 0 when ready
    bullets: [], // {x, y, vx, vy, travelled}
    punchCooldown: 0,
    meleeArc: 0, // visual swing timer
  };
}

/** Start a reload if there is reserve ammo and the mag is not full. */
export function startReload(combat) {
  if (combat.reloading > 0 || combat.ammo >= MAG_SIZE || combat.reserve <= 0) return false;
  combat.reloading = RELOAD_TIME;
  return true;
}

/** Fire one bullet toward (tx, ty) from (x, y). Returns the bullet or null. */
export function fireBullet(combat, x, y, tx, ty) {
  if (combat.reloading > 0 || combat.ammo <= 0) return null;
  combat.ammo--;
  const a = Math.atan2(ty - y, tx - x);
  const b = { x, y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, travelled: 0 };
  combat.bullets.push(b);
  return b;
}

/**
 * Does the segment (x1,y1)->(x2,y2) pass within radius r of (cx,cy)?
 * The anti-tunnelling test: a bullet moving 620 u/s crosses ~10 units per
 * frame, so endpoint-only checks would miss thin targets.
 */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return Math.hypot(cx - px, cy - py) <= r;
}

/**
 * Advance bullets by dt and resolve hits against a list of targets
 * ({x, y, r, hp}). Returns the hit events [{target, damage}].
 * Bullets die on their first hit or at the end of their range.
 */
export function updateBullets(combat, dt, targets) {
  const hits = [];
  const alive = [];
  for (const b of combat.bullets) {
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    b.travelled += Math.hypot(b.vx * dt, b.vy * dt);
    let hit = false;
    for (const t of targets) {
      if (t.hp <= 0) continue;
      if (segmentHitsCircle(b.x, b.y, nx, ny, t.x, t.y, t.r || 16)) {
        t.hp -= BULLET_DAMAGE;
        hits.push({ target: t, damage: BULLET_DAMAGE });
        hit = true;
        break;
      }
    }
    if (!hit && b.travelled < BULLET_RANGE) {
      b.x = nx;
      b.y = ny;
      alive.push(b);
    }
  }
  combat.bullets = alive;
  if (combat.reloading > 0) {
    combat.reloading -= dt;
    if (combat.reloading <= 0) {
      combat.reloading = 0;
      const need = MAG_SIZE - combat.ammo;
      const take = Math.min(need, combat.reserve);
      combat.ammo += take;
      combat.reserve -= take;
    }
  }
  if (combat.punchCooldown > 0) combat.punchCooldown -= dt;
  if (combat.meleeArc > 0) combat.meleeArc -= dt;
  return hits;
}

/** Punch the nearest target in range. Returns the target hit or null. */
export function punch(combat, x, y, angle, targets) {
  if (combat.punchCooldown > 0) return null;
  combat.punchCooldown = 0.45;
  combat.meleeArc = 0.22;
  let best = null;
  let bd = Infinity;
  for (const t of targets) {
    if (t.hp <= 0) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d > PUNCH_RANGE) continue;
    const a = Math.atan2(t.y - y, t.x - x);
    let da = Math.abs(a - angle);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da > 1.1) continue; // must be roughly in front
    if (d < bd) { bd = d; best = t; }
  }
  if (best) best.hp -= PUNCH_DAMAGE;
  return best;
}

/** A guard for job 7: position, health, and the pips the HUD draws. */
export function createGuard(x, y) {
  return { x, y, r: 16, hp: 100, maxHp: 100, kind: 'guard', shootTimer: 1.2 };
}

/** Health pips for a guard (4 pips, each worth 25 hp). */
export function guardPips(guard) {
  return Math.ceil(Math.max(0, guard.hp) / 25);
}

/** Guards shoot back at the player when close enough. Returns shots fired. */
export function guardsShoot(guards, player, dt) {
  const shots = [];
  for (const g of guards) {
    if (g.hp <= 0) continue;
    g.shootTimer -= dt;
    const d = Math.hypot(player.x - g.x, player.y - g.y);
    if (d < 340 && g.shootTimer <= 0) {
      g.shootTimer = 1.6;
      shots.push({ from: g, damage: 9 });
    }
  }
  return shots;
}
