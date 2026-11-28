import { MorphCarousel, type MediaSlotProps, type PaginationSlotProps } from 'expo-morph-carousel';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

/**
 * A fast-food menu: a tall cola bottle, a wide burger, a tall sundae and a
 * very wide pile of fries, so the liquid effect has to pour one outline into
 * a very different one. The photos share one square frame and stand on its
 * bottom edge, so they keep their real proportions and a floor shadow can sit
 * under each. A Pagination slot is the menu tab bar, a MediaBackground slot
 * draws a glow that changes color with the item and a shadow as wide as it.
 *
 * Photos from Wikimedia Commons (see example/assets/food/CREDITS.md).
 */

type Item = {
  id: string;
  tab: string;
  name: string;
  description: string;
  price: number;
  kcal: number;
  image: number;
  color: string;
  tint: string;
  /** Width of the product in its square frame, for the floor shadow. */
  footprint: number;
};

const MENU: Item[] = [
  {
    id: 'cola',
    tab: 'Cola',
    name: 'Classic cola',
    description: 'Ice cold, in the glass bottle.',
    price: 1.9,
    kcal: 140,
    image: require('../assets/food/cola.png'),
    color: '#c8102e',
    tint: '#fde3e3',
    footprint: 0.29,
  },
  {
    id: 'burger',
    tab: 'Burger',
    name: 'Cheeseburger',
    description: 'Beef patty, cheddar and lettuce on a sesame bun.',
    price: 5.5,
    kcal: 520,
    image: require('../assets/food/burger.png'),
    color: '#b8621b',
    tint: '#fcebd7',
    footprint: 0.86,
  },
  {
    id: 'sundae',
    tab: 'Sundae',
    name: 'Hot fudge sundae',
    description: 'Vanilla ice cream, chocolate fudge and a cherry on top.',
    price: 3.2,
    kcal: 330,
    image: require('../assets/food/sundae.png'),
    color: '#6b3e26',
    tint: '#f1e7df',
    footprint: 0.34,
  },
  {
    id: 'fries',
    tab: 'Fries',
    name: 'French fries',
    description: 'Thin cut, golden and lightly salted.',
    price: 2.6,
    kcal: 320,
    image: require('../assets/food/fries.png'),
    color: '#d99a00',
    tint: '#fdf1cc',
    footprint: 0.9,
  },
];

const PADDING = 12;
const POSITIONS = MENU.map((_, i) => i);
const price = (item: Item) => `$${item.price.toFixed(2)}`;

export default function OrderScreen() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const components = useMemo(() => ({ Pagination: MenuTabs, MediaBackground: Glow }), []);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = MENU.reduce((sum, item) => sum + (cart[item.id] ?? 0) * item.price, 0);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      <View style={styles.cart} accessibilityLiveRegion="polite">
        <Text style={styles.cartTitle}>Your order</Text>
        <Text style={styles.cartInfo}>
          {count === 0 ? 'Nothing yet' : `${count} item${count > 1 ? 's' : ''} · $${total.toFixed(2)}`}
        </Text>
      </View>

      <MorphCarousel
        data={MENU}
        keyExtractor={(item) => item.id}
        getImage={(item) => item.image}
        getPlaceholderColor={(item) => item.tint}
        mediaFit="contain"
        mediaHeight={340}
        mediaPadding={PADDING}
        tapToNavigate={{ area: 'media' }}
        accessibilityLabel="Menu"
        getAccessibilityLabel={(item) => `${item.name}, ${price(item)}`}
        components={components}
        style={styles.card}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.info}>
              {price(item)} · {item.kcal} kcal
            </Text>
          </View>
        )}
        renderFooter={({ item }) =>
          item ? (
            <Pressable
              style={[styles.add, { backgroundColor: item.color }]}
              accessibilityRole="button"
              onPress={() => setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))}
            >
              <Text style={styles.addText}>
                Add {item.tab.toLowerCase()} · {price(item)}
                {cart[item.id] ? `  (${cart[item.id]})` : ''}
              </Text>
            </Pressable>
          ) : null
        }
      />
      <Text style={styles.hint}>Swipe the food, tap it, or pick a tab.</Text>
    </ScrollView>
  );
}

const TAB = 74;
const GAP = 4;

/** Pagination slot: one tab per item, with a pill that follows the swipe and takes its color. */
function MenuTabs({ index, position, scrollTo }: PaginationSlotProps) {
  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * (TAB + GAP) }],
    backgroundColor: interpolateColor(
      position.value,
      POSITIONS,
      MENU.map((m) => m.color),
    ),
  }));
  return (
    <View style={styles.tabs}>
      <Animated.View style={[styles.tabPill, pill]} />
      {MENU.map((item, i) => (
        <Pressable
          key={item.id}
          onPress={() => scrollTo(i)}
          style={styles.tab}
          accessibilityRole="tab"
          accessibilityLabel={item.name}
          accessibilityState={{ selected: i === index }}
        >
          <Text style={[styles.tabLabel, i === index && styles.tabLabelOn]}>{item.tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** MediaBackground slot: a glow in the item's tint, and a floor shadow as wide as the item. */
function Glow({ position, width, height }: MediaSlotProps<Item>) {
  const glow = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      position.value,
      POSITIONS,
      MENU.map((m) => m.tint),
    ),
  }));
  // The photos are drawn in a square that fits the media area inside its
  // padding (mediaPadding); the bottom 4% of the square is empty.
  const side = Math.min(width, height) - 2 * PADDING;
  const floor = useAnimatedStyle(() => ({
    transform: [
      {
        scaleX: interpolate(
          position.value,
          POSITIONS,
          MENU.map((m) => m.footprint),
          'clamp',
        ),
      },
    ],
  }));
  const d = side * 0.9;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: d,
            height: d,
            borderRadius: d / 2,
            left: (width - d) / 2,
            top: (height - d) / 2,
          },
          glow,
        ]}
      />
      <Animated.View
        style={[
          styles.floor,
          { width: side, left: (width - side) / 2, top: (height + side) / 2 - side * 0.04 - 6 },
          floor,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 14 },
  cart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  cartTitle: { fontSize: 15, fontWeight: '700', color: '#1c1c1e' },
  cartInfo: { fontSize: 15, color: '#6e6e73' },
  card: { height: 620, borderRadius: 28, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 6, gap: 4 },
  name: { fontSize: 22, fontWeight: '800', color: '#1c1c1e' },
  description: { fontSize: 14, lineHeight: 19, color: '#6e6e73', textAlign: 'center' },
  info: { fontSize: 15, fontWeight: '600', color: '#1c1c1e', marginTop: 2 },
  tabs: { flexDirection: 'row', gap: GAP, padding: 5, borderRadius: 26, backgroundColor: '#f2f2f7' },
  tabPill: { position: 'absolute', left: 5, top: 5, width: TAB, height: 38, borderRadius: 19 },
  tab: { width: TAB, height: 38, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '700', color: '#6e6e73' },
  tabLabelOn: { color: '#fff' },
  floor: { position: 'absolute', height: 12, borderRadius: 6, backgroundColor: '#00000012' },
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
