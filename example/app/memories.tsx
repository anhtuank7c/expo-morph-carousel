import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MorphCarousel, type MorphCarouselRef } from 'expo-morph-carousel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memories, photoFor } from '../data/demos';
import { sides } from '../data/layout';

/**
 * A "memories" slideshow like the photo apps make: full-screen photos that
 * slowly zoom (Ken Burns), melt into the next one with the liquid effect,
 * and move on by themselves. Tap the left or right side to go back or skip
 * (`tapToNavigate`); the bars on top show the progress.
 */

const PHOTO_MS = 4500;
const ZOOM = 1.12;

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const carousel = useRef<MorphCarouselRef>(null);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const progress = useSharedValue(0);
  const zoom = useSharedValue(1);

  const next = useCallback(() => carousel.current?.next(), []);

  // Each photo: the bar fills, the picture drifts in or out, then the next one.
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, { duration: PHOTO_MS, easing: Easing.linear }, (done) => {
      if (done) runOnJS(next)();
    });
    // Alternate zooming in and out so a page change never jumps.
    zoom.value = withTiming(index % 2 === 0 ? ZOOM : 1, {
      duration: PHOTO_MS + 600,
      easing: Easing.inOut(Easing.quad),
    });
  }, [index, next, progress, zoom]);

  const kenBurns = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const memory = memories[index];

  return (
    <View style={styles.screen}>
      <Animated.View style={[StyleSheet.absoluteFill, kenBurns]}>
        <MorphCarousel
          ref={carousel}
          data={memories}
          keyExtractor={(m) => m.id}
          getImage={(m, _i, target) => ({ uri: photoFor(m.id, target) })}
          getPlaceholderColor={(m) => m.color}
          mediaPosition="background"
          mediaFit="cover"
          mediaPadding={0}
          liquid={{ preserveShape: true, blur: 40 }}
          animation={{ type: 'timing', duration: 900 }}
          loop
          tapToNavigate
          pagination={false}
          onIndexChange={setIndex}
          accessibilityLabel="Memories"
          getAccessibilityLabel={(m) => m.place}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={[styles.top, sides(insets, 10), { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {memories.map((m, i) => (
            <Bar key={m.id} i={i} index={index} progress={progress} />
          ))}
        </View>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={styles.flex} />
          <Pressable
            onPress={() => setSaved((s) => !s)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={26} color="#fff" />
          </Pressable>
          <Ionicons name="share-outline" size={26} color="#fff" />
        </View>
      </View>

      <View
        style={[styles.bottom, sides(insets, 22), { paddingBottom: insets.bottom + 28 }]}
        pointerEvents="none"
      >
        <Text style={styles.when}>3 years ago today</Text>
        <Text style={styles.title}>Summer in the mountains</Text>
        <Animated.Text
          key={memory.id}
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(300)}
          style={styles.place}
        >
          {memory.place} · {index + 1} of {memories.length}
        </Animated.Text>
      </View>
    </View>
  );
}

function Bar({ i, index, progress }: { i: number; index: number; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: `${(i < index ? 1 : i === index ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

const shadow = { textShadowColor: '#0009', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  flex: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 12 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#ffffff59', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 4 },
  when: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    ...shadow,
  },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', ...shadow },
  place: { color: '#ffffffe0', fontSize: 16, fontWeight: '600', ...shadow },
});
