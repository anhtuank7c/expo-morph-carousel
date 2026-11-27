#!/usr/bin/env node
/**
 * Generates the demo images in example/assets/shapes/: 3D-looking shapes on a
 * transparent background, the kind of image the liquid effect is made for
 * (product shots without a backdrop). They are drawn per pixel with ffmpeg's
 * `geq` filter, so the repository needs no third-party artwork.
 *
 *   node example/scripts/make-assets.mjs            # ffmpeg on PATH
 *   FFMPEG=/path/to/ffmpeg node example/scripts/make-assets.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'shapes');
mkdirSync(out, { recursive: true });
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const S = 512;

// u, v: -1..1 across the image (y down). Light comes from the top left.
const u = `((X-${S / 2})/${S * 0.4})`;
const v = `((Y-${S / 2})/${S * 0.4})`;
/** Antialiased coverage: 1 inside (d < 0), 0 outside, over ~1.5 px. */
const cover = (d) => `255*clip(-(${d})*${S * 0.4}/1.5+0.5,0,1)`;
/** Diffuse light from the top left, 0.3..1, for a sphere-like normal. */
const shade = (cx = -0.45, cy = -0.5, k = 0.55) => `clip(1-hypot(${u}-(${cx}),${v}-(${cy}))*${k},0.3,1)`;
/** Small specular highlight. */
const spec = (cx = -0.4, cy = -0.45) => `255*pow(clip(1-hypot(${u}-(${cx}),${v}-(${cy}))*3.2,0,1),3)`;

const rgb = ([r, g, b], light, extra = '0') => ({
  r: `clip(${r}*${light}+${extra},0,255)`,
  g: `clip(${g}*${light}+${extra},0,255)`,
  b: `clip(${b}*${light}+${extra},0,255)`,
});

const shapes = {
  // sphere
  orb: { d: `hypot(${u},${v})-1`, ...rgb([128, 86, 230], shade(), spec()) },
  // rounded square (superellipse) with a diagonal orange → pink gradient
  tile: {
    d: `pow(pow(abs(${u}),4)+pow(abs(${v}),4),0.25)-0.92`,
    r: `clip(255*${shade(-0.6, -0.6, 0.35)}+${spec(-0.5, -0.55)}*0.4,0,255)`,
    g: `clip((150-50*(${u}+${v}))*${shade(-0.6, -0.6, 0.35)},0,255)`,
    b: `clip((60+70*(${u}+${v}))*${shade(-0.6, -0.6, 0.35)},0,255)`,
  },
  // torus seen from the front
  ring: {
    d: `abs(hypot(${u},${v})-0.68)-0.32`,
    ...rgb(
      [32, 190, 170],
      `clip(1-hypot(${u}+0.4,${v}+0.45)*0.5-abs(hypot(${u},${v})-0.68)*0.9,0.3,1)`,
      spec(-0.45, -0.5),
    ),
  },
  // vertical capsule
  pill: {
    d: `hypot(${u},max(abs(${v})-0.5,0))-0.46`,
    ...rgb([52, 120, 246], shade(-0.25, -0.75, 0.5), spec(-0.18, -0.7)),
  },
  // heart: two circles on top of a downward triangle whose sides are tangent
  // to them (signed distances, so the antialiased edge is even everywhere)
  heart: {
    // circles centered (±0.37, -0.22), r 0.5; the tangent points are at v = 0.17,
    // where the triangle starts; a rectangle fills the gap between the circles.
    d: `min(min(min(hypot(${u}-0.37,${v}+0.22)-0.5,hypot(${u}+0.37,${v}+0.22)-0.5),max((abs(${u})+1.245*${v}-0.896)/1.597,0.17-${v})),max(abs(${u})-0.37,abs(${v}+0.01)-0.21))`,
    ...rgb([235, 64, 90], shade(-0.4, -0.55, 0.5), spec(-0.45, -0.4)),
  },
};

for (const [name, s] of Object.entries(shapes)) {
  const filter = `format=rgba,geq=r='${s.r}':g='${s.g}':b='${s.b}':a='${cover(s.d)}'`;
  const res = spawnSync(
    ffmpeg,
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=black@0:s=${S}x${S}`,
      '-vf',
      filter,
      '-frames:v',
      '1',
      join(out, `${name}.png`),
    ],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) {
    console.error(`${name}: ${res.stderr || res.error}`);
    process.exit(1);
  }
  console.log(`assets/shapes/${name}.png`);
}
