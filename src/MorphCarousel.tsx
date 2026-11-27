import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  I18nManager,
  Image,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { resolveEffect } from './effects';
import { resolveCacheOptions, useCachedUri } from './cache';
import type { ResolvedCacheOptions } from './cache/ImageCache';
import { useLiquidLayer, type LiquidItem } from './liquid';
import { clamp, nearestVirtual, pageWindow, rubberBand, snapTarget, wrap } from './math';
import { Pagination } from './Pagination';
import type { AutoplayOptions, CarouselDirection, MediaEffectFn, MorphCarouselProps } from './types';

const DEFAULT_SPRING = { damping: 26, stiffness: 220, mass: 1 };
const DEFAULT_LIQUID = { blur: 28, threshold: 0.5, sharpness: 24 };
const DEFAULT_AUTOPLAY: Required<AutoplayOptions> = {
  interval: 4000,
  reverse: false,
  whenScreenReaderEnabled: false,
};

type Size = { width: number; height: number };

export function MorphCarousel<T>({
  data,
  getImage,
  renderItem,
  keyExtractor,
  effect = 'liquid',
  liquid,
  mediaPosition = 'top',
  mediaHeight = 280,
  mediaFit = 'contain',
  mediaPadding = 16,
  getPlaceholderColor,
  imageCache,
  direction = 'horizontal',
  loop = false,
  initialIndex = 0,
  autoplay = false,
  windowSize = 2,
  spring,
  gestureEnabled = true,
  pagination = true,
  renderFooter,
  onIndexChange,
  positionValue,
  accessibilityLabel = 'Carousel',
  getAccessibilityLabel,
  ref,
  style,
  mediaStyle,
  pageStyle,
  footerStyle,
  testID,
}: MorphCarouselProps<T>) {
  const count = data.length;
  const vertical = direction === 'vertical';
  const rtl = !vertical && I18nManager.isRTL;
  const reduceMotion = useReducedMotion();
  const springConfig = useMemo(() => ({ ...DEFAULT_SPRING, ...spring }), [spring]);
  const liquidConfig = { ...DEFAULT_LIQUID, ...liquid };
  // Memoized on identity: pass a module constant or a memoized object, or each
  // parent render makes every visible image look its URI up again.
  const cacheOptions = useMemo(() => resolveCacheOptions(imageCache), [imageCache]);

  const startIndex = clamp(initialIndex, 0, Math.max(count - 1, 0));
  const position = useSharedValue(startIndex);
  const [center, setCenter] = useState(startIndex);
  const index = wrap(center, count);

  const [pageSize, setPageSize] = useState<Size>({ width: 0, height: 0 });
  const [mediaSize, setMediaSize] = useState<Size>({ width: 0, height: 0 });
  const pageExtent = useSharedValue(0);

  /* --- index tracking ----------------------------------------------------
     `position` lives on the UI thread. React only needs to know when the
     nearest page changes, to move the render window and report the index.   */
  const onIndexChangeRef = useRef(onIndexChange);
  const lastIndex = useRef(startIndex);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  });
  const onCenter = useCallback(
    (virtual: number) => {
      setCenter(virtual);
      const next = wrap(virtual, count);
      if (next !== lastIndex.current) {
        lastIndex.current = next;
        onIndexChangeRef.current?.(next);
      }
    },
    [count],
  );
  useAnimatedReaction(
    () => Math.round(position.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(onCenter)(cur);
    },
  );
  useAnimatedReaction(
    () => position.value,
    (value) => {
      if (positionValue) positionValue.value = value;
    },
  );

  // Data shrank under the current page: move back inside it.
  useEffect(() => {
    if (!loop && count > 0 && center > count - 1) {
      position.value = count - 1;
    }
  }, [count, center, loop, position]);

  /* --- navigation ------------------------------------------------------- */
  const animateTo = useCallback(
    (target: number, animated = true) => {
      cancelAnimation(position);
      position.value = animated ? withSpring(target, springConfig) : target;
    },
    [position, springConfig],
  );
  const scrollTo = useCallback(
    (to: number, options?: { animated?: boolean }) => {
      if (count === 0) return;
      const target = nearestVirtual(wrap(Math.round(to), count), Math.round(position.value), count, loop);
      animateTo(target, options?.animated ?? true);
    },
    [animateTo, count, loop, position],
  );
  const step = useCallback(
    (delta: number, options?: { animated?: boolean }) => {
      if (count === 0) return;
      const from = Math.round(position.value);
      let target = from + delta;
      if (!loop) {
        // Without loop, stepping past an end rewinds to the other end, which
        // is what autoplay and "next" buttons expect.
        if (target > count - 1) target = 0;
        else if (target < 0) target = count - 1;
      }
      animateTo(target, options?.animated ?? true);
    },
    [animateTo, count, loop, position],
  );
  const next = useCallback((options?: { animated?: boolean }) => step(1, options), [step]);
  const prev = useCallback((options?: { animated?: boolean }) => step(-1, options), [step]);

  useImperativeHandle(ref, () => ({ scrollTo, next, prev, getIndex: () => lastIndex.current }), [
    scrollTo,
    next,
    prev,
  ]);

  /* --- autoplay ----------------------------------------------------------- */
  const [touching, setTouching] = useState(false);
  const screenReader = useScreenReaderEnabled();
  const autoplayConfig = autoplay ? { ...DEFAULT_AUTOPLAY, ...(autoplay === true ? {} : autoplay) } : null;
  const autoplayActive =
    !!autoplayConfig && count > 1 && !touching && (!screenReader || autoplayConfig.whenScreenReaderEnabled);
  const autoplayInterval = autoplayConfig?.interval ?? 0;
  const autoplayReverse = autoplayConfig?.reverse ?? false;
  useEffect(() => {
    if (!autoplayActive) return;
    // Restarts on every page change, so a manual swipe gets a full interval.
    const timer = setTimeout(() => step(autoplayReverse ? -1 : 1), autoplayInterval);
    return () => clearTimeout(timer);
  }, [autoplayActive, autoplayInterval, autoplayReverse, center, step]);

  /* --- gesture -------------------------------------------------------------- */
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const pan = useMemo(() => {
    const sign = rtl ? -1 : 1;
    const settle = (velocity: number) => {
      'worklet';
      const target = snapTarget(Math.round(start.value), position.value, velocity, count, loop);
      position.value = withSpring(target, { ...springConfig, velocity });
    };
    const g = Gesture.Pan()
      .enabled(gestureEnabled && count > 1)
      .onBegin(() => {
        // Touching a moving carousel catches it, like a native scroll view.
        cancelAnimation(position);
        start.value = position.value;
        runOnJS(setTouching)(true);
      })
      .onStart(() => {
        dragging.value = true;
      })
      .onUpdate((e) => {
        const extent = pageExtent.value;
        if (extent <= 0) return;
        const moved = (vertical ? e.translationY : e.translationX) / extent;
        const raw = start.value - moved * sign;
        position.value = loop ? raw : rubberBand(raw, 0, count - 1);
      })
      .onEnd((e) => {
        const extent = pageExtent.value;
        const velocity = extent > 0 ? (-(vertical ? e.velocityY : e.velocityX) / extent) * sign : 0;
        settle(velocity);
      })
      .onFinalize(() => {
        // A tap that caught a moving carousel never activates the pan, so
        // onEnd does not run: settle from where it was caught.
        if (!dragging.value) settle(0);
        dragging.value = false;
        runOnJS(setTouching)(false);
      });
    return vertical
      ? g.activeOffsetY([-10, 10]).failOffsetX([-14, 14])
      : g.activeOffsetX([-10, 10]).failOffsetY([-14, 14]);
  }, [count, dragging, gestureEnabled, loop, pageExtent, position, rtl, springConfig, start, vertical]);

  /* --- layout ------------------------------------------------------------- */
  const onPagesLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPageSize({ width, height });
    pageExtent.value = vertical ? height : width;
  };
  const onMediaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMediaSize({ width, height });
  };

  /* --- render window ---------------------------------------------------- */
  const pages = pageWindow(center, Math.max(windowSize, 1), count, loop);
  const keyOf = (item: T, i: number) => keyExtractor?.(item, i) ?? String(i);

  const wantLiquid = effect === 'liquid' && !reduceMotion;
  const LiquidLayer = useLiquidLayer(wantLiquid);
  const viewEffect: MediaEffectFn = resolveEffect(
    effect === 'liquid' ? 'crossfade' : reduceMotion && typeof effect === 'string' ? 'crossfade' : effect,
  );

  const media =
    mediaSize.width > 0 && count > 0 ? (
      LiquidLayer ? (
        // The rule sees a component returned by a hook. It is created once per
        // app (cached at module level in ./liquid), not on each render.
        // eslint-disable-next-line react-hooks/static-components
        <LiquidLayer
          items={pages.map<LiquidItem>((v) => {
            const i = wrap(v, count);
            return {
              key: String(v),
              virtual: v,
              source: toSkiaSource(getImage(data[i], i)),
              placeholderColor: getPlaceholderColor?.(data[i], i),
            };
          })}
          position={position}
          width={mediaSize.width}
          height={mediaSize.height}
          padding={mediaPadding}
          fit={mediaFit}
          blur={liquidConfig.blur}
          threshold={liquidConfig.threshold}
          sharpness={liquidConfig.sharpness}
          cache={cacheOptions}
        />
      ) : (
        pages.map((v) => {
          const i = wrap(v, count);
          return (
            <ViewMediaItem
              key={v}
              virtual={v}
              position={position}
              source={getImage(data[i], i)}
              placeholderColor={getPlaceholderColor?.(data[i], i)}
              effect={viewEffect}
              size={mediaSize}
              direction={direction}
              rtl={rtl}
              fit={mediaFit}
              padding={mediaPadding}
              cache={cacheOptions}
            />
          );
        })
      )
    ) : null;

  /* --- accessibility & keyboard ------------------------------------------ */
  const current = count > 0 ? data[index] : undefined;
  const itemLabel =
    current === undefined ? '' : (getAccessibilityLabel?.(current, index) ?? keyOf(current, index));
  const valueText = count > 0 ? `${itemLabel}, ${index + 1} / ${count}` : '';
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') next();
    if (e.nativeEvent.actionName === 'decrement') prev();
  };
  const keyboard =
    Platform.OS === 'web'
      ? {
          tabIndex: 0,
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            const forward = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
            const back = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
            if (e.key === forward) next();
            else if (e.key === back) prev();
            else if (e.key === 'Home') scrollTo(0);
            else if (e.key === 'End') scrollTo(count - 1);
            else return;
            e.preventDefault();
          },
        }
      : null;

  const showPagination = pagination !== false && count > 1;
  const paginationOptions = typeof pagination === 'object' ? pagination : undefined;

  return (
    <View style={[styles.root, style]} testID={testID}>
      <GestureDetector gesture={pan} userSelect="none" touchAction={vertical ? 'pan-x' : 'pan-y'}>
        <View
          style={styles.body}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: valueText }}
          // React Native Web does not map accessibilityValue.text to the DOM.
          aria-valuetext={valueText}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
          {...(keyboard as object)}
        >
          {mediaPosition === 'background' ? (
            <View style={[StyleSheet.absoluteFill, mediaStyle]} onLayout={onMediaLayout} pointerEvents="none">
              {media}
            </View>
          ) : (
            <View
              style={[styles.mediaTop, { height: mediaHeight }, mediaStyle]}
              onLayout={onMediaLayout}
              pointerEvents="none"
            >
              {media}
            </View>
          )}
          <View style={styles.pages} onLayout={onPagesLayout}>
            {renderItem &&
              pageSize.width > 0 &&
              pages.map((v) => {
                const i = wrap(v, count);
                return (
                  <Page
                    key={v}
                    virtual={v}
                    position={position}
                    size={pageSize}
                    direction={direction}
                    rtl={rtl}
                    style={pageStyle}
                  >
                    {renderItem({ item: data[i], index: i })}
                  </Page>
                );
              })}
          </View>
        </View>
      </GestureDetector>

      {(showPagination || renderFooter) && (
        <View style={[styles.footer, footerStyle]}>
          {showPagination && (
            <Pagination
              count={count}
              position={position}
              loop={loop}
              onPress={(i) => scrollTo(i)}
              {...paginationOptions}
            />
          )}
          {renderFooter?.({ item: current, index, count, position, scrollTo, next, prev })}
        </View>
      )}
    </View>
  );
}

/* --- pieces ---------------------------------------------------------------- */

function Page({
  virtual,
  position,
  size,
  direction,
  rtl,
  style,
  children,
}: {
  virtual: number;
  position: SharedValue<number>;
  size: Size;
  direction: CarouselDirection;
  rtl: boolean;
  style: MorphCarouselProps<unknown>['pageStyle'];
  children: React.ReactNode;
}) {
  const vertical = direction === 'vertical';
  const animated = useAnimatedStyle(() => {
    const offset = virtual - position.value;
    const distance = offset * (vertical ? size.height : size.width) * (rtl ? -1 : 1);
    return {
      // Pages further than one away are off screen; hiding them also keeps
      // their content out of hit testing.
      opacity: Math.abs(offset) < 1.5 ? 1 : 0,
      transform: [vertical ? { translateY: distance } : { translateX: distance }],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', width: size.width, height: size.height }, style, animated]}
    >
      {children}
    </Animated.View>
  );
}

function ViewMediaItem({
  virtual,
  position,
  source,
  placeholderColor,
  effect,
  size,
  direction,
  rtl,
  fit,
  padding,
  cache,
}: {
  virtual: number;
  position: SharedValue<number>;
  source: ImageSourcePropType;
  placeholderColor?: string;
  effect: MediaEffectFn;
  size: Size;
  direction: CarouselDirection;
  rtl: boolean;
  fit: 'contain' | 'cover';
  padding: number;
  cache: ResolvedCacheOptions | null;
}) {
  const remote = toRemoteUri(source);
  const cached = useCachedUri(remote, cache);
  // Remote: the cached file (or the URL), nothing while it downloads.
  const shown: ImageSourcePropType | null = remote
    ? cached
      ? { ...(source as object), uri: cached }
      : null
    : source;
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const shownKey = typeof shown === 'number' ? String(shown) : remote ? cached : 'local';
  const loaded = loadedUri !== null && loadedUri === shownKey;
  const animated = useAnimatedStyle(() =>
    effect({ offset: virtual - position.value, width: size.width, height: size.height, direction, rtl }),
  );
  const blob = Math.min(size.width, size.height) * 0.64;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, { padding }, animated]}>
      {!loaded && placeholderColor && (
        <View
          style={{ width: blob, height: blob, borderRadius: blob / 2, backgroundColor: placeholderColor }}
        />
      )}
      {shown !== null && (
        <Image
          source={shown}
          resizeMode={fit}
          onLoad={() => setLoadedUri(shownKey)}
          style={{
            position: 'absolute',
            left: padding,
            top: padding,
            width: Math.max(size.width - padding * 2, 0),
            height: Math.max(size.height - padding * 2, 0),
          }}
        />
      )}
    </Animated.View>
  );
}

function toSkiaSource(source: ImageSourcePropType): number | string | null {
  if (typeof source === 'number') return source;
  if (Array.isArray(source)) return source[0]?.uri ?? null;
  return (source as { uri?: string }).uri ?? null;
}

function useScreenReaderEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (alive) setEnabled(on);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  body: { flex: 1 },
  mediaTop: { width: '100%', overflow: 'hidden' },
  pages: { flex: 1, overflow: 'hidden' },
  footer: { alignItems: 'center', gap: 16, paddingVertical: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

/** The http(s) URI of a `{ uri }` source, or null for bundled and local images. */
function toRemoteUri(source: ImageSourcePropType): string | null {
  if (typeof source !== 'object' || Array.isArray(source)) return null;
  const uri = (source as { uri?: string }).uri;
  return uri && /^https?:\/\//i.test(uri) ? uri : null;
}
