import { Ionicons } from '@expo/vector-icons';
import { imageTargetFor, MorphCarousel, usePrefetchImages, type MorphCarouselRef } from 'expo-morph-carousel';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { avatar, photo, photoFor, storyUsers, type StoryUser } from '../data/demos';
import { column, sides } from '../data/layout';

/**
 * Stories like the big social apps have them. Two carousels:
 *
 * - the users, as the faces of a cube (`pageEffect="cube"`): swipe to the
 *   next person, or let the last frame hand over;
 * - each user's frames, full screen behind the UI (`mediaPosition="background"`),
 *   melting into each other with the liquid effect. Taps on the left and
 *   right go back and forward, a long press pauses, and a timer drives the
 *   progress bars and moves on through the ref API.
 */

const FRAME_MS = 5000;

export default function StoriesScreen() {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  // Download every frame at the size the full-screen viewer will ask for
  // while the tray is on screen, so a story opens without waiting.
  const window = useWindowDimensions();
  const target = imageTargetFor(window, PixelRatio.get(), 'cover');
  usePrefetchImages(storyUsers.flatMap((u) => u.frames.map((f) => photoFor(f.id, target))));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.screen, column]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
        {storyUsers.map((u, i) => (
          <Pressable
            key={u.id}
            style={styles.trayItem}
            onPress={() => setOpen(i)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${u.name}'s story`}
          >
            <View style={[styles.ring, { borderColor: seen[u.id] ? '#c7c7cc' : u.color }]}>
              <Image source={{ uri: avatar(u.avatar, 160) }} style={styles.trayAvatar} />
            </View>
            <Text style={styles.trayName} numberOfLines={1}>
              {u.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.hint}>
        Tap a story. Inside, tap left or right, hold to pause, swipe to the next person: the people turn like
        a cube, the photos melt into each other.
      </Text>
      {storyUsers.map((u) => (
        <View key={u.id} style={styles.post}>
          <View style={styles.postHeader}>
            <Image source={{ uri: avatar(u.avatar, 80) }} style={styles.postAvatar} />
            <Text style={styles.postName}>{u.name}</Text>
          </View>
          <Image source={{ uri: photo(u.frames[0].id, 900, 900) }} style={styles.postImage} />
          <Text style={styles.postCaption}>{u.frames[0].caption}</Text>
        </View>
      ))}
      <Modal
        visible={open !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(null)}
      >
        {/* A modal is a new root: gestures and safe areas need their own providers. */}
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.viewerRoot}>
            {open !== null && (
              <Viewer
                initial={open}
                onSeen={(id) => setSeen((s) => (s[id] ? s : { ...s, [id]: true }))}
                onClose={() => setOpen(null)}
              />
            )}
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </Modal>
    </ScrollView>
  );
}

function Viewer({
  initial,
  onSeen,
  onClose,
}: {
  initial: number;
  onSeen: (id: string) => void;
  onClose: () => void;
}) {
  const users = useRef<MorphCarouselRef>(null);
  const [current, setCurrent] = useState(initial);
  useEffect(() => onSeen(storyUsers[current].id), [current, onSeen]);

  const next = useCallback(() => {
    if (current < storyUsers.length - 1) users.current?.next();
    else onClose();
  }, [current, onClose]);
  const prev = useCallback(() => {
    if (current > 0) users.current?.prev();
  }, [current]);

  return (
    <MorphCarousel
      ref={users}
      data={storyUsers}
      keyExtractor={(u) => u.id}
      initialIndex={initial}
      pageEffect="cube"
      pagination={false}
      windowSize={1}
      onIndexChange={setCurrent}
      accessibilityLabel="Stories"
      getAccessibilityLabel={(u) => `${u.name}'s story`}
      style={styles.viewer}
      renderItem={({ item, index }) => (
        <UserStory user={item} active={index === current} onEnd={next} onStart={prev} onClose={onClose} />
      )}
    />
  );
}

function UserStory({
  user,
  active,
  onEnd,
  onStart,
  onClose,
}: {
  user: StoryUser;
  active: boolean;
  onEnd: () => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const frames = useRef<MorphCarouselRef>(null);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);
  const last = user.frames.length - 1;

  const forward = useCallback(() => {
    if (frames.current && frames.current.getIndex() < last) frames.current.next();
    else onEnd();
  }, [last, onEnd]);
  const back = useCallback(() => {
    if (frames.current && frames.current.getIndex() > 0) frames.current.prev();
    else onStart();
  }, [onStart]);

  const run = useCallback(
    (from: number) => {
      progress.value = from;
      progress.value = withTiming(1, { duration: FRAME_MS * (1 - from), easing: Easing.linear }, (done) => {
        if (done) runOnJS(forward)();
      });
    },
    [forward, progress],
  );

  // Restart the bar for every frame, and only for the user in view.
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (active) run(0);
  }, [active, frame, progress, run]);

  const pause = () => {
    cancelAnimation(progress);
    setPaused(true);
  };
  const resume = () => {
    if (!paused) return;
    setPaused(false);
    if (active) run(progress.value);
  };

  const shown = user.frames[frame];
  return (
    <View style={styles.story}>
      <MorphCarousel
        ref={frames}
        data={user.frames}
        keyExtractor={(f) => f.id}
        getImage={(f, _i, target) => ({ uri: photoFor(f.id, target) })}
        mediaPosition="background"
        mediaFit="cover"
        mediaPadding={0}
        // Photos keep their rectangle; only their content melts.
        liquid={{ preserveShape: true, blur: 34 }}
        animation={{ type: 'timing', duration: 520 }}
        gestureEnabled={false}
        pagination={false}
        onIndexChange={setFrame}
        accessibilityLabel={`${user.name}'s photos`}
        getAccessibilityLabel={(f) => f.caption}
        style={StyleSheet.absoluteFill}
      />

      {/* Taps: left third back, the rest forward; hold to pause. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => (e.nativeEvent.locationX < width * 0.3 ? back() : forward())}
        onLongPress={pause}
        delayLongPress={180}
        onPressOut={resume}
        accessibilityRole="button"
        accessibilityLabel="Next photo"
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'decrement' ? back() : forward())}
      />

      <View
        style={[styles.top, sides(insets, 10), { paddingTop: insets.top + 8, opacity: paused ? 0 : 1 }]}
        pointerEvents="box-none"
      >
        <View style={styles.bars}>
          {user.frames.map((f, i) => (
            <Bar key={f.id} index={i} frame={frame} progress={progress} />
          ))}
        </View>
        <View style={styles.header}>
          <Image source={{ uri: avatar(user.avatar, 96) }} style={styles.headerAvatar} />
          <Text style={styles.headerName}>{user.name}</Text>
          <Text style={styles.headerTime}>{shown.time}</Text>
          <View style={styles.flex} />
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.bottom,
          sides(insets, 12),
          { paddingBottom: insets.bottom + 12, opacity: paused ? 0 : 1 },
        ]}
      >
        <Text style={styles.caption}>{shown.caption}</Text>
        <View style={styles.replyRow}>
          <View style={styles.reply}>
            <Text style={styles.replyText}>Send message</Text>
          </View>
          <Ionicons name="heart-outline" size={28} color="#fff" />
          <Ionicons name="paper-plane-outline" size={26} color="#fff" />
        </View>
      </View>
    </View>
  );
}

function Bar({ index, frame, progress }: { index: number; frame: number; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: `${(index < frame ? 1 : index === frame ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

const shadow = { textShadowColor: '#0008', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  screen: { paddingVertical: 12, gap: 14 },
  tray: { paddingHorizontal: 12, gap: 14 },
  trayItem: { alignItems: 'center', width: 76, gap: 6 },
  ring: { padding: 3, borderRadius: 40, borderWidth: 3 },
  trayAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#ddd' },
  trayName: { fontSize: 12, color: '#1c1c1e' },
  hint: { fontSize: 13, lineHeight: 18, color: '#6e6e73', paddingHorizontal: 16 },
  post: { backgroundColor: '#fff', paddingBottom: 12, gap: 10 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  postAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd' },
  postName: { fontSize: 14, fontWeight: '700', color: '#1c1c1e' },
  postImage: { width: '100%', aspectRatio: 1, backgroundColor: '#e5e5ea' },
  postCaption: { fontSize: 14, color: '#1c1c1e', paddingHorizontal: 12 },
  viewerRoot: { flex: 1, backgroundColor: '#000' },
  viewer: { flex: 1, backgroundColor: '#000' },
  story: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#ffffff59', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#555',
  },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 14, ...shadow },
  headerTime: { color: '#ffffffb3', fontSize: 13, ...shadow },
  flex: { flex: 1 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12 },
  caption: { color: '#fff', fontSize: 20, fontWeight: '700', ...shadow },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reply: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ffffffb3',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  replyText: { color: '#fff', fontSize: 14 },
});
