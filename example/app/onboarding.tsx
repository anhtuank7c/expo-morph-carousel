import { router } from 'expo-router';
import { MorphCarousel, type MorphCarouselRef } from 'expo-morph-carousel';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { products } from '../data/products';
import { column, sides } from '../data/layout';

const steps = products.slice(0, 4);
const tints = steps.map((s) => s.color);

/**
 * Full-screen onboarding. The media fills the background, the text sits in
 * the lower half, and the footer buttons use the ref API. The background tint
 * follows the swipe through `positionValue`.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const carousel = useRef<MorphCarouselRef>(null);
  const position = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const last = index === steps.length - 1;

  const background = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      position.value,
      steps.map((_, i) => i),
      tints.map((c) => `${c}22`),
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.screen,
        background,
        sides(insets),
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Pressable style={styles.skip} onPress={() => router.back()} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
      <MorphCarousel
        ref={carousel}
        testID="onboarding-carousel"
        data={steps}
        keyExtractor={(s) => s.id}
        getImage={(s) => s.image}
        getPlaceholderColor={(s) => s.color}
        getAccessibilityLabel={(s) => s.title}
        accessibilityLabel="Introduction"
        mediaPosition="background"
        mediaPadding={64}
        mediaStyle={styles.media}
        positionValue={position}
        onIndexChange={setIndex}
        style={[styles.carousel, column]}
        pageStyle={styles.pageFrame}
        pagination={{ activeColor: '#1c1c1e', inactiveColor: '#1c1c1e33' }}
        renderItem={({ item, index: i }) => (
          <View style={styles.page}>
            <Text style={styles.step}>
              Step {i + 1} of {steps.length}
            </Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
        renderFooter={() => (
          <Pressable
            testID="onboarding-next"
            style={styles.next}
            onPress={() => (last ? router.back() : carousel.current?.next())}
          >
            <Text style={styles.nextText}>{last ? 'Get started' : 'Next'}</Text>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  skip: { alignSelf: 'flex-end', padding: 16 },
  skipText: { fontSize: 16, color: '#6e6e73' },
  carousel: { flex: 1 },
  media: { bottom: '42%' },
  pageFrame: { justifyContent: 'flex-end' },
  page: { paddingHorizontal: 32, paddingBottom: 16, gap: 10 },
  step: { fontSize: 13, fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: '800', color: '#1c1c1e' },
  description: { fontSize: 16, lineHeight: 22, color: '#3a3a3c' },
  next: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
