import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

// A strict static mount for Pages tests: no SPA rewrite that could mask broken deep links.
const root = fileURLToPath(new URL('../../apps/web/dist/', import.meta.url));
const base = process.env.VITE_BASE_PATH || '/ttrpg-forge/';
const port = Number(process.env.PORT || 4181);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://localhost:${port}`).pathname);
    if (!pathname.startsWith(base)) throw new Error('outside mount');
    const relative = pathname.slice(base.length) || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(resolve(root) + sep) || !(await stat(file)).isFile()) throw new Error('not a file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Pages test mount: http://localhost:${port}${base}`));
