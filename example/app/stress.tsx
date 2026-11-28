import { useLocalSearchParams } from 'expo-router';
import { imageCache, MorphCarousel, type MorphCarouselRef } from 'expo-morph-carousel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { heightFor, photos, unsplashUrl } from '../data/products';
import { column } from '../data/layout';

type Decode = 'scheduled' | 'immediate' | 'onDraw';

/**
 * A Tinder-like feed of 60 distinct photos (each a different width of an
 * Unsplash picture, so every one is its own file and its own decode),
 * with probes for both threads:
 *
 * - JS thread: gaps between requestAnimationFrame callbacks. A gap of
 *   100 ms means the JS thread was busy for 100 ms: callbacks, renders and
 *   network responses of the app waited that long.
 * - UI thread: gaps between Reanimated frame callbacks, i.e. dropped frames
 *   of the swipe animation itself.
 * - Callback delay: from the UI thread crossing to the next page to
 *   `onIndexChange` running on the JS thread.
 *
 * The decode mode comes from the URL (`/stress?decode=onDraw`), so every
 * measurement starts in a fresh app with no decoded image in memory.
 *
 * `&auto=40&gap=350` runs it unattended (devices that block injected
 * taps): download every photo, wait for the window to settle, reset the
 * probes, move 40 pages forward every 350 ms through the ref (the same
 * path a tap takes: JS calls the step), reset again and show DONE.
 */
const FEED = Array.from({ length: 60 }, (_, i) => {
  const p = photos[i % photos.length];
  const width = 1080 + i * 8;
  return {
    id: String(i),
    title: `${p.title} #${i + 1}`,
    color: p.color,
    uri: unsplashUrl(p.id, width, heightFor(width)),
    width,
  };
});

type Stats = {
  jsMax: number;
  js50: number;
  js100: number;
  jsBlocked: number;
  uiMax: number;
  ui25: number;
  uiFrames: number;
  lagMax: number;
  lagSum: number;
  lagCount: number;
};
const empty = (): Stats => ({
  jsMax: 0,
  js50: 0,
  js100: 0,
  jsBlocked: 0,
  uiMax: 0,
  ui25: 0,
  uiFrames: 0,
  lagMax: 0,
  lagSum: 0,
  lagCount: 0,
});

const keyOf = (p: (typeof FEED)[number]) => p.id;
const imageOf = (p: (typeof FEED)[number]) => ({ uri: p.uri, width: p.width });
const colorOf = (p: (typeof FEED)[number]) => p.color;
const TAP = { area: 'media' as const };
const renderCard = ({ item }: { item: (typeof FEED)[number] }) => (
  <View style={styles.page}>
    <Text style={styles.title}>{item.title}</Text>
  </View>
);

export default function StressScreen() {
  const params = useLocalSearchParams<{ decode?: string; auto?: string; gap?: string }>();
  const param = params.decode;
  const autoSteps = Number(params.auto) || 0;
  const autoGap = Number(params.gap) || 350;
  const carouselRef = useRef<MorphCarouselRef>(null);
  const resets = useRef(0);
  const [phase, setPhase] = useState(autoSteps ? 'starting' : 'manual');
  const decode: Decode = param === 'immediate' || param === 'onDraw' ? param : 'scheduled';

  /* JS thread probe */
  const js = useRef(empty());
  useEffect(() => {
    let last = performance.now();
    let id = 0;
    const tick = () => {
      const now = performance.now();
      const gap = now - last;
      last = now;
      const s = js.current;
      s.jsMax = Math.max(s.jsMax, gap);
      if (gap > 50) s.js50++;
      if (gap > 100) s.js100++;
      if (gap > 33) s.jsBlocked += gap - 16.7;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  /* UI thread probe */
  const uiMax = useSharedValue(0);
  const ui25 = useSharedValue(0);
  const uiFrames = useSharedValue(0);
  useFrameCallback((f) => {
    const gap = f.timeSincePreviousFrame ?? 0;
    // Only count while something moves: an idle UI thread skips frames too.
    if (gap > 0 && gap < 1000) {
      uiFrames.value += 1;
      uiMax.value = Math.max(uiMax.value, gap);
      if (gap > 25) ui25.value += 1;
    }
  });

  /* callback delay: UI crosses to a new page -> onIndexChange on JS */
  const position = useSharedValue(0);
  const crossedAt = useSharedValue(0);
  useAnimatedReaction(
    () => Math.round(position.value),
    (cur, prev) => {
      if (prev !== null && cur !== prev) crossedAt.value = Date.now();
    },
  );
  const onIndexChange = useCallback(() => {
    if (!crossedAt.value) return;
    const lag = Date.now() - crossedAt.value;
    const s = js.current;
    s.lagMax = Math.max(s.lagMax, lag);
    s.lagSum += lag;
    s.lagCount += 1;
  }, [crossedAt]);
  // The probes refresh the screen twice a second; the carousel element is
  // kept, so those renders do not reach it (only its own work is measured).
  const liquid = useMemo(() => ({ preserveShape: true, decode }), [decode]);
  const carousel = useMemo(
    () => (
      <MorphCarousel
        ref={carouselRef}
        data={FEED}
        keyExtractor={keyOf}
        getImage={imageOf}
        getPlaceholderColor={colorOf}
        mediaFit="cover"
        mediaPadding={0}
        mediaHeight={300}
        liquid={liquid}
        pageEffect="tinder"
        tapToNavigate={TAP}
        positionValue={position}
        onIndexChange={onIndexChange}
        pagination={false}
        style={styles.card}
        renderItem={renderCard}
      />
    ),
    [liquid, onIndexChange, position],
  );

  // Every finished phase: the first is the load (mount, downloads, first
  // decodes), the next ones the swipe runs.
  const [phases, setPhases] = useState<Stats[]>([]);
  const [live, setLive] = useState<Stats>(empty);
  useEffect(() => {
    const t = setInterval(
      () => setLive({ ...js.current, uiMax: uiMax.value, ui25: ui25.value, uiFrames: uiFrames.value }),
      500,
    );
    return () => clearInterval(t);
  }, [ui25, uiFrames, uiMax]);
  const snapshot = (): Stats => ({
    ...js.current,
    uiMax: uiMax.value,
    ui25: ui25.value,
    uiFrames: uiFrames.value,
  });
  const reset = () => {
    const ended = snapshot();
    // Read by the measurement script from the Metro log.
    console.warn(`STRESS ${decode} ${resets.current === 0 ? 'load' : 'swipe'}: ${line(ended)}`);
    resets.current += 1;
    setPhases((list) => [...list, ended]);
    js.current = empty();
    uiMax.value = 0;
    ui25.value = 0;
    uiFrames.value = 0;
  };
  const line = (s: Stats) =>
    `js max ${s.jsMax.toFixed(0)} ms · >50 ${s.js50} · >100 ${s.js100} · blocked ${s.jsBlocked.toFixed(0)} ms | ` +
    `ui max ${s.uiMax.toFixed(0)} ms · >25 ${s.ui25}/${s.uiFrames} | ` +
    `callback lag avg ${s.lagCount ? (s.lagSum / s.lagCount).toFixed(0) : '-'} max ${s.lagMax.toFixed(0)} ms (${s.lagCount})`;

  const [prefetch, setPrefetch] = useState('');

  // Unattended run. reset() is read through a ref: the timers outlive renders.
  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  });
  useEffect(() => {
    if (!autoSteps) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));
    void (async () => {
      setPhase('downloading');
      const r = await imageCache.prefetch(
        FEED.map((p) => p.uri),
        undefined,
        'low',
      );
      if (cancelled) return;
      setPrefetch(`${r.loaded} cached, ${r.failed} failed`);
      setPhase('settling');
      await wait(5000);
      if (cancelled) return;
      resetRef.current();
      setPhase('running');
      for (let i = 0; i < autoSteps && !cancelled; i++) {
        carouselRef.current?.next();
        await wait(autoGap);
      }
      await wait(3000);
      if (cancelled) return;
      resetRef.current();
      setPhase('DONE');
    })();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [autoGap, autoSteps]);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.screen, column]}>
      {carousel}
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={reset} testID="reset">
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          testID="prefetch"
          onPress={() => {
            setPrefetch('…');
            void imageCache
              .prefetch(
                FEED.map((p) => p.uri),
                undefined,
                'low',
              )
              .then((r) => {
                console.warn(`STRESS prefetch: ${r.loaded} cached, ${r.failed} failed`);
                setPrefetch(`${r.loaded} cached, ${r.failed} failed`);
              });
          }}
        >
          <Text style={styles.buttonText}>Prefetch all</Text>
        </Pressable>
      </View>
      <Text style={styles.mode} testID="mode">
        decode: {decode} · {phase}
      </Text>
      <Text style={styles.stats} testID="stats-load">
        {phases.length === 0
          ? 'load: —'
          : phases.map((p, i) => `${i === 0 ? 'load' : `run ${i}`}: ${line(p)}`).join('\n\n')}
      </Text>
      <Text style={styles.stats} testID="stats-swipe">
        now: {line(live)}
      </Text>
      <Text style={styles.mode} testID="prefetch-status">
        {prefetch}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  card: { height: 380, borderRadius: 24, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', color: '#1c1c1e' },
  mode: { fontSize: 13, color: '#6e6e73' },
  stats: { fontFamily: 'monospace', fontSize: 12, color: '#1c1c1e' },
  row: { flexDirection: 'row', gap: 12 },
  button: { backgroundColor: '#e5e5ea', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  buttonText: { fontWeight: '600', color: '#1c1c1e' },
});
