import {
  MorphCarousel,
  type DotSlotProps,
  type MediaSlotProps,
  type PaginationSlotProps,
} from 'expo-morph-carousel';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { products, type Product } from '../data/products';

/**
 * Slots: the parts of the carousel replaced by app components, like the
 * slots of expo-morph-menu. Each slot gets the carousel's position as a
 * shared value, so it animates with the finger on the UI thread.
 */

const tints = products.map((p) => p.color);

/** Behind the media: the color of the item in view, blending while swiping. */
function TintBackground({ position, count }: MediaSlotProps<Product>) {
  const style = useAnimatedStyle(() => {
    // Wrap so the last → first step of a loop blends too.
    const p = ((position.value % count) + count) % count;
    return {
      backgroundColor: interpolateColor(
        p,
        [...tints.map((_, i) => i), count],
        [...tints, tints[0]].map((c) => `${c}33`),
      ),
    };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, style]} />;
}

/** Over the media: a counter badge and a thin progress line. */
function CounterOverlay({ index, count, position }: MediaSlotProps<Product>) {
  const line = useAnimatedStyle(() => {
    const p = ((position.value % count) + count) % count;
    return { width: `${((p + 1) / count) * 100}%` };
  });
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {index + 1} / {count}
        </Text>
      </View>
      <Animated.View style={[styles.line, line]} />
    </View>
  );
}

/** Pagination slot: one segment per page that fills as you swipe, like stories. */
function SegmentPagination({ count, position, scrollTo }: PaginationSlotProps) {
  return (
    <View style={styles.segments}>
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} index={i} count={count} position={position} onPress={() => scrollTo(i)} />
      ))}
    </View>
  );
}

function Segment({
  index,
  count,
  position,
  onPress,
}: {
  index: number;
  count: number;
  position: SharedValue<number>;
  onPress: () => void;
}) {
  const fill = useAnimatedStyle(() => {
    const p = ((position.value % count) + count) % count;
    const t = Math.max(0, Math.min(1, p - index + 1));
    return { width: `${t * 100}%` };
  });
  return (
    <Pressable style={styles.segment} onPress={onPress} hitSlop={10}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </Pressable>
  );
}

/** Dot slot: numbered dots that grow and darken as their page comes into view. */
function NumberDot({ index, active, onPress }: DotSlotProps) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(active.value, [0, 1], [0.8, 1.15]) }],
    backgroundColor: interpolateColor(active.value, [0, 1], ['#e5e5ea', '#5b4bd6']),
  }));
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(active.value, [0, 1], ['#6e6e73', '#ffffff']),
  }));
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Animated.View style={[styles.numberDot, style]}>
        <Animated.Text style={[styles.numberDotText, text]}>{index + 1}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export default function SlotsScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      <Text style={styles.section}>Pagination, MediaOverlay and MediaBackground slots</Text>
      <MorphCarousel
        testID="slots-carousel"
        data={products}
        keyExtractor={(p) => p.id}
        getImage={(p) => p.image}
        getAccessibilityLabel={(p) => p.title}
        mediaHeight={260}
        mediaPadding={36}
        loop
        style={styles.card}
        components={{
          Pagination: SegmentPagination,
          MediaOverlay: CounterOverlay,
          MediaBackground: TintBackground,
        }}
        renderItem={({ item, offset }) => <Caption item={item} offset={offset} />}
      />

      <Text style={styles.section}>Dot slot</Text>
      <MorphCarousel
        data={products}
        keyExtractor={(p) => p.id}
        getImage={(p) => p.image}
        effect="parallax"
        mediaHeight={180}
        mediaPadding={24}
        style={styles.small}
        components={{ Dot: NumberDot }}
        pagination={{ gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.smallPage}>
            <Text style={styles.smallTitle}>{item.title}</Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

/** Page content animated from `offset`: the title lags behind, the text fades. */
function Caption({ item, offset }: { item: Product; offset: SharedValue<number> }) {
  const title = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(offset.value, [-1, 0, 1], [-80, 0, 80]) }],
  }));
  const body = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(offset.value), [0, 0.6], [1, 0]) }));
  return (
    <View style={styles.page}>
      <Animated.Text style={[styles.title, title]}>{item.title}</Animated.Text>
      <Animated.Text style={[styles.description, body]}>{item.description}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  section: { fontSize: 13, color: '#6e6e73', marginLeft: 4 },
  card: { height: 470, borderRadius: 26, backgroundColor: '#fff' },
  small: { height: 300, borderRadius: 22, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  description: { fontSize: 14, lineHeight: 20, color: '#6e6e73', textAlign: 'center' },
  smallPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  smallTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e' },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1c1c1ecc',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  line: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: '#5b4bd6' },
  segments: { flexDirection: 'row', gap: 6, alignSelf: 'stretch', paddingHorizontal: 24 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e5e5ea', overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: '#1c1c1e' },
  numberDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numberDotText: { fontSize: 12, fontWeight: '700' },
});
