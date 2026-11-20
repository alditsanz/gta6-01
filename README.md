# Solmar Heat

[![gta6-01 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
Welcome to **Solmar**, a sun-soaked coastal city of nine districts — steal cars,
run from the SCPD, work for Mama Lou, and become a legend.

## Play

Open `game/index.html` in a desktop browser, or serve it locally:

```
node serve.ts        # then visit http://localhost:8321/
```

No build step, no network, no assets — everything is drawn and
synthesized live by the game itself.

## The game

- **A living city** — 9 districts, 10 landmarks (Solmar National Bank,
  The Palms Motel, Pier 9, Lou's Mod Shop…), traffic, pedestrians,
  street props, day/night cycle and rolling weather.
- **A story in 3 jobs** — *Wheels for Lou*, *The Palms Package* and the
  *National Bank Job*, with dialogue from Mama Lou throughout.
- **Wanted system** — 5 stars of SCPD response: pursuit cruisers, foot
  cops, roadblocks at 4 stars and a helicopter with a searchlight at 5.
- **Side work** — 3 street races, taxi fares, timed deliveries, turf
  wars over 5 zones, 10 hidden Solmar coins, pickups.
- **Lou's Mod Shop** — engine, armor and tires, 3 levels each.
- **Combat** — mouse-aimed shooting with reloads, punches, and crews
  that shoot back.
- **Save** — progress saves automatically (localStorage).

## Controls

WASD / arrows move & drive · E enter/exit car · mouse aim, click shoot ·
F punch · R reload · T taxi fare · Space handbrake · Shift sprint ·
Q radio · M mute · P map & pause

## Layout

- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to the
  output directory and writes the dossier.
- `game/src/` — one module per job: world, render, missions, combat,
  police (in world), races, sidejobs, turf, modshop, collectibles,
  weather, radio, props, shots, audio, input, landmarks, config, random.
- `screenshots/` — four real renders of the game, taken by its own
  staged-shot mode (`game/src/shots.js`).
