import { Ionicons } from '@expo/vector-icons';
import { MorphCarousel, type MorphCarouselRef, type PaginationSlotProps } from 'expo-morph-carousel';
import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photo, photoFor, shopColors } from '../data/demos';
import { column, useContentWidth } from '../data/layout';

/**
 * A product page from a shopping app. The gallery is a carousel of the
 * colors: the photos melt into each other, the Pagination slot is a strip of
 * thumbnails whose frame follows the swipe, and the color swatches below
 * drive the same carousel through its ref.
 */

const SIZES = ['38', '39', '40', '41', '42', '43', '44'];
const THUMB = 56;
const THUMB_GAP = 8;

export default function ShopScreen() {
  // A square gallery on a phone; on a tablet or in landscape it stops at
  // 55% of the screen height so the details stay in view.
  const width = useContentWidth();
  const galleryHeight = Math.min(width, Math.round(useWindowDimensions().height * 0.55));
  const insets = useSafeAreaInsets();
  const gallery = useRef<MorphCarouselRef>(null);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState<string | null>('41');
  const [fav, setFav] = useState(false);
  const [cart, setCart] = useState(0);
  const components = useMemo(() => ({ Pagination: Thumbnails }), []);
  const current = shopColors[color];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[column, { paddingBottom: 110 + insets.bottom }]}
      >
        <MorphCarousel
          ref={gallery}
          data={shopColors}
          keyExtractor={(c) => c.id}
          getImage={(c, _i, target) => ({ uri: photoFor(c.id, target) })}
          getPlaceholderColor={(c) => c.swatch}
          mediaHeight={galleryHeight}
          mediaFit="cover"
          mediaPadding={0}
          liquid={{ preserveShape: true }}
          tapToNavigate={{ area: 'media' }}
          components={components}
          onIndexChange={setColor}
          accessibilityLabel="Product photos"
          getAccessibilityLabel={(c) => `Color ${c.name}`}
          style={{ height: galleryHeight + 150 }}
          renderItem={({ item }) => (
            <View style={styles.colorInfo}>
              <Text style={styles.colorName}>{item.name}</Text>
              <Text style={[styles.stock, item.stock < 5 && styles.low]}>
                {item.stock < 5 ? `Only ${item.stock} left` : 'In stock'}
              </Text>
            </View>
          )}
        />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={styles.brand}>STRIDE LAB</Text>
              <Text style={styles.title}>Cloud Runner 2 — {current.name}</Text>
            </View>
            <Pressable
              onPress={() => setFav((f) => !f)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Favorite"
            >
              <Ionicons
                name={fav ? 'heart' : 'heart-outline'}
                size={28}
                color={fav ? '#ff2d55' : '#1c1c1e'}
              />
            </Pressable>
          </View>
          <View style={styles.ratingRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Ionicons key={i} name={i < 4 ? 'star' : 'star-half'} size={15} color="#ffb400" />
            ))}
            <Text style={styles.rating}>4.6 · 2,184 reviews</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>$89</Text>
            <Text style={styles.was}>$129</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>-31%</Text>
            </View>
          </View>
          <View style={styles.live}>
            <Ionicons name="flame" size={16} color="#ff6b00" />
            <Text style={styles.liveText}>18 people are looking at this right now</Text>
          </View>

          <Text style={styles.label}>Color</Text>
          <View style={styles.swatches}>
            {shopColors.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => gallery.current?.scrollTo(i)}
                style={[styles.swatchRing, i === color && { borderColor: c.swatch }]}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                accessibilityState={{ selected: i === color }}
              >
                <View style={[styles.swatch, { backgroundColor: c.swatch }]} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Size (EU)</Text>
          <View style={styles.sizes}>
            {SIZES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSize(s)}
                style={[styles.size, s === size && styles.sizeOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: s === size }}
              >
                <Text style={[styles.sizeText, s === size && styles.sizeTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>About</Text>
          <Text style={styles.about}>
            A light everyday runner with a breathable knit upper, a soft foam midsole and a grippy rubber
            outsole. Free returns within 30 days.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.cartBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.cartIcon}
          accessibilityRole="button"
          accessibilityLabel={`Cart, ${cart} items`}
        >
          <Ionicons name="bag-outline" size={24} color="#1c1c1e" />
          {cart > 0 && (
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{cart}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.add, { backgroundColor: current.swatch }]}
          onPress={() => setCart((c) => c + 1)}
          accessibilityRole="button"
        >
          <Text style={styles.addText}>Add to cart · size {size}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Pagination slot: thumbnails of the colors, with a frame that follows the swipe. */
function Thumbnails({ count, index, position, scrollTo }: PaginationSlotProps) {
  return (
    <View style={styles.thumbs}>
      {shopColors.slice(0, count).map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => scrollTo(i)}
          accessibilityRole="button"
          accessibilityLabel={`Photo ${i + 1}, ${c.name}`}
          accessibilityState={{ selected: i === index }}
        >
          <Thumb id={c.id} i={i} position={position} />
        </Pressable>
      ))}
    </View>
  );
}

function Thumb({ id, i, position }: { id: string; i: number; position: SharedValue<number> }) {
  const frame = useAnimatedStyle(() => {
    const near = interpolate(Math.abs(position.value - i), [0, 1], [1, 0], 'clamp');
    return { borderColor: `rgba(28,28,30,${near})`, transform: [{ scale: 0.9 + near * 0.1 }] };
  });
  return (
    <Animated.View style={[styles.thumb, frame]}>
      <Image source={{ uri: photo(id, 160, 160) }} style={styles.thumbImage} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  colorInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  colorName: { fontSize: 15, fontWeight: '700', color: '#1c1c1e' },
  stock: { fontSize: 14, color: '#2b8a3e', fontWeight: '600' },
  low: { color: '#e03131' },
  thumbs: { flexDirection: 'row', gap: THUMB_GAP, paddingHorizontal: 16 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 12, borderWidth: 2, padding: 2 },
  thumbImage: { flex: 1, borderRadius: 8, backgroundColor: '#eee' },
  body: { paddingHorizontal: 16, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  brand: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#868e96' },
  title: { fontSize: 22, fontWeight: '800', color: '#1c1c1e' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rating: { marginLeft: 6, fontSize: 13, color: '#6e6e73' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 28, fontWeight: '800', color: '#1c1c1e' },
  was: { fontSize: 15, color: '#8e8e93', textDecorationLine: 'line-through' },
  badge: { backgroundColor: '#ff3b30', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff4e6',
    borderRadius: 10,
    padding: 10,
  },
  liveText: { fontSize: 13, color: '#d9480f', fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '700', color: '#1c1c1e', marginTop: 8 },
  swatches: { flexDirection: 'row', gap: 10 },
  swatchRing: { padding: 3, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  size: {
    minWidth: 52,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d0d5',
    alignItems: 'center',
  },
  sizeOn: { backgroundColor: '#1c1c1e', borderColor: '#1c1c1e' },
  sizeText: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  sizeTextOn: { color: '#fff' },
  about: { fontSize: 14, lineHeight: 20, color: '#495057' },
  cartBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ffffffee',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d0d0d5',
  },
  cartIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d0d0d5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCount: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  add: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
