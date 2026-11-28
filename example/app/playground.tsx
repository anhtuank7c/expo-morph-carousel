import { MorphCarousel, type MediaEffect, type MediaEffectFn } from 'expo-morph-carousel';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { products } from '../data/products';
import { column } from '../data/layout';

/** A custom effect: the image turns like a card around its vertical axis. */
const flip: MediaEffectFn = ({ offset }) => {
  'worklet';
  const angle = Math.max(-1, Math.min(1, offset)) * 90;
  return {
    opacity: Math.abs(offset) < 0.5 ? 1 : 0,
    transform: [{ perspective: 800 }, { rotateY: `${angle}deg` }],
  };
};

const effects: { label: string; value: MediaEffect }[] = [
  { label: 'liquid', value: 'liquid' },
  { label: 'crossfade', value: 'crossfade' },
  { label: 'slide', value: 'slide' },
  { label: 'parallax', value: 'parallax' },
  { label: 'stack', value: 'stack' },
  { label: 'custom flip', value: flip },
];

export default function PlaygroundScreen() {
  const [effect, setEffect] = useState(0);
  const [loop, setLoop] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [vertical, setVertical] = useState(false);
  const [blur, setBlur] = useState(28);
  const [index, setIndex] = useState(0);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.screen, column]}>
      <MorphCarousel
        // Remount when the direction changes: the pages are laid out per axis.
        key={vertical ? 'v' : 'h'}
        testID="playground-carousel"
        data={products}
        keyExtractor={(p) => p.id}
        getImage={(p) => p.image}
        getPlaceholderColor={(p) => p.color}
        getAccessibilityLabel={(p) => p.title}
        effect={effects[effect].value}
        liquid={{ blur }}
        loop={loop}
        autoplay={autoplay ? { interval: 2500 } : false}
        direction={vertical ? 'vertical' : 'horizontal'}
        initialIndex={index}
        onIndexChange={setIndex}
        mediaHeight={240}
        mediaPadding={24}
        style={styles.card}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Text style={styles.title}>{item.title}</Text>
          </View>
        )}
      />

      <Text style={styles.label}>Effect</Text>
      <View style={styles.chips}>
        {effects.map((e, i) => (
          <Pressable
            key={e.label}
            onPress={() => setEffect(i)}
            style={[styles.chip, i === effect && styles.chipOn]}
            testID={`effect-${e.label}`}
          >
            <Text style={[styles.chipText, i === effect && styles.chipTextOn]}>{e.label}</Text>
          </Pressable>
        ))}
      </View>

      {effects[effect].value === 'liquid' && (
        <>
          <Text style={styles.label}>Liquid blur: {blur}</Text>
          <View style={styles.chips}>
            {[12, 20, 28, 40, 56].map((b) => (
              <Pressable
                key={b}
                onPress={() => setBlur(b)}
                style={[styles.chip, b === blur && styles.chipOn]}
              >
                <Text style={[styles.chipText, b === blur && styles.chipTextOn]}>{b}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <View style={styles.toggles}>
        <Toggle label="Loop" value={loop} onChange={setLoop} />
        <Toggle label="Autoplay (2.5 s)" value={autoplay} onChange={setAutoplay} />
        <Toggle label="Vertical" value={vertical} onChange={setVertical} />
      </View>
    </ScrollView>
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
  card: { height: 360, borderRadius: 24, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  label: { marginTop: 8, fontSize: 13, color: '#6e6e73' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#5b4bd6' },
  chipText: { fontSize: 14, color: '#1c1c1e' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  toggles: { marginTop: 8, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 14 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleText: { fontSize: 15, color: '#1c1c1e' },
});
