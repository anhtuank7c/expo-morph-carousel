import { Ionicons } from '@expo/vector-icons';
import { MorphCarousel } from 'expo-morph-carousel';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { banners, deals, photo, photoFor, type Deal } from '../data/demos';
import { column, useContentWidth } from '../data/layout';

/**
 * A shopping app's flash sale page, three carousels:
 *
 * - a hero banner that loops and autoplays, the photos melting into each
 *   other (`liquid.preserveShape` keeps their corners);
 * - a row of deal cards narrower than the screen (`pageSize`, `pageAlign:
 *   'start'`) that glides over several cards with `snapMode="momentum"`;
 * - a "deal of the day" with the product photo in the media area and the
 *   price sliding underneath.
 */

const SIDE = 16;

export default function FlashSaleScreen() {
  // Sizes follow the content column, so a tablet shows a phone-sized page, centered.
  const inner = useContentWidth() - SIDE * 2;
  const left = useCountdown(2 * 3600 + 13 * 60 + 45);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.screen, column]}>
      <MorphCarousel
        data={banners}
        keyExtractor={(b) => b.id}
        getImage={(b, _i, target) => ({ uri: photoFor(b.id, target) })}
        getPlaceholderColor={(b) => b.color}
        mediaPosition="background"
        mediaFit="cover"
        mediaPadding={0}
        liquid={{ preserveShape: true }}
        loop
        autoplay={{ interval: 3500 }}
        tapToNavigate
        pagination={{ activeColor: '#fff', inactiveColor: '#ffffff80', size: 6, activeWidth: 18 }}
        accessibilityLabel="Promotions"
        getAccessibilityLabel={(b) => `${b.title}, ${b.subtitle}`}
        style={[styles.banner, { height: Math.round(inner * 0.5) }]}
        pageStyle={styles.bannerPage}
        // The dots sit on the photo instead of under it.
        footerStyle={styles.bannerDots}
        renderItem={({ item }) => (
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{item.title}</Text>
            <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.saleHeader}>
        <Ionicons name="flash" size={22} color="#ff3b30" />
        <Text style={styles.saleTitle}>Flash sale</Text>
        <Text style={styles.endsIn}>ends in</Text>
        {left.map((part, i) => (
          <View key={i} style={styles.clockGroup}>
            {i > 0 && <Text style={styles.clockColon}>:</Text>}
            <View style={styles.clock}>
              <Text style={styles.clockText}>{part}</Text>
            </View>
          </View>
        ))}
        <View style={styles.flex} />
        <Text style={styles.seeAll}>See all</Text>
      </View>

      <MorphCarousel
        data={deals}
        keyExtractor={(d) => d.id}
        pageSize={Math.round(inner * 0.44)}
        pageGap={12}
        pageAlign="start"
        snapMode="momentum"
        windowSize={4}
        pagination={false}
        accessibilityLabel="Flash sale deals"
        getAccessibilityLabel={(d) => `${d.name}, $${d.price}, was $${d.was}`}
        style={{ height: Math.round(inner * 0.44) + 128 }}
        renderItem={({ item }) => <DealCard deal={item} />}
      />

      <Text style={styles.section}>Deal of the day</Text>
      <MorphCarousel
        data={deals.slice(0, 5)}
        keyExtractor={(d) => d.id}
        getImage={(d, _i, target) => ({ uri: photoFor(d.id, target) })}
        getPlaceholderColor={(d) => d.color}
        mediaFit="cover"
        mediaPadding={0}
        mediaHeight={Math.round(inner * 0.62)}
        liquid={{ preserveShape: true }}
        autoplay={{ interval: 4000 }}
        tapToNavigate={{ area: 'media' }}
        accessibilityLabel="Deal of the day"
        getAccessibilityLabel={(d) => d.name}
        style={styles.daily}
        mediaStyle={styles.dailyMedia}
        renderItem={({ item }) => (
          <View style={styles.dailyPage}>
            <Text style={styles.dailyName}>{item.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dailyPrice}>${item.price}</Text>
              <Text style={styles.was}>${item.was}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>-{Math.round((1 - item.price / item.was) * 100)}%</Text>
              </View>
            </View>
          </View>
        )}
        renderFooter={({ item }) => (
          <Pressable
            style={[styles.buy, { backgroundColor: item?.color ?? '#ff3b30' }]}
            accessibilityRole="button"
          >
            <Text style={styles.buyText}>Buy now</Text>
          </Pressable>
        )}
      />
    </ScrollView>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const off = Math.round((1 - deal.price / deal.was) * 100);
  const sold = deal.sold / deal.stock;
  return (
    <View style={styles.card}>
      <View>
        <Image
          source={{ uri: photo(deal.id, 400, 400) }}
          style={[styles.cardImage, { backgroundColor: deal.color }]}
        />
        <View style={styles.cardBadge}>
          <Text style={styles.badgeText}>-{off}%</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {deal.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.cardPrice}>${deal.price}</Text>
          <Text style={styles.was}>${deal.was}</Text>
        </View>
        <View style={styles.soldBar}>
          <View style={[styles.soldFill, { width: `${Math.max(12, sold * 100)}%` }]} />
          <Text style={styles.soldText}>{sold > 0.8 ? 'Almost gone' : `${deal.sold} sold`}</Text>
        </View>
      </View>
    </View>
  );
}

/** Hours, minutes and seconds left, two digits each. */
function useCountdown(seconds: number) {
  const [end] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((end - now) / 1000));
  return [Math.floor(left / 3600), Math.floor(left / 60) % 60, left % 60].map((n) =>
    String(n).padStart(2, '0'),
  );
}

const styles = StyleSheet.create({
  screen: { padding: SIDE, gap: 14, paddingBottom: 32 },
  banner: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#ddd' },
  bannerPage: { justifyContent: 'flex-end' },
  bannerDots: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 10 },
  bannerText: { padding: 18, paddingBottom: 30, gap: 2 },
  bannerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: '#0008',
    textShadowRadius: 8,
  },
  bannerSubtitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: '#0008',
    textShadowRadius: 8,
  },
  saleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  saleTitle: { fontSize: 20, fontWeight: '800', color: '#1c1c1e' },
  endsIn: { fontSize: 13, color: '#6e6e73', marginLeft: 4 },
  clockGroup: { flexDirection: 'row', alignItems: 'center' },
  clockColon: { fontWeight: '800', color: '#ff3b30', marginHorizontal: 2 },
  clock: { backgroundColor: '#ff3b30', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  clockText: { color: '#fff', fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  seeAll: { color: '#ff3b30', fontWeight: '700', fontSize: 14 },
  card: { flex: 1, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden' },
  cardImage: { width: '100%', aspectRatio: 1 },
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff3b30',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardBody: { padding: 10, gap: 6 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardPrice: { fontSize: 18, fontWeight: '800', color: '#ff3b30' },
  was: { fontSize: 13, color: '#8e8e93', textDecorationLine: 'line-through' },
  soldBar: {
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffe3e0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  soldFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 9, backgroundColor: '#ff6b5b' },
  soldText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: '#c0392b',
    textShadowRadius: 2,
  },
  badge: { backgroundColor: '#ff3b30', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  section: { fontSize: 20, fontWeight: '800', color: '#1c1c1e', marginTop: 6 },
  daily: { height: 520, borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden' },
  dailyMedia: { borderRadius: 0 },
  dailyPage: { flex: 1, paddingHorizontal: 18, paddingTop: 12, gap: 6 },
  dailyName: { fontSize: 20, fontWeight: '700', color: '#1c1c1e' },
  dailyPrice: { fontSize: 26, fontWeight: '800', color: '#ff3b30' },
  buy: {
    alignSelf: 'stretch',
    marginHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
