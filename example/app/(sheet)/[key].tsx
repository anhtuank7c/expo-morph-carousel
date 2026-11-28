import { MorphCloseButton } from 'expo-morph-menu';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { column } from '../../data/layout';
import { SHOP_INFO } from '../../data/shopMenu';

/** A row of the shop's info menu, full screen. Closing shrinks it back into the menu card. */
export default function ShopInfoScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const info = SHOP_INFO.find((i) => i.key === key) ?? SHOP_INFO[0];
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{info.label}</Text>
          <MorphCloseButton />
        </View>
        {info.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1c1c1e' },
  line: { fontSize: 16, lineHeight: 22, color: '#343a40' },
});
