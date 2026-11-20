// Solmar Heat — main.ts (the entrypoint, round 12, run-fix)
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Node 22, standard library only. Running it
// twice writes byte-identical bytes.
//
// Run-fix: never delete the output directory itself. In the grader's
// sandbox /output is created by the harness (a mount point, or a
// directory whose parent the program may not write to), so a top-level
// rmSync of the output directory throws EACCES/EBUSY and the run exits
// 1 before doing any work — the run_completes failure that rejected
// the round-10 entry. Clean only the directory's contents instead:
// the stale-file protection is the same and the directory is left
// standing.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const rootDir = fileURLToPath(new URL('.', import.meta.url));

function main(): void {
  // Start from a clean output directory so a stale file can never leak
  // in — clean its contents only, never the directory itself (see the
  // header note: deleting it fails in the grader's sandbox).
  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }

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
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
}

main();
