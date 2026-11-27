import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  I18nManager,
  Image,
  PixelRatio,
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
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { resolveEffect } from './effects';
import { imageCache, isCachedSync, resolveCacheOptions, useCachedUri, type LoadPriority } from './cache';
import type { ResolvedCacheOptions } from './cache/ImageCache';
import { useLiquidLayer, type LiquidItem } from './liquid';
import {
  makeTarget,
  normalizeSource,
  pickCandidate,
  requiredWidth,
  sameSource,
  type NormalizedSource,
} from './responsive';
import { useChosenUri, useImageLayers, type ImageArea } from './useResponsiveImage';
import {
  clamp,
  momentumTarget,
  nearestVirtual,
  pageWindow,
  rubberBand,
  snapTarget,
  tapDirection,
  wrap,
} from './math';
import { resolvePageEffect, type PageEffectFn } from './pageEffects';
import { Pagination } from './Pagination';
import type {
  AutoplayOptions,
  CarouselDirection,
  MediaEffectFn,
  MorphCarouselProps,
  SpringOptions,
} from './types';

/** Duration of the cross-fade when an image is replaced by a sharper or newer one. */
const SWAP_MS = 220;
const DEFAULT_SPRING = { damping: 26, stiffness: 220, mass: 1 };
const DEFAULT_TIMING_MS = 380;
/** Glide of `snapMode="free"`: the deceleration of a native scroll view. */
const FREE_DECELERATION = 0.998;
const DEFAULT_LIQUID = {
  blur: 28,
  threshold: 0.5,
  sharpness: 24,
  preserveShape: false,
  decode: 'scheduled' as const,
};
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
  imageCache: imageCacheProp,
  prefetch = 1,
  direction = 'horizontal',
  loop = false,
  initialIndex = 0,
  autoplay = false,
  windowSize = 2,
  pageEffect = 'slide',
  pageSize: pageSizeProp,
  pageGap = 0,
  pageAlign = 'center',
  snapMode = 'page',
  animation,
  configureGesture,
  tapToNavigate = false,
  components,
  onScrollStart,
  onScrollEnd,
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
  const hasMediaTop = !!getImage && mediaPosition === 'top';
  const mediaIsBackground = !!getImage && mediaPosition === 'background';
  const rtl = !vertical && I18nManager.isRTL;
  const reduceMotion = useReducedMotion();
  const motion = useMemo(() => {
    if (animation?.type === 'timing') {
      return { timing: true, duration: animation.duration ?? DEFAULT_TIMING_MS, spring: DEFAULT_SPRING };
    }
    const { damping, stiffness, mass } = (animation ?? {}) as SpringOptions;
    return {
      timing: false,
      duration: 0,
      spring: {
        damping: damping ?? DEFAULT_SPRING.damping,
        stiffness: stiffness ?? DEFAULT_SPRING.stiffness,
        mass: mass ?? DEFAULT_SPRING.mass,
      },
    };
  }, [animation]);
  const pageEffectFn = useMemo(
    () => resolvePageEffect(reduceMotion && typeof pageEffect === 'string' ? 'slide' : pageEffect),
    [pageEffect, reduceMotion],
  );
  const liquidConfig = { ...DEFAULT_LIQUID, ...liquid };
  // Memoized on identity: pass a module constant or a memoized object, or each
  // parent render makes every visible image look its URI up again.
  const cacheOptions = useMemo(() => resolveCacheOptions(imageCacheProp), [imageCacheProp]);

  const startIndex = clamp(initialIndex, 0, Math.max(count - 1, 0));
  const position = useSharedValue(startIndex);
  const [center, setCenter] = useState(startIndex);
  const index = wrap(center, count);

  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [mediaSize, setMediaSize] = useState<Size>({ width: 0, height: 0 });
  const pageExtent = useSharedValue(0);

  /* --- index tracking ----------------------------------------------------
     `position` lives on the UI thread. React only needs to know when the
     nearest page changes, to move the render window and report the index.   */
  const onIndexChangeRef = useRef(onIndexChange);
  const onScrollStartRef = useRef(onScrollStart);
  const onScrollEndRef = useRef(onScrollEnd);
  const lastIndex = useRef(startIndex);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    onScrollStartRef.current = onScrollStart;
    onScrollEndRef.current = onScrollEnd;
  });
  const emitStart = useCallback(() => onScrollStartRef.current?.(), []);
  const emitEnd = useCallback((virtual: number) => onScrollEndRef.current?.(wrap(virtual, count)), [count]);
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
  // Mirrors the position into the caller's shared value. Without one, the
  // reaction reads nothing that changes and never runs again.
  useAnimatedReaction(
    () => (positionValue ? position.value : 0),
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
  /** Settle on `target` with the configured animation; reports the end. Runs on either thread. */
  const settleTo = useCallback(
    (target: number, velocity: number) => {
      'worklet';
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) runOnJS(emitEnd)(target);
      };
      position.value = motion.timing
        ? withTiming(target, { duration: motion.duration }, done)
        : withSpring(target, { ...motion.spring, velocity }, done);
    },
    [emitEnd, motion, position],
  );
  const animateTo = useCallback(
    (target: number, animated = true) => {
      cancelAnimation(position);
      emitStart();
      if (animated) settleTo(target, 0);
      else {
        position.value = target;
        emitEnd(target);
      }
    },
    [emitEnd, emitStart, position, settleTo],
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
  const next = useCallback(
    (options?: { animated?: boolean; count?: number }) => step(options?.count ?? 1, options),
    [step],
  );
  const prev = useCallback(
    (options?: { animated?: boolean; count?: number }) => step(-(options?.count ?? 1), options),
    [step],
  );

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
  /** The touch caught the carousel between pages (an animation was running). */
  const caught = useSharedValue(false);
  // The gesture callbacks run on gestures, not during render. The React
  // Compiler rule cannot tell once the gesture is handed to `configureGesture`.
  /* eslint-disable react-hooks/refs */
  const pan = useMemo(() => {
    const sign = rtl ? -1 : 1;
    const settle = (velocity: number) => {
      'worklet';
      if (snapMode === 'free') {
        position.value = withDecay(
          loop
            ? { velocity, deceleration: FREE_DECELERATION }
            : { velocity, deceleration: FREE_DECELERATION, clamp: [0, Math.max(count - 1, 0)] },
          (finished) => {
            if (finished) runOnJS(emitEnd)(Math.round(position.value));
          },
        );
        return;
      }
      const target =
        snapMode === 'momentum'
          ? momentumTarget(position.value, velocity, count, loop)
          : snapTarget(Math.round(start.value), position.value, velocity, count, loop);
      settleTo(target, velocity);
    };
    const g = Gesture.Pan()
      .enabled(gestureEnabled && count > 1)
      .onBegin(() => {
        // Touching a moving carousel catches it, like a native scroll view.
        cancelAnimation(position);
        start.value = position.value;
        caught.value = Math.abs(position.value - Math.round(position.value)) > 0.001;
        runOnJS(setTouching)(true);
      })
      .onStart(() => {
        dragging.value = true;
        runOnJS(emitStart)();
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
        // onEnd does not run: settle from where it was caught (free mode
        // simply stays there).
        // A touch on a carousel at rest is not a scroll: nothing to settle
        // and no onScrollEnd (a tap may still navigate).
        if (!dragging.value && caught.value && snapMode !== 'free') settle(0);
        dragging.value = false;
        runOnJS(setTouching)(false);
      });
    const base = vertical
      ? g.activeOffsetY([-10, 10]).failOffsetX([-14, 14])
      : g.activeOffsetX([-10, 10]).failOffsetY([-14, 14]);
    // Memoize `configureGesture`, or the gesture is rebuilt on every render.
    return configureGesture ? configureGesture(base) : base;
  }, [
    caught,
    configureGesture,
    count,
    dragging,
    emitEnd,
    emitStart,
    gestureEnabled,
    loop,
    pageExtent,
    position,
    rtl,
    settleTo,
    snapMode,
    start,
    vertical,
  ]);
  /* eslint-enable react-hooks/refs */

  /* --- tap to navigate ------------------------------------------------------
     A tap fires only when the pan did not take over (`Gesture.Exclusive`),
     so swiping and tapping never both move the carousel. The geometry it
     needs (where the pages start, the current page's frame) is mirrored into
     a shared value because the decision runs on the UI thread.            */
  const tapOptions = tapToNavigate
    ? {
        mode: 'sides' as const,
        backZone: 0.3,
        area: 'all' as const,
        ...(tapToNavigate === true ? {} : tapToNavigate),
      }
    : null;
  const tapGeometry = useSharedValue({ pagesTop: 0, viewportMain: 0, pageMain: 0, lead: 0, mediaMain: 0 });
  // As for the pan: the callback runs on taps, not during render.
  /* eslint-disable react-hooks/refs */
  const tap = useMemo(() => {
    if (!tapOptions) return null;
    const { mode, backZone, area } = tapOptions;
    return Gesture.Tap()
      .enabled(count > 1)
      .maxDistance(12)
      .onEnd((e, success) => {
        if (!success) return;
        const g = tapGeometry.value;
        const inMedia = g.pagesTop > 0 ? e.y < g.pagesTop : area === 'media' && mediaIsBackground;
        if (area === 'media' && !inMedia) return;
        let dir: -1 | 0 | 1;
        if (vertical && g.pagesTop > 0 && e.y < g.pagesTop) {
          // On the media above vertical pages: split the media area itself.
          dir = tapDirection(e.y, g.mediaMain, mode, backZone, false);
        } else if (vertical) {
          dir = tapDirection(e.y - g.pagesTop, g.viewportMain, mode, backZone, false, g.pageMain, g.lead);
        } else {
          dir = tapDirection(e.x, g.viewportMain, mode, backZone, rtl, g.pageMain, g.lead);
        }
        if (dir !== 0) runOnJS(step)(dir);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the options' values change
  }, [
    count,
    rtl,
    step,
    tapGeometry,
    vertical,
    tapOptions?.mode,
    tapOptions?.backZone,
    tapOptions?.area,
    mediaIsBackground,
  ]);
  /* eslint-enable react-hooks/refs */
  const gesture = useMemo(() => (tap ? Gesture.Exclusive(pan, tap) : pan), [pan, tap]);

  /* --- layout ------------------------------------------------------------- */
  const onPagesLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  };
  // One page along the scroll axis, and the distance between two pages (what
  // a swipe of one page covers).
  const viewportMain = vertical ? viewport.height : viewport.width;
  const pageMain = Math.min(pageSizeProp ?? viewportMain, viewportMain || Number.POSITIVE_INFINITY);
  const pageStep = pageMain + pageGap;
  const pageLead = pageAlign === 'center' ? (viewportMain - pageMain) / 2 : 0;
  const pagesTop = hasMediaTop ? mediaSize.height : 0;
  useEffect(() => {
    tapGeometry.value = {
      pagesTop,
      viewportMain,
      pageMain,
      lead: pageLead,
      mediaMain: vertical ? mediaSize.height : mediaSize.width,
    };
  }, [mediaSize.height, mediaSize.width, pageLead, pageMain, pagesTop, tapGeometry, vertical, viewportMain]);
  useEffect(() => {
    pageExtent.value = pageStep;
  }, [pageExtent, pageStep]);
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

  /* --- responsive images ------------------------------------------------
     The area an image is drawn in (media area minus padding) times the pixel
     ratio decides which candidate is sharp enough. `getImage` also receives
     it as `target`, rounded to a few widths, to build CDN URLs.            */
  const pixelRatio = PixelRatio.get();
  const imageWidth = Math.max(mediaSize.width - mediaPadding * 2, 0);
  const imageHeight = Math.max(mediaSize.height - mediaPadding * 2, 0);
  // Stable between renders, so memoized media items can compare it by identity.
  const area = useMemo<ImageArea>(
    () => ({ width: imageWidth, height: imageHeight, pixelRatio, fit: mediaFit }),
    [imageHeight, imageWidth, mediaFit, pixelRatio],
  );
  const target = makeTarget({ width: imageWidth, height: imageHeight }, pixelRatio, mediaFit);
  const hasMedia = !!getImage;
  const sourceOf = (i: number): NormalizedSource => {
    if (!getImage) return { kind: 'none' };
    const n = normalizeSource(getImage(data[i], i, target));
    // A single URI built for `target` is as wide as the target asked for;
    // without a width it would count as infinitely sharp and never upgrade.
    if (n.kind === 'uri' && n.candidates.length === 1 && !Number.isFinite(n.candidates[0].width)) {
      n.candidates[0] = { ...n.candidates[0], width: target.width };
    }
    return n;
  };

  /** The page in view downloads first, its neighbors next, the rest after. */
  const priorityFor = (v: number): LoadPriority => {
    const d = Math.abs(v - center);
    return d === 0 ? 'high' : d === 1 ? 'normal' : 'low';
  };

  /* --- prefetch beyond the render window ------------------------------
     Pages just outside the window are not rendered, but their images are
     downloaded at low priority so they are on disk when the user gets there.
     The URL is chosen exactly as the page will choose it when it mounts. */
  const prefetchKey =
    cacheOptions && prefetch > 0 && mediaSize.width > 0 && count > 0
      ? (() => {
          const radius = Math.max(windowSize, 1);
          const urls: string[] = [];
          for (let k = radius + 1; k <= radius + prefetch; k++) {
            for (const v of [center + k, center - k]) {
              if (!loop && (v < 0 || v >= count)) continue;
              const n = sourceOf(wrap(v, count));
              if (n.kind !== 'uri') continue;
              const aspectSrc = n.candidates.find((c) => c.height && Number.isFinite(c.width));
              const need = requiredWidth(
                area,
                pixelRatio,
                mediaFit,
                aspectSrc ? aspectSrc.width / aspectSrc.height! : undefined,
              );
              const pick = pickCandidate(n.candidates, need, (u) => isCachedSync(u, cacheOptions));
              if (pick) urls.push(pick.uri);
            }
          }
          return [...new Set(urls)].join('\n');
        })()
      : '';
  useEffect(() => {
    if (!prefetchKey || !cacheOptions) return;
    void imageCache.prefetch(prefetchKey.split('\n'), cacheOptions, 'low');
  }, [prefetchKey, cacheOptions]);

  const media =
    hasMedia && mediaSize.width > 0 && count > 0 ? (
      LiquidLayer ? (
        // The rule sees a component returned by a hook. It is created once per
        // app (cached at module level in ./liquid), not on each render.
        // eslint-disable-next-line react-hooks/static-components
        <LiquidLayer
          items={pages.map<LiquidItem>((v) => {
            const i = wrap(v, count);
            return {
              key: String(v),
              identity: keyOf(data[i], i),
              virtual: v,
              source: sourceOf(i),
              placeholderColor: getPlaceholderColor?.(data[i], i),
              priority: priorityFor(v),
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
          preserveShape={liquidConfig.preserveShape}
          decode={liquidConfig.decode}
          cache={cacheOptions}
          pixelRatio={pixelRatio}
        />
      ) : (
        pages.map((v) => {
          const i = wrap(v, count);
          return (
            <ViewMediaItemMemo
              key={v}
              virtual={v}
              identity={keyOf(data[i], i)}
              position={position}
              source={sourceOf(i)}
              area={area}
              priority={priorityFor(v)}
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

  const showPagination = pagination !== false && components?.Pagination !== null && count > 1;
  const paginationOptions = typeof pagination === 'object' ? pagination : undefined;
  const PaginationSlot = components?.Pagination;
  const { MediaOverlay, MediaBackground } = components ?? {};
  const mediaSlotProps = {
    item: current,
    index,
    count,
    position,
    width: mediaSize.width,
    height: mediaSize.height,
  };
  const mediaLayers = (
    <>
      {MediaBackground && mediaSize.width > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <MediaBackground {...mediaSlotProps} />
        </View>
      )}
      {media}
      {MediaOverlay && mediaSize.width > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <MediaOverlay {...mediaSlotProps} />
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, style]} testID={testID}>
      <GestureDetector gesture={gesture} userSelect="none" touchAction={vertical ? 'pan-x' : 'pan-y'}>
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
          {!hasMedia ? null : mediaPosition === 'background' ? (
            <View style={[StyleSheet.absoluteFill, mediaStyle]} onLayout={onMediaLayout} pointerEvents="none">
              {mediaLayers}
            </View>
          ) : (
            <View
              style={[styles.mediaTop, { height: mediaHeight }, mediaStyle]}
              onLayout={onMediaLayout}
              pointerEvents="none"
            >
              {mediaLayers}
            </View>
          )}
          <View style={styles.pages} onLayout={onPagesLayout}>
            {renderItem &&
              viewport.width > 0 &&
              pages.map((v) => {
                const i = wrap(v, count);
                return (
                  <PageMemo
                    key={v}
                    virtual={v}
                    position={position}
                    viewport={viewport}
                    pageMain={pageMain}
                    step={pageStep}
                    align={pageAlign}
                    effect={pageEffectFn}
                    direction={direction}
                    rtl={rtl}
                    style={pageStyle}
                    item={data[i]}
                    index={i}
                    renderItem={renderItem as PageRenderItem}
                  />
                );
              })}
          </View>
        </View>
      </GestureDetector>

      {(showPagination || renderFooter) && (
        <View style={[styles.footer, footerStyle]}>
          {showPagination &&
            (PaginationSlot ? (
              <PaginationSlot
                count={count}
                index={index}
                position={position}
                loop={loop}
                direction={direction}
                scrollTo={(i) => scrollTo(i)}
              />
            ) : (
              <Pagination
                count={count}
                position={position}
                loop={loop}
                onPress={(i) => scrollTo(i)}
                Dot={components?.Dot}
                {...paginationOptions}
              />
            ))}
          {/* `position` is a shared value handed over, not read during render. */}
          {/* eslint-disable-next-line react-hooks/refs */}
          {renderFooter?.({ item: current, index, count, position, scrollTo, next, prev })}
        </View>
      )}
    </View>
  );
}

/* --- pieces ---------------------------------------------------------------- */

/**
 * One page. Its frame is `pageMain` long along the scroll axis, placed at the
 * start or the center of the viewport; the page effect moves it from there by
 * its offset from the current position.
 */
function Page({
  virtual,
  position,
  viewport,
  pageMain,
  step,
  align,
  effect,
  direction,
  rtl,
  style,
  item,
  index,
  renderItem,
}: {
  virtual: number;
  position: SharedValue<number>;
  viewport: Size;
  pageMain: number;
  step: number;
  align: 'center' | 'start';
  effect: PageEffectFn;
  direction: CarouselDirection;
  rtl: boolean;
  style: MorphCarouselProps<unknown>['pageStyle'];
  item: unknown;
  index: number;
  renderItem: PageRenderItem;
}) {
  const vertical = direction === 'vertical';
  const width = vertical ? viewport.width : pageMain;
  const height = vertical ? pageMain : viewport.height;
  const lead = align === 'center' ? ((vertical ? viewport.height : viewport.width) - pageMain) / 2 : 0;
  const offset = useDerivedValue(() => virtual - position.value);
  const animated = useAnimatedStyle(() =>
    effect({
      offset: offset.value,
      step,
      width,
      height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      direction,
      rtl,
    }),
  );
  // Start alignment in right-to-left layouts starts at the right edge.
  const frame = vertical
    ? { top: lead, left: 0 }
    : rtl && align === 'start'
      ? { right: 0, top: 0 }
      : { left: lead, top: 0 };
  return (
    <Animated.View style={[{ position: 'absolute', width, height }, frame, style, animated]}>
      {renderItem({ item, index, offset })}
    </Animated.View>
  );
}

type PageRenderItem = (info: {
  item: unknown;
  index: number;
  offset: SharedValue<number>;
}) => React.ReactNode;

/**
 * The current page changes halfway through a swipe and re-renders the
 * carousel. Pages whose props did not change keep their element: their item
 * is not rendered again in the middle of the animation.
 */
const PageMemo = memo(Page);

function ViewMediaItem({
  virtual,
  identity,
  position,
  source,
  area,
  priority,
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
  identity: string;
  position: SharedValue<number>;
  source: NormalizedSource;
  area: ImageArea;
  priority: LoadPriority;
  placeholderColor?: string;
  effect: MediaEffectFn;
  size: Size;
  direction: CarouselDirection;
  rtl: boolean;
  fit: 'contain' | 'cover';
  padding: number;
  cache: ResolvedCacheOptions | null;
}) {
  const chosen = useChosenUri(identity, source, area, cache);
  const cached = useCachedUri(chosen, cache, priority);
  const value: number | string | null = source.kind === 'bundled' ? source.asset : cached;
  const { layers, onShown } = useImageLayers(value);
  const [baseLoaded, setBaseLoaded] = useState<number | null>(null);
  const animated = useAnimatedStyle(() =>
    effect({ offset: virtual - position.value, width: size.width, height: size.height, direction, rtl }),
  );
  const blob = Math.min(size.width, size.height) * 0.64;
  // Anchored to the edges so it follows the native layout in the same frame
  // (after a rotation, a size from React state would lag one render behind).
  // The Image inside fills it by percentage (see styles.fill).
  const frame = {
    position: 'absolute' as const,
    left: padding,
    top: padding,
    right: padding,
    bottom: padding,
  };
  const showPlaceholder = placeholderColor && (layers.length === 0 || baseLoaded !== layers[0].id);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, { padding }, animated]}>
      {showPlaceholder && (
        <View
          style={{ width: blob, height: blob, borderRadius: blob / 2, backgroundColor: placeholderColor }}
        />
      )}
      {layers.map((l, i) => (
        <ImageLayer
          key={l.id}
          id={l.id}
          source={typeof l.value === 'number' ? l.value : { uri: l.value }}
          fadeIn={i > 0}
          fit={fit}
          style={frame}
          onLoad={i === 0 ? setBaseLoaded : undefined}
          onShown={onShown}
        />
      ))}
    </Animated.View>
  );
}

const ViewMediaItemMemo = memo(ViewMediaItem, (a, b) => {
  for (const k of Object.keys(a) as (keyof typeof a)[]) {
    if (k === 'source') {
      if (!sameSource(a.source, b.source)) return false;
    } else if (k === 'size') {
      if (a.size.width !== b.size.width || a.size.height !== b.size.height) return false;
    } else if (a[k] !== b[k]) return false;
  }
  return true;
});

/**
 * One image of a view-based media item. A replacing layer stays transparent
 * while it downloads and decodes, then fades in over the one below, so the
 * swap after a rotation never shows an empty frame.
 */
function ImageLayer({
  id,
  source,
  fadeIn,
  fit,
  style,
  onLoad,
  onShown,
}: {
  id: number;
  source: ImageSourcePropType;
  fadeIn: boolean;
  fit: 'contain' | 'cover';
  style: object;
  onLoad?: (id: number) => void;
  onShown: (id: number) => void;
}) {
  const opacity = useSharedValue(fadeIn ? 0 : 1);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const handleLoad = () => {
    onLoad?.(id);
    if (!fadeIn) return;
    opacity.value = withTiming(1, { duration: SWAP_MS }, (finished) => {
      if (finished) runOnJS(onShown)(id);
    });
  };
  return (
    <Animated.View style={[style, animated]}>
      <Image source={source} resizeMode={fit} onLoad={handleLoad} style={styles.fill} />
    </Animated.View>
  );
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
  // Percent size, not absoluteFill: on Android an Image placed only by its
  // edges is drawn at the image's intrinsic size.
  fill: { width: '100%', height: '100%' },
});
