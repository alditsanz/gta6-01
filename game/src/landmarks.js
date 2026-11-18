// Solmar Heat — landmarks.js
// One job: the named places of Solmar — where they sit, how big they are,
// and what the player can do at each of them.

export const LANDMARKS = [
  { name: 'SCPD Headquarters', kind: 'hq',       x: 1830, y: 240,  w: 220, h: 150, color: '#3d5a80' },
  { name: "Lou's Paint Shop",  kind: 'paint',    x: 180,  y: 520,  w: 180, h: 120, color: '#c96a3b' },
  { name: 'Marina',            kind: 'marina',   x: 120,  y: 1000, w: 260, h: 180, color: '#4fa8c9' },
  { name: 'Pier 9',            kind: 'pier',     x: 120,  y: 2160, w: 300, h: 160, color: '#8a6fd6' },
  { name: 'Cactus Plaza',      kind: 'plaza',    x: 1100, y: 320,  w: 220, h: 160, color: '#7fb069' },
  { name: 'Harbor Market',     kind: 'market',   x: 1000, y: 1380, w: 200, h: 140, color: '#c9b458' },
  { name: 'Canal Bridge North',kind: 'bridge',   x: 1900, y: 1090, w: 120, h: 60,  color: '#5ec2b8' },
  { name: 'Sunset Tower',      kind: 'tower',    x: 420,  y: 180,  w: 140, h: 140, color: '#e8a34c' },
];

export function landmarkByKind(kind) {
  return LANDMARKS.find((l) => l.kind === kind) || null;
}

export function landmarkCenter(landmark) {
  return { x: landmark.x + landmark.w / 2, y: landmark.y + landmark.h / 2 };
}

export function pointInLandmark(x, y, landmark) {
  return x >= landmark.x && x <= landmark.x + landmark.w &&
         y >= landmark.y && y <= landmark.y + landmark.h;
}

export function landmarkAt(x, y) {
  for (const l of LANDMARKS) if (pointInLandmark(x, y, l)) return l;
  return null;
}

// Lou's Paint Shop: clears heat and repairs the car while the player is
// inside its lot. Repaints are handled by sidejobs/paint logic in main.
export function insidePaintShop(x, y) {
  const shop = landmarkByKind('paint');
  return shop ? pointInLandmark(x, y, shop) : false;
}

// The canal cuts across Canal Row as a horizontal water band. The only
// dry crossings are the bridges where the roads pass over it.
export const CANAL = { x0: 1626, y0: 1120, x1: 2440, y1: 1200 };

export function pointInCanal(x, y) {
  return x >= CANAL.x0 && x <= CANAL.x1 && y >= CANAL.y0 && y <= CANAL.y1;
}

// On a bridge when standing on the canal band within one road's width of
// a road line. Road x positions come from the caller to avoid a cycle.
export function onCanalBridge(x, y, roadXs) {
  if (!pointInCanal(x, y)) return false;
  return roadXs.some((rx) => Math.abs(x - rx) <= 34);
}

// The ledger in job 7 sits inside SCPD Headquarters.
export function ledgerSpot() {
  const hq = landmarkByKind('hq');
  const c = landmarkCenter(hq);
  return { x: c.x, y: c.y };
}

// The escape point for job 7 is the Marina landmark.
export function marinaEscapeSpot() {
  const m = landmarkByKind('marina');
  return landmarkCenter(m);
}

// The Pier 9 getaway point for job 6.
export function pierSpot() {
  const p = landmarkByKind('pier');
  return landmarkCenter(p);
}
