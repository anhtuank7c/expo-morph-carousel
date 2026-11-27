// Run with `npm test` (Node 22.18+ strips the TypeScript types itself).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clamp,
  nearestVirtual,
  pageWindow,
  ringOffset,
  rubberBand,
  snapTarget,
  transitionPeak,
  wrap,
} from '../src/math.ts';

describe('wrap', () => {
  it('maps negative and overflowing indexes into range', () => {
    assert.equal(wrap(-1, 5), 4);
    assert.equal(wrap(5, 5), 0);
    assert.equal(wrap(12, 5), 2);
    assert.equal(wrap(3, 0), 0);
  });
});

describe('clamp', () => {
  it('limits to the range', () => {
    assert.equal(clamp(-2, 0, 4), 0);
    assert.equal(clamp(9, 0, 4), 4);
    assert.equal(clamp(2, 0, 4), 2);
  });
});

describe('transitionPeak', () => {
  it('is 0 on a page and 1 halfway between pages', () => {
    assert.equal(transitionPeak(0), 0);
    assert.equal(transitionPeak(3), 0);
    assert.equal(transitionPeak(1.5), 1);
    assert.equal(transitionPeak(-0.5), 1);
    assert.ok(Math.abs(transitionPeak(2.25) - 0.5) < 1e-9);
    assert.ok(Math.abs(transitionPeak(2.75) - 0.5) < 1e-9);
  });
});

describe('ringOffset', () => {
  it('takes the short way around the ring', () => {
    assert.equal(ringOffset(0, 4, 5), 1); // first dot is one step after the last page
    assert.equal(ringOffset(4, 0, 5), -1);
    assert.equal(ringOffset(2, 2, 5), 0);
    assert.equal(ringOffset(0, 4.5, 5), 0.5);
  });
});

describe('rubberBand', () => {
  it('passes positions inside the range through', () => {
    assert.equal(rubberBand(1.3, 0, 4), 1.3);
  });
  it('resists overscroll and never reaches the finger', () => {
    const over = rubberBand(-1, 0, 4);
    assert.ok(over < 0 && over > -1);
    const far = rubberBand(-3, 0, 4);
    assert.ok(far < over, 'more drag still moves further');
    assert.ok(rubberBand(5, 0, 4) > 4 && rubberBand(5, 0, 4) < 5);
  });
});

describe('snapTarget', () => {
  it('snaps to the nearest page without a fling', () => {
    assert.equal(snapTarget(2, 2.4, 0, 5, false), 2);
    assert.equal(snapTarget(2, 2.6, 0, 5, false), 3);
  });
  it('moves one page in the fling direction', () => {
    assert.equal(snapTarget(2, 2.1, 2, 5, false), 3);
    assert.equal(snapTarget(2, 1.9, -2, 5, false), 1);
  });
  it('never moves more than one page per swipe', () => {
    assert.equal(snapTarget(2, 4.2, 0, 10, false), 3);
    assert.equal(snapTarget(2, -1, -5, 10, true), 1);
  });
  it('stops at the ends without loop', () => {
    assert.equal(snapTarget(4, 4.3, 3, 5, false), 4);
    assert.equal(snapTarget(0, -0.3, -3, 5, false), 0);
  });
  it('continues past the ends with loop', () => {
    assert.equal(snapTarget(4, 4.3, 3, 5, true), 5);
    assert.equal(snapTarget(0, -0.3, -3, 5, true), -1);
  });
});

describe('pageWindow', () => {
  it('stays inside the data without loop', () => {
    assert.deepEqual(pageWindow(0, 2, 5, false), [0, 1, 2]);
    assert.deepEqual(pageWindow(4, 1, 5, false), [3, 4]);
  });
  it('extends past the ends with loop', () => {
    assert.deepEqual(pageWindow(0, 1, 5, true), [-1, 0, 1]);
  });
  it('is empty without data', () => {
    assert.deepEqual(pageWindow(0, 2, 0, true), []);
  });
});

describe('nearestVirtual', () => {
  it('clamps without loop', () => {
    assert.equal(nearestVirtual(9, 2, 5, false), 4);
    assert.equal(nearestVirtual(1, 3, 5, false), 1);
  });
  it('goes the short way with loop', () => {
    assert.equal(nearestVirtual(0, 4, 5, true), 5); // last → first: one step forward
    assert.equal(nearestVirtual(4, 5, 5, true), 4); // first (virtual 5) → last: one step back
    assert.equal(nearestVirtual(2, 12, 5, true), 12);
    assert.equal(nearestVirtual(3, -1, 5, true), -2);
  });
});
