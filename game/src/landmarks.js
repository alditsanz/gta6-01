// landmarks.js — the named places of Solmar: bank, hospital, paint shop,
// motel, pier, docks, plaza and the SCPD headquarters. One job: turn the
// LANDMARKS table in config.js into world coordinates and answer
// "what is near here?". The renderer draws their labels; the minimap draws
// their glyphs.
import { LANDMARKS } from './config.js';
import { roadCenter } from './world.js';
import { dist } from './random.js';

export function buildLandmarks() {
  return LANDMARKS.map((def) => ({
    id: def.id,
    name: def.name,
    kind: def.kind,
    note: def.note,
    x: roadCenter(def.i),
    y: roadCenter(def.j),
  }));
}

export function landmarkById(landmarks, id) {
  for (const l of landmarks) {
    if (l.id === id) return l;
  }
  return null;
}

export function landmarkNear(landmarks, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const l of landmarks) {
    const d = dist(x, y, l.x, l.y);
    if (d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

// The single letter a landmark gets on the minimap and in the world.
export function landmarkGlyph(kind) {
  switch (kind) {
    case 'hospital': return '+';
    case 'bank': return '$';
    case 'paint': return 'P';
    case 'pier': return '9';
    case 'motel': return 'M';
    case 'docks': return 'D';
    case 'hq': return 'H';
    default: return '•';
  }
}
