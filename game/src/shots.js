// Solmar Heat — shots: staging hooks the maker uses to set up
// screenshots and play-tests from outside the game. Nothing here
// changes how the game plays; it only lets a script put the game
// into a state (night, 5 stars, a mission) and read it back.

const Shots = {
  install(state) {
    const api = {
      state: () => GameState,
      // Put the game on the title screen.
      title() { GameState.screen = 'title'; },
      // Open the mission board.
      board() { GameState.screen = 'board'; },
      // Start playing, optionally at a position.
      play(x, y) {
        GameState.screen = 'play';
        if (x !== undefined) { GameState.player.x = x; GameState.player.y = y; }
      },
      // Give the player a car and put them in it.
      giveCar(modelId) {
        const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
        const car = Cars.spawnCar(GameState, model, GameState.player.x + 40, GameState.player.y);
        Cars.enter(GameState, car);
      },
      // Set the wanted level directly (0-5).
      wanted(n) { Police.setStars(GameState, n); },
      // Jump the clock: minutes since midnight (e.g. 1320 = 22:00).
      clock(minutes) { DayNight.minutes = minutes % 1440; },
      // Force the weather: 'clear' | 'rain' | 'fog'.
      weather(w) { DayNight.weather = w; DayNight.weatherTimer = 9999; },
      // Start a story job by id.
      job(id) { Missions.start(GameState, id); },
      // Start a race by id.
      race(id) {
        const def = RACES.find((r) => r.id === id);
        if (def) {
          GameState.player.x = def.start.x;
          GameState.player.y = def.start.y;
          this.giveCar('falco');
          Races.start(GameState, def);
        }
      },
      // Start a turf war in the player's current district.
      turfWar() {
        const name = World.districtAt(GameState.player.x, GameState.player.y);
        const c = Turf.districtCenter(name);
        GameState.player.x = c.x;
        GameState.player.y = c.y;
        Turf.tryStartWar(GameState);
      },
      // Teleport the player (keeps them in the world).
      teleport(x, y) {
        GameState.player.x = clamp(x, 20, CFG.world - 20);
        GameState.player.y = clamp(y, 20, CFG.world - 20);
        if (GameState.car) { GameState.car.x = GameState.player.x; GameState.car.y = GameState.player.y; }
      },
      // Read back a small summary for assertions.
      summary() {
        const s = GameState;
        return {
          screen: s.screen,
          money: s.money,
          stars: s.stars,
          district: World.districtAt(s.player.x, s.player.y),
          x: Math.round(s.player.x), y: Math.round(s.player.y),
          mission: s.mission ? s.mission.job.id : null,
          missionStep: s.mission ? s.mission.step : null,
          jobsDone: s.jobsDone.slice(),
          coins: Collectibles.count(),
          turf: Turf.ownedCount(),
          weather: DayNight.weather,
          clock: DayNight.clockText(),
          night: DayNight.isNight(),
          heli: Heli.active,
          roadblocks: Police.roadblocks.length,
          policeCars: Police.cars.length,
          inCar: !!s.car,
          rank: RANKS[s.rank],
        };
      },
    };
    window.__solmar = api;
  },
};
