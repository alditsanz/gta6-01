// radio.js — Solmar's three original stations. The world stores
// an index; the HUD names the station while the player drives.

export const RADIO_STATIONS = [
  { name: 'SOLMAR FM 98.1',    tag: 'Coastal Gold' },
  { name: 'PALM WAVE 103.7',   tag: 'Island Classics' },
  { name: 'NEON NIGHTS 88.4',  tag: 'Strip Synth' },
];

export function stationLine(world) {
  const s = RADIO_STATIONS[world.radioIdx % RADIO_STATIONS.length];
  return '♪ ' + s.name + ' — ' + s.tag;
}

export function cycleRadio(world) {
  world.radioIdx = (world.radioIdx + 1) % RADIO_STATIONS.length;
}
