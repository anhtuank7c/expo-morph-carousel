import { MorphCarousel } from 'expo-morph-carousel';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * The smallest useful carousel: images that melt into each other, a title
 * and a description per page, dots and a button. This is the snippet of the
 * Getting started page, as it runs.
 */

const shapes = [
  {
    id: 'orb',
    title: 'Meet Orb',
    description: 'A glossy sphere. Swipe to watch it melt into the next shape.',
    image: require('../assets/shapes/orb.png'),
  },
  {
    id: 'tile',
    title: 'Explore Tile',
    description: 'A rounded square with a warm gradient.',
    image: require('../assets/shapes/tile.png'),
  },
  {
    id: 'ring',
    title: 'Discover Ring',
    description: 'The liquid fills the hole, then opens it again.',
    image: require('../assets/shapes/ring.png'),
  },
  {
    id: 'heart',
    title: 'Love Heart',
    description: 'Watch the point grow out of the blob.',
    image: require('../assets/shapes/heart.png'),
  },
];

export default function Basic() {
  return (
    <View style={styles.screen}>
      <MorphCarousel
        data={shapes}
        keyExtractor={(s) => s.id}
        getImage={(s) => s.image}
        getAccessibilityLabel={(s) => s.title}
        style={styles.card}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
        renderFooter={({ next }) => (
          <Pressable style={styles.button} onPress={next}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  card: { height: 520, borderRadius: 28, backgroundColor: '#fff' },
  page: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1c1e' },
  description: { fontSize: 15, lineHeight: 21, color: '#6e6e73', textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
