# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Heat** is an original open-world crime game built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01): a
sun-soaked modern city you explore on foot and by car, with traffic,
pedestrians, police, missions, combat and a HUD with a minimap — all
offline, from static files, no network requests.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD / arrows — move & drive · E — steal / exit car · Mouse — aim & shoot ·
R — reload · F — punch · Space — handbrake · T — taxi fare · Shift — sprint ·
P — pause · M — mute · C — turf war · V — delivery · G — repaint at Lou's ·
1 / 2 / 3 — buy Engine / Armor / Tires at Lou's Mod Shop

## The game

- **Solmar, a 9×9 street grid** across 10 districts — Sunset Mile, Cactus
  Court, Neon Strip, Palm Row, Canal Row (canals with bridges), Marina,
  Harbor Lights, Old Solmar, Pier 9 and Dune Fields — with landmarks
  (SCPD Headquarters, Lou's Paint Shop, the Marina, Pier 9, the plaza).
- **7 story jobs** about the driver, Lena Voss and the crime boss Kane,
  ending in *The Last Ledger*: steal Kane's ledger from SCPD HQ, clear
  3 guards, escape to the Marina in 90 seconds under a 4-star manhunt.
  Finishing the story grants the rank **Solmar Legend**.
- **A 5-star wanted system** with mid-band heat, BFS police pursuit,
  roadblocks from 4 stars, and an SCPD helicopter at 5 stars. Lou's
  Paint Shop clears heat and repairs your car; repaint it with G.
- **Lou's Mod Shop (new):** spend cash on real upgrades — Engine (top
  speed), Armor (car health), Tires (grip) — three levels each, saved
  with your progress.
- **Side work:** taxi fares (~$310), package deliveries, 3 street races,
  10 hidden Solmar coins ($75 each), near-miss bonuses ($15), and turf
  wars — hold a zone for 20 seconds to flip it to your crew and earn
  $5/hour per zone.
- **A living city:** day/night cycle with streetlights, clear / rain /
  fog weather (rain cuts grip), and rush-hour traffic — twice as dense
  at 07:00–09:00 and 17:00–19:00, half as dense late at night.
- **Progress saves automatically** (money, missions, coins, mods, turf).

## Entry

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` via `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

A wholly original game. No part of it comes from any commercial game.
MIT licensed.
