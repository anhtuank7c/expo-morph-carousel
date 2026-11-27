import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  sameSource,
  makeTarget,
  normalizeSource,
  pickCandidate,
  requiredWidth,
  shouldSwitch,
  stepUp,
} from '../src/responsive.ts';

const set = [
  { uri: 'a-480', width: 480, height: 360 },
  { uri: 'a-1080', width: 1080, height: 810 },
  { uri: 'a-1920', width: 1920, height: 1440 },
];

describe('normalizeSource', () => {
  it('keeps bundled assets', () => {
    assert.deepEqual(normalizeSource(7), { kind: 'bundled', asset: 7 });
  });
  it('turns a single uri into one candidate of unknown width', () => {
    const n = normalizeSource({ uri: 'https://x/a.jpg' });
    assert.equal(n.kind, 'uri');
    assert.equal(n.kind === 'uri' && n.candidates[0].width, Number.POSITIVE_INFINITY);
  });
  it('turns an array with widths into a srcset', () => {
    const n = normalizeSource(set);
    assert.equal(n.kind === 'uri' && n.candidates.length, 3);
  });
  it('ignores entries without uri', () => {
    assert.deepEqual(normalizeSource([{ width: 10 }]), { kind: 'none' });
    assert.deepEqual(normalizeSource(null), { kind: 'none' });
  });
});

describe('requiredWidth', () => {
  const area = { width: 360, height: 240 };
  it('multiplies by the pixel ratio', () => {
    assert.equal(requiredWidth(area, 3, 'contain'), 1080);
  });
  it('contain: a tall image needs less than the area width', () => {
    // 1:2 portrait image in a 360×240 area at 3x: limited by height → 240·3·0.5
    assert.equal(requiredWidth(area, 3, 'contain', 0.5), 360);
  });
  it('cover: a tall area needs more width than it has', () => {
    // 4:3 image covering a 360×640 portrait area at 2x → 640·2·4/3
    assert.equal(Math.round(requiredWidth({ width: 360, height: 640 }, 2, 'cover', 4 / 3)), 1707);
  });
});

describe('pickCandidate', () => {
  it('picks the smallest candidate that is wide enough', () => {
    assert.equal(pickCandidate(set, 900)?.uri, 'a-1080');
    assert.equal(pickCandidate(set, 100)?.uri, 'a-480');
  });
  it('falls back to the largest when none is wide enough', () => {
    assert.equal(pickCandidate(set, 5000)?.uri, 'a-1920');
  });
  it('prefers a cached candidate that is not oversized', () => {
    assert.equal(pickCandidate(set, 1000, (u) => u === 'a-1920')?.uri, 'a-1920');
    assert.equal(
      pickCandidate(set, 900, (u) => u === 'a-1920')?.uri,
      'a-1080',
      '1920 is more than 2x of 900',
    );
    assert.equal(pickCandidate(set, 400, (u) => u === 'a-1920')?.uri, 'a-480', '1920 is more than 2x of 400');
  });
  it('returns undefined without candidates', () => {
    assert.equal(pickCandidate([], 100), undefined);
  });
});

describe('shouldSwitch', () => {
  it('switches to a sharper image only', () => {
    assert.equal(shouldSwitch(null, set[0]), true);
    assert.equal(shouldSwitch({ uri: 'a-480', width: 480 }, set[1]), true);
    assert.equal(shouldSwitch({ uri: 'a-1080', width: 1080 }, set[0]), false, 'no downgrade after rotation');
    assert.equal(shouldSwitch({ uri: 'a-1080', width: 1080 }, set[1]), false);
    assert.equal(
      shouldSwitch({ uri: 'old-1080', width: 1080 }, set[1]),
      true,
      'a different URL at the same size is new content',
    );
  });
});

describe('stepUp and makeTarget', () => {
  it('rounds widths up to a few steps', () => {
    assert.equal(stepUp(1000), 1080);
    assert.equal(stepUp(1081), 1200);
    assert.equal(stepUp(5000), 5120);
  });
  it('builds a target from the area, pixel ratio and fit', () => {
    const t = makeTarget({ width: 360, height: 270 }, 3, 'contain');
    assert.equal(t.width, 1080);
    assert.equal(t.height, 810);
    assert.equal(makeTarget({ width: 360, height: 640 }, 2, 'cover').width, 1440);
  });
});

describe('sameSource', () => {
  it('compares candidates by value', () => {
    const a = normalizeSource([
      { uri: 'a', width: 640 },
      { uri: 'b', width: 1280 },
    ]);
    const b = normalizeSource([
      { uri: 'a', width: 640 },
      { uri: 'b', width: 1280 },
    ]);
    assert.equal(sameSource(a, b), true);
    assert.equal(sameSource(a, normalizeSource([{ uri: 'a', width: 640 }])), false);
    assert.equal(
      sameSource(
        a,
        normalizeSource([
          { uri: 'a', width: 640 },
          { uri: 'c', width: 1280 },
        ]),
      ),
      false,
    );
  });
  it('handles bundled and missing sources', () => {
    assert.equal(sameSource(normalizeSource(3), normalizeSource(3)), true);
    assert.equal(sameSource(normalizeSource(3), normalizeSource(4)), false);
    assert.equal(sameSource(normalizeSource(null), normalizeSource(undefined)), true);
    assert.equal(sameSource(normalizeSource(3), normalizeSource({ uri: 'x' })), false);
  });
});
