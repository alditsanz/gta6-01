// Solmar Heat — the entry program (Node 22, standard library only).
// It copies game/ and screenshots/ into the output directory and
// writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Running it twice writes the same bytes.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const root = new URL('.', import.meta.url).pathname;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
