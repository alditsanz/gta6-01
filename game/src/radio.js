// radio.js — Rex's three favourite stations. Pure data plus a
// cycler; the HUD reads the current station while he is in a car.

export const RADIO_STATIONS = [
  { freq: '98.1', name: 'SOLMAR FM 98.1 — Coastal Gold' },
  { freq: '103.7', name: 'PALM WAVE 103.7 — Island Classics' },
  { freq: '88.4', name: 'NEON NIGHTS 88.4 — Strip Synth' },
];

export function stationAt(idx) {
  return RADIO_STATIONS[((idx % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length];
}

export function nextStation(world) {
  world.radioIdx = (world.radioIdx + 1) % RADIO_STATIONS.length;
  return stationAt(world.radioIdx);
}
