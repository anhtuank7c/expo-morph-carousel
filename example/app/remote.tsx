import Constants from 'expo-constants';
import {
  imageCache,
  MorphCarousel,
  type CacheStrategy,
  type ImageCacheOptions,
  type MorphCarouselRef,
  useImageCacheStats,
  WIDTH_STEPS,
} from 'expo-morph-carousel';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { heightFor, photos, REMOTE_MEDIA_HEIGHT, REMOTE_SIDE_MARGIN, unsplashUrl } from '../data/products';

/**
 * Remote images through the carousel's disk cache.
 *
 * "Local server" talks to example/scripts/image-server.mjs, which sends ETag
 * and Cache-Control headers and can swap its images, so every cache path can
 * be watched: a fresh hit (no request), a 304 revalidation after expiry, and a
 * new image replacing a stale one after "Swap images on server".
 */

type Source = 'local' | 'unsplash';

/** Host of the computer running Metro, which also runs the image server. */
function serverHost() {
  if (Platform.OS === 'web') return typeof location === 'undefined' ? 'localhost' : location.hostname;
  const hostUri = Constants.expoConfig?.hostUri ?? 'localhost:8081';
  return hostUri.split(':')[0];
}
const SERVER = `http://${serverHost()}:8090`;

const localItems = [0, 1, 2, 3, 4].map((n) => ({
  id: `local-${n}`,
  title: `Image ${n + 1}`,
  uri: `${SERVER}/img/${n}.png`,
  color: ['#6a4fd8', '#f0a020', '#20a890', '#3478f6', '#eb405a'][n],
}));

type Item = { id: string; title: string; uri: string; color: string; unsplash?: string };

const STRATEGIES: CacheStrategy[] = ['stale-while-revalidate', 'cache-first', 'network-first'];
const AGES: { label: string; ms: number }[] = [
  { label: '10 s', ms: 10_000 },
  { label: '1 min', ms: 60_000 },
  { label: '1 day', ms: 86_400_000 },
];

export default function RemoteScreen() {
  const [source, setSource] = useState<Source>('local');
  const [strategy, setStrategy] = useState<CacheStrategy>('stale-while-revalidate');
  const [maxAge, setMaxAge] = useState(AGES[0].ms);
  const [serverHeaders, setServerHeaders] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [tapImage, setTapImage] = useState(true);
  const [keepCorners, setKeepCorners] = useState(true);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const carousel = useRef<MorphCarouselRef>(null);

  const items: Item[] =
    source === 'local'
      ? localItems
      : photos.map((p) => ({ id: p.id, title: p.title, uri: p.uri, color: p.color, unsplash: p.id }));
  const screen = useWindowDimensions();

  // Stable options object: the carousel memoizes on identity.
  const cache = useMemo<ImageCacheOptions | false>(
    () => (enabled ? { strategy, maxAge, respectHttpHeaders: serverHeaders } : false),
    [enabled, strategy, maxAge, serverHeaders],
  );

  const stats = useImageCacheStats();
  const config = imageCache.getConfig();
  const now = useNow();
  const current = items[index];
  // Unsplash items exist in several sizes (one URL per target width); show
  // every cached variant, newest first, to see the upgrade after a rotation.
  const variants = current?.unsplash
    ? WIDTH_STEPS.map((w) => ({ w, e: imageCache.getEntry(unsplashUrl(current.unsplash!, w, heightFor(w))) }))
        .filter((v) => v.e)
        .sort((a, b) => b.e!.fetchedAt - a.e!.fetchedAt)
    : [];
  const entry = current?.unsplash ? variants[0]?.e : current ? imageCache.getEntry(current.uri) : undefined;

  const call = async (path: string) => {
    try {
      const res = await fetch(`${SERVER}${path}`);
      setNote((await res.text()).trim());
    } catch {
      setNote(`Server not reachable at ${SERVER}. Run: npm run image-server --workspace example`);
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      <MorphCarousel
        key={source}
        ref={carousel}
        testID="remote-carousel"
        data={items}
        keyExtractor={(p) => p.id}
        // Unsplash: ask the CDN for exactly the size the media area needs
        // (target is in physical pixels, rounded to a few widths).
        getImage={(p, _i, t) => ({
          uri: p.unsplash ? unsplashUrl(p.unsplash, t.width, heightFor(t.width)) : p.uri,
        })}
        getPlaceholderColor={(p) => p.color}
        getAccessibilityLabel={(p) => p.title}
        accessibilityLabel="Remote images"
        imageCache={cache}
        mediaFit={source === 'local' ? 'contain' : 'cover'}
        mediaPadding={source === 'local' ? 24 : 0}
        mediaHeight={REMOTE_MEDIA_HEIGHT}
        // Photos: keep the rectangle sharp while the content melts (no rounded,
        // eaten-in corners). Shapes on a transparent background melt whole.
        liquid={
          source === 'local'
            ? { preserveShape: keepCorners }
            : { blur: 36, threshold: 0.35, preserveShape: keepCorners }
        }
        // Tap the image: left 30% back, the rest forward. Taps on the text
        // below do nothing.
        tapToNavigate={tapImage ? { area: 'media' } : false}
        loop
        onIndexChange={setIndex}
        style={styles.card}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.uri.replace(/^https?:\/\//, '')}
            </Text>
          </View>
        )}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Current image</Text>
        <Text style={styles.mono}>
          {entry
            ? `fetched ${ago(now - entry.fetchedAt)} ago · ${
                entry.expiresAt > now
                  ? `fresh for ${ago(entry.expiresAt - now)}`
                  : `stale ${ago(now - entry.expiresAt)}`
              }${entry.etag ? ` · ETag ${entry.etag}` : ''}`
            : enabled
              ? 'not cached yet'
              : 'cache off'}
          {variants.length > 0 && `\nvariants: ${variants.map((v) => `${v.w}w`).join(', ')} (newest first)`}
        </Text>
        <Text style={styles.panelTitle}>Screen</Text>
        <Text style={styles.mono}>
          {Math.round(screen.width)}×{Math.round(screen.height)} dp @{PixelRatio.get()}x ·{' '}
          {screen.width > screen.height ? 'landscape' : 'portrait'}
        </Text>
        <Text style={styles.panelTitle}>Cache</Text>
        <Text style={styles.mono}>
          {imageCache.isAvailable() ? '' : 'no store on this platform · '}
          {stats.entries} files · {(stats.size / 1024).toFixed(0)} KB{'\n'}
          hits {stats.hits} · downloads {stats.misses} · revalidations {stats.revalidations}
          {'\n'}304 {stats.notModified} · updated {stats.updates} · errors {stats.errors}
          {'\n'}downloading {stats.active} · queued {stats.queued}
          {'\n'}limits {Math.round(config.maxSize / 1048576)} MB · {config.maxEntries} files ·{' '}
          {config.maxConcurrent} parallel · {config.decodedImages} decoded ·{' '}
          {Math.round(config.decodedBytes / 1048576)} MB
        </Text>
      </View>

      <Section label="Source">
        <Chips
          values={['local', 'unsplash'] as Source[]}
          labels={{ local: 'Local server', unsplash: 'Unsplash' }}
          value={source}
          onChange={setSource}
        />
      </Section>
      <Section label="Strategy">
        <Chips values={STRATEGIES} value={strategy} onChange={setStrategy} />
      </Section>
      <Section label={serverHeaders ? 'maxAge (used when the server sends no Cache-Control)' : 'maxAge'}>
        <Chips
          values={AGES.map((a) => a.ms)}
          labels={Object.fromEntries(AGES.map((a) => [a.ms, a.label]))}
          value={maxAge}
          onChange={setMaxAge}
        />
      </Section>

      <View style={styles.toggles}>
        <Toggle label="Tap the image to change page" value={tapImage} onChange={setTapImage} />
        <Toggle label="Keep image corners while morphing" value={keepCorners} onChange={setKeepCorners} />
        <Toggle label="Cache enabled" value={enabled} onChange={setEnabled} />
        <Toggle label="Use server Cache-Control / ETag" value={serverHeaders} onChange={setServerHeaders} />
      </View>

      <View style={styles.buttons}>
        <Button
          label="Prefetch all"
          onPress={() =>
            void imageCache.prefetch(
              items.map((i) => i.uri),
              cache || undefined,
            )
          }
        />
        <Button label="Clear cache" onPress={() => void imageCache.clear()} />
        {source === 'local' && (
          <>
            <Button label="Swap images on server" onPress={() => void call('/swap')} />
            <Button label="Server max-age 10 s" onPress={() => void call('/config?maxAge=10')} />
            <Button label="Server max-age 1 h" onPress={() => void call('/config?maxAge=3600')} />
          </>
        )}
      </View>
      {!!note && <Text style={styles.note}>{note}</Text>}
      {source === 'local' && (
        <Text style={styles.note}>
          Server: {SERVER}. Start it with `npm run image-server --workspace example`; on an Android emulator
          also run `adb reverse tcp:8090 tcp:8090`.
        </Text>
      )}
      {source === 'unsplash' && (
        <Text style={styles.note}>
          Photos from Unsplash (unsplash.com, Unsplash License). The CDN sends Cache-Control max-age of one
          year: with the “Use server Cache-Control” switch on, the cache keeps them that long; turn it off to
          use maxAge.
        </Text>
      )}
    </ScrollView>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ago(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chips<V extends string | number>({
  values,
  labels,
  value,
  onChange,
}: {
  values: V[];
  labels?: Record<string, string>;
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.chips}>
      {values.map((v) => (
        <Pressable
          key={String(v)}
          onPress={() => onChange(v)}
          style={[styles.chip, v === value && styles.chipOn]}
        >
          <Text style={[styles.chipText, v === value && styles.chipTextOn]}>
            {labels?.[String(v)] ?? String(v)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: REMOTE_SIDE_MARGIN, gap: 12 },
  card: { height: 380, borderRadius: 24, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  meta: { fontSize: 12, color: '#6e6e73' },
  panel: { borderRadius: 16, backgroundColor: '#1c1c1e', padding: 14, gap: 4 },
  panelTitle: { fontSize: 12, fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase' },
  mono: {
    fontSize: 13,
    color: '#f2f2f7',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  section: { gap: 6 },
  label: { fontSize: 13, color: '#6e6e73' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#5b4bd6' },
  chipText: { fontSize: 14, color: '#1c1c1e' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  toggles: { borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleText: { fontSize: 15, color: '#1c1c1e', flexShrink: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#e5e5ea' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  note: { fontSize: 12, color: '#6e6e73' },
});
