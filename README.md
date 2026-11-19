# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime story — steal, drive, run, survive. A wholly original
game built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01).
No part of it comes from any commercial game.

## The game

Solmar is a sun-soaked modern city on a 9×9 street grid: ten districts
(Sunset Mile, Cactus Court, Neon Strip, Marina, Pier 9, Canal Row and more),
traffic and pedestrians, 12 stealable cars, and the SCPD watching everything
you do.

- **7 story jobs** — an arc about the player, Lena Voss and the crime boss
  Kane, ending with *The Last Ledger*: clear 3 guards, steal Kane's ledger
  from SCPD Headquarters and escape to the Marina in 90 seconds under a
  4-star manhunt ($4,150 total).
- **5-star wanted system** — heat rises with crime and decays when you lay
  low; police cars pursue on the road grid, roadblocks appear from 4 stars,
  and an SCPD helicopter joins at 5 stars.
- **Side work** — taxi fares (press T), package deliveries, 10 hidden Solmar
  coins ($75 each), near-miss bonuses, 3 street races, and turf wars across
  5 zones that pay hourly income.
- **Lou's Paint Shop** clears heat and repairs your car; **Lou's Mod Shop**
  (new in round 10) sells Engine, Armor and Tire upgrades in 3 levels each.
- **A living city** — day/night cycle with streetlights, rain and fog, and
  rush-hour traffic that doubles at peak times.
- **Combat** — shooting with ammo and reload, punching, guards with health
  pips; **WASTED** sends you to Solmar General Hospital.
- **Save** — progress saves automatically (money, jobs, coins, turf, mods).

## Controls

WASD / arrows — move & drive · E — steal / exit car · Mouse — aim & shoot ·
R — reload · F — punch · Space — handbrake · Shift — sprint · T — taxi fare ·
Q — start a race at a flag · G — challenge turf · P — pause · M — mute ·
Enter — mission board.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Everything runs offline from static files under `game/` — no network
requests, no assets to download, sound synthesised live with WebAudio.

## Layout

- `game/index.html` — the page (loads `src/main.js` as a module)
- `game/src/` — one clear job per file: `config`, `random`, `input`,
  `world`, `weather`, `landmarks`, `collectibles`, `combat`, `sidejobs`,
  `races`, `turf`, `modshop`, `missions`, `audio`, `render`, `shots`, `main`
- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to `/output`
  and writes `/output/dossier.json` via `vendor/makefun-game.ts`
- `screenshots/` — four real renders of the game itself

## License

MIT — see `LICENSE`.
