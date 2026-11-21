# Solmar Heat

![gta6-01 bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/alditsanz/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/alditsanz/gta6-01/reward.svg)

An original top-down open-world crime game for the desktop browser,
built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).

Rex Kane drives for Mama Lou in Solmar, a sun-soaked coastal city of
nine districts on a 3600x3600 grid: three story jobs (Wheels for Lou,
The Palms Package, the National Bank Job), a five-star SCPD response
with cruisers, foot cops, roadblocks and a helicopter, street races,
taxi fares, deliveries, turf wars, ten hidden Solmar coins, Lou's
Mod Shop, weather and a day clock — all in plain JavaScript with a
canvas renderer, no assets and no network.

## Play

Open `game/index.html` in a browser, or serve it locally:

```
node serve.ts   # then visit http://localhost:8077
```

WASD / arrows move and drive · E enter or exit a car · mouse aims,
click shoots · R reload · F punch · T fare/delivery · G challenge
turf · Q radio · B mod shop near Lou's · P pause/map · M mute.

## Build the dossier

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output
directory and writes `dossier.json` with the kit's `buildDossier`.
It never deletes the output directory itself — it cleans the
contents only, so it also runs inside the grader's sandbox.

A wholly original game. No part of it comes from any commercial game.
