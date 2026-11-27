import { MorphCarousel } from 'expo-morph-carousel';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { products } from '../data/products';

/**
 * The layout from the SwiftUI "morphing carousel": a card with the product
 * image on top, the title and description sliding underneath, dots and a
 * button at the bottom. The image melts into the next one while the text
 * slides.
 */
export default function ProductScreen() {
  return (
    // "automatic": on iOS the native header is translucent and the screen
    // starts under it; the scroll view insets its content below the header.
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      <Text style={styles.section}>Demo</Text>
      <MorphCarousel
        testID="product-carousel"
        data={products}
        keyExtractor={(p) => p.id}
        getImage={(p) => p.image}
        getPlaceholderColor={(p) => p.color}
        getAccessibilityLabel={(p) => p.title}
        accessibilityLabel="Products"
        mediaHeight={300}
        // Tapping works too: the left third goes back, the rest forward.
        tapToNavigate
        mediaPadding={28}
        style={styles.card}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
        renderFooter={({ item }) => (
          <Pressable style={[styles.button, { backgroundColor: item?.color ?? '#1c1c1e' }]}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16 },
  section: { fontSize: 13, color: '#6e6e73', marginBottom: 8, marginLeft: 4 },
  card: { height: 560, borderRadius: 28, backgroundColor: '#fff' },
  page: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 12, gap: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1c1e' },
  description: { fontSize: 15, lineHeight: 21, color: '#6e6e73', textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
