#!/usr/bin/env node
/**
 * Local image server for testing the carousel's image cache.
 *
 *   npm run image-server --workspace example        # port 8090, max-age 30 s
 *   PORT=8090 MAX_AGE=10 node example/scripts/image-server.mjs
 *
 * - GET /img/<n>.png    one of the demo shapes, with ETag and Cache-Control.
 *                       Answers 304 when If-None-Match matches.
 * - GET /swap           bumps the version: every URL now serves a different
 *                       shape (and ETag), so you can watch stale images get
 *                       replaced after they expire.
 * - GET /config?maxAge=60&nostore=0&delay=800
 *                       change max-age (s), send no-store, or add latency (ms).
 * - GET /               status page.
 *
 * Each request is logged with its outcome (200 or 304), which shows what the
 * cache does: nothing at all while an image is fresh, a 304 revalidation after
 * it expires, a 200 after /swap.
 *
 * Android emulator: `adb reverse tcp:8090 tcp:8090`. A phone on the same Wi-Fi
 * reaches the server through your computer's LAN address (the example app
 * derives it from the Metro host).
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shapes = ['orb', 'tile', 'ring', 'pill', 'heart'];
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'shapes');
const images = shapes.map((s) => readFileSync(join(dir, `${s}.png`)));

const port = Number(process.env.PORT ?? 8090);
const config = { version: 0, maxAge: Number(process.env.MAX_AGE ?? 30), noStore: false, delay: 0 };
const counts = { 200: 0, 304: 0 };

const time = () => new Date().toISOString().slice(11, 19);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Cache-Control');
  res.setHeader('Access-Control-Allow-Headers', 'If-None-Match, If-Modified-Since');
  if (req.method === 'OPTIONS') return res.end();

  if (url.pathname === '/swap') {
    config.version++;
    console.log(`${time()}  swap → version ${config.version}`);
    return res.end(`version ${config.version}\n`);
  }
  if (url.pathname === '/config') {
    if (url.searchParams.has('maxAge')) config.maxAge = Number(url.searchParams.get('maxAge'));
    if (url.searchParams.has('nostore')) config.noStore = url.searchParams.get('nostore') === '1';
    if (url.searchParams.has('delay')) config.delay = Number(url.searchParams.get('delay'));
    console.log(`${time()}  config ${JSON.stringify(config)}`);
    return res.end(`${JSON.stringify(config)}\n`);
  }

  const m = /^\/img\/(\d+)\.png$/.exec(url.pathname);
  if (!m) {
    res.setHeader('content-type', 'text/plain');
    return res.end(
      `expo-morph-carousel image server\n${JSON.stringify({ ...config, served: counts })}\n` +
        `GET /img/0.png … /img/${shapes.length - 1}.png, /swap, /config?maxAge=&nostore=&delay=\n`,
    );
  }

  const n = Number(m[1]) % shapes.length;
  const shown = (n + config.version) % shapes.length;
  const etag = `"v${config.version}-${n}"`;
  const send = () => {
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', config.noStore ? 'no-store' : `max-age=${config.maxAge}`);
    if (req.headers['if-none-match'] === etag) {
      counts[304]++;
      res.statusCode = 304;
      console.log(`${time()}  304  ${url.pathname}  (${shapes[shown]}, unchanged)`);
      return res.end();
    }
    counts[200]++;
    res.setHeader('content-type', 'image/png');
    console.log(`${time()}  200  ${url.pathname}  → ${shapes[shown]}  ${images[shown].length} B`);
    res.end(images[shown]);
  };
  if (config.delay > 0) setTimeout(send, config.delay);
  else send();
}).listen(port, () => {
  // No host: Node listens on IPv6 and IPv4, so both localhost (::1) and the LAN address work.
  console.log(`image server on http://localhost:${port}  (max-age ${config.maxAge} s)`);
});
