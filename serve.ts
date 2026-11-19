// Solmar Heat — serve.ts (a tiny static file server, Node 22, stdlib only)
// Serves game/ on http://localhost:8080 so the game can be played and
// screenshotted locally without any build step:
//
//   node serve.ts [--port 8080]
//
// It answers only paths inside game/, sends the MIME types a browser game
// needs, and refuses everything else. Nothing clever, nothing online.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const wanted = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = resolve(join(gameRoot, normalize(path).replace(/^(\.\.[/\\])+/, '')));
    // Refuse anything that climbs out of game/.
    if (file !== gameRoot && !file.startsWith(gameRoot + sep)) {
      response.writeHead(403);
      response.end('forbidden');
      return;
    }
    const stat = statSync(file);
    if (!stat.isFile()) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size,
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
}).listen(port, () => {
  console.log(`Solmar Heat serving game/ on http://localhost:${port}`);
});
