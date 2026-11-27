import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Scheduler } from '../src/cache/scheduler.ts';

/** A task that resolves when `release()` is called, recording when it started. */
function gate(log: string[], name: string) {
  let release!: () => void;
  const done = new Promise<void>((r) => (release = r));
  return {
    task: () => {
      log.push(name);
      return done;
    },
    release: () => release(),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Scheduler', () => {
  it('never runs more than the limit at once', async () => {
    const log: string[] = [];
    const s = new Scheduler(2);
    const g = ['a', 'b', 'c'].map((n) => gate(log, n));
    const all = g.map((x, i) => s.run(String(i), 'normal', x.task));
    assert.deepEqual(log, ['a', 'b']);
    assert.deepEqual(s.counts(), { active: 2, queued: 1 });
    g[0].release();
    await tick();
    assert.deepEqual(log, ['a', 'b', 'c']);
    g[1].release();
    g[2].release();
    await Promise.all(all);
    assert.deepEqual(s.counts(), { active: 0, queued: 0 });
  });

  it('starts higher priority first, then in arrival order', async () => {
    const log: string[] = [];
    const s = new Scheduler(1);
    const first = gate(log, 'busy');
    const p0 = s.run('busy', 'low', first.task);
    const jobs = [
      ['low-1', 'low'],
      ['normal-1', 'normal'],
      ['high-1', 'high'],
      ['normal-2', 'normal'],
    ] as const;
    const gates = jobs.map(([n]) => gate(log, n));
    const ps = jobs.map(([n, p], i) => s.run(n, p, gates[i].task));
    first.release();
    for (const g of gates) {
      await tick();
      g.release();
    }
    await Promise.all([p0, ...ps]);
    assert.deepEqual(log, ['busy', 'high-1', 'normal-1', 'normal-2', 'low-1']);
  });

  it('bump raises a queued job', async () => {
    const log: string[] = [];
    const s = new Scheduler(1);
    const first = gate(log, 'busy');
    const p0 = s.run('busy', 'high', first.task);
    const a = gate(log, 'a');
    const b = gate(log, 'b');
    const pa = s.run('a', 'normal', a.task);
    const pb = s.run('b', 'low', b.task);
    s.bump('b', 'high'); // the user swiped to b's page
    s.bump('a', 'low'); // never lowers
    first.release();
    await tick();
    b.release();
    await tick();
    a.release();
    await Promise.all([p0, pa, pb]);
    assert.deepEqual(log, ['busy', 'b', 'a']);
  });

  it('passes results and errors through', async () => {
    const s = new Scheduler(1);
    assert.equal(await s.run('x', 'normal', async () => 42), 42);
    await assert.rejects(
      s.run('y', 'normal', async () => {
        throw new Error('boom');
      }),
      /boom/,
    );
    assert.deepEqual(s.counts(), { active: 0, queued: 0 });
  });
});
