import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ImageCache,
  DEFAULT_CACHE_OPTIONS,
  type CacheStore,
  type FetchResult,
} from '../src/cache/ImageCache.ts';
import {
  decide,
  evict,
  extensionFor,
  hashKey,
  parseCacheHeaders,
  type CacheEntry,
} from '../src/cache/policy.ts';

const MIN = 60_000;

function entry(partial: Partial<CacheEntry>): CacheEntry {
  return {
    key: 'k',
    url: 'https://x/a.png',
    file: 'f',
    size: 10,
    fetchedAt: 0,
    expiresAt: 10 * MIN,
    lastUsed: 0,
    ...partial,
  };
}

describe('decide', () => {
  const swr = { strategy: 'stale-while-revalidate' as const, maxStale: 60 * MIN };
  it('fetches when nothing is cached', () => {
    assert.equal(decide(undefined, 0, swr), 'fetch');
  });
  it('uses a fresh entry with every strategy except network-first', () => {
    const e = entry({});
    assert.equal(decide(e, MIN, swr), 'use');
    assert.equal(decide(e, MIN, { ...swr, strategy: 'cache-first' }), 'use');
    assert.equal(decide(e, MIN, { ...swr, strategy: 'network-first' }), 'fetch');
  });
  it('stale-while-revalidate shows a stale entry and refreshes it', () => {
    assert.equal(decide(entry({}), 20 * MIN, swr), 'use-and-revalidate');
  });
  it('stale-while-revalidate waits for the network past maxStale', () => {
    assert.equal(decide(entry({}), 80 * MIN, swr), 'fetch');
  });
  it('cache-first waits for the network once expired', () => {
    assert.equal(decide(entry({}), 20 * MIN, { ...swr, strategy: 'cache-first' }), 'fetch');
  });
});

describe('parseCacheHeaders', () => {
  it('reads max-age, ETag and Last-Modified case-insensitively', () => {
    const h = parseCacheHeaders(
      {
        'Cache-Control': 'public, max-age=60',
        ETag: '"v1"',
        'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
      },
      0,
    );
    assert.equal(h.maxAge, 60_000);
    assert.equal(h.etag, '"v1"');
    assert.equal(h.lastModified, 'Mon, 01 Jan 2024 00:00:00 GMT');
    assert.equal(h.noStore, false);
  });
  it('treats no-cache as immediately stale and flags no-store', () => {
    assert.equal(parseCacheHeaders({ 'cache-control': 'no-cache' }, 0).maxAge, 0);
    assert.equal(parseCacheHeaders({ 'cache-control': 'no-store' }, 0).noStore, true);
  });
  it('falls back to Expires, and an invalid date means expired', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    assert.equal(parseCacheHeaders({ expires: 'Thu, 01 Jan 2026 00:05:00 GMT' }, now).maxAge, 5 * MIN);
    assert.equal(parseCacheHeaders({ expires: '0' }, now).maxAge, 0);
  });
  it('returns undefined when the server says nothing', () => {
    assert.equal(parseCacheHeaders({}, 0).maxAge, undefined);
  });
});

describe('evict', () => {
  it('removes least recently used entries until both limits hold', () => {
    const list = [
      entry({ key: 'a', size: 40, lastUsed: 3 }),
      entry({ key: 'b', size: 40, lastUsed: 1 }),
      entry({ key: 'c', size: 40, lastUsed: 2 }),
    ];
    assert.deepEqual(
      evict(list, 80, 10).map((e) => e.key),
      ['b'],
    );
    assert.deepEqual(
      evict(list, 1000, 1).map((e) => e.key),
      ['b', 'c'],
    );
    assert.deepEqual(evict(list, 1000, 10), []);
  });
});

describe('helpers', () => {
  it('hashKey is stable and differs per input', () => {
    assert.equal(hashKey('a'), hashKey('a'));
    assert.notEqual(hashKey('a'), hashKey('b'));
    assert.match(hashKey('https://x/y.png'), /^[0-9a-f]{16}$/);
  });
  it('extensionFor prefers the content type, then the URL', () => {
    assert.equal(extensionFor('https://x/a', 'image/jpeg; charset=binary'), 'jpg');
    assert.equal(extensionFor('https://x/a.webp?w=2'), 'webp');
    assert.equal(extensionFor('https://x/a'), 'img');
  });
});

/* --- ImageCache with a fake store, fake server and fake clock -------------- */

function setup(serve: (url: string, headers: Record<string, string>) => FetchResult) {
  const files = new Map<string, Uint8Array>();
  let index: CacheEntry[] = [];
  const store: CacheStore = {
    load: async () => index,
    saveIndex: async (e) => {
      index = e.map((x) => ({ ...x }));
    },
    write: async (f, b) => {
      files.set(f, b);
    },
    remove: async (f) => {
      files.delete(f);
    },
    displayUri: async (f) => `file:///cache/${f}`,
    clear: async () => {
      files.clear();
      index = [];
    },
  };
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const clock = { t: 1_000_000 };
  const cache = new ImageCache(
    store,
    async (url, headers) => {
      requests.push({ url, headers });
      return serve(url, headers);
    },
    { maxSize: 1000, maxEntries: 10 },
    () => clock.t,
  );
  return { cache, files, requests, clock };
}

const png = (n: number) => new Uint8Array([137, 80, 78, 71, n]);

describe('ImageCache', () => {
  it('downloads once, then serves from the cache while fresh', async () => {
    const { cache, requests } = setup(() => ({
      status: 200,
      headers: { 'content-type': 'image/png' },
      bytes: png(1),
    }));
    const opts = { ...DEFAULT_CACHE_OPTIONS, maxAge: 10 * MIN };
    const a = await cache.load('https://x/a', opts);
    const b = await cache.load('https://x/a', opts);
    assert.match(a, /^file:\/\/\/cache\/[0-9a-f]{16}-.+\.png$/);
    assert.equal(a, b);
    assert.equal(requests.length, 1);
    assert.equal(cache.stats().hits, 1);
    assert.equal(cache.stats().misses, 1);
    assert.equal(cache.peek('https://x/a', opts), a);
  });

  it('stale-while-revalidate returns the stale file and revalidates with ETag (304)', async () => {
    const { cache, requests, clock } = setup((_, h) =>
      h['If-None-Match'] === '"v1"'
        ? { status: 304, headers: {} }
        : { status: 200, headers: { etag: '"v1"', 'cache-control': 'max-age=60' }, bytes: png(1) },
    );
    const opts = DEFAULT_CACHE_OPTIONS;
    const first = await cache.load('https://x/a', opts);
    clock.t += 2 * MIN; // past the server's 60 s
    const second = await cache.load('https://x/a', opts);
    assert.equal(second, first, 'stale file shown immediately');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(requests.length, 2);
    assert.equal(requests[1].headers['If-None-Match'], '"v1"');
    assert.equal(cache.stats().notModified, 1);
    assert.equal(cache.getEntry('https://x/a')?.expiresAt, clock.t + 60_000, 'expiry renewed');
  });

  it('notifies subscribers with a new URI when the content changed', async () => {
    let version = 1;
    const { cache, clock } = setup(() => ({
      status: 200,
      headers: { etag: `"v${version}"`, 'cache-control': 'max-age=1' },
      bytes: png(version),
    }));
    const opts = DEFAULT_CACHE_OPTIONS;
    const first = await cache.load('https://x/a', opts);
    const updates: string[] = [];
    cache.subscribe('https://x/a', opts, (uri) => updates.push(uri));
    version = 2;
    clock.t += 5_000;
    await cache.load('https://x/a', opts);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(updates.length, 1);
    assert.notEqual(updates[0], first);
    assert.equal(cache.stats().updates, 1);
  });

  it('cache-first falls back to the stale copy when offline', async () => {
    let online = true;
    const { cache, clock } = setup(() => {
      if (!online) throw new Error('offline');
      return { status: 200, headers: {}, bytes: png(1) };
    });
    const opts = { ...DEFAULT_CACHE_OPTIONS, strategy: 'cache-first' as const, maxAge: MIN };
    const first = await cache.load('https://x/a', opts);
    online = false;
    clock.t += 5 * MIN;
    assert.equal(await cache.load('https://x/a', opts), first);
    assert.equal(cache.stats().errors, 1);
  });

  it('rejects when nothing is cached and the network fails', async () => {
    const { cache } = setup(() => {
      throw new Error('offline');
    });
    await assert.rejects(cache.load('https://x/a'));
  });

  it('respects no-store by returning the remote URL without writing', async () => {
    const { cache, files } = setup(() => ({
      status: 200,
      headers: { 'cache-control': 'no-store' },
      bytes: png(1),
    }));
    assert.equal(await cache.load('https://x/a'), 'https://x/a');
    assert.equal(files.size, 0);
  });

  it('uses getCacheKey so signed URLs share one entry', async () => {
    const { cache, requests } = setup(() => ({ status: 200, headers: {}, bytes: png(1) }));
    const opts = { ...DEFAULT_CACHE_OPTIONS, getCacheKey: (u: string) => u.split('?')[0] };
    await cache.load('https://x/a.png?sig=1', opts);
    await cache.load('https://x/a.png?sig=2', opts);
    assert.equal(requests.length, 1);
  });

  it('shares one request between concurrent loads', async () => {
    const { cache, requests } = setup(() => ({ status: 200, headers: {}, bytes: png(1) }));
    const [a, b] = await Promise.all([cache.load('https://x/a'), cache.load('https://x/a')]);
    assert.equal(a, b);
    assert.equal(requests.length, 1);
    assert.equal(cache.stats().misses, 1, 'one download counted, not one per lookup');
  });

  it('evicts least recently used files beyond maxEntries', async () => {
    const { cache, files, clock } = setup((url) => ({ status: 200, headers: {}, bytes: png(url.length) }));
    cache.setLimits({ maxEntries: 2 });
    await cache.load('https://x/1');
    clock.t += 1;
    await cache.load('https://x/22');
    clock.t += 1;
    await cache.load('https://x/333');
    assert.equal(files.size, 2);
    assert.equal(cache.getEntry('https://x/1'), undefined);
  });

  it('keeps the same file when a refetch returns identical bytes without validators', async () => {
    const { cache, clock } = setup(() => ({
      status: 200,
      headers: { 'cache-control': 'max-age=1' },
      bytes: png(7),
    }));
    const first = await cache.load('https://x/a', { ...DEFAULT_CACHE_OPTIONS, strategy: 'network-first' });
    clock.t += 5_000;
    const second = await cache.load('https://x/a', { ...DEFAULT_CACHE_OPTIONS, strategy: 'network-first' });
    assert.equal(second, first);
    assert.equal(cache.stats().updates, 0);
  });
});
