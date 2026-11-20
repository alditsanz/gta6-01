# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down 2.5D open-world crime game for the
[make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
Vanilla JavaScript on canvas — no libraries, no network, no assets;
every sound is synthesised with WebAudio.

You are **Rex Marlowe**, back in the sun-soaked coastal city of Solmar
with a jacket and a debt. Mama Lou has work.

## Play

```sh
node serve.ts --port 8080   # then open http://localhost:8080
```

Or open `game/index.html` through any static file server.

**Controls:** WASD / arrows move & drive · **E** steal / exit car ·
mouse aim, click to shoot · **R** reload · **F** punch · **Space**
handbrake · **Shift** sprint · **T** taxi fare · **G** delivery ·
**P** pause · **S** save · **M** mute.

## What's in the city

- A 9×9 street grid (3,600×3,600) with named districts and landmarks:
  Lou's Paint Shop, Lou's Mod Shop, Solmar National Bank, The Palms
  Motel, SCPD Headquarters, the Marina, Pier 9 and the hospital.
- Traffic that drives the grid, pedestrians who flee gunfire, and 22
  parked cars to steal across 12 models — Rex's red Vento is ringed
  in gold so you can always find yourself.
- A 5-star wanted system: foot cops who bust you, cruisers that hunt
  with BFS pathfinding over the grid, roadblocks from 4 stars and a
  helicopter at 5. Heat decays when you lay low; excess cops are
  trimmed as it drops.
- Three story missions with dialogue, beacons and payouts — steal the
  Vento (+$150), run the Palms package through an ambush (+$400), and
  crack the National Bank vault against the Harbor Boys (+$1,200).
- Lou's Mod Shop: Engine, Armor and Tires upgrades, three levels
  each, persisted in the autosave.
- Street races, taxi fares, deliveries, turf wars, 10 hidden Solmar
  coins, near-miss bonuses, a day/night clock with rolling weather
  and rush-hour traffic.
- HUD with live minimap, wanted stars, clock, money, health, ammo
  and a speedometer; title, pause, WASTED and BUSTED screens;
  progress saves automatically to localStorage.

## Layout

- `main.ts` — entrypoint: copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json`.
- `game/index.html` + `game/src/*.js` — the game, one clear job per
  file (config, random, input, audio, world, render, shots, main,
  missions, modshop, collectibles, combat, landmarks, races,
  sidejobs, turf, weather).
- `screenshots/` — four real renders of the game itself, taken with
  its own shot-staging code in headless Chromium.

A wholly original game. No part of it comes from any commercial game.
