/**
 * Image cache with expiry. Platform-independent: storage and networking are
 * injected (`CacheStore`, `Fetcher`), which keeps this class testable in Node
 * and lets native (expo-file-system) and web (Cache Storage) share the logic.
 *
 * - Every remote image is stored once per cache key, with the time it was
 *   fetched and when it expires (from `maxAge`, or the server's
 *   `Cache-Control` / `Expires` headers).
 * - A lookup returns a URI the image components can show (a `file://` path on
 *   native, a `blob:` URL on web) according to the strategy, and may refetch
 *   in the background.
 * - Refetches are conditional (`If-None-Match`, `If-Modified-Since`), so an
 *   unchanged image costs a 304 with no body.
 * - When the content does change, it is written under a new file name and
 *   subscribers get the new URI; image views reload because their URI changed.
 * - The total size and entry count are capped; the least recently used
 *   entries are deleted first.
 */
import {
  decide,
  evict,
  extensionFor,
  hashKey,
  parseCacheHeaders,
  type CacheEntry,
  type CacheStrategy,
} from './policy';
import { Scheduler, type LoadPriority } from './scheduler';

export type CacheStore = {
  /** Entries persisted by a previous session. */
  load(): Promise<CacheEntry[]>;
  saveIndex(entries: CacheEntry[]): Promise<void>;
  write(file: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  remove(file: string): Promise<void>;
  /** URI an `<Image>` or Skia can load for a stored file. */
  displayUri(file: string): Promise<string>;
  clear(): Promise<void>;
};

export type FetchResult = {
  status: number;
  headers: Record<string, string>;
  bytes?: Uint8Array;
};
export type Fetcher = (url: string, headers: Record<string, string>) => Promise<FetchResult>;

export type ImageCacheOptions = {
  /** Default `stale-while-revalidate`. */
  strategy?: CacheStrategy;
  /** How long a downloaded image stays fresh, in ms. Default 24 hours. */
  maxAge?: number;
  /**
   * With `stale-while-revalidate`, how long after expiry a stale image may
   * still be shown while the new one loads. Older entries wait for the
   * network like `cache-first`. Default 7 days.
   */
  maxStale?: number;
  /**
   * Use the server's `Cache-Control` / `Expires` lifetime when it sends one,
   * and skip the disk for `no-store`. Default true.
   */
  respectHttpHeaders?: boolean;
  /** Headers for every request, such as `Authorization`. */
  headers?: Record<string, string>;
  /**
   * Cache key for a URL. Use it for signed URLs whose query string changes on
   * every request: `(url) => url.split('?')[0]`.
   */
  getCacheKey?: (url: string) => string;
};

export type ResolvedCacheOptions = Required<Omit<ImageCacheOptions, 'getCacheKey' | 'headers'>> &
  Pick<ImageCacheOptions, 'getCacheKey' | 'headers'>;

export const DEFAULT_CACHE_OPTIONS: ResolvedCacheOptions = {
  strategy: 'stale-while-revalidate',
  maxAge: 24 * 60 * 60 * 1000,
  maxStale: 7 * 24 * 60 * 60 * 1000,
  respectHttpHeaders: true,
};

export type ImageCacheStats = {
  /** Lookups answered from the cache. */
  hits: number;
  /** Lookups that had to download. */
  misses: number;
  /** Background or blocking refetches of an existing entry. */
  revalidations: number;
  /** Refetches the server answered with 304 Not Modified. */
  notModified: number;
  /** Refetches that brought new content. */
  updates: number;
  errors: number;
  entries: number;
  /** Bytes on disk. */
  size: number;
  /** Downloads running now. */
  active: number;
  /** Downloads waiting for a free slot. */
  queued: number;
};

export type ImageCacheLimits = {
  /** Default 100 MB. */
  maxSize?: number;
  /** Default 500. */
  maxEntries?: number;
  /** Downloads at the same time; the rest wait, highest priority first. Default 4. */
  maxConcurrent?: number;
};

type Listener = (uri: string) => void;

export class ImageCache {
  private entries = new Map<string, CacheEntry & { contentHash?: string }>();
  private uris = new Map<string, string>();
  private inflight = new Map<string, Promise<CacheEntry | null>>();
  private listeners = new Map<string, Set<Listener>>();
  private statListeners = new Set<() => void>();
  private counters = { hits: 0, misses: 0, revalidations: 0, notModified: 0, updates: 0, errors: 0 };
  private ready: Promise<void>;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private maxSize: number;
  private maxEntries: number;
  private store: CacheStore;
  private fetcher: Fetcher;
  private now: () => number;
  private scheduler: Scheduler;

  constructor(
    store: CacheStore,
    fetcher: Fetcher,
    limits: ImageCacheLimits = {},
    now: () => number = Date.now,
  ) {
    this.store = store;
    this.fetcher = fetcher;
    this.now = now;
    this.maxSize = limits.maxSize ?? 100 * 1024 * 1024;
    this.maxEntries = limits.maxEntries ?? 500;
    this.scheduler = new Scheduler(limits.maxConcurrent ?? 4, () => this.emitStats());
    this.ready = store.load().then(
      (list) => {
        for (const e of list) this.entries.set(e.key, e);
      },
      () => {},
    );
  }

  setLimits(limits: ImageCacheLimits) {
    if (limits.maxSize !== undefined) this.maxSize = limits.maxSize;
    if (limits.maxEntries !== undefined) this.maxEntries = limits.maxEntries;
    if (limits.maxConcurrent !== undefined) this.scheduler.setLimit(limits.maxConcurrent);
    void this.enforceLimits();
  }

  /**
   * Synchronous lookup for the first render: the display URI if the image is
   * cached, already opened this session, and the strategy would show it.
   */
  peek(url: string, options: ResolvedCacheOptions = DEFAULT_CACHE_OPTIONS): string | null {
    const entry = this.entries.get(this.keyOf(url, options));
    if (!entry) return null;
    if (decide(entry, this.now(), options) === 'fetch') return null;
    return this.uris.get(entry.file) ?? null;
  }

  /**
   * The URI to display for `url`. Rejects only when the image is neither
   * cached nor downloadable; callers then fall back to the remote URL.
   */
  async load(
    url: string,
    options: ResolvedCacheOptions = DEFAULT_CACHE_OPTIONS,
    priority: LoadPriority = 'normal',
  ): Promise<string> {
    await this.ready;
    const key = this.keyOf(url, options);
    const entry = this.entries.get(key);
    const decision = decide(entry, this.now(), options);

    if (entry && decision !== 'fetch') {
      this.counters.hits++;
      entry.lastUsed = this.now();
      this.scheduleSave();
      if (decision === 'use-and-revalidate') {
        // Background revalidation never competes with images being shown.
        void this.refresh(url, key, options, entry, 'low').catch(() => {});
      }
      this.emitStats();
      return this.uriOf(entry);
    }

    // Counted in `download` (miss or revalidation), once per actual request:
    // concurrent lookups of one URL share a request.
    try {
      const fresh = await this.refresh(url, key, options, entry, priority);
      return fresh ? await this.uriOf(fresh) : url;
    } catch (error) {
      // Offline or server error: a stale copy beats nothing.
      if (entry) return this.uriOf(entry);
      throw error;
    } finally {
      this.emitStats();
    }
  }

  /** Resolves when a refetch in progress for `url` (if any) has finished. Never rejects. */
  async settled(url: string, options: Pick<ImageCacheOptions, 'getCacheKey'> = {}): Promise<void> {
    await this.inflight.get(this.keyOf(url, options))?.catch(() => null);
  }

  /** Called with the new display URI when a refetch brings new content. */
  subscribe(url: string, options: ResolvedCacheOptions, listener: Listener): () => void {
    const key = this.keyOf(url, options);
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  /** Download (or revalidate) images ahead of time. Failures are ignored. */
  async prefetch(
    urls: string[],
    options: ImageCacheOptions = {},
    priority: LoadPriority = 'low',
  ): Promise<{ loaded: number; failed: number }> {
    const resolved = { ...DEFAULT_CACHE_OPTIONS, ...options };
    const results = await Promise.all(
      urls.map((u) =>
        this.load(u, resolved, priority).then(
          () => true,
          () => false,
        ),
      ),
    );
    const loaded = results.filter(Boolean).length;
    return { loaded, failed: results.length - loaded };
  }

  /**
   * Raise the priority of a download that is still waiting for a slot, for
   * example when the user swipes to its page. No effect once it runs.
   */
  prioritize(url: string, options: Pick<ImageCacheOptions, 'getCacheKey'>, priority: LoadPriority) {
    this.scheduler.bump(this.keyOf(url, options), priority);
  }

  /** Fetch time and expiry of a cached URL, for debugging and UI. */
  getEntry(url: string, options: ImageCacheOptions = {}): Readonly<CacheEntry> | undefined {
    return this.entries.get(this.keyOf(url, { ...DEFAULT_CACHE_OPTIONS, ...options }));
  }

  async remove(url: string, options: ImageCacheOptions = {}): Promise<void> {
    await this.ready;
    const key = this.keyOf(url, { ...DEFAULT_CACHE_OPTIONS, ...options });
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.uris.delete(entry.file);
    await this.store.remove(entry.file).catch(() => {});
    this.scheduleSave();
    this.emitStats();
  }

  async clear(): Promise<void> {
    await this.ready;
    this.entries.clear();
    this.uris.clear();
    this.counters = { hits: 0, misses: 0, revalidations: 0, notModified: 0, updates: 0, errors: 0 };
    await this.store.clear().catch(() => {});
    this.emitStats();
  }

  stats(): ImageCacheStats {
    let size = 0;
    for (const e of this.entries.values()) size += e.size;
    return { ...this.counters, entries: this.entries.size, size, ...this.scheduler.counts() };
  }

  onStats(listener: () => void): () => void {
    this.statListeners.add(listener);
    return () => {
      this.statListeners.delete(listener);
    };
  }

  /** Resolves when pending index writes are done (tests, app shutdown). */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.store.saveIndex([...this.entries.values()]).catch(() => {});
  }

  /* --- internals ------------------------------------------------------- */

  private keyOf(url: string, options: Pick<ImageCacheOptions, 'getCacheKey'>) {
    return options.getCacheKey ? options.getCacheKey(url) : url;
  }

  private async uriOf(entry: CacheEntry): Promise<string> {
    const known = this.uris.get(entry.file);
    if (known) return known;
    const uri = await this.store.displayUri(entry.file);
    this.uris.set(entry.file, uri);
    return uri;
  }

  /** One request per key at a time; concurrent callers share it. */
  private refresh(
    url: string,
    key: string,
    options: ResolvedCacheOptions,
    previous: CacheEntry | undefined,
    priority: LoadPriority,
  ): Promise<CacheEntry | null> {
    const running = this.inflight.get(key);
    if (running) {
      // Someone needs it sooner now: move it up the queue.
      this.scheduler.bump(key, priority);
      return running;
    }
    const task = this.download(url, key, options, previous, priority).finally(() =>
      this.inflight.delete(key),
    );
    this.inflight.set(key, task);
    return task;
  }

  private async download(
    url: string,
    key: string,
    options: ResolvedCacheOptions,
    previous: (CacheEntry & { contentHash?: string }) | undefined,
    priority: LoadPriority,
  ): Promise<CacheEntry | null> {
    const headers: Record<string, string> = { ...options.headers };
    if (previous?.etag) headers['If-None-Match'] = previous.etag;
    if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;
    if (previous) this.counters.revalidations++;
    else this.counters.misses++;

    let res: FetchResult;
    try {
      res = await this.scheduler.run(key, priority, () => this.fetcher(url, headers));
    } catch (error) {
      this.counters.errors++;
      this.emitStats();
      throw error;
    }
    const now = this.now();
    const http = parseCacheHeaders(res.headers, now);
    const ttl = options.respectHttpHeaders && http.maxAge !== undefined ? http.maxAge : options.maxAge;

    if (res.status === 304 && previous) {
      this.counters.notModified++;
      // A 304 often omits Cache-Control; keep the lifetime the entry had.
      const lifetime =
        options.respectHttpHeaders && http.maxAge === undefined
          ? previous.expiresAt - previous.fetchedAt
          : ttl;
      previous.fetchedAt = now;
      previous.expiresAt = now + lifetime;
      previous.lastUsed = now;
      previous.etag = http.etag ?? previous.etag;
      previous.lastModified = http.lastModified ?? previous.lastModified;
      this.scheduleSave();
      this.emitStats();
      return previous;
    }
    if (res.status < 200 || res.status >= 300 || !res.bytes) {
      this.counters.errors++;
      this.emitStats();
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    if (options.respectHttpHeaders && http.noStore) {
      // The server forbids storing it: show the remote URL directly.
      return null;
    }

    const contentHash = hashBytes(res.bytes);
    if (previous && previous.contentHash === contentHash) {
      // Same bytes without validators: keep the file (and its URI) as is.
      previous.fetchedAt = now;
      previous.expiresAt = now + ttl;
      previous.lastUsed = now;
      this.counters.notModified++;
      this.scheduleSave();
      this.emitStats();
      return previous;
    }

    const contentType = findHeader(res.headers, 'content-type');
    const file = `${hashKey(key)}-${now.toString(36)}.${extensionFor(url, contentType)}`;
    await this.store.write(file, res.bytes, contentType);
    const entry = {
      key,
      url,
      file,
      size: res.bytes.byteLength,
      fetchedAt: now,
      expiresAt: now + ttl,
      lastUsed: now,
      etag: http.etag,
      lastModified: http.lastModified,
      contentType,
      contentHash,
    };
    const old = this.entries.get(key);
    this.entries.set(key, entry);
    if (old && old.file !== file) {
      this.uris.delete(old.file);
      void this.store.remove(old.file).catch(() => {});
    }
    await this.enforceLimits(key);
    this.scheduleSave();

    if (previous) {
      this.counters.updates++;
      const set = this.listeners.get(key);
      if (set?.size) {
        const uri = await this.uriOf(entry);
        for (const l of set) l(uri);
      }
    }
    this.emitStats();
    return entry;
  }

  private async enforceLimits(keep?: string) {
    const candidates = [...this.entries.values()].filter((e) => e.key !== keep);
    const keepEntry = keep ? this.entries.get(keep) : undefined;
    const reserved = keepEntry ? keepEntry.size : 0;
    const victims = evict(candidates, this.maxSize - reserved, this.maxEntries - (keepEntry ? 1 : 0));
    for (const v of victims) {
      this.entries.delete(v.key);
      this.uris.delete(v.file);
      await this.store.remove(v.file).catch(() => {});
    }
    if (victims.length) this.scheduleSave();
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.store.saveIndex([...this.entries.values()]).catch(() => {});
    }, 500);
  }

  private emitStats() {
    for (const l of this.statListeners) l();
  }
}

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  for (const k of Object.keys(headers)) if (k.toLowerCase() === name) return headers[k];
  return undefined;
}

/** FNV-1a over the bytes: detects identical content when the server sends no validators. */
function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  // Sampling keeps this cheap for large photos; length is mixed in as well.
  const step = Math.max(1, Math.floor(bytes.length / 65536));
  for (let i = 0; i < bytes.length; i += step) h = Math.imul(h ^ bytes[i], 0x01000193);
  return `${(h >>> 0).toString(16)}-${bytes.length}`;
}
