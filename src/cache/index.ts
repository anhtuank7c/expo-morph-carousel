/**
 * The shared image cache and the hook the carousel uses to show cached files.
 */
import { useEffect, useState } from 'react';

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

let instance: ImageCache | null | undefined;
let pendingLimits: ImageCacheLimits = {};

/** The shared cache, or null when the platform has no store for it. */
function getCache(): ImageCache | null {
  if (instance === undefined) {
    const store = createStore();
    instance = store ? new ImageCache(store, fetchBytes, pendingLimits) : null;
  }
  return instance;
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
 */
export function useCachedUri(uri: string | null, options: ResolvedCacheOptions | null): string | null {
  const cache = uri && options && isRemote(uri) ? getCache() : null;
  const [resolved, setResolved] = useState<{ for: string | null; uri: string | null }>(() => ({
    for: uri,
    uri: cache && uri ? cache.peek(uri, options!) : uri,
  }));

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
        .load(uri, options)
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

/**
 * The shared image cache. All carousels use it; you can warm it up before a
 * carousel mounts, inspect it, or clear it (for example on sign out).
 */
export const imageCache = {
  /** Whether a persistent store exists on this platform (expo-file-system on native, Cache Storage on web). */
  isAvailable(): boolean {
    return getCache() !== null;
  },
  /** Size and entry limits. Call before the first carousel renders, or any time to shrink. */
  configure(limits: ImageCacheLimits) {
    pendingLimits = { ...pendingLimits, ...limits };
    instance?.setLimits(limits);
  },
  prefetch(urls: string[], options?: ImageCacheOptions): Promise<void> {
    return getCache()?.prefetch(urls, options) ?? Promise.resolve();
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
      }
    );
  },
  /** Listen to counter changes. Returns an unsubscribe function. */
  onStats(listener: () => void): () => void {
    return getCache()?.onStats(listener) ?? (() => {});
  },
};

export type { ImageCacheLimits, ImageCacheOptions, ImageCacheStats };
export type { CacheStrategy, CacheEntry } from './policy';
