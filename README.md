# Solmar Heat

[![Solmar Heat on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounties/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounties/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounties/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime story in the sun-soaked city of **Solmar** — a wholly
original top-down game, built with vanilla JavaScript and a single canvas.
No part of it comes from any commercial game.

You are a getaway driver hired by **Lena Voss**. The crime boss **Kane**
turns on her, and the seven-job story arc runs from your first wheels at
Cactus Court Plaza to the finale, *The Last Ledger*: steal Kane's ledger
from SCPD Headquarters, clear its guards, and escape to the Marina under
a 4-star manhunt. Finish it and you are a **Solmar Legend**.

## How to run

Build the competition dossier (copies `game/` and `screenshots/` to the
output directory and writes `dossier.json`):

```sh
node main.ts
```

Play the game locally in a desktop browser:

```sh
node serve.ts
# then open http://localhost:5173/
```

Both use Node 22 with the standard library only — nothing to install.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, drive |
| E | Steal a car / exit a car |
| Mouse | Aim, hold to shoot |
| R | Reload |
| F | Punch |
| Space | Handbrake |
| Shift | Sprint on foot |
| T | Pick up a taxi fare (in a car, near a passenger) |
| Y | Lou's Paint Shop — clear heat and repair ($150) |
| U | Lou's Mod Shop (near the shop) |
| 1 / 2 / 3 | In the Mod Shop: buy Engine / Armor / Tires |
| G | Start a turf war in a rival zone |
| P | Pause |
| M | Mute |

Click or press Enter on the title screen, then pick a job (1–7) from
Lena's mission board, or press Esc to free-roam.

## Features

- **A living city** — a 9×9 road grid across 10 named districts
  (Sunset Mile, Cactus Court, Neon Strip, the Marina, Pier 9, Canal Row
  with canals and bridges, and more), with traffic, pedestrians,
  landmarks, parks and buildings.
- **Driving** — 12 stealable cars with their own speed and handling,
  car damage and wrecks, handbrake turns, near-miss bonuses, and
  rush-hour traffic that follows the in-game clock.
- **Wanted system** — a 5-star heat level: SCPD cruisers pursue with
  road-grid pathfinding, roadblocks appear at 4 stars, and a police
  helicopter joins at 5 stars. Lay low to cool off, or pay Lou.
- **Seven story jobs** plus a mission board, with timers, objectives,
  guards with health pips, swept bullet combat, punching and ammo.
- **Side work** — taxi fares, a timed package delivery, three street
  races (Sunset Sprint, Canal Circuit, Solmar Grand Run), and turf
  wars over six zones that pay hourly income.
- **Lou's Mod Shop** — Engine, Armor and Tires upgrades, three levels
  each, bought with game money and saved with your progress.
- **Collectibles** — 10 hidden Solmar coins worth $75 each.
- **Day, night and weather** — a full in-game clock with dawn, dusk,
  lit windows and streetlights, plus rain that cuts grip and fog that
  closes in the view.
- **Ranks and saving** — climb from Lookout to Solmar Legend; money,
  jobs, coins, turf, mods and stats autosave in your browser.
- **Sound** — synthesized WebAudio effects (shots, crashes, whooshes,
  coins, cash). No audio assets, no network requests, fully offline.

## Screenshots

The `screenshots/` folder holds four real renders of the running game:
the title screen, driving downtown, a 4-star police chase with a
roadblock, and The Last Ledger heist at SCPD Headquarters.

## License

MIT — see `LICENSE`.
