// sidejobs.js — taxi fares and the Canal Row delivery job.
// Fares: press T near a waiting passenger, drive them to their
// destination, get paid about $310. Deliveries: pick up a package and
// run it across the map against a timer; police eyes raise heat faster.

import { dist } from './config.js';
import { LANDMARKS } from './landmarks.js';

export const FARE_PAY = 310;
export const FARE_TIME = 95;
export const DELIVERY_PAY = 420;
export const DELIVERY_TIME = 110;

export class SideJobs {
  constructor(rng) {
    this.rng = rng;
    this.fare = null;        // {x,y,phase:'wait'|'ride',dest,timeLeft}
    this.faresDone = 0;
    this.delivery = null;    // {x,y,phase:'pickup'|'run',dest,timeLeft}
    this.deliveriesDone = 0;
    this.spottedHeatRate = 26; // extra heat per second while spotted on a run
  }

  spawnFare() {
    const lm = LANDMARKS[Math.floor(this.rng() * LANDMARKS.length)];
    let dest = LANDMARKS[Math.floor(this.rng() * LANDMARKS.length)];
    if (dest.id === lm.id) dest = LANDMARKS[(LANDMARKS.indexOf(dest) + 3) % LANDMARKS.length];
    this.fare = { x: lm.x + 40, y: lm.y + 40, phase: 'wait', dest, timeLeft: 0, pay: FARE_PAY };
    return this.fare;
  }

  // Press T near a waiting fare while in a car starts the ride.
  tryPickupFare(px, py, inCar) {
    if (!this.fare || this.fare.phase !== 'wait' || !inCar) return false;
    if (dist(px, py, this.fare.x, this.fare.y) > 64) return false;
    this.fare.phase = 'ride';
    this.fare.timeLeft = FARE_TIME;
    return true;
  }

  updateFare(dt, px, py) {
    if (!this.fare || this.fare.phase !== 'ride') return null;
    this.fare.timeLeft -= dt;
    if (this.fare.timeLeft <= 0) { this.fare = null; return { type: 'fare-failed' }; }
    if (dist(px, py, this.fare.dest.x, this.fare.dest.y) <= 78) {
      const pay = this.fare.pay;
      this.fare = null; this.faresDone += 1;
      return { type: 'fare-complete', pay };
    }
    return null;
  }

  startDelivery() {
    const from = LANDMARKS.find((l) => l.id === 'canal-market');
    const to = LANDMARKS.find((l) => l.id === 'depot');
    this.delivery = { x: from.x + 34, y: from.y - 30, phase: 'pickup', dest: to, timeLeft: 0, pay: DELIVERY_PAY };
    return this.delivery;
  }

  tryPickupPackage(px, py) {
    if (!this.delivery || this.delivery.phase !== 'pickup') return false;
    if (dist(px, py, this.delivery.x, this.delivery.y) > 60) return false;
    this.delivery.phase = 'run';
    this.delivery.timeLeft = DELIVERY_TIME;
    return true;
  }

  // spotted: a police unit can see the player this frame.
  updateDelivery(dt, px, py, spotted) {
    if (!this.delivery || this.delivery.phase !== 'run') return null;
    this.delivery.timeLeft -= dt;
    if (this.delivery.timeLeft <= 0) { this.delivery = null; return { type: 'delivery-failed' }; }
    const heat = spotted ? this.spottedHeatRate * dt : 0;
    if (dist(px, py, this.delivery.dest.x, this.delivery.dest.y) <= 78) {
      const pay = this.delivery.pay;
      this.delivery = null; this.deliveriesDone += 1;
      return { type: 'delivery-complete', pay, heat };
    }
    return { type: 'delivery-tick', heat };
  }
}
