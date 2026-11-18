// Serves the production build in dist/ for a last look before deploying.
// Compresses text the way a static host would, so measurements here reflect production.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT || 4174);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (statSync(file).isDirectory()) file = path.join(file, 'index.html');
    statSync(file);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  const compress = /\.(html|js|css|svg|json|txt|xml)$/.test(file) && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
  response.writeHead(200, {
    'content-type': types[path.extname(file)] || 'application/octet-stream',
    'cache-control': /-[A-Z0-9]{8}\./.test(path.basename(file)) ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...(compress ? { 'content-encoding': 'gzip' } : {}),
  });
  const stream = createReadStream(file);
  (compress ? stream.pipe(createGzip()) : stream).pipe(response);
}).listen(port, () => console.log(`preview: http://localhost:${port}`));
