// Solmar Heat — main.ts (the entrypoint, round 10)
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Node 22, standard library only. Running it twice
// writes byte-identical bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const rootDir = new URL('.', import.meta.url).pathname;

function main(): void {
  // Start from a clean output directory so a stale file can never leak in.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const gameSrc = join(rootDir, 'game');
  const shotsSrc = join(rootDir, 'screenshots');
  const gameDst = join(outDir, 'game');
  const shotsDst = join(outDir, 'screenshots');

  if (!existsSync(gameSrc)) throw new Error('game/: no such directory');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/: no such directory');

  cpSync(gameSrc, gameDst, { recursive: true });
  cpSync(shotsSrc, shotsDst, { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
}

main();
