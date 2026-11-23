[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

An open-world crime story in Solmar Bay, drawn entirely on a 1280×720
canvas — no image assets, no audio files, everything painted and
synthesized in code from one seeded world.

## The game

You are Rex Kane, back in Solmar Bay with a borrowed Vento and a list
of people who owe you. Work five story jobs for Mama Lou, Lena Voss
and Kane — wheels, a package run, a night run, an ambush on Canal Row,
and the Solmar National Bank job — while the SCPD scales from two
cruisers to a seven-unit response with AIR-1 overhead and roadblocks
on the avenues.

- **Five story missions** with goto / pickup / hold / escape steps,
  letter grades, and a real story-complete victory screen that reads
  its grades, score and feats from your actual career fields.
- **Five-star SCPD system** — pursuit cars that pathfind across the
  street grid, foot units that try to bust you, a helicopter spotlight
  at five stars, roadblocks with spike strips at four.
- **Round-16 cameras** — a perspective chase cam with a vanishing-point
  road and a hero car planted in the foreground, and a ground-level
  over-shoulder frame for the vault hold, ring drawn as a floor ellipse.
- **A living city** — 3×3 districts, ten landmarks, traffic, parked
  cars, crowds that flee, a day/night cycle with dawn, golden hour and
  dusk, rain and fog that genuinely loosen your grip.
- **The hunt layer** — 20 Solmar coins, 12 lantern stashes, 5 stunt
  jumps, 3 street races, 5 turf zones to flip, taxi fares and marina
  deliveries.
- **Progression** — career stats and reputation ranks, a mod shop
  (engine / armor / tires), a paint shop that wipes your heat, and an
  autosave in localStorage.
- **Pause map** — district standings tinted by turf, a GPS route drawn
  along the avenues to your target, the completion ring, checklist and
  full career grid.

## Run it

```sh
node serve.ts          # → http://localhost:8077/
node main.ts           # builds /output/dossier.json (or $MAKEFUN_OUTPUT_DIR)
```

## Controls

- **WASD / arrows** — walk or drive · **Shift** — sprint
- **E** — enter/exit car, use the paint and mod shops
- **Mouse** — aim · **click / Space** — shoot · **F** — punch · **R** — reload
- **1 / 2 / 3** — fists / pistol / SMG (also buys mods in the shop)
- **N** — next story job · **T** — taxi fare · **G** — delivery
- **Q** — radio station · **P / Esc** — map & record · **Enter** — confirm
