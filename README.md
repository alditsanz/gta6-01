# SOLMAR HEAT — an open-world crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR HEAT** is an original open-world crime game in the spirit of GTA 6,
built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). It runs
offline in a desktop browser from static files — no network requests, no
libraries, no build step. Open `game/index.html` (or `node serve.ts` and visit
http://localhost:8080) and play with keyboard + mouse.

Rex Marlowe came back to the sun-soaked coastal city of **Solmar** with nothing
but a jacket and a debt. Mama Lou has work — if you can drive, shoot, and
outrun the SCPD long enough to get paid.

## What is in the game

- **A city to explore on foot and by car** — a 9×9 street grid (2,440 ×
  2,440 px, every road reachable) with named places on the map: the National
  Bank, Solmar General hospital, Lou's Paint Shop, The Palms Motel, Pier 9,
  the Docks and Civic Plaza, plus parks, palms and rooftop pools.
- **Traffic and pedestrians** — 16 cars drive the street grid and stop for
  the car ahead; 26 pedestrians stroll the sidewalks and flee gunfire.
- **Cars to steal and drive** — 10 vehicle types with their own speed,
  acceleration and handling, including the Vento taxi and the Rumbo pickup.
  Walk up to a parked car and press **E**. Stealing in front of a witness
  calls the cops. **Space** is the handbrake.
- **A wanted level and police who respond** — 5 stars. Cruisers hunt you
  down the street grid with BFS pathfinding and sirens; lay low and the heat
  decays, get caught and you pay a $100 fine and wake up at Civic Plaza.
- **Missions and a story** — 6 story missions with dialogue, objective
  markers and a distance readout: pick up Lena, steal the Falco, escort the
  van, survive a motel ambush, crack the National Bank vault against the
  Harbor Boys, then a timed 75-second getaway to Pier 9 against a 3-star
  manhunt. Finishing all six completes the story and opens free roam as a
  Solmar Legend. Ranks grow as jobs are done: Wheelman → Crew Driver →
  Solmar Fixer → King of the Mile → Solmar Legend.
- **Combat** — pistol with a 12-round magazine, reserve ammo and reload
  (**R**), punching, and Harbor Boys gangsters who strafe and shoot back.
  Bullets are tested along the whole segment they travel, so fast rounds
  cannot skip past a target. Health and ammo pickups, a WASTED screen with
  respawn at Solmar General hospital.
- **Side work between jobs** — taxi fares (press **T** near a rider, drive
  them across town for up to $420), Lou's Paint Shop (drive through for
  $200 and the heat forgets you), and dropped cash bags around the city.
- **HUD with a minimap** — mission objective + countdown timer, wanted
  stars, clock, rank, money, health bar, ammo counter, speedometer, a live
  minimap (roads, player arrow, cops, mission marker, bank / hospital /
  paint-shop icons), toasts, and a golden-hour light wash.
- **Start and save** — title screen with the story setup, mission board,
  pause menu, and progress saved to localStorage (continue from the title
  screen).
- **Sound** — everything synthesised live with WebAudio: engine hum, police
  sirens, gunshots, pickups, mission jingles and a slow bass-and-hat loop.
  **M** mutes.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move (on foot) / drive (in a car) |
| Shift | Sprint |
| Mouse + click | Aim + shoot the pistol |
| E | Steal / enter a car, exit a car |
| F | Punch |
| R | Reload |
| Space | Handbrake |
| T | Start a taxi fare (near a pedestrian, while driving) |
| Tab | Mission board (jobs 1–6) |
| P / Esc | Pause |
| S (in pause) | Save progress |
| M | Mute |

## Files

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (tuning, city layout, story, ranks), `random.js` (seeded RNG
  + segment hit tests), `input.js` (keyboard + mouse), `audio.js`
  (WebAudio synth), `world.js` (city, traffic, police, missions, save),
  `render.js` (city renderer, HUD, minimap, screens), `landmarks.js`
  (named places), `combat.js` (ammo, reload, gangster AI, enemy fire),
  `sidejobs.js` (taxi fares, paint shop, cash bags), `shots.js`
  (deterministic screenshot staging), `main.js` (game loop + screen flow).
- `screenshots/` — 4 real renders of the game in stock Chromium:
  1-start (title), 2-drive (taxi fare in the Vento), 3-chase (4-star
  police chase in the Pier 9 getaway), 4-mission (the bank vault shootout).
- `main.ts` — the entry program; `vendor/makefun-game.ts` — the kit's
  dossier library, unchanged; `serve.ts` — a tiny static server for local play.

## Verified

- 42 headless logic checks pass (`/tmp/gta6-logic-test.mjs`): all 6
  missions complete end to end, ammo/reload, gangster fire, taxi fares,
  paint shop, WASTED respawn, handbrake, ranks.
- Headless Chromium play-test: title → story → mission board → mission 1
  → driving → pause, 0 page errors, 0 failed game requests.
- `main.ts` run twice into separate dirs writes byte-identical output.

## Originality

Everything here is invented: the city of Solmar, its streets and places, Rex
Marlowe, Mama Lou, Lena Voss, Detective Kane, the Harbor Boys, the SCPD,
every vehicle name, the story, the art and the sound. No Rockstar Games
names, characters, map, art, music or assets are used anywhere.

## License

MIT — see `LICENSE`.
