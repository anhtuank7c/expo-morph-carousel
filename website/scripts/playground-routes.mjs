// The example app's web build is a single-page app; GitHub Pages has no
// rewrites, so give every screen its own folder with a copy of index.html
// (the app reads the path and shows that screen).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'public', 'playground');
const app = path.resolve(here, '..', '..', 'example', 'app');
const index = fs.readFileSync(path.join(out, 'index.html'));
const routes = fs
  .readdirSync(app)
  .filter((f) => /\.tsx$/.test(f) && !f.startsWith('_') && f !== 'index.tsx')
  .map((f) => f.replace(/\.tsx$/, ''));
for (const r of routes) {
  fs.mkdirSync(path.join(out, r), { recursive: true });
  fs.writeFileSync(path.join(out, r, 'index.html'), index);
}
console.log(`playground: ${routes.length} routes (${routes.join(', ')})`);
