import {
  MorphCarousel,
  pageEffects,
  type AnimationConfig,
  type PageEffect,
  type PageEffectFn,
  type SnapMode,
} from 'expo-morph-carousel';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  I18nManager,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { products, type Product } from '../data/products';

/**
 * Page effects with the liquid images. With "Liquid images" on (the default),
 * the product shots melt into each other in the media area while the cards
 * underneath move with the chosen page effect: both effects at once. Off, the
 * carousel is a plain card carousel and the image is part of each card.
 * Every built-in page effect, a custom one, snap modes, spring or timing, a
 * peek at the neighbors, vertical.
 */

/** A custom page effect: cards swing like a door hinged on their leading edge. */
const door: PageEffectFn = ({ offset, step }) => {
  'worklet';
  const o = Math.max(-1, Math.min(1, offset));
  return {
    opacity: 1 - Math.abs(o) * 0.6,
    zIndex: Math.round(100 - Math.abs(offset) * 10),
    transformOrigin: o > 0 ? 'left center' : 'right center',
    transform: [{ perspective: 800 }, { translateX: offset * step }, { rotateY: `${o * -60}deg` }],
  };
};

const EFFECTS: { label: string; value: PageEffect; peek?: boolean }[] = [
  { label: 'slide', value: 'slide' },
  { label: 'parallax', value: 'parallax', peek: true },
  { label: 'stack', value: pageEffects.stack({ visible: 3, rotation: 8 }) },
  { label: 'coverflow', value: 'coverflow', peek: true },
  { label: 'cube', value: 'cube' },
  { label: 'flip', value: 'flip' },
  { label: 'fade', value: 'fade' },
  { label: 'scale-fade', value: 'scale-fade' },
  { label: 'rotate', value: 'rotate', peek: true },
  { label: 'tinder', value: 'tinder' },
  { label: 'custom door', value: door },
];

const SNAPS: SnapMode[] = ['page', 'momentum', 'free'];
const ANIMATIONS: { label: string; value: AnimationConfig }[] = [
  { label: 'spring', value: { type: 'spring' } },
  { label: 'bouncy', value: { type: 'spring', damping: 12, stiffness: 160 } },
  { label: 'timing 300 ms', value: { type: 'timing', duration: 300 } },
];

export default function LayoutsScreen() {
  const { width } = useWindowDimensions();
  // `/layouts?effect=cube&autoplay=1` opens on an effect and plays it (handy
  // for recordings and devices that block injected taps).
  const params = useLocalSearchParams<{ effect?: string; autoplay?: string }>();
  const [effect, setEffect] = useState(() =>
    Math.max(
      EFFECTS.findIndex((e) => e.label === params.effect),
      0,
    ),
  );
  const [snap, setSnap] = useState<SnapMode>('page');
  const [anim, setAnim] = useState(0);
  const [loop, setLoop] = useState(true);
  const [vertical, setVertical] = useState(false);
  const [peekOverride, setPeekOverride] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const [moving, setMoving] = useState(false);
  const [rests, setRests] = useState(0);
  const [liquid, setLiquid] = useState(true);
  const [tap, setTap] = useState(true);
  const peek = peekOverride ?? !!EFFECTS[effect].peek;
  // A cube is drawn bigger than its page while it turns (the near edge comes
  // toward the eye), so it gets room around it and edge-to-edge faces.
  const isCube = EFFECTS[effect].value === 'cube';

  const viewport = width - 32;
  const animation = ANIMATIONS[anim].value;
  const pageSize = peek
    ? Math.round((vertical ? 340 : viewport) * 0.72)
    : isCube
      ? Math.round((vertical ? 300 : viewport) * 0.78)
      : undefined;
  const data = useMemo(() => [...products, ...products.map((p) => ({ ...p, id: `${p.id}-2` }))], []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      <MorphCarousel
        key={`${vertical ? 'v' : 'h'}-${liquid ? 'liquid' : 'cards'}`}
        testID="layouts-carousel"
        data={data}
        keyExtractor={(p) => p.id}
        getAccessibilityLabel={(p) => p.title}
        accessibilityLabel="Cards"
        pageEffect={EFFECTS[effect].value}
        pageSize={pageSize}
        pageGap={peek ? 12 : 0}
        snapMode={snap}
        // Tap the left 30% to go back, anywhere else to go forward; a tap on a
        // peeking neighbor goes to it.
        tapToNavigate={tap}
        animation={animation}
        loop={loop}
        autoplay={params.autoplay ? { interval: 1800, whenScreenReaderEnabled: true } : undefined}
        direction={vertical ? 'vertical' : 'horizontal'}
        // The liquid morph of the images, above the cards.
        getImage={liquid ? (p) => p.image : undefined}
        effect="liquid"
        mediaHeight={220}
        mediaPadding={24}
        getPlaceholderColor={(p) => p.color}
        style={liquid ? styles.carouselWithMedia : styles.carousel}
        onIndexChange={setPage}
        onScrollStart={() => setMoving(true)}
        onScrollEnd={(i) => {
          setMoving(false);
          setPage(i);
          setRests((n) => n + 1);
        }}
        renderItem={({ item, offset }) => (
          <Card
            item={item}
            offset={offset}
            showImage={!liquid}
            face={isCube ? (vertical ? 'vertical' : 'horizontal') : undefined}
          />
        )}
      />

      <Text style={styles.status} testID="layouts-status">
        Page {page + 1} / {data.length} · {moving ? 'moving' : 'at rest'} · onScrollEnd ×{rests} ·{' '}
        {I18nManager.isRTL ? 'RTL' : 'LTR'}
      </Text>

      <Label>Page effect</Label>
      <Chips
        labels={EFFECTS.map((e) => e.label)}
        selected={effect}
        onSelect={(i) => {
          setEffect(i);
          setPeekOverride(null);
        }}
      />
      <Label>Snap mode</Label>
      <Chips labels={SNAPS} selected={SNAPS.indexOf(snap)} onSelect={(i) => setSnap(SNAPS[i])} />
      <Label>Animation</Label>
      <Chips labels={ANIMATIONS.map((a) => a.label)} selected={anim} onSelect={setAnim} />

      <View style={styles.toggles}>
        <Toggle label="Liquid images (media above the cards)" value={liquid} onChange={setLiquid} />
        <Toggle label="Peek at neighbors (pageSize 72%)" value={peek} onChange={setPeekOverride} />
        <Toggle label="Tap to navigate (left 30% back, rest forward)" value={tap} onChange={setTap} />
        <Toggle label="Loop" value={loop} onChange={setLoop} />
        <Toggle label="Vertical" value={vertical} onChange={setVertical} />
      </View>
    </ScrollView>
  );
}

/**
 * The card. Its title slides at half speed using the page's `offset`. With the
 * liquid media on, the image lives in the media area instead of the card.
 */
function Card({
  item,
  offset,
  showImage,
  face,
}: {
  item: Product;
  offset: SharedValue<number>;
  showImage: boolean;
  /** A face of the cube: fills the page along the axis it turns on. */
  face?: 'horizontal' | 'vertical';
}) {
  // A face turning away from the light gets darker.
  const shade = useAnimatedStyle(() => ({ opacity: Math.min(Math.abs(offset.value), 1) * 0.45 }));
  const title = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(offset.value, [-1, 0, 1], [-60, 0, 60]) }],
    opacity: interpolate(Math.abs(offset.value), [0, 0.8], [1, 0.3]),
  }));
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: item.color },
        face === 'horizontal' && styles.faceHorizontal,
        face === 'vertical' && styles.faceVertical,
      ]}
    >
      {showImage && <Image source={item.image} style={styles.cardImage} resizeMode="contain" />}
      <Animated.Text style={[styles.cardTitle, title]}>{item.title}</Animated.Text>
      {!showImage && <Text style={styles.cardText}>{item.description}</Text>}
      {face && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.faceShade, shade]} pointerEvents="none" />
      )}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Chips({
  labels,
  selected,
  onSelect,
}: {
  labels: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={styles.chips}>
      {labels.map((l, i) => (
        <Pressable
          key={l}
          onPress={() => onSelect(i)}
          style={[styles.chip, i === selected && styles.chipOn]}
          testID={`chip-${l}`}
        >
          <Text style={[styles.chipText, i === selected && styles.chipTextOn]}>{l}</Text>
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

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 10 },
  carousel: { height: 380 },
  carouselWithMedia: { height: 500, borderRadius: 26, backgroundColor: '#fff' },
  cardText: { fontSize: 14, lineHeight: 19, color: '#ffffffd9', textAlign: 'center', paddingHorizontal: 18 },
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardImage: { width: '62%', height: '52%' },
  // Cube faces meet at their edges: no gap, no corners, no shadow (a shadow
  // on a view turned in 3D is drawn flat on Android).
  faceHorizontal: { marginHorizontal: 0, borderRadius: 0, elevation: 0, shadowOpacity: 0 },
  faceVertical: { marginVertical: 0, borderRadius: 0, elevation: 0, shadowOpacity: 0 },
  faceShade: { backgroundColor: '#000' },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  label: { marginTop: 6, fontSize: 13, color: '#6e6e73' },
  status: { fontSize: 13, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#5b4bd6' },
  chipText: { fontSize: 14, color: '#1c1c1e' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  toggles: { marginTop: 6, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleText: { fontSize: 15, color: '#1c1c1e', flexShrink: 1 },
});
