# Solmar Heat

[![Solmar Heat](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original sun-soaked open-world crime game for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01) — built from
scratch in vanilla JavaScript, no libraries, no network, no assets
from any commercial game.

## The game

You are a wheelman in **Solmar**, a 9×9 street-grid city of 10 districts
(Sunset Mile, Cactus Court, Neon Strip, Marina, Pier 9, East Market,
Canal Row, Old Town, Harbor Lights, Southgate). Steal cars, outrun the
SCPD, and work your way up from small-time driver to **Solmar Legend**.

- **7 story jobs** — an arc about you, Lena Voss, and the crime boss
  Kane, ending in **The Last Ledger**: steal Kane's ledger from SCPD
  Headquarters, clear 3 guards, and escape to the Marina in 90 seconds
  under a 4-star manhunt ($4,150 total take).
- **3 street races** — Sunset Sprint, Neon Circuit, and the Canal Grand
  Tour, with checkpoints, par times, and payouts up to $600.
- **SCPD helicopter** — at 5 stars a chopper joins the pursuit with a
  searchlight and a ground shadow; it only leaves when the heat drops.
- **Turf wars (new)** — 10 districts held by three gangs. Plant your
  flag, survive 30 seconds of gang-car attacks, and the district is
  yours. Owned turf pays $40 a minute and shows on the minimap.
- **Day & night + weather (new)** — a full day lasts 4 real minutes;
  night lights the windows and lamps and gives your car headlights,
  rain makes the roads slippery, and fog closes the view in.
- **Canal Row** — a 10th district with canals you cross on bridges,
  a depot delivery job ($250 a run), and 2 extra stealable cars
  (12 total, including the Falco and the Vento taxi).
- **Side work** — taxi fares (~$310), 10 hidden Solmar coins ($75
  each), near-miss bonuses ($15), Lou's Paint Shop (clears heat and
  repairs your car), car damage and wrecks, WASTED + hospital respawn,
  ranks up to Solmar Legend, autosave, and synthesized WebAudio sound.

## Controls

WASD / arrows — move & drive · E — steal / exit car · Mouse — aim & shoot ·
R — reload · F — punch · Space — handbrake · T — taxi fare · G — turf war ·
B — delivery job · Shift — sprint · P — pause · M — mute · Enter — mission board

## Play it

Serve `game/` with any static file server and open `game/index.html`
in a desktop browser. No build step, no network requests.

## Entry

Built for the [GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01).
`main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to
`/output` and writes `/output/dossier.json` via `buildDossier`.

## License

MIT — see `LICENSE`.
