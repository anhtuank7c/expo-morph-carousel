import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { imageTargetFor, usePrefetchImages } from 'expo-morph-carousel';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { heightFor, photos, REMOTE_MEDIA_HEIGHT, REMOTE_SIDE_MARGIN, unsplashUrl } from '../data/products';

const demos: { href: Href; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    href: '/product',
    title: 'Product showcase',
    subtitle: 'Liquid morph between product shots, sliding text, dots and a button',
    icon: 'cube-outline',
  },
  {
    href: '/onboarding',
    title: 'Onboarding',
    subtitle: 'Full-screen background media, Skip and Next driven by the ref API',
    icon: 'rocket-outline',
  },
  {
    href: '/playground',
    title: 'Playground',
    subtitle: 'Every preset, a custom effect, loop, autoplay, vertical, liquid tuning',
    icon: 'options-outline',
  },
  {
    href: '/remote',
    title: 'Remote images',
    subtitle: 'Photos from the network with placeholder blobs, cover fit, loop and autoplay',
    icon: 'cloud-download-outline',
  },
];

export default function Home() {
  // Warm the cache for the "Remote images" screen while the user is still
  // here: build the same Unsplash URLs that screen's carousel will request
  // (same area, pixel ratio and fit), and download them at low priority.
  const { width } = useWindowDimensions();
  const target = imageTargetFor(
    { width: width - REMOTE_SIDE_MARGIN * 2, height: REMOTE_MEDIA_HEIGHT },
    PixelRatio.get(),
    'cover',
  );
  const prefetch = usePrefetchImages(
    photos.map((p) => unsplashUrl(p.id, target.width, heightFor(target.width))),
  );

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.prefetch} testID="prefetch-status">
        Remote images prefetched: {prefetch.loaded}/{prefetch.total}
        {prefetch.failed ? ` · ${prefetch.failed} failed` : ''} at {target.width}w
      </Text>
      {demos.map((d) => (
        <Link key={d.title} href={d.href} asChild>
          <Pressable style={styles.row} testID={`demo-${d.title}`}>
            <View style={styles.icon}>
              <Ionicons name={d.icon} size={22} color="#5b4bd6" />
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{d.title}</Text>
              <Text style={styles.subtitle}>{d.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#c7c7cc" />
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  prefetch: { fontSize: 12, color: '#6e6e73', marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#efedfc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  subtitle: { fontSize: 13, color: '#6e6e73' },
});
