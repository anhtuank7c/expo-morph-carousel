/**
 * Web store: the browser's Cache Storage (`caches`), which survives reloads
 * and is shared by all tabs of the site. Images are shown through `blob:` URLs
 * created on demand. Without Cache Storage (old browsers, some private modes,
 * non-secure origins) there is no store and images load straight from the
 * network, where the browser's HTTP cache still applies.
 */
import type { CacheStore } from './ImageCache';
import type { CacheEntry } from './policy';

const NAME = 'expo-morph-carousel-v1';
const INDEX = '/__expo-morph-carousel__/index.json';
const pathOf = (file: string) => `/__expo-morph-carousel__/${file}`;

export function createStore(): CacheStore | null {
  if (typeof caches === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null;
  const open = () => caches.open(NAME);
  const blobUrls = new Map<string, string>();

  const release = (file: string) => {
    const url = blobUrls.get(file);
    if (url) URL.revokeObjectURL(url);
    blobUrls.delete(file);
  };

  return {
    async load() {
      try {
        const cache = await open();
        const res = await cache.match(INDEX);
        if (!res) return [];
        const list = (await res.json()) as CacheEntry[];
        const keep: CacheEntry[] = [];
        for (const e of list) if (await cache.match(pathOf(e.file))) keep.push(e);
        return keep;
      } catch {
        return [];
      }
    },
    async saveIndex(entries) {
      const cache = await open();
      await cache.put(
        INDEX,
        new Response(JSON.stringify(entries), { headers: { 'content-type': 'application/json' } }),
      );
    },
    async write(file, bytes, contentType) {
      const cache = await open();
      await cache.put(
        pathOf(file),
        new Response(bytes as BodyInit, {
          headers: { 'content-type': contentType ?? 'application/octet-stream' },
        }),
      );
    },
    async remove(file) {
      release(file);
      const cache = await open();
      await cache.delete(pathOf(file));
    },
    async displayUri(file) {
      const known = blobUrls.get(file);
      if (known) return known;
      const cache = await open();
      const res = await cache.match(pathOf(file));
      if (!res) throw new Error(`missing cached file ${file}`);
      const url = URL.createObjectURL(await res.blob());
      blobUrls.set(file, url);
      return url;
    },
    async clear() {
      for (const f of [...blobUrls.keys()]) release(f);
      await caches.delete(NAME);
    },
  };
}
