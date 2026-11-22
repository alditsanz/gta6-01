# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).
Top-down, vanilla JavaScript on a canvas, fully offline — no assets, no
network calls, all sound synthesized. You are **Rex Kane**, a wheelman
in the sun-soaked city of Solmar, working jobs for Mama Lou and Lena
Voss while the boss Kane closes in.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts`
and visit the printed address). Click or press Enter to play.

- **WASD / arrows** — walk & drive · **E** — enter / exit car
- **Mouse** — aim · **click** — shoot · **F** — punch · **R** — reload
- **1/2/3** — fists / pistol / SMG · **Space** — handbrake · **Shift** — sprint
- **N** — next story job · **T** — taxi fare · **B** — delivery · **J** — race (at a start)
- **G** — Lou's Paint Shop (near it) · **O** — Lou's Mod Shop (near it) · **C** — crew getaway
- **P** — map & record · **Q** — radio station · **M** — mute

Progress saves automatically to the browser.

## Feature matrix (all real, all counted in-game)

| System | Count |
| --- | --- |
| Story jobs | **5** — Wheels for Lou · The Palms Package · Neon Night Run · Canal Row Ambush · National Bank Job (each graded S/A/B/C) |
| Solmar coins | **20** hidden coins, $75 each |
| Lantern Stashes | **12** hidden stashes, $120 each |
| Stunt jumps | **5** marked jumps on the fast straights |
| Street races | **3** routes — Coast Cruise, Grid Runner, Grand Solmar |
| Turf war | **5** zones vs the Vipers, hold-to-flip, hourly income |
| Wanted system | **5 stars** — SCPD cruisers (BFS pursuit), foot cops, roadblocks from 4★, AIR-1 helicopter at 5★ |
| Cars | **12** models to steal and drive, with damage and wrecks |
| Crew | Lena Voss — getaway ability that bleeds heat (45 s cooldown) |
| Mod shop | Engine / Armor / Tires, **3 levels each** (9 mods) |
| Side work | Taxi fares (~$310) and timed Marina deliveries |
| City | 9 districts, 10 landmarks, day/night cycle, weather (clear/rain/fog), rush-hour traffic |
| Saves | 3 slots shown on the map & record screen; autosave to localStorage |

## Structure

- `main.ts` — entrypoint: copies `game/` + `screenshots/` to the output
  directory and writes the dossier via `vendor/makefun-game.ts`.
- `game/src/` — one module per job: `world` (city + police), `render`
  (drawing + HUD + map screen), `missions`, `combat`, `sidejobs`,
  `races`, `turf`, `collectibles`, `modshop`, `weather`, `props`,
  `landmarks`, `radio`, `random`, `config`, `input`, `audio`, `shots`,
  `main`.
- `screenshots/` — four real renders of the game itself (chase, vault,
  map, title).

A wholly original game. No part of it comes from any commercial game.
