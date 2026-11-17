// landmarks.js — the named places of Solmar: bank, hospital, paint shop,
// motel, pier, docks and plaza. One job: turn the LANDMARKS table in
// config.js into world coordinates and answer "what is near here?".
// The renderer draws their labels and the minimap draws their icons.
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
  return landmarks.find((l) => l.id === id) || null;
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

// The on-screen label for a landmark kind, drawn on the minimap.
export function landmarkGlyph(kind) {
  if (kind === 'hospital') return '+';
  if (kind === 'bank') return '$';
  if (kind === 'paint') return 'P';
  if (kind === 'pier') return '9';
  if (kind === 'motel') return 'M';
  if (kind === 'docks') return 'D';
  return '•';
}
