// Solmar Heat — world.js
// One job: pure world facts — the grid, districts, the clock, the sky,
// weather, the wanted-heat rules and police pathfinding on the road
// graph. No DOM here, so the logic test imports this file directly.

import {
  WORLD_SIZE, ROADS, ROAD_COUNT, DISTRICTS, WANTED, RUSH_MORNING,
  RUSH_EVENING, NIGHT_QUIET, BASE_TRAFFIC,
} from './config.js';
import { clamp } from './random.js';

// ---------------------------------------------------------------- grid

export function clampToWorld(x, y) {
  return {
    x: clamp(x, 12, WORLD_SIZE - 12),
    y: clamp(y, 12, WORLD_SIZE - 12),
  };
}

export function isOnRoad(x, y) {
  const near = (v) => ROADS.some((r) => Math.abs(v - r) <= 16);
  return near(x) || near(y);
}

export function nearestRoadValue(v) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}

// Nearest intersection (road crossing) to a point, as grid indices.
export function nearestNode(x, y) {
  let rx = 0;
  let ry = 0;
  for (let i = 0; i < ROAD_COUNT; i++) {
    if (Math.abs(ROADS[i] - x) < Math.abs(ROADS[rx] - x)) rx = i;
    if (Math.abs(ROADS[i] - y) < Math.abs(ROADS[ry] - y)) ry = i;
  }
  return { rx, ry };
}

export function nodePosition(rx, ry) {
  return { x: ROADS[rx], y: ROADS[ry] };
}

// ---------------------------------------------------------------- districts

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function districtByName(name) {
  return DISTRICTS.find((d) => d.name === name) || null;
}

// ---------------------------------------------------------------- clock, sky, weather

// Traffic density is a pure function of the clock hour, so it is testable:
// rush hour about twice the usual flow, quiet night about half.
export function trafficDensityForHour(hour) {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const inWindow = (w) => h >= w[0] && h < w[1];
  if (inWindow(RUSH_MORNING) || inWindow(RUSH_EVENING)) return 2.0;
  if (inWindow(NIGHT_QUIET)) return 0.5;
  return 1.0;
}

export function trafficTargetForHour(hour) {
  return Math.round(BASE_TRAFFIC * trafficDensityForHour(hour));
}

export function skyPhase(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  if (h >= 19 && h < 21) return 'evening';
  return 'night';
}

export function isNightHour(hour) {
  const p = skyPhase(hour);
  return p === 'night' || p === 'evening';
}

// Grip multiplier for the current weather; rain makes the roads slick.
export function gripForWeather(weather) {
  if (weather === 'rain') return 0.85;
  return 1.0;
}

// How far the player can see through the weather, in world units.
export function viewRangeForWeather(weather) {
  if (weather === 'fog') return 520;
  if (weather === 'rain') return 780;
  return 1400;
}

export const WEATHER_KINDS = ['clear', 'rain', 'fog'];

export function nextWeather(current) {
  const i = WEATHER_KINDS.indexOf(current);
  return WEATHER_KINDS[(i + 1) % WEATHER_KINDS.length];
}

// ---------------------------------------------------------------- wanted level

export function starsForHeat(heat) {
  const h = clamp(heat, 0, WANTED.maxHeat);
  if (h <= 0) return 0;
  return Math.min(5, Math.floor(h / WANTED.bandSize) + 1);
}

// Adding heat that crosses into a new star lands mid-band, never exactly
// on a boundary: a boundary landing would decay back a star the next frame.
export function addHeat(heat, amount) {
  const before = starsForHeat(heat);
  let next = clamp(heat + amount, 0, WANTED.maxHeat);
  const after = starsForHeat(next);
  if (after > before) {
    const bandStart = (after - 1) * WANTED.bandSize;
    next = bandStart + WANTED.bandSize / 2;
  }
  return next;
}

export function decayHeat(heat, dtSeconds, layingLow) {
  if (!layingLow) return heat;
  return Math.max(0, heat - WANTED.decayPerSecond * dtSeconds);
}

export function heatBandMid(star) {
  return (star - 1) * WANTED.bandSize + WANTED.bandSize / 2;
}

// ---------------------------------------------------------------- police pathfinding

// Breadth-first search over the 9x9 intersection graph. Returns the list
// of nodes from start to goal, inclusive, or null when unreachable.
export function bfsPath(fromRx, fromRy, toRx, toRy) {
  const key = (rx, ry) => ry * ROAD_COUNT + rx;
  const start = key(fromRx, fromRy);
  const goal = key(toRx, toRy);
  if (start === goal) return [{ rx: fromRx, ry: fromRy }];
  const prev = new Map();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    const cx = cur % ROAD_COUNT;
    const cy = Math.floor(cur / ROAD_COUNT);
    const neighbours = [];
    if (cx > 0) neighbours.push(key(cx - 1, cy));
    if (cx < ROAD_COUNT - 1) neighbours.push(key(cx + 1, cy));
    if (cy > 0) neighbours.push(key(cx, cy - 1));
    if (cy < ROAD_COUNT - 1) neighbours.push(key(cx, cy + 1));
    for (const n of neighbours) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, cur);
      if (n === goal) {
        const path = [];
        let at = n;
        while (at !== undefined) {
          path.unshift({ rx: at % ROAD_COUNT, ry: Math.floor(at / ROAD_COUNT) });
          at = prev.get(at);
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

// The next intersection a pursuer at (fromRx, fromRy) should drive toward
// to reach the player's intersection. Null when already there.
export function bfsNextStep(fromRx, fromRy, toRx, toRy) {
  const path = bfsPath(fromRx, fromRy, toRx, toRy);
  if (!path || path.length < 2) return null;
  return path[1];
}

// ---------------------------------------------------------------- car damage

export function damageCar(health, amount) {
  return Math.max(0, health - amount);
}

export function carIsTotaled(health) {
  return health <= 0;
}

// A totaled car can never be driven or stolen again.
export function canStealCar(car) {
  if (!car) return false;
  if (car.wreck) return false;
  if (carIsTotaled(car.health)) return false;
  return true;
}
