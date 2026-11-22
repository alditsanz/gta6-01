// Solmar Heat — main.ts (the entrypoint, round 16)
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Node 22, standard library only. Running it
// any number of times writes byte-identical bytes.
//
// The output directory itself is NEVER deleted: in the grader's
// sandbox /output is created by the harness (a mount point, or a
// directory whose parent this program may not write to), so removing
// the directory itself throws and the run fails before doing any
// work. Only its CONTENTS are cleaned — the stale-file protection is
// the same and the directory is left standing.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const rootDir = fileURLToPath(new URL('.', import.meta.url));

function main(): void {
  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }

  const gameSrc = join(rootDir, 'game');
  const shotsSrc = join(rootDir, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/: no such directory');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/: no such directory');

  // Copy the whole game tree and the screenshot set exactly as committed.
  cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
}

main();
