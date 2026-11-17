// Solmar's landmarks: the named places the story and the side systems
// revolve around, with the zone tests the game logic uses.

import { LANDMARKS } from './config.js';

/** Every landmark, in a fixed order for the renderer and the minimap. */
export const LANDMARK_LIST = [
  LANDMARKS.hq,
  LANDMARKS.paint,
  LANDMARKS.marina,
  LANDMARKS.pier,
  LANDMARKS.plaza,
  LANDMARKS.hospital,
];

/** Is a point inside a landmark's zone (radius in world units)? */
export function insideZone(x, y, lm, radius = 90) {
  const dx = x - lm.x;
  const dy = y - lm.y;
  return dx * dx + dy * dy <= radius * radius;
}

/** The nearest landmark to a point, with its distance. */
export function nearestLandmark(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const lm of LANDMARK_LIST) {
    const d = Math.hypot(x - lm.x, y - lm.y);
    if (d < bestD) {
      bestD = d;
      best = lm;
    }
  }
  return { landmark: best, distance: bestD };
}

/** A short label the HUD shows when the player is near a landmark. */
export function landmarkLabel(x, y) {
  const { landmark, distance } = nearestLandmark(x, y);
  if (distance < 170) return landmark.name;
  return null;
}
