// radio.js — the three Solmar radio stations.
// One job: name the stations; the HUD shows the current one while the
// player drives, main.js cycles world.radioIdx (Q key / every 24 s).

export const RADIO_STATIONS = [
  'SOLMAR FM 98.1 — Coastal Gold',
  'PALM WAVE 103.7 — Island Classics',
  'NEON NIGHTS 88.4 — Strip Synth',
];

export function stationName(world) {
  const i = ((world.radioIdx % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
  return RADIO_STATIONS[i];
}

export function cycleRadio(world) {
  world.radioIdx = (world.radioIdx + 1) % RADIO_STATIONS.length;
  return stationName(world);
}
