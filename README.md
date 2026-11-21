# Solmar Heat

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
Top-down, vanilla JavaScript on a canvas, fully offline — no assets, no network.

## The game

Rex Kane is a getaway driver working for Mama Lou in Solmar, a sun-soaked
coastal city of nine districts, a beach, a boardwalk and one very awake
police department. Steal cars, run five story jobs, hold turf, race,
work fares and deliveries, and try to become a Solmar Legend.

- **Five story jobs** — Wheels for Lou, The Palms Package, National Bank
  Job, Harbor Lights and Neon Crown, each graded S/A/B/C.
- **A living city** — 42 traffic cars, 72 pedestrians, day/night cycle,
  weather (rain cuts grip, fog cuts sight), rush-hour streets.
- **Five-star wanted system** — SCPD pursuit cars pathfind the road grid
  (BFS), foot cops, roadblocks at four stars, a helicopter with a
  searchlight at five. An exposure meter drives IN SIGHT / SEARCHING.
- **Side work** — 3 street races, taxi fares, timed deliveries, 5 turf
  zones with rent, 20 Solmar coins, 12 Lantern Stashes, 5 stunt jumps.
- **Progression** — respect ranks to Solmar Legend, Lou's Mod Shop
  (engine / armor / tires), Lou's Paint Shop (repairs + clears heat),
  a crew with usable abilities, and three save slots.

## Play

Serve the `game/` folder with any static server (or `node serve.ts`)
and open it in a desktop browser.

WASD drive · E enter/exit car · mouse aim · click shoot · R reload ·
F punch · 1/2/3 weapons · Q radio · C/V crew abilities · J next job ·
T fare · G delivery · B race at a flag · P map & record · M mute.

## Layout

- `main.ts` — the make.fun entrypoint: copies `game/` + `screenshots/`
  to the output directory and writes `dossier.json`.
- `game/src/` — one module per job: world, render, missions, combat,
  races, sidejobs, turf, modshop, collectibles, props, weather, radio,
  input, audio, shots, main.
- `screenshots/` — four real renders of the game itself.

A wholly original game. No part of it comes from any commercial game.
