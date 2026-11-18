// Solmar Heat — missions.js
// One job: the 7 story jobs — Lena Voss, Kane, and the ledger. Each job
// is a list of stages with a target point, an instruction and a timer.
// main.js walks the stages; this file only describes them.

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Lena Voss',
    banner: 'Steal a Falco and bring it to the Sunset Mile marker.',
    payout: 250,
    timer: 180,
    stages: [
      { kind: 'steal', label: 'Steal a car (press E near one)', x: 320, y: 300 },
      { kind: 'drive', label: 'Drive to the Sunset Mile marker', x: 568, y: 568 },
    ],
  },
  {
    id: 2,
    title: "Lena's Errand",
    giver: 'Lena Voss',
    banner: 'Pick up Lena at Cactus Plaza, then drive her to the Marina.',
    payout: 400,
    timer: 150,
    stages: [
      { kind: 'pickup', label: 'Pick up Lena at Cactus Plaza', x: 1210, y: 400 },
      { kind: 'drive', label: 'Drive Lena to the Marina', x: 250, y: 1090 },
    ],
  },
  {
    id: 3,
    title: 'The Quiet Lift',
    giver: 'Lena Voss',
    banner: 'Steal the Vento taxi from the Neon Strip and park it at the Foundry garage.',
    payout: 500,
    timer: 180,
    stages: [
      { kind: 'steal', label: 'Steal the Vento taxi in the Neon Strip', x: 1900, y: 320 },
      { kind: 'drive', label: 'Park it at the Foundry garage', x: 1210, y: 1010 },
    ],
  },
  {
    id: 4,
    title: 'Harbor Chase',
    giver: 'Kane',
    banner: 'Tail the courier through Harbor Lights to Coral Bay. Do not lose him.',
    payout: 700,
    timer: 150,
    stages: [
      { kind: 'tail', label: 'Catch up to the courier', x: 1210, y: 1400 },
      { kind: 'tail', label: 'Follow him to Coral Bay', x: 2152, y: 2152 },
    ],
  },
  {
    id: 5,
    title: 'Setup at the Foundry',
    giver: 'Kane',
    banner: 'Plant the package at the Old Foundry, then reach Vista Heights. 2 stars from the start.',
    payout: 900,
    timer: 160,
    startStars: 2,
    stages: [
      { kind: 'plant', label: 'Plant the package at the Old Foundry', x: 1210, y: 1010 },
      { kind: 'drive', label: 'Reach Vista Heights', x: 1888, y: 1800 },
    ],
  },
  {
    id: 6,
    title: 'Pier 9 Getaway — Lena Voss',
    giver: 'Lena Voss',
    banner: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    payout: 1200,
    timer: 120,
    startStars: 3,
    stages: [
      { kind: 'drive', label: 'Reach Pier 9 before the timer runs out', x: 270, y: 2240 },
    ],
  },
  {
    id: 7,
    title: 'The Last Ledger',
    giver: 'Lena Voss',
    banner: "Steal Kane's ledger from SCPD Headquarters, clear 3 guards, grab the ledger, then escape to the Marina in 90 seconds under a 4-star manhunt.",
    payout: 4000,
    timer: 300,
    escapeTimer: 90,
    startStars: 0,
    escapeStars: 4,
    guardCount: 3,
    guardDrop: 50,
    stages: [
      { kind: 'clear', label: 'Clear the 3 guards at SCPD Headquarters', x: 1940, y: 315 },
      { kind: 'grab', label: 'Grab the ledger', x: 1940, y: 315 },
      { kind: 'escape', label: 'Escape to the Marina in 90 seconds', x: 250, y: 1090 },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function missionStage(mission, stageIndex) {
  return mission.stages[stageIndex] || null;
}

export function missionStageCount(mission) {
  return mission.stages.length;
}

// Job 7's total take: the $4,000 payout plus $50 from each of the 3 guards.
export function jobSevenTotal() {
  const job = missionById(7);
  return job.payout + job.guardCount * job.guardDrop;
}

export function totalStoryPayout() {
  return MISSIONS.reduce((sum, m) => sum + m.payout, 0);
}

// The next job the player has not finished yet, or null when the story
// is complete. Job 6 completes the job but NOT the story; only job 7 does.
export function nextUnfinishedMission(completedIds) {
  for (const m of MISSIONS) {
    if (!completedIds.includes(m.id)) return m;
  }
  return null;
}

export function storyComplete(completedIds) {
  return completedIds.includes(7);
}
