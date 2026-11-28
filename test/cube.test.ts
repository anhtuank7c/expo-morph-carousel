import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cube, cubeFace, type PageEffectInput } from '../src/pageEffects.ts';

const W = 360; // page width (side of the cube when horizontal)
const H = 520; // page height
const EYE = 900; // eye distance

type T = Record<string, number | string>;
type M = number[];

/* --- 4×4 matrices as React Native builds them (row vectors, list applied last to first) --- */

const identity = (): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** b · a, like MatrixMathHelper.multiplyInto(out, a, b). */
function mul(a: M, b: M): M {
  const o = new Array<number>(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += b[i * 4 + k] * a[k * 4 + j];
      o[i * 4 + j] = s;
    }
  return o;
}
const rad = (v: number | string) => (typeof v === 'string' ? (parseFloat(v) * Math.PI) / 180 : v);
/** TransformHelper.processTransform for the transforms the effects use (origin: the view center). */
function matrixOf(list: T[]): M {
  let m = identity();
  for (const t of list) {
    const [k, v] = Object.entries(t)[0];
    const h = identity();
    const r = rad(v);
    if (k === 'perspective') h[11] = -1 / (v as number);
    else if (k === 'rotateY')
      [h[0], h[2], h[8], h[10]] = [Math.cos(r), -Math.sin(r), Math.sin(r), Math.cos(r)];
    else if (k === 'rotateX')
      [h[5], h[6], h[9], h[10]] = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r)];
    else if (k === 'scaleX') h[0] = v as number;
    else if (k === 'scaleY') h[5] = v as number;
    else if (k === 'translateX') h[12] = v as number;
    else if (k === 'translateY') h[13] = v as number;
    else throw new Error(`unexpected transform ${k}`);
    m = mul(m, h);
  }
  return m;
}
/** A point of the view (from its center) on screen (from the view's center). */
function project(m: M, x: number, y: number) {
  const w = x * m[3] + y * m[7] + m[15];
  return { x: (x * m[0] + y * m[4] + m[12]) / w, y: (x * m[1] + y * m[5] + m[13]) / w };
}

/* --- what Android draws: MatrixMathHelper.decomposeMatrix, then the View properties --- */

function inverse(m: M): M {
  const a = m.slice();
  const b = identity();
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r * 4 + c]) > Math.abs(a[p * 4 + c])) p = r;
    for (let k = 0; k < 4; k++) {
      [a[c * 4 + k], a[p * 4 + k]] = [a[p * 4 + k], a[c * 4 + k]];
      [b[c * 4 + k], b[p * 4 + k]] = [b[p * 4 + k], b[c * 4 + k]];
    }
    const d = a[c * 4 + c];
    for (let k = 0; k < 4; k++) {
      a[c * 4 + k] /= d;
      b[c * 4 + k] /= d;
    }
    for (let r = 0; r < 4; r++)
      if (r !== c) {
        const f = a[r * 4 + c];
        for (let k = 0; k < 4; k++) {
          a[r * 4 + k] -= f * a[c * 4 + k];
          b[r * 4 + k] -= f * b[c * 4 + k];
        }
      }
  }
  return b;
}
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/**
 * What a View on Android draws for a transform list: React Native multiplies
 * the list into one matrix, decomposes it (MatrixMathHelper.decomposeMatrix)
 * and sets translation, rotation, scale and a camera distance on the View,
 * which scales, turns and projects about its center, then translates.
 */
function androidDrawn(list: T[]): M {
  const m = matrixOf(list);
  const n = m.map((v) => v / m[15]);
  const pm = n.map((v, i) => (i % 4 === 3 ? 0 : v));
  pm[15] = 1;
  let perspective = 0;
  if (Math.abs(n[3]) > 1e-5 || Math.abs(n[7]) > 1e-5 || Math.abs(n[11]) > 1e-5) {
    const inv = inverse(pm);
    // rightHandSide × transpose(inverse), third component: row 2 of the inverse
    perspective = n[3] * inv[8] + n[7] * inv[9] + n[11] * inv[10] + n[15] * inv[11];
  }
  const row: V3[] = [0, 1, 2].map((i) => [n[i * 4], n[i * 4 + 1], n[i * 4 + 2]] as V3);
  const sx = len(row[0]);
  row[0] = row[0].map((v) => v / sx) as V3;
  const k01 = dot(row[0], row[1]);
  row[1] = row[1].map((v, i) => v - k01 * row[0][i]) as V3;
  const sy = len(row[1]);
  row[1] = row[1].map((v) => v / sy) as V3;
  const k02 = dot(row[0], row[2]);
  row[2] = row[2].map((v, i) => v - k02 * row[0][i]) as V3;
  const k12 = dot(row[1], row[2]);
  row[2] = row[2].map((v, i) => v - k12 * row[1][i]) as V3;
  row[2] = row[2].map((v) => v / len(row[2])) as V3;
  const rotX = -Math.atan2(row[2][1], row[2][2]);
  const rotY = -Math.atan2(-row[2][0], Math.hypot(row[2][1], row[2][2]));
  const rotZ = -Math.atan2(row[1][0], row[0][0]);
  assert.ok(
    Math.abs(rotZ) < 1e-9 && Math.abs(k01) < 1e-9,
    'no rotateZ or skew, which the View would not draw',
  );
  // setCameraDistance(density² × distance × √5); the renderer divides by dpi and multiplies by 72
  const camera = (-1 / (perspective || -0.00078125)) * ((72 * Math.sqrt(5)) / 160);
  return matrixOf([
    { translateX: n[12] },
    { translateY: n[13] },
    { perspective: camera },
    { rotateX: rotX },
    { rotateY: rotY },
    { scaleX: sx },
    { scaleY: sy },
  ]);
}

/* --- the real cube ------------------------------------------------------- */

/**
 * Where the point (u, v) of a face (from the page's center) lands on a real
 * cube turned by offset × 90°, its center half a side behind the screen,
 * seen from EYE in front of the page's center.
 */
function real(offset: number, u: number, v: number, vertical: boolean) {
  const a = (offset * Math.PI) / 2;
  const h = (vertical ? H : W) / 2;
  const s = vertical ? v : u; // along the scroll axis
  const along = h * Math.sin(a) + s * Math.cos(a);
  const z = h * Math.cos(a) - s * Math.sin(a) - h;
  const k = EYE / (EYE - z);
  return vertical ? { x: u * k, y: along * k } : { x: along * k, y: v * k };
}

const input = (offset: number, platform: string, vertical = false): PageEffectInput => ({
  offset,
  step: vertical ? H : W,
  width: W,
  height: H,
  viewportWidth: W,
  viewportHeight: H,
  direction: vertical ? 'vertical' : 'horizontal',
  rtl: false,
  platform,
});

const effect = cube({ perspective: EYE });
const draw = (platform: string, list: T[]) => (platform === 'android' ? androidDrawn(list) : matrixOf(list));
const POINTS: [number, number][] = [];
for (const u of [-1, -0.5, 0, 0.5, 1]) for (const v of [-1, 0, 1]) POINTS.push([(u * W) / 2, (v * H) / 2]);

function check(platform: string, vertical: boolean) {
  let faces = 0;
  for (let o = -0.95; o <= 0.95; o += 0.05) {
    const style = effect(input(o, platform, vertical));
    if (style.opacity === 0) continue;
    faces++;
    assert.equal(style.transformOrigin, undefined, 'transforms are about the view center');
    const m = draw(platform, style.transform as T[]);
    for (const [u, v] of POINTS) {
      const d = project(m, u, v);
      const r = real(o, u, v, vertical);
      const at = `${platform} ${vertical ? 'vertical' : 'horizontal'}, offset ${o.toFixed(2)}, point (${u}, ${v})`;
      assert.ok(
        Math.abs(d.x - r.x) < 1e-6 && Math.abs(d.y - r.y) < 1e-6,
        `${at}: ${d.x}, ${d.y} vs ${r.x}, ${r.y}`,
      );
    }
  }
  assert.ok(faces > 30, 'most offsets draw a face');
}

describe('cube faces', () => {
  it('match the projection of a real cube at every point on iOS and web', () => {
    check('ios', false);
    check('web', false);
    check('ios', true);
  });

  it('match it on Android too, as the View draws the decomposed transform', () => {
    check('android', false);
    check('android', true);
  });

  it('neighbors share their edge', () => {
    for (const platform of ['ios', 'android']) {
      for (let t = 0.05; t < 1; t += 0.05) {
        const leaving = effect(input(-t, platform));
        const coming = effect(input(1 - t, platform));
        if (leaving.opacity === 0 || coming.opacity === 0) continue;
        for (const v of [-H / 2, H / 2]) {
          const a = project(draw(platform, leaving.transform as T[]), W / 2, v); // its trailing edge
          const b = project(draw(platform, coming.transform as T[]), -W / 2, v); // its leading edge
          assert.ok(
            Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6,
            `${platform} edge at ${t.toFixed(2)}`,
          );
        }
      }
    }
  });

  it('is the identity at rest and hides faces turned away', () => {
    const f = cubeFace(0, W, EYE)!;
    assert.equal(f.translate, 0);
    assert.equal(f.along, 1);
    assert.equal(f.across, 1);
    assert.equal(f.angle, 0);
    assert.equal(cubeFace(1, W, EYE), null);
    assert.equal(cubeFace(-1, W, EYE), null);
  });
});
