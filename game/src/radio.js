// Solmar Heat — radio.js
// Three original Solmar stations. The world picks one at creation from
// its seeded rng; Q (or a slow auto-cycle while driving) changes it.

export const RADIO_STATIONS = [
  { name: 'SOLMAR FM 98.1', tag: 'Coastal Gold' },
  { name: 'PALM WAVE 103.7', tag: 'Island Classics' },
  { name: 'NEON NIGHTS 88.4', tag: 'Strip Synth' },
];

export function stationLabel(idx) {
  const s = RADIO_STATIONS[((idx % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length];
  return `♪ ${s.name} — ${s.tag}`;
}
