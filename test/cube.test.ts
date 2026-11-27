import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cubeFace } from '../src/pageEffects.ts';

const W = 360; // side of the cube (page width)
const EYE = 900; // eye distance

/**
 * Where a point of a face lands with the transforms cube() returns, applied
 * the way React Native applies a transform list (last one first: scale,
 * rotateY, perspective, translate), around the face's leading edge. Returns
 * screen x (from the page center) and the vertical scale at that point.
 */
function drawn(offset: number, u: number) {
  const f = cubeFace(offset, W, EYE);
  if (!f) return null;
  const b = (f.angle * Math.PI) / 180;
  const x = u * W * f.along; // from the leading edge, scaled
  // rotateY(b): x' = x cos b, z' = -x sin b (z toward the eye)
  const xr = x * Math.cos(b);
  const zr = -x * Math.sin(b);
  // perspective(p): scales by p / (p - z)
  const k = f.perspective / (f.perspective - zr);
  // the leading edge sits at -W/2 before the transforms
  return { x: -W / 2 + f.translate + xr * k, size: f.across * k };
}

/** The same point on a real cube turned by offset × 90°, seen from EYE. */
function real(offset: number, u: number) {
  const a = (offset * Math.PI) / 2;
  const h = W / 2;
  // face point before turning: (X, 0) with X from -h to h; cube center at z = -h
  const X = -h + u * W;
  const x = X * Math.cos(a) + h * Math.sin(a);
  const z = -X * Math.sin(a) + h * Math.cos(a) - h;
  return { x: (x * EYE) / (EYE - z), size: EYE / (EYE - z) };
}

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps * Math.max(1, Math.abs(b));

describe('cube faces', () => {
  it('match the projection of a real cube at every point', () => {
    for (let o = -0.95; o <= 0.95; o += 0.05) {
      if (Math.abs(o) < 0.85) assert.ok(cubeFace(o, W, EYE), `face at ${o.toFixed(2)} is visible`);
      for (const u of [0, 0.25, 0.5, 0.8, 1]) {
        const d = drawn(o, u);
        if (!d) continue; // turned away from the eye
        const r = real(o, u);
        assert.ok(close(d.x, r.x), `x at offset ${o.toFixed(2)}, u ${u}: ${d.x} vs ${r.x}`);
        assert.ok(close(d.size, r.size), `size at offset ${o.toFixed(2)}, u ${u}: ${d.size} vs ${r.size}`);
      }
    }
  });

  it('neighbors share their edge', () => {
    for (let t = 0.05; t < 1; t += 0.05) {
      const current = drawn(-t, 1); // trailing edge of the page leaving
      const next = drawn(1 - t, 0); // leading edge of the page coming in
      if (!current || !next) continue; // one of them turned away
      assert.ok(close(current.x, next.x), `edge x at ${t.toFixed(2)}`);
      assert.ok(close(current.size, next.size), `edge height at ${t.toFixed(2)}`);
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
