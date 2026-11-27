import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDecodeQueue } from '../src/liquid/decodeQueue.ts';

/** A queue whose loads resolve immediately and whose frames run on demand. */
function setup(opts: { failLoad?: string[]; failDecode?: string[] } = {}) {
  const frames: (() => void)[] = [];
  const decoded: string[] = [];
  const queue = createDecodeQueue<string, string>({
    load: (key) => (opts.failLoad?.includes(key) ? Promise.reject(new Error('x')) : Promise.resolve(key)),
    decode: (data) => {
      decoded.push(data);
      if (opts.failDecode?.includes(data)) throw new Error('bad image');
      return `img:${data}`;
    },
    schedule: (fn) => frames.push(fn),
  });
  const flushLoads = () => new Promise((r) => setImmediate(r));
  const frame = () => {
    const fn = frames.shift();
    fn?.();
    return !!fn;
  };
  return { queue, decoded, frames, frame, flushLoads };
}

describe('decode queue', () => {
  it('decodes one image per frame, most urgent first', async () => {
    const { queue, decoded, frame, flushLoads } = setup();
    const got: string[] = [];
    queue.request('far', 'low', (i) => got.push(i));
    queue.request('next', 'normal', (i) => got.push(i));
    queue.request('current', 'high', (i) => got.push(i));
    await flushLoads();
    assert.deepEqual(decoded, []); // nothing decoded before a frame
    frame();
    assert.deepEqual(decoded, ['current']);
    frame();
    frame();
    assert.deepEqual(decoded, ['current', 'next', 'far']);
    assert.deepEqual(got, ['img:current', 'img:next', 'img:far']);
    assert.equal(frame(), false); // idle: no frame requested
  });

  it('keeps request order within a priority', async () => {
    const { queue, decoded, frame, flushLoads } = setup();
    for (const k of ['a', 'b', 'c']) queue.request(k, 'normal', () => {});
    await flushLoads();
    while (frame());
    assert.deepEqual(decoded, ['a', 'b', 'c']);
  });

  it('drops a request nobody waits for', async () => {
    const { queue, decoded, frame, flushLoads } = setup();
    const a = queue.request('a', 'high', () => {});
    queue.request('b', 'low', () => {});
    a.cancel();
    await flushLoads();
    while (frame());
    assert.deepEqual(decoded, ['b']);
    assert.equal(queue.size, 0);
  });

  it('shares one decode between requests for the same image', async () => {
    const { queue, decoded, frame, flushLoads } = setup();
    const got: string[] = [];
    const first = queue.request('a', 'low', (i) => got.push(`1:${i}`));
    queue.request('a', 'low', (i) => got.push(`2:${i}`));
    first.cancel(); // the other one still waits
    await flushLoads();
    while (frame());
    assert.deepEqual(decoded, ['a']);
    assert.deepEqual(got, ['2:img:a']);
  });

  it('follows priority changes', async () => {
    const { queue, decoded, frame, flushLoads } = setup();
    queue.request('a', 'normal', () => {});
    const b = queue.request('b', 'low', () => {});
    b.setPriority('high'); // the user swiped to b
    await flushLoads();
    frame();
    assert.deepEqual(decoded, ['b']);
  });

  it('survives failed loads and decodes', async () => {
    const { queue, decoded, frame, flushLoads } = setup({ failLoad: ['x'], failDecode: ['y'] });
    const got: string[] = [];
    queue.request('x', 'high', (i) => got.push(i));
    queue.request('y', 'high', (i) => got.push(i));
    queue.request('z', 'low', (i) => got.push(i));
    await flushLoads();
    while (frame());
    assert.deepEqual(decoded, ['y', 'z']);
    assert.deepEqual(got, ['img:z']);
    assert.equal(queue.size, 0);
  });
});
