// serve.ts — a tiny local static server for playing Solmar Heat
// during development. Not part of the submitted game; the entry on
// make.fun ships game/ + screenshots/ only. Run: node serve.ts
// then open http://localhost:8077 in a desktop browser.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer(async (req, res) => {
  try {
    const path = normalize(join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]));
    if (!path.startsWith(root)) { res.writeHead(403); return res.end('no'); }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(8077, () => console.log('Solmar Heat at http://localhost:8077'));
