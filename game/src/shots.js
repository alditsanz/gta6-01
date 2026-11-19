// Solmar Heat — shots.js
// Debug staging hooks for screenshots and the automated play-test. The game
// exposes a small, honest API on window.__solmar so a headless browser can
// put the game into a real state (start a mission, raise the wanted level,
// stage a chase) and read back the HUD numbers. Nothing here fakes a
// screenshot: every staged state is produced by the game's own systems.

/**
 * Install window.__solmar on a live game instance. `game` is the object
 * main.js builds (it must carry .state, .startMission(), .setHeat(),
 * .stageChase(), .stageMission7() and .screen).
 */
export function installShotsHook(game) {
  if (typeof window === 'undefined') return;
  window.__solmar = {
    version: 'round-10',
    /** Current screen: title | board | play | pause | wasted. */
    screen: () => game.screen,
    /** The live numbers the HUD shows. */
    hud: () => ({
      x: Math.round(game.state.player.x),
      y: Math.round(game.state.player.y),
      money: game.state.money,
      score: game.state.score,
      stars: game.state.stars,
      heat: game.state.heat,
      health: game.state.player.health,
      ammo: game.state.combat.ammo,
      reserve: game.state.combat.reserve,
      coins: game.state.coins.filter((c) => c.taken).length,
      district: game.state.district,
      clock: game.state.clockText,
      weather: game.state.clock.weather,
      mission: game.state.missions.active ? game.state.missions.active.job.name : null,
      rank: game.state.rank,
    }),
    /** Start the title flow and open the mission board. */
    toBoard: () => game.toBoard(),
    /** Abandon the active mission (staging helper for screenshots). */
    clearMission: () => game.clearMission(),
    /** Start story job n (1..7). */
    startMission: (n) => game.startMission(n),
    /** Set wanted heat directly (0..500). */
    setHeat: (h) => game.setHeat(h),
    /** Stage a plain driving shot: the player in the Falco, eastbound. */
    stageDrive: () => game.stageDrive(),
    /** Stage the chase shot: 4 stars, a roadblock ahead, mission 6 running. */
    stageChase: () => game.stageChase(),
    /** Stage the mission shot: job 7 at HQ with its guards up. */
    stageMission7: () => game.stageMission7(),
    /** Teleport the player (used by the play-test to walk districts). */
    teleport: (x, y) => game.teleport(x, y),
    /** How many entities are live (sanity for the play-test). */
    counts: () => ({
      traffic: game.state.traffic.length,
      peds: game.state.peds.length,
      police: game.state.police.length,
      coinsLeft: game.state.coins.filter((c) => !c.taken).length,
    }),
  };
}
