/**
 * The shared image cache, the hooks the carousel and apps use, and the public
 * `imageCache` API.
 */
import { useEffect, useRef, useState } from 'react';

import {
  DEFAULT_CACHE_OPTIONS,
  ImageCache,
  type FetchResult,
  type ImageCacheLimits,
  type ImageCacheOptions,
  type ImageCacheStats,
  type ResolvedCacheOptions,
} from './ImageCache';
import { isRemote, type CacheEntry } from './policy';
import type { LoadPriority } from './scheduler';
import { createStore } from './store';

async function fetchBytes(url: string, headers: Record<string, string>): Promise<FetchResult> {
  const res = await fetch(url, { headers });
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    out[key] = value;
  });
  const bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : undefined;
  return { status: res.status, headers: out, bytes };
}

/** Delay after expiry before a mounted image is looked up again. */
const MIN_RECHECK = 1000;
/** Expiries further away than this are picked up on the next mount instead of a timer. */
const MAX_TIMER = 60 * 60 * 1000;

export type ImageCacheConfig = ImageCacheLimits & {
  /**
   * Decoded images kept in memory for the liquid effect, so swiping back and
   * forth does not decode them again. Each costs width × height × 4 bytes
   * (a 1080×810 photo ≈ 3.5 MB). Default 24.
   */
  decodedImages?: number;
  /**
   * Memory budget for those decoded images, in bytes (width × height × 4
   * each). The least recently used go first when either limit is reached.
   * Default 96 MB.
   */
  decodedBytes?: number;
};

const DEFAULT_CONFIG: Required<ImageCacheConfig> = {
  maxSize: 100 * 1024 * 1024,
  maxEntries: 500,
  maxConcurrent: 4,
  decodedImages: 24,
  decodedBytes: 96 * 1024 * 1024,
};

let config: Required<ImageCacheConfig> = { ...DEFAULT_CONFIG };
let instance: ImageCache | null | undefined;

/** The shared cache, or null when the platform has no store for it. */
function getCache(): ImageCache | null {
  if (instance === undefined) {
    const store = createStore();
    instance = store ? new ImageCache(store, fetchBytes, config) : null;
  }
  return instance;
}

/** Current limit for decoded images in memory (read by the liquid layer). */
export function decodedImageLimit(): number {
  return config.decodedImages;
}

/** Current memory budget for decoded images, in bytes (read by the liquid layer). */
export function decodedByteLimit(): number {
  return config.decodedBytes;
}

/** Whether `uri` has a cache entry (fresh or stale). Synchronous, for choosing between candidates. */
export function isCachedSync(uri: string, options: ResolvedCacheOptions): boolean {
  return !!getCache()?.getEntry(uri, options);
}

export function resolveCacheOptions(
  options: ImageCacheOptions | false | undefined,
): ResolvedCacheOptions | null {
  if (options === false) return null;
  return { ...DEFAULT_CACHE_OPTIONS, ...options };
}

/**
 * URI to display for `uri`, through the cache.
 *
 * - Local or bundled images, a disabled cache, or a platform without a store:
 *   `uri` unchanged.
 * - Cached: the cached file on the first render (no flash), then whatever the
 *   strategy decides; a background refresh that brings new content swaps it.
 * - Not cached: `null` while downloading (show a placeholder), then the file.
 *   If the download fails, the remote URL, so the image component can retry.
 *
 * `priority` ranks the download against others waiting for a slot. It can
 * change while mounted (the carousel raises it as the page comes into view);
 * a waiting download is moved up the queue.
 */
export function useCachedUri(
  uri: string | null,
  options: ResolvedCacheOptions | null,
  priority: LoadPriority = 'normal',
): string | null {
  const cache = uri && options && isRemote(uri) ? getCache() : null;
  const [resolved, setResolved] = useState<{ for: string | null; uri: string | null }>(() => ({
    for: uri,
    uri: cache && uri ? cache.peek(uri, options!) : uri,
  }));
  const priorityRef = useRef(priority);

  // Re-rank a waiting download when the page moves closer to the user.
  useEffect(() => {
    priorityRef.current = priority;
    if (cache && uri && options) cache.prioritize(uri, options, priority);
  }, [cache, uri, options, priority]);

  useEffect(() => {
    if (!cache || !uri || !options) return;
    let alive = true;
    const set = (next: string) => {
      if (alive)
        setResolved((prev) => (prev.for === uri && prev.uri === next ? prev : { for: uri, uri: next }));
    };
    // An image can stay mounted for a long time (the current page, or every
    // page of a short looping carousel). Look it up again when it expires, so
    // the strategy gets to refresh it while it is on screen, not only on mount.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      void cache
        .load(uri, options, priorityRef.current)
        .then(set, () => set(uri))
        // A stale hit returns at once while the refetch runs in the background;
        // schedule from the expiry that refetch sets, not the stale one.
        .then(() => cache.settled(uri, options))
        .finally(() => {
          if (!alive) return;
          const entry = cache.getEntry(uri, options);
          // Already expired (for example `no-cache`, max-age 0): no polling,
          // the next mount looks it up again.
          if (!entry || entry.expiresAt <= Date.now()) return;
          const wait = entry.expiresAt - Date.now() + MIN_RECHECK;
          if (wait < MAX_TIMER) timer = setTimeout(run, wait);
        });
    };
    run();
    const unsubscribe = cache.subscribe(uri, options, set);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [cache, uri, options]);

  if (!cache) return uri;
  // A new `uri` prop: never show the previous item's file.
  return resolved.for === uri ? resolved.uri : cache.peek(uri!, options!);
}

export type PrefetchState = {
  /** Images now in the cache (downloaded, or already there). */
  loaded: number;
  failed: number;
  total: number;
  /** Every image has either loaded or failed. */
  done: boolean;
};

/**
 * Download images into the cache ahead of time, for example the first images
 * of the next screen while the user is still on this one, or a gallery's
 * images when its list item scrolls into view.
 *
 * Runs whenever the set of URLs changes (order and duplicates do not matter)
 * and when `enabled` turns true. Downloads go through the shared queue at
 * `priority` (default `low`), so they never delay images that are on screen.
 *
 *   const { done } = usePrefetchImages(products.map((p) => p.imageUrl));
 */
export function usePrefetchImages(
  urls: readonly string[],
  options: { enabled?: boolean; priority?: LoadPriority; cache?: ImageCacheOptions } = {},
): PrefetchState {
  const { enabled = true, priority = 'low', cache } = options;
  const unique = [...new Set(urls)].sort();
  const key = unique.join('\n');
  const [state, setState] = useState<PrefetchState & { key: string }>({
    key: '',
    loaded: 0,
    failed: 0,
    total: unique.length,
    done: unique.length === 0,
  });
  const cacheRef = useRef(cache);
  useEffect(() => {
    cacheRef.current = cache;
  });

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    const store = getCache();
    if (!enabled || !store || list.length === 0) return;
    let alive = true;
    let loaded = 0;
    let failed = 0;
    const resolved = { ...DEFAULT_CACHE_OPTIONS, ...cacheRef.current };
    for (const url of list) {
      store
        .load(url, resolved, priority)
        .then(
          () => {
            loaded++;
          },
          () => {
            failed++;
          },
        )
        .finally(() => {
          if (alive)
            setState({ key, loaded, failed, total: list.length, done: loaded + failed === list.length });
        });
    }
    return () => {
      alive = false;
    };
  }, [enabled, key, priority]);

  const total = unique.length;
  if (state.key !== key) return { loaded: 0, failed: 0, total, done: total === 0 || !getCache() };
  return { loaded: state.loaded, failed: state.failed, total, done: state.done };
}

/** Live cache counters for a debug panel or a settings screen. */
export function useImageCacheStats(): ImageCacheStats {
  const [stats, setStats] = useState(() => imageCache.stats());
  useEffect(() => imageCache.onStats(() => setStats(imageCache.stats())), []);
  return stats;
}

/**
 * The shared image cache. All carousels use it; you can warm it up before a
 * carousel mounts, inspect it, or clear it (for example on sign out).
 */
export const imageCache = {
  /** Whether a persistent store exists on this platform (expo-file-system on native, Cache Storage on web). */
  isAvailable(): boolean {
    return getCache() !== null;
  },
  /**
   * Limits. Defaults: `maxSize` 100 MB and `maxEntries` 500 on disk (least
   * recently used files go first), `maxConcurrent` 4 downloads, 24
   * `decodedImages` and 96 MB `decodedBytes` in memory. Takes effect
   * immediately; shrinking evicts.
   */
  configure(next: ImageCacheConfig) {
    config = { ...config, ...next };
    instance?.setLimits(next);
  },
  /** Current limits. */
  getConfig(): Readonly<Required<ImageCacheConfig>> {
    return config;
  },
  /** Download images into the cache. Default priority `low`. */
  prefetch(
    urls: string[],
    options?: ImageCacheOptions,
    priority: LoadPriority = 'low',
  ): Promise<{ loaded: number; failed: number }> {
    return getCache()?.prefetch(urls, options, priority) ?? Promise.resolve({ loaded: 0, failed: 0 });
  },
  getEntry(url: string, options?: ImageCacheOptions): Readonly<CacheEntry> | undefined {
    return getCache()?.getEntry(url, options);
  },
  remove(url: string, options?: ImageCacheOptions): Promise<void> {
    return getCache()?.remove(url, options) ?? Promise.resolve();
  },
  clear(): Promise<void> {
    return getCache()?.clear() ?? Promise.resolve();
  },
  stats(): ImageCacheStats {
    return (
      getCache()?.stats() ?? {
        hits: 0,
        misses: 0,
        revalidations: 0,
        notModified: 0,
        updates: 0,
        errors: 0,
        entries: 0,
        size: 0,
        active: 0,
        queued: 0,
      }
    );
  },
  /** Listen to counter changes. Returns an unsubscribe function. */
  onStats(listener: () => void): () => void {
    return getCache()?.onStats(listener) ?? (() => {});
  },
};

export type { ImageCacheLimits, ImageCacheOptions, ImageCacheStats, LoadPriority };
export type { CacheStrategy, CacheEntry } from './policy';
