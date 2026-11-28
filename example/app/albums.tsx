import { Ionicons } from '@expo/vector-icons';
import { MorphCarousel, pageEffects, type MorphCarouselRef } from 'expo-morph-carousel';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { albums, photo, type Album } from '../data/demos';

/**
 * A music player: album covers in a coverflow (`pageEffect` coverflow with a
 * page narrower than the screen, so the neighbors show), a blurred copy of the
 * cover behind everything that cross-fades with the swipe (`positionValue`),
 * and player controls that drive the carousel through its ref.
 */

const coverflow = pageEffects.coverflow({ angle: 52, scale: 0.8, spacing: 0.56 });

export default function AlbumsScreen() {
  const { width } = useWindowDimensions();
  const player = useRef<MorphCarouselRef>(null);
  const position = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const album = albums[index];
  const cover = Math.round(width * 0.64);

  // A pretend playback clock: a new album starts from 0, the end skips ahead.
  const onAlbum = (i: number) => {
    setIndex(i);
    setElapsed(0);
  };
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    if (elapsed >= album.length) player.current?.next();
  }, [elapsed, album.length]);

  return (
    <View style={styles.screen}>
      {albums.map((a, i) => (
        <Backdrop key={a.id} album={a} i={i} position={position} />
      ))}
      <View style={styles.dim} />

      <Text style={styles.heading}>Now playing</Text>
      <MorphCarousel
        ref={player}
        data={albums}
        keyExtractor={(a) => a.id}
        pageEffect={coverflow}
        pageSize={cover}
        loop
        tapToNavigate
        pagination={false}
        positionValue={position}
        onIndexChange={onAlbum}
        accessibilityLabel="Albums"
        getAccessibilityLabel={(a) => `${a.title} by ${a.artist}`}
        style={{ height: cover + 40 }}
        renderItem={({ item }) => (
          <View style={styles.coverWrap}>
            <Image
              source={{ uri: photo(item.id, 600, 600) }}
              style={[styles.cover, { backgroundColor: item.color }]}
            />
          </View>
        )}
      />

      <View style={styles.info}>
        <Text style={styles.title}>{album.title}</Text>
        <Text style={styles.artist}>{album.artist}</Text>
      </View>

      <View style={styles.timeline}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${(elapsed / album.length) * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{clock(elapsed)}</Text>
          <Text style={styles.time}>-{clock(album.length - elapsed)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Ionicons name="shuffle" size={24} color="#ffffffb3" />
        <Pressable
          onPress={() => player.current?.prev()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous"
        >
          <Ionicons name="play-skip-back" size={34} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => setPlaying((p) => !p)}
          style={styles.play}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={36} color="#111" />
        </Pressable>
        <Pressable
          onPress={() => player.current?.next()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Ionicons name="play-skip-forward" size={34} color="#fff" />
        </Pressable>
        <Ionicons name="repeat" size={24} color="#ffffffb3" />
      </View>
    </View>
  );
}

/** One blurred cover behind the player, visible while its album is near the center. */
function Backdrop({ album, i, position }: { album: Album; i: number; position: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // With loop the position keeps counting; compare on the circle.
    const n = albums.length;
    const d = Math.abs(((((position.value - i) % n) + n + n / 2) % n) - n / 2);
    return { opacity: interpolate(d, [0, 1], [1, 0], 'clamp') };
  });
  return (
    <Animated.Image
      source={{ uri: photo(album.id, 200, 400) }}
      blurRadius={30}
      style={[StyleSheet.absoluteFill, { backgroundColor: album.color }, style]}
    />
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111', justifyContent: 'center', gap: 18 },
  dim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#00000059' },
  heading: {
    color: '#ffffffb3',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  coverWrap: {
    flex: 1,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 14 },
  info: { alignItems: 'center', gap: 4, paddingHorizontal: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  artist: { color: '#ffffffb3', fontSize: 16, fontWeight: '600' },
  timeline: { paddingHorizontal: 32, gap: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: '#ffffff40', overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: '#fff' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#ffffffb3', fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  play: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
