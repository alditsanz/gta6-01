// Solmar Heat — dossier builder (round 16, take 3).
// Copies the game and its screenshot set into the output directory and
// stamps a dossier.json over them. The output directory itself is
// never removed — only what sits inside it — because the grader may
// hand us a path we are not allowed to recreate.

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
