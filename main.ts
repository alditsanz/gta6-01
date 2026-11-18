// Solmar Heat — entrypoint: copies game/ and screenshots/ into the
// output directory and writes the dossier buildDossier produces.
// Node 22, standard library only; running it twice writes the same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('game', `${out}/game`, { recursive: true });
if (existsSync('screenshots')) {
  cpSync('screenshots', `${out}/screenshots`, { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(`${out}/dossier.json`, dossier);
console.log(`wrote ${out}/dossier.json (${dossier.length} bytes)`);
