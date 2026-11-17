[![Solmar Heat on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

# Solmar Heat

An original open-world crime game for [make.fun's Make GTA 6 bounty](https://make.fun/c/gta6-01) — a sun-soaked modern city, seven story jobs, and no part of any commercial game.

## The game

You are a wheelman in **Solmar**, a 9×9 street-grid city. Steal cars (the Falco, the Vento taxi, eight more), outrun the SCPD, and work seven story jobs for Lena Voss against the crime boss Kane — ending with **The Last Ledger**: clear the guards at SCPD Headquarters, grab Kane's ledger, and escape to the Marina in 90 seconds under a 4-star manhunt.

- **Open world:** traffic, pedestrians, districts (Sunset Mile, Cactus Court, Neon Strip, Marina, Pier 9), landmarks, and a minimap.
- **Wanted system:** 5 stars, police pursuit on the road grid, roadblocks from 4 stars, Lou's Paint Shop to clear the heat and repair your car.
- **Combat:** shooting with reload, punching, guards with health pips, ammo pickups.
- **Side work:** taxi fares, 10 hidden Solmar coins ($75 each), near-miss bonuses, car damage and wrecks.
- **Progression:** money, score, ranks up to Solmar Legend, and progress that saves automatically.

## Play

Open `game/index.html` in a desktop browser (or serve the repo with `node serve.ts` and visit http://localhost:8080). No network, no build step — vanilla JavaScript and canvas, sound synthesized with WebAudio.

- **WASD / arrows** — move & drive · **E** — steal / exit car · **Mouse** — aim & shoot
- **R** — reload · **F** — punch · **Space** — handbrake · **T** — taxi fare
- **Shift** — sprint · **P** — pause · **M** — mute · **Enter / click** — play

## Files

- `game/index.html` + `game/src/` — the game, one clear job per file (`config`, `random`, `input`, `world`, `render`, `audio`, `shots`, `main`, `combat`, `sidejobs`, `landmarks`, `collectibles`).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game (start / drive / chase / mission).

## License

MIT — see [LICENSE](LICENSE).
