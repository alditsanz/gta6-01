// Solmar Heat — serve.ts
// Tiny local dev server: serves game/ as static files so the game can
// be played or screenshotted locally. Node standard library only.
// Usage: node serve.ts --port 8080  →  http://localhost:8080

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const gameDir = join(rootDir, 'game');
const portArg = process.argv.indexOf('--port');
const port = portArg >= 0 ? Number(process.argv[portArg + 1]) : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(gameDir, '.' + decodeURIComponent(path));
  if (!file.startsWith(gameDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(port, () => console.log('Solmar Heat at http://localhost:' + port));
