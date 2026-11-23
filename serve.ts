// Solmar Heat — a tiny static file server for local play.
// Serves only the game/ folder:  node serve.ts  →  http://localhost:8077/

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const port = Number(process.env.PORT || 8077);

const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css',
};

createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = 'index.html';
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Solmar Heat at http://localhost:${port}/`));
