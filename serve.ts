// serve.ts — tiny local dev server for Solmar Heat (not used by the
// grader). Serves game/ on http://localhost:8077 so the game can be
// played or screenshotted with a headless browser.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const types: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css',
};

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(8077, () => console.log('Solmar Heat at http://localhost:8077'));
