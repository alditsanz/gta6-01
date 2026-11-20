// missions.js — the seven story jobs of Solmar Heat.
// Lena Voss hires the player as a getaway driver; the crime boss Kane
// turns on her, and the arc ends with stealing his ledger from SCPD HQ.
// Jobs are data + a small phase machine: reach / guards / grab / escape.

import { dist } from './config.js';
import { landmarkById } from './landmarks.js';

export const MISSIONS = [
  {
    id: 'job1', n: 1, title: 'First Wheels', giver: 'Lena Voss',
    text: 'Meet Lena Voss at Cactus Court Plaza. She needs a driver she can trust.',
    objective: 'Drive to Cactus Court Plaza and meet Lena Voss.',
    target: 'plaza', timer: 120, stars: 0, pay: 250, kind: 'reach',
  },
  {
    id: 'job2', n: 2, title: 'Neon Escort', giver: 'Lena Voss',
    text: 'Escort Lena from the Neon Strip to the Marina before Kane\'s crew finds her.',
    objective: 'Reach the Neon Strip, then escort Lena to the Marina.',
    target: 'marina', startAt: 'strip', timer: 150, stars: 1, pay: 450, kind: 'escort',
  },
  {
    id: 'job3', n: 3, title: 'Harbor Lift', giver: 'Lena Voss',
    text: 'Lift a loaded car from the Harbor Depot and bring it to Lou\'s Paint Shop.',
    objective: 'Take a car at the Harbor Depot and deliver it to Lou\'s Paint Shop.',
    target: 'paint', startAt: 'depot', timer: 180, stars: 2, pay: 700, kind: 'deliver-car',
  },
  {
    id: 'job4', n: 4, title: 'Strip Chase', giver: 'Lena Voss',
    text: 'Kane\'s crew is chasing Lena\'s courier. Reach the courier on the Neon Strip and shake the heat.',
    objective: 'Reach the Neon Strip courier, then lose your wanted level.',
    target: 'strip', timer: 180, stars: 2, pay: 950, kind: 'reach-and-lose',
  },
  {
    id: 'job5', n: 5, title: 'Canal Run', giver: 'Lena Voss',
    text: 'Move a package through Canal Row to the Canal Row Market. The bridges are your friends.',
    objective: 'Reach Canal Row Market through the canals before the timer runs out.',
    target: 'canal-market', timer: 170, stars: 2, pay: 1250, kind: 'reach',
  },
  {
    id: 'job6', n: 6, title: 'Pier 9 Getaway — Lena Voss', giver: 'Lena Voss',
    text: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    objective: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    target: 'pier9', timer: 140, stars: 3, pay: 1800, kind: 'reach',
  },
  {
    id: 'job7', n: 7, title: 'The Last Ledger', giver: 'Lena Voss',
    text: 'Steal Kane\'s ledger from SCPD Headquarters, clear the guards, and escape to the Marina.',
    objective: 'Steal the ledger at SCPD HQ, clear 3 guards, escape to the Marina in 90 seconds.',
    target: 'marina', startAt: 'hq', timer: 240, escapeTimer: 90, stars: 4,
    pay: 4000, guardDrop: 50, guards: 3, kind: 'ledger',
  },
];

export function missionById(id) { return MISSIONS.find((m) => m.id === id) || null; }

export class MissionManager {
  constructor() {
    this.active = null;      // mission data
    this.phase = 'idle';     // idle | go | guards | grab | escape | done | failed
    this.timeLeft = 0;
    this.guards = [];
    this.guardsCleared = 0;
    this.guardDrops = 0;
    this.completed = new Set();
    this.storyComplete = false;
  }

  start(mission) {
    this.active = mission;
    this.timeLeft = mission.timer;
    this.guardsCleared = 0;
    this.guardDrops = 0;
    this.guards = [];
    if (mission.kind === 'ledger') {
      this.phase = 'guards';
      const hq = landmarkById(mission.startAt);
      for (let i = 0; i < (mission.guards || 3); i++) {
        this.guards.push({
          id: 'guard' + i, x: hq.x + (i - 1) * 56, y: hq.y + 74,
          health: 3, maxHealth: 3, alive: true, drop: mission.guardDrop || 50,
        });
      }
    } else if (mission.startAt) {
      this.phase = 'go-start';
    } else {
      this.phase = 'go';
    }
    return this.active;
  }

  currentTarget() {
    if (!this.active) return null;
    if (this.phase === 'go-start') return landmarkById(this.active.startAt);
    if (this.phase === 'guards' || this.phase === 'grab') return landmarkById(this.active.startAt || this.active.target);
    return landmarkById(this.active.target);
  }

  objectiveText() {
    if (!this.active) return '';
    if (this.phase === 'go-start') {
      const lm = landmarkById(this.active.startAt);
      return 'Go to ' + (lm ? lm.name : 'the start point') + '.';
    }
    if (this.phase === 'guards') return 'Clear the guards at SCPD Headquarters (' + this.guardsCleared + '/' + (this.active.guards || 3) + ').';
    if (this.phase === 'grab') return 'Grab Kane\'s ledger inside SCPD Headquarters.';
    if (this.phase === 'escape') return 'Escape to the Marina in ' + Math.ceil(this.timeLeft) + ' seconds — 4-star manhunt!';
    return this.active.objective;
  }

  // Returns an event object when something resolves, else null.
  update(dt, px, py) {
    if (!this.active) return null;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      const failed = this.active;
      this.active = null; this.phase = 'failed';
      return { type: 'failed', mission: failed };
    }
    const target = this.currentTarget();
    if (!target) return null;
    const near = dist(px, py, target.x, target.y) <= 78;
    if (!near) return null;
    if (this.phase === 'go-start') { this.phase = 'go'; return { type: 'phase', phase: 'go' }; }
    if (this.phase === 'grab') {
      this.phase = 'escape';
      this.timeLeft = this.active.escapeTimer || 90;
      return { type: 'grabbed', mission: this.active };
    }
    if (this.phase === 'go' || this.phase === 'escape') {
      return this.finish();
    }
    return null;
  }

  onGuardDown(guard) {
    if (!guard || guard._counted) return null;
    guard._counted = true;
    this.guardsCleared += 1;
    this.guardDrops += guard.drop || 0;
    if (this.active && this.phase === 'guards' && this.guardsCleared >= (this.active.guards || 3)) {
      this.phase = 'grab';
      return { type: 'phase', phase: 'grab' };
    }
    return { type: 'guard-down', cleared: this.guardsCleared };
  }

  finish() {
    const mission = this.active;
    const totalPay = mission.pay + this.guardDrops;
    this.completed.add(mission.id);
    if (mission.n === 7) this.storyComplete = true;
    this.active = null; this.phase = 'done';
    return { type: 'complete', mission, pay: totalPay, guardDrops: this.guardDrops, storyComplete: this.storyComplete };
  }

  fail(reason) {
    const mission = this.active;
    this.active = null; this.phase = 'failed';
    return { type: 'failed', mission, reason: reason || 'failed' };
  }

  serialize() {
    return { completed: [...this.completed], storyComplete: this.storyComplete };
  }

  restore(data) {
    if (!data) return;
    this.completed = new Set(data.completed || []);
    this.storyComplete = !!data.storyComplete;
  }
}
