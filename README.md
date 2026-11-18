# Solmar Heat

[![Solmar Heat](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). A wholly original
game — no part of it comes from any commercial game.

## The game

Explore the sun-soaked city of **Solmar** — a 9×9 street grid across 10
districts, from Sunset Mile and the Neon Strip to Canal Row and Pier 9 — on
foot and by car. Steal one of 12 cars (the Falco, the Vento taxi, the Cobra…),
outrun SCPD pursuit with a 5-star wanted level, roadblocks from 4 stars and a
police helicopter at 5 stars, and work 7 story jobs for Lena Voss against the
crime boss Kane, ending in **The Last Ledger** — a $4,150 finale heist at SCPD
Headquarters.

Side work never stops: taxi fares (~$310), 10 hidden Solmar coins ($75 each),
near-miss bonuses ($15), street races on 3 routes ($150/$300/$600), delivery
runs, turf wars across 5 crew-held zones with hourly income, and a living
city — a day/night clock, rain that loosens your grip, fog that closes the
world in, and rush-hour traffic that doubles at 07:00–09:00 and 17:00–19:00.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any static
server). No network requests, no build step, no assets to download.

- **WASD / arrows** — move & drive · **E** — steal / exit car · **Mouse** — aim & shoot
- **R** — reload · **F** — punch · **Space** — handbrake · **T** — taxi fare
- **C** — turf challenge · **Shift** — sprint · **B** — mission board · **P** — pause · **M** — mute

Progress saves automatically in the browser. Lou's Paint Shop clears your
heat and repairs your car.

## Files

- `game/` — the game: `index.html` plus 12 focused modules under `game/src/`
  (`config`, `random`, `input`, `world`, `render`, `audio`, `shots`, `main`,
  `combat`, `sidejobs`, `landmarks`, `collectibles`)
- `screenshots/` — four real renders of the game (start / drive / chase / mission)
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output`
  and writes `/output/dossier.json` via `vendor/makefun-game.ts`

## License

MIT — see `LICENSE`.
