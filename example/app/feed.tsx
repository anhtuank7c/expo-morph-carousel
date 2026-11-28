import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MorphCarousel, type MediaEffect } from 'expo-morph-carousel';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avatar, compact, feedPosts, photoFor, type FeedPost } from '../data/demos';

/**
 * A full-screen vertical feed like the short-video apps: one post per page,
 * swiped up and down (`direction="vertical"`), the photo behind the UI
 * (`mediaPosition="background"`). Double tap to like, the record turns while
 * a post is in view, and the chip at the top switches the transition.
 */

const EFFECTS: { label: string; value: MediaEffect }[] = [
  { label: 'Liquid', value: 'liquid' },
  { label: 'Slide', value: 'slide' },
  { label: 'Parallax', value: 'parallax' },
];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [effect, setEffect] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const toggle = (id: string, value?: boolean) => setLiked((l) => ({ ...l, [id]: value ?? !l[id] }));

  return (
    <View style={styles.screen}>
      <MorphCarousel
        data={feedPosts}
        keyExtractor={(p) => p.id}
        direction="vertical"
        getImage={(p, _i, target) => ({ uri: photoFor(p.id, target) })}
        getPlaceholderColor={(p) => p.color}
        mediaPosition="background"
        mediaFit="cover"
        mediaPadding={0}
        effect={EFFECTS[effect].value}
        liquid={{ preserveShape: true, blur: 30 }}
        pagination={false}
        onIndexChange={setIndex}
        accessibilityLabel="Feed"
        getAccessibilityLabel={(p) => `${p.user}: ${p.caption}`}
        style={StyleSheet.absoluteFill}
        renderItem={({ item, index: i }) => (
          <Post
            post={item}
            active={i === index}
            liked={!!liked[item.id]}
            onLike={(v) => toggle(item.id, v)}
          />
        )}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <View style={styles.tabs}>
          <Text style={styles.tabOff}>Following</Text>
          <Text style={styles.tabOn}>For you</Text>
        </View>
        <Pressable
          onPress={() => setEffect((e) => (e + 1) % EFFECTS.length)}
          style={styles.effect}
          accessibilityRole="button"
          accessibilityLabel={`Transition: ${EFFECTS[effect].label}`}
        >
          <Text style={styles.effectText}>{EFFECTS[effect].label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Post({
  post,
  active,
  liked,
  onLike,
}: {
  post: FeedPost;
  active: boolean;
  liked: boolean;
  onLike: (value?: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const lastTap = useRef(0);
  const burst = useSharedValue(0);
  const spin = useSharedValue(0);
  const played = useSharedValue(0);

  // The record turns and the progress bar fills while the post is in view.
  useEffect(() => {
    if (!active) {
      cancelAnimation(spin);
      cancelAnimation(played);
      played.value = 0;
      return;
    }
    spin.value = withRepeat(withTiming(spin.value + 360, { duration: 4000, easing: Easing.linear }), -1);
    played.value = 0;
    played.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
  }, [active, spin, played]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      onLike(true);
      burst.value = 0;
      burst.value = withSequence(
        withTiming(1, { duration: 220 }),
        withTiming(1, { duration: 300 }),
        withTiming(2, { duration: 260 }),
      );
    }
    lastTap.current = now;
  };

  const heart = useAnimatedStyle(() => ({
    opacity: burst.value === 0 || burst.value >= 2 ? 0 : burst.value < 1 ? burst.value : 2 - burst.value,
    transform: [{ scale: burst.value < 1 ? 0.4 + burst.value * 0.8 : 1.2 + (burst.value - 1) * 0.4 }],
  }));
  const record = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const bar = useAnimatedStyle(() => ({ width: `${played.value * 100}%` }));

  return (
    <View style={styles.post}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} accessibilityLabel="Double tap to like" />
      <Animated.View style={[styles.burst, heart]} pointerEvents="none">
        <Ionicons name="heart" size={120} color="#ff2d55" />
      </Animated.View>

      <View style={[styles.actions, { bottom: insets.bottom + 96 }]}>
        <View style={styles.author}>
          <Image source={{ uri: avatar(post.avatar, 120) }} style={styles.authorAvatar} />
          <View style={styles.follow}>
            <Ionicons name="add" size={14} color="#fff" />
          </View>
        </View>
        <Action
          icon={liked ? 'heart' : 'heart-outline'}
          color={liked ? '#ff2d55' : '#fff'}
          label={compact(post.likes + (liked ? 1 : 0))}
          onPress={() => onLike()}
        />
        <Action icon="chatbubble-ellipses-outline" label={compact(post.comments)} />
        <Action icon="bookmark-outline" label="Save" />
        <Action icon="arrow-redo-outline" label="Share" />
        <Animated.View style={[styles.record, record]}>
          <Image source={{ uri: avatar(post.avatar, 80) }} style={styles.recordInner} />
        </Animated.View>
      </View>

      <View style={[styles.info, { bottom: insets.bottom + 24 }]}>
        <Text style={styles.user}>@{post.user}</Text>
        <Text style={styles.caption}>{post.caption}</Text>
        <View style={styles.sound}>
          <Ionicons name="musical-notes" size={14} color="#fff" />
          <Text style={styles.soundText} numberOfLines={1}>
            {post.sound}
          </Text>
        </View>
      </View>
      <View style={[styles.progress, { bottom: insets.bottom + 8 }]}>
        <Animated.View style={[styles.progressFill, bar]} />
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  color = '#fff',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={34} color={color} style={styles.iconShadow} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const shadow = { textShadowColor: '#0009', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  tabs: { flexDirection: 'row', gap: 18 },
  tabOff: { color: '#ffffffaa', fontSize: 16, fontWeight: '600', ...shadow },
  tabOn: { color: '#fff', fontSize: 16, fontWeight: '800', ...shadow },
  effect: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#0006' },
  effectText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  post: { flex: 1 },
  burst: { position: 'absolute', alignSelf: 'center', top: '38%' },
  actions: { position: 'absolute', right: 10, alignItems: 'center', gap: 18 },
  author: { marginBottom: 6 },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#555',
  },
  follow: {
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { alignItems: 'center', gap: 2 },
  iconShadow: { ...shadow },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700', ...shadow },
  record: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
    borderWidth: 8,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: { width: 24, height: 24, borderRadius: 12 },
  info: { position: 'absolute', left: 14, right: 84, gap: 6 },
  user: { color: '#fff', fontSize: 16, fontWeight: '800', ...shadow },
  caption: { color: '#fff', fontSize: 14, lineHeight: 19, ...shadow },
  sound: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  soundText: { color: '#fff', fontSize: 13, ...shadow },
  progress: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#ffffff33' },
  progressFill: { height: 2, backgroundColor: '#fff' },
});
