// Solmar Heat — street races: three routes, one per district.
// Enter a race at its checkered start, hit every checkpoint in order,
// beat the par time and get paid. Fail and you can retry for free.

const Races = {
  race: null, // { def, cpIndex, timer, started }
  results: {}, // raceId -> 'won' | 'lost'

  init(saved) {
    this.race = null;
    this.results = saved || {};
  },

  startMarker(state) {
    // Standing (in a car) on a race start line?
    for (const def of RACES) {
      if (dist(state.player.x, state.player.y, def.start.x, def.start.y) < 70) {
        return def;
      }
    }
    return null;
  },

  start(state, def) {
    if (!state.car) {
      state.toast = 'You need a car to race';
      state.toastTimer = 1.5;
      return false;
    }
    this.race = { def, cpIndex: 0, timer: def.par, started: true };
    state.toast = `${def.name} — hit every checkpoint before the clock runs out!`;
    state.toastTimer = 2.5;
    AudioSys.sfx('race');
    return true;
  },

  update(state, dt) {
    const r = this.race;
    if (!r) return;
    r.timer -= dt;
    const target = r.cpIndex < r.def.checkpoints.length
      ? r.def.checkpoints[r.cpIndex]
      : r.def.finish;
    if (dist(state.player.x, state.player.y, target.x, target.y) < 60) {
      r.cpIndex++;
      AudioSys.sfx('checkpoint');
      if (r.cpIndex > r.def.checkpoints.length) {
        // Finished all checkpoints + the finish line.
        state.money += r.def.pay;
        state.score += 60;
        this.results[r.def.id] = 'won';
        state.toast = `${r.def.name} won! +$${r.def.pay}`;
        state.toastTimer = 2.5;
        AudioSys.sfx('cash');
        this.race = null;
        SaveGame.save(state);
        return;
      }
      state.toast = `Checkpoint ${r.cpIndex}/${r.def.checkpoints.length}`;
      state.toastTimer = 1;
    }
    if (r.timer <= 0) {
      this.results[r.def.id] = 'lost';
      state.toast = `${r.def.name} failed — too slow. Retry at the start line.`;
      state.toastTimer = 2.5;
      this.race = null;
    }
  },

  // The point the HUD arrow and minimap should point at right now.
  currentTarget() {
    const r = this.race;
    if (!r) return null;
    if (r.cpIndex < r.def.checkpoints.length) return r.def.checkpoints[r.cpIndex];
    return r.def.finish;
  },
};
