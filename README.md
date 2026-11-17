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

- **A city to explore on foot and by car** — a 9×9 street grid with extruded
  buildings, a park, a beach, docks, a hospital, a bank, a motel and a paint
  shop, all with named places on the map.
- **Traffic and pedestrians** — cars drive the street grid with lane discipline
  and turn at intersections; pedestrians stroll the sidewalks and flee gunfire.
- **Cars to steal and drive** — 8 vehicle types (sedan, coupe, sports, taxi,
  van, truck, pickup, police cruiser) with their own speed, acceleration and
  handling. Walk up to a parked car and press **E**. Stealing in front of a
  witness calls the cops.
- **A wanted level and police who respond** — 5 stars. Foot cops chase and try
  to bust you; cruisers hunt you down the street grid with BFS pathfinding and
  sirens. Lay low and the heat decays; get caught and you pay a fine.
- **Missions and a story** — 3 story missions with dialogue, objective markers,
  a beacon, a screen-edge arrow and a distance readout: steal the Vento and
  deliver it to Lou's Paint Shop, pick up a package at The Palms Motel and
  escape a 2-star ambush, then crack the National Bank vault against the Harbor
  Boys and a 3-star manhunt and escape to Pier 9. Mission rewards pay out in
  cash; finishing all three completes the story and opens free roam.
- **Combat** — pistol with aim, ammo and reload, punching, gangsters who strafe
  and shoot back, bullets, sparks and smoke, health and ammo pickups, WASTED
  and BUSTED screens with respawn.
- **HUD with a minimap** — mission objective + distance, wanted stars, clock,
  money, health bar, ammo, speedometer, a live minimap (roads, player arrow,
  cops, mission marker, hospital), toasts, and a golden-hour light wash.
- **Start and save** — title screen with the story setup, pause menu, and
  progress saved to localStorage (continue from the title screen).
- **Sound** — everything synthesised live with WebAudio: engine hum, police
  sirens, gunshots, pickups, mission jingles and a slow Am–F–C–G pad-and-bass
  loop. **M** mutes.

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
| P / Esc | Pause |
| S (in pause) | Save progress |
| M | Mute |

## Files

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (tuning, city layout, story), `random.js` (seeded RNG),
  `input.js` (keyboard + mouse), `audio.js` (WebAudio synth),
  `world.js` (city, traffic, police, missions, combat, save),
  `render.js` (city renderer, HUD, minimap, screens),
  `shots.js` (deterministic screenshot staging + logic checks),
  `main.js` (game loop + screen flow).
- `screenshots/` — 4 real renders of the game in stock Chromium:
  1-start (title), 2-drive (mission passed in the Vento), 3-chase (4-star
  police chase), 4-mission (the bank vault standoff).
- `main.ts` — the entry program; `vendor/makefun-game.ts` — the kit's
  dossier library, unchanged; `serve.ts` — a tiny static server for local play.

## Originality

Everything here is invented: the city of Solmar, its streets and places, Rex
Marlowe, Mama Lou, Detective Kane, the Harbor Boys, the SCPD, every vehicle
name, the story, the art and the sound. No Rockstar Games names, characters,
map, art, music or assets are used anywhere.

## License

MIT — see `LICENSE`.
