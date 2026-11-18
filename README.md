# Solmar Heat

[![Solmar Heat](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime story — steal, drive, run, survive. A wholly original
game: its own city (Solmar), characters (Lena Voss, the boss Kane), vehicles,
story and art. No part of it comes from any commercial game.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Keyboard and mouse:
WASD / arrows to move and drive, E to steal a car (or start a race, or pick
up a parcel), mouse to aim and shoot, R reload, F punch, Space handbrake,
T taxi fare, Shift sprint, P pause, M mute.

## The game

- **A city to explore:** a 9×9 street grid, 10 districts (Sunset Mile,
  Cactus Court, Neon Strip, Old Town, Palm Court, Harbor Lights, Marina,
  Pier 9, Vineyard Hills — and Canal Row, with canals you can only cross
  on its bridges), landmarks (SCPD Headquarters, Lou's Paint Shop, the
  Marina, Pier 9), traffic and pedestrians.
- **12 cars to steal**, from the red Falco to the Vento taxi and the two
  Canal Row cars, the Marlin and the Kite.
- **A 5-star wanted level** with police cruisers that chase you along the
  roads (breadth-first pursuit), roadblocks from 4 stars, and an SCPD
  helicopter at 5 stars. Lay low and the heat decays; Lou's Paint Shop
  clears it and repairs your car.
- **7 story jobs** with Lena Voss against the boss Kane, ending in
  "The Last Ledger": steal the ledger from SCPD Headquarters, clear
  3 guards, escape to the Marina in 90 seconds under a 4-star manhunt
  ($4,150 total). Finish the story to become a Solmar Legend.
- **Side work:** taxi fares (~$310), 10 hidden Solmar coins ($75 each),
  near-miss bonuses ($15), and two round-5 additions — **3 street races**
  (Sunset Sprint $150, Neon Circuit $300, Canal Run $600, each with
  checkpoints and a par time) and a **delivery job** (parcel from Old Town
  Market to Pier 9, $250, with police spotting you twice as fast while
  you carry it).
- **Combat, damage and consequences:** shooting with ammo and reload,
  punching, guards with health, car damage (8 per wall hit — a totaled
  car is wrecked for good), WASTED and a hospital respawn, ranks from
  Street Rookie to Street Royalty, and autosave.
- **Sound:** every effect is synthesized with WebAudio. No audio files,
  no network requests — the game runs fully offline from its own files.

## Why round 5's additions are in

Each new system was added on a hypothesis and measured, not on a hunch:

- **Street races** — hypothesis: a repeatable timed skill activity with
  its own HUD (timer, checkpoint arrow, count) adds depth and replay
  value. Measured in the logic test: all 3 routes start, run their
  checkpoints in order and pay out ($150/$300/$600); failing the par
  pays nothing and the race can be retried.
- **Helicopter pursuit** — hypothesis: a 5-star-only unit (shadow,
  searchlight, faster than any cruiser) makes max heat visibly distinct
  and raises the stakes of the chase. Measured: spawns at 5 stars, closes
  on the player at 290 vs the cruisers' 185, leaves below 5 stars.
- **Canal Row + delivery** — hypothesis: a 10th district with a real
  crossing mechanic (bridges over canals), 2 more cars and a timed
  risk/reward job widen the map and the choice of things to do.
  Measured: district name resolves, canals block off-bridge crossings,
  bridges let you through, 12 cars total, delivery pays $250 and doubles
  police spotting while carried.

Nothing that failed its measurement stayed in.

## Files

- `game/index.html` — the page; `game/src/` — one clear job per file
  (`config`, `random`, `input`, `world`, `landmarks`, `collectibles`,
  `combat`, `sidejobs`, `races`, `heli`, `police`, `audio`, `render`,
  `shots`, `main`).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json`.
- `screenshots/` — four real renders of the game (start / drive / chase /
  mission), taken with headless Chromium.

## License

MIT. See LICENSE.
