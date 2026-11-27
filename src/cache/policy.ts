/**
 * Pure cache policy: freshness, HTTP header parsing, eviction and keys.
 * No React Native imports, so it is unit tested with plain Node.
 */

export type CacheStrategy = 'stale-while-revalidate' | 'cache-first' | 'network-first';

export type CacheEntry = {
  /** Cache key (by default the URL). */
  key: string;
  url: string;
  /** File name in the store. Changes whenever the content changes. */
  file: string;
  size: number;
  fetchedAt: number;
  /** When the entry stops being fresh. */
  expiresAt: number;
  lastUsed: number;
  etag?: string;
  lastModified?: string;
  contentType?: string;
};

export type FreshnessOptions = {
  strategy: CacheStrategy;
  /** Never show an entry older than this past its expiry; refetch first instead. */
  maxStale: number;
};

/**
 * What to do with a cache lookup.
 * - `use`: show the cached file, nothing else.
 * - `use-and-revalidate`: show the cached file now, refetch in the background.
 * - `fetch`: wait for the network; the cached file (if any) is only a fallback.
 */
export type Decision = 'use' | 'use-and-revalidate' | 'fetch';

export function decide(entry: CacheEntry | undefined, now: number, options: FreshnessOptions): Decision {
  if (!entry) return 'fetch';
  const fresh = now < entry.expiresAt;
  switch (options.strategy) {
    case 'network-first':
      return 'fetch';
    case 'cache-first':
      return fresh ? 'use' : 'fetch';
    case 'stale-while-revalidate':
      if (fresh) return 'use';
      return now - entry.expiresAt <= options.maxStale ? 'use-and-revalidate' : 'fetch';
  }
}

export type HttpCacheHeaders = {
  /** Lifetime from the response, in ms. `undefined` when the server says nothing. */
  maxAge?: number;
  /** `no-store`: the response must not be written to disk. */
  noStore: boolean;
  etag?: string;
  lastModified?: string;
};

/** Reads `Cache-Control`, `Expires`, `ETag` and `Last-Modified` (header names are case-insensitive). */
export function parseCacheHeaders(
  headers: Record<string, string | undefined>,
  now: number,
): HttpCacheHeaders {
  const get = (name: string) => {
    for (const k of Object.keys(headers)) if (k.toLowerCase() === name) return headers[k];
    return undefined;
  };
  const control = (get('cache-control') ?? '').toLowerCase();
  const directives = new Map<string, string | true>();
  for (const part of control.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k) directives.set(k, v === undefined ? true : v.replace(/"/g, ''));
  }

  let maxAge: number | undefined;
  if (directives.has('no-cache')) maxAge = 0;
  else if (directives.has('max-age')) {
    const seconds = Number(directives.get('max-age'));
    if (Number.isFinite(seconds) && seconds >= 0) maxAge = seconds * 1000;
  } else {
    const expires = get('expires');
    if (expires) {
      const at = Date.parse(expires);
      // An invalid date (often "0") means "already expired".
      maxAge = Number.isNaN(at) ? 0 : Math.max(at - now, 0);
    }
  }

  return {
    maxAge,
    noStore: directives.has('no-store'),
    etag: get('etag'),
    lastModified: get('last-modified'),
  };
}

/**
 * Entries to delete so that the cache fits `maxSize` bytes and `maxEntries`
 * entries, least recently used first.
 */
export function evict(entries: CacheEntry[], maxSize: number, maxEntries: number): CacheEntry[] {
  const byAge = [...entries].sort((a, b) => a.lastUsed - b.lastUsed);
  let size = entries.reduce((sum, e) => sum + e.size, 0);
  let count = entries.length;
  const out: CacheEntry[] = [];
  for (const e of byAge) {
    if (size <= maxSize && count <= maxEntries) break;
    out.push(e);
    size -= e.size;
    count -= 1;
  }
  return out;
}

/** Stable short hash for file names (FNV-1a, two 32-bit lanes → 16 hex chars). */
export function hashKey(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
};

/** File extension from the content type, then from the URL path, else `img`. */
export function extensionFor(url: string, contentType?: string): string {
  const fromType = contentType ? EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()] : undefined;
  if (fromType) return fromType;
  const path = url.split(/[?#]/)[0];
  const m = /\.([a-z0-9]{2,5})$/i.exec(path);
  return m ? m[1].toLowerCase() : 'img';
}

export function isRemote(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}
