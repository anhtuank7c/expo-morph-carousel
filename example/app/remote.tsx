import { MorphCarousel } from 'expo-morph-carousel';
import { StyleSheet, Text, View } from 'react-native';

import { photos } from '../data/products';

/**
 * Photos loaded from the network. Each item has a placeholder color that
 * shows as a soft blob until its image arrives, and the carousel keeps the
 * next and previous two images loaded (`windowSize`), so a swipe rarely waits.
 * With `cover` the liquid effect melts whole photos into each other.
 */
export default function RemoteScreen() {
  return (
    <View style={styles.screen}>
      <MorphCarousel
        testID="remote-carousel"
        data={photos}
        keyExtractor={(p) => p.id}
        getImage={(p) => ({ uri: p.uri })}
        getPlaceholderColor={(p) => p.color}
        getAccessibilityLabel={(p) => p.title}
        accessibilityLabel="Photos"
        mediaFit="cover"
        mediaPadding={0}
        mediaHeight={320}
        liquid={{ blur: 36, threshold: 0.35 }}
        loop
        autoplay={{ interval: 3500 }}
        windowSize={2}
        style={styles.card}
        renderItem={({ item, index }) => (
          <View style={styles.page}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              Photo {index + 1} of {photos.length} · picsum.photos/id/{item.id}
            </Text>
          </View>
        )}
      />
      <Text style={styles.note}>
        Autoplay pauses while you touch the carousel and while a screen reader is on.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  card: { height: 470, borderRadius: 24, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  meta: { fontSize: 13, color: '#6e6e73' },
  note: { fontSize: 13, color: '#6e6e73', textAlign: 'center' },
});
