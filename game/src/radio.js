// Solmar Heat — the dial. Three stations, one label helper with
// wraparound so any index the tuner lands on reads cleanly.

export const RADIO_STATIONS = [
  { name: 'SOLMAR FM 98.1', tag: 'Coastal Gold' },
  { name: 'PALM WAVE 103.7', tag: 'Island Classics' },
  { name: 'NEON NIGHTS 88.4', tag: 'Strip Synth' },
];

export function stationLabel(idx) {
  const total = RADIO_STATIONS.length;
  const wrapped = ((idx % total) + total) % total;
  const station = RADIO_STATIONS[wrapped];
  return `♪ ${station.name} — ${station.tag}`;
}
