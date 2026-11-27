/**
 * Native store: files in `<cache dir>/expo-morph-carousel/` through
 * expo-file-system, plus an `index.json` with the metadata. The OS may clear
 * the cache directory when storage runs low; entries whose file is gone are
 * dropped when the index loads.
 *
 * expo-file-system is an optional peer dependency. Without it there is no
 * store and images load straight from the network (`createStore` returns null).
 */
import type { CacheStore } from './ImageCache';
import type { CacheEntry } from './policy';

declare const require: (id: string) => unknown;

type FsFile = {
  uri: string;
  exists: boolean;
  write(content: string | Uint8Array): Promise<void> | void;
  text(): Promise<string>;
  delete(): void;
  create?(options?: object): void;
};
type FsDirectory = { uri: string; exists: boolean; create(options?: object): void; delete(): void };
type FileSystem = {
  File: new (...parts: unknown[]) => FsFile;
  Directory: new (...parts: unknown[]) => FsDirectory;
  Paths: { cache: FsDirectory };
};

const FOLDER = 'expo-morph-carousel';

export function createStore(): CacheStore | null {
  let fs: FileSystem;
  try {
    fs = require('expo-file-system') as FileSystem;
    if (!fs?.File || !fs?.Paths) return null;
  } catch {
    return null;
  }
  const { File, Directory, Paths } = fs;

  const dir = () => {
    const d = new Directory(Paths.cache, FOLDER);
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    return d;
  };
  const file = (name: string) => new File(dir(), name);

  return {
    async load() {
      try {
        const index = file('index.json');
        if (!index.exists) return [];
        const list = JSON.parse(await index.text()) as CacheEntry[];
        return list.filter((e) => file(e.file).exists);
      } catch {
        return [];
      }
    },
    async saveIndex(entries) {
      await file('index.json').write(JSON.stringify(entries));
    },
    async write(name, bytes) {
      await file(name).write(bytes);
    },
    async remove(name) {
      const f = file(name);
      if (f.exists) f.delete();
    },
    async displayUri(name) {
      return file(name).uri;
    },
    async clear() {
      const d = new Directory(Paths.cache, FOLDER);
      if (d.exists) d.delete();
    },
  };
}
