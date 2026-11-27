import { MorphCarousel, type MediaSlotProps, type PaginationSlotProps } from 'expo-morph-carousel';
import { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Ordering a drink: the pages are the cup sizes. The three cups of a flavor
 * share one frame and stand on its bottom edge (see make-devices.mjs), so
 * moving from S to L grows the cup instead of zooming it, and the liquid
 * effect pours one size into the next. A Pagination slot is the size picker,
 * a MediaBackground slot draws the flavor's glow and a floor shadow that
 * widens with the size.
 */

const CUPS = {
  matcha: {
    s: require('../assets/drinks/matcha-s.png'),
    m: require('../assets/drinks/matcha-m.png'),
    l: require('../assets/drinks/matcha-l.png'),
  },
  strawberry: {
    s: require('../assets/drinks/strawberry-s.png'),
    m: require('../assets/drinks/strawberry-m.png'),
    l: require('../assets/drinks/strawberry-l.png'),
  },
  coldbrew: {
    s: require('../assets/drinks/coldbrew-s.png'),
    m: require('../assets/drinks/coldbrew-m.png'),
    l: require('../assets/drinks/coldbrew-l.png'),
  },
};

type FlavorId = keyof typeof CUPS;
type Flavor = { id: FlavorId; name: string; color: string; tint: string; price: number; kcal: number };

const FLAVORS: Flavor[] = [
  { id: 'matcha', name: 'Matcha latte', color: '#4f8a24', tint: '#e6f2d8', price: 3.9, kcal: 0.36 },
  { id: 'strawberry', name: 'Strawberry milk', color: '#d9426f', tint: '#fde2eb', price: 4.2, kcal: 0.42 },
  { id: 'coldbrew', name: 'Cold brew', color: '#6b3e26', tint: '#f1e5da', price: 3.5, kcal: 0.08 },
];

type Size = { id: 's' | 'm' | 'l'; label: string; name: string; ml: number; extra: number };

const SIZES: Size[] = [
  { id: 's', label: 'S', name: 'Small', ml: 350, extra: 0 },
  { id: 'm', label: 'M', name: 'Medium', ml: 500, extra: 0.6 },
  { id: 'l', label: 'L', name: 'Large', ml: 700, extra: 1.2 },
];
/** Cup scale per size, as drawn (S 72%, M 86%, L 100% of the frame). */
const SCALES = [0.72, 0.86, 1];

const FlavorContext = createContext<Flavor>(FLAVORS[0]);

const price = (flavor: Flavor, size: Size) => `$${(flavor.price + size.extra).toFixed(2)}`;

export default function OrderScreen() {
  const [flavorId, setFlavorId] = useState<FlavorId>('matcha');
  const flavor = FLAVORS.find((f) => f.id === flavorId)!;
  const components = useMemo(() => ({ Pagination: SizePicker, MediaBackground: Glow }), []);

  return (
    <FlavorContext.Provider value={flavor}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
        <View style={styles.flavors}>
          {FLAVORS.map((f) => {
            const on = f.id === flavorId;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFlavorId(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.flavor, on && { backgroundColor: f.color }]}
              >
                <View style={[styles.flavorDot, { backgroundColor: on ? '#fff' : f.color }]} />
                <Text style={[styles.flavorText, on && styles.flavorTextOn]}>{f.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <MorphCarousel
          data={SIZES}
          keyExtractor={(s) => s.id}
          initialIndex={1}
          // The flavor picks the set of cups; changing it cross-fades them.
          getImage={(s) => CUPS[flavorId][s.id]}
          mediaFit="contain"
          mediaHeight={360}
          mediaPadding={18}
          tapToNavigate={{ area: 'media' }}
          accessibilityLabel="Cup size"
          getAccessibilityLabel={(s) => `${s.name}, ${s.ml} ml, ${price(flavor, s)}`}
          components={components}
          style={styles.card}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Text style={styles.sizeName}>
                {item.name} {flavor.name.toLowerCase()}
              </Text>
              <Text style={styles.sizeInfo}>
                {item.ml} ml · {Math.round(item.ml * flavor.kcal)} kcal
              </Text>
            </View>
          )}
          renderFooter={({ item }) =>
            item ? (
              <Pressable style={[styles.add, { backgroundColor: flavor.color }]} accessibilityRole="button">
                <Text style={styles.addText}>
                  Add {item.name.toLowerCase()} · {price(flavor, item)}
                </Text>
              </Pressable>
            ) : null
          }
        />
        <Text style={styles.hint}>Swipe the cup, tap it, or pick a size.</Text>
      </ScrollView>
    </FlavorContext.Provider>
  );
}

const BUTTON = 52;
const GAP = 14;

/** Pagination slot: S, M and L, with a pill that follows the swipe. */
function SizePicker({ index, position, scrollTo }: PaginationSlotProps) {
  const flavor = useContext(FlavorContext);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * (BUTTON + GAP) }] }));
  return (
    <View style={styles.sizes}>
      <Animated.View style={[styles.sizePill, { backgroundColor: flavor.color }, pill]} />
      {SIZES.map((s, i) => (
        <Pressable
          key={s.id}
          onPress={() => scrollTo(i)}
          style={styles.sizeButton}
          accessibilityRole="button"
          accessibilityLabel={s.name}
          accessibilityState={{ selected: i === index }}
        >
          <Text style={[styles.sizeLabel, i === index && styles.sizeLabelOn]}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** MediaBackground slot: the flavor's glow, and a floor shadow as wide as the cup. */
function Glow({ position, width, height }: MediaSlotProps<Size>) {
  const flavor = useContext(FlavorContext);
  const floor = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(position.value, [0, 1, 2], SCALES, 'clamp') }],
  }));
  const d = height * 0.86;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          width: d,
          height: d,
          borderRadius: d / 2,
          left: (width - d) / 2,
          top: (height - d) / 2,
          backgroundColor: flavor.tint,
        }}
      />
      <Animated.View
        style={[
          styles.floor,
          { width: height * 0.36, left: (width - height * 0.36) / 2, top: height - 18 - 7 },
          floor,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 14 },
  flavors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flavor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  flavorDot: { width: 10, height: 10, borderRadius: 5 },
  flavorText: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  flavorTextOn: { color: '#fff' },
  card: { height: 600, borderRadius: 28, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', paddingTop: 6, gap: 4 },
  sizeName: { fontSize: 22, fontWeight: '800', color: '#1c1c1e' },
  sizeInfo: { fontSize: 14, color: '#6e6e73' },
  sizes: { flexDirection: 'row', gap: GAP, padding: 6, borderRadius: 32, backgroundColor: '#f2f2f7' },
  sizePill: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
  },
  sizeButton: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  sizeLabel: { fontSize: 18, fontWeight: '700', color: '#6e6e73' },
  sizeLabelOn: { color: '#fff' },
  floor: { position: 'absolute', height: 14, borderRadius: 7, backgroundColor: '#00000016' },
  add: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  addText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, color: '#6e6e73', textAlign: 'center' },
});
