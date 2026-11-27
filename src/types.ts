import type { ComponentType, ReactNode, Ref } from 'react';
import type { Gesture } from 'react-native-gesture-handler';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { ImageCacheOptions } from './cache/ImageCache';
import type { PageEffect } from './pageEffects';
import type { ImageTarget } from './responsive';

/** The pan gesture the carousel builds with `Gesture.Pan()`. */
export type CarouselPanGesture = ReturnType<typeof Gesture.Pan>;

/**
 * Style a media effect returns for one image. Only properties that are cheap to
 * animate on the UI thread are allowed.
 */
export type MediaFrameStyle = {
  opacity?: number;
  zIndex?: number;
  transform?: (
    | { translateX: number }
    | { translateY: number }
    | { scale: number }
    | { rotate: string }
    | { rotateY: string }
    | { perspective: number }
  )[];
};

export type MediaEffectInput = {
  /**
   * Signed distance of this image's page from the current position, in pages.
   * 0 when the page is in view, -1 one page before it, 0.5 halfway to the next.
   */
  offset: number;
  /** Size of the media area in points. */
  width: number;
  height: number;
  /** `'horizontal'` or `'vertical'`. */
  direction: CarouselDirection;
  /** `true` when the layout is right-to-left and the direction is horizontal. */
  rtl: boolean;
};

/**
 * A custom media effect. It runs on the UI thread once per visible image and
 * frame, so it must be a worklet: start the function body with `'worklet';`.
 */
export type MediaEffectFn = (input: MediaEffectInput) => MediaFrameStyle;

/**
 * - `liquid`: the images melt into a blob and reform as the next image (blur +
 *   alpha threshold, drawn with Skia). Falls back to `crossfade` when Skia is
 *   not installed, while it loads on web, and when Reduce Motion is on.
 * - `crossfade`: the images fade into each other in place.
 * - `slide`: the images move with the pages.
 * - `parallax`: the images move at half the speed of the pages and fade.
 * - `stack`: the outgoing image shrinks and fades back, the next one slides over it.
 * - a worklet function for a custom effect.
 */
export type MediaEffect = 'liquid' | 'crossfade' | 'slide' | 'parallax' | 'stack' | MediaEffectFn;

export type CarouselDirection = 'horizontal' | 'vertical';

export type LiquidOptions = {
  /** Blur radius at the middle of a transition. Larger makes a rounder, more liquid blob. Default 28. */
  blur?: number;
  /** Alpha (0–1) at which the blurred edge is cut. Lower keeps more of the blur halo. Default 0.5. */
  threshold?: number;
  /** How sharp the cut edge is. Default 24. */
  sharpness?: number;
  /**
   * Keep the image's own outline during the morph: only the content inside
   * the image area melts, edges and corners stay sharp. Use it for photos
   * (`mediaFit="cover"`), whose rectangle would otherwise be rounded off and
   * eaten into while the effect runs. `threshold` and `sharpness` do not
   * apply. Default false.
   */
  preserveShape?: boolean;
  /**
   * When photos are decoded. A decode blocks the thread it runs on for tens
   * of milliseconds per photo.
   *
   * - `'scheduled'` (default): on the JS thread, one per task, the
   *   page in view first, then its neighbors; images of pages that left the
   *   window before their turn are skipped. The app's own callbacks run
   *   between two decodes, even when a window of pages mounts at once.
   * - `'immediate'`: on the JS thread as soon as the file is read, back to
   *   back when several arrive together.
   * - `'onDraw'`: left to Skia, which decodes on the first draw: on the UI
   *   thread, in the middle of the swipe that brings the page into view.
   *
   * Bundled images (`require`) are loaded by Skia and not affected.
   */
  decode?: 'scheduled' | 'immediate' | 'onDraw';
};

export type AutoplayOptions = {
  /** Time on each page in ms. Default 4000. */
  interval?: number;
  /** Autoplay backwards. Default false. */
  reverse?: boolean;
  /**
   * Keep autoplaying while a screen reader is on. Default false: moving content
   * makes a screen reader lose its place.
   */
  whenScreenReaderEnabled?: boolean;
};

export type SpringOptions = {
  damping?: number;
  stiffness?: number;
  mass?: number;
};

/**
 * How the carousel moves to a page after a swipe, a dot tap, `next()` or
 * autoplay. A spring carries the finger's velocity; timing gives a fixed
 * duration.
 */
export type AnimationConfig =
  ({ type?: 'spring' } & SpringOptions) | { type: 'timing'; /** Default 380 ms. */ duration?: number };

/**
 * - `page` (default): one page per swipe, like a native pager.
 * - `momentum`: a hard fling glides over several pages, then snaps to the nearest.
 * - `free`: glides and stops anywhere, like a scroll view.
 */
export type SnapMode = 'page' | 'momentum' | 'free';

export type TapToNavigateOptions = {
  /**
   * - `sides` (default): a tap on the leading part (left, or top when vertical;
   *   right in right-to-left layouts) goes back, anywhere else forward, like
   *   stories.
   * - `forward`: any tap goes forward.
   *
   * Either way, a tap on a neighbor peeking at the side (with `pageSize`)
   * goes to that neighbor.
   */
  mode?: 'sides' | 'forward';
  /** Fraction of the carousel that goes back in `sides` mode. Default 0.3. */
  backZone?: number;
  /** Where taps count: the whole carousel (default) or only the media area. */
  area?: 'all' | 'media';
};

export type RenderItemInfo<T> = {
  item: T;
  index: number;
  /**
   * This page's signed distance from the current position, on the UI thread:
   * 0 in view, 1 next, -1 previous. Animate the page's content independently,
   * for example a title that slides slower than its card.
   */
  offset: SharedValue<number>;
};

/** Props of a `components.Pagination` slot. */
export type PaginationSlotProps = {
  count: number;
  /** Index of the page in view. */
  index: number;
  /** Continuous position in pages, on the UI thread. */
  position: SharedValue<number>;
  loop: boolean;
  direction: CarouselDirection;
  scrollTo: (index: number) => void;
};

/** Props of a `components.Dot` slot, rendered once per page by the built-in pagination. */
export type DotSlotProps = {
  index: number;
  count: number;
  /** 1 when this dot's page is in view, 0 when a page or more away, in between while swiping. UI thread. */
  active: SharedValue<number>;
  direction: CarouselDirection;
  /** Present when dots are pressable. */
  onPress?: () => void;
};

/** Props of the `components.MediaOverlay` and `components.MediaBackground` slots. */
export type MediaSlotProps<T> = {
  item: T | undefined;
  index: number;
  count: number;
  /** Continuous position in pages, on the UI thread. */
  position: SharedValue<number>;
  width: number;
  height: number;
};

/**
 * Replaceable parts, like the slots of expo-morph-menu. Every slot is optional;
 * the built-in part is used when it is missing.
 */
export type CarouselComponents<T> = {
  /** Whole page indicator. `null` hides it. */
  Pagination?: ComponentType<PaginationSlotProps> | null;
  /** One dot of the built-in pagination. */
  Dot?: ComponentType<DotSlotProps>;
  /** Drawn over the media area, for example a gradient, a caption or a badge. Not touchable. */
  MediaOverlay?: ComponentType<MediaSlotProps<T>>;
  /** Drawn behind the media, for example a color that follows the swipe. */
  MediaBackground?: ComponentType<MediaSlotProps<T>>;
};

export type CarouselApi = {
  /** Index of the current page in `data`. */
  index: number;
  count: number;
  /** Continuous position in pages, on the UI thread. Use in `useAnimatedStyle`. */
  position: SharedValue<number>;
  scrollTo: (index: number, options?: { animated?: boolean }) => void;
  next: () => void;
  prev: () => void;
};

export type RenderFooterInfo<T> = CarouselApi & { item: T | undefined };

export type PaginationOptions = {
  /** Color of the current page's dot. Default `#1c1c1e`. */
  activeColor?: string;
  /** Color of the other dots. Default `#c7c7cc`. */
  inactiveColor?: string;
  /** Dot diameter. Default 8. */
  size?: number;
  /** Width of the current page's dot, which stretches into a pill. Default 22. */
  activeWidth?: number;
  /** Space between dots. Default 6. */
  gap?: number;
  /** Tap a dot to go to its page. Default true. */
  pressable?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type MorphCarouselRef = {
  scrollTo: (index: number, options?: { animated?: boolean }) => void;
  /** Move `count` pages forward (default 1). */
  next: (options?: { animated?: boolean; count?: number }) => void;
  /** Move `count` pages back (default 1). */
  prev: (options?: { animated?: boolean; count?: number }) => void;
  getIndex: () => number;
};

export type MorphCarouselProps<T> = {
  data: readonly T[];
  /**
   * Image shown in the media area for an item:
   * - `require(...)` or `{ uri }`;
   * - an array of `{ uri, width, height }` variants, like `srcset`: the
   *   carousel picks the smallest one that is sharp for the measured area and
   *   pixel ratio;
   * - or build the URL from `target` (physical pixels, rounded to a few
   *   widths), for image CDNs: `(p, i, t) => ({ uri: `${p.url}?w=${t.width}` })`.
   *
   * After a rotation to a larger area a sharper variant is loaded and
   * cross-faded in; after a rotation to a smaller one the current image stays.
   */
  getImage?: (item: T, index: number, target: ImageTarget) => ImageSourcePropType;
  /**
   * Page content: a card, a title and description, anything. Without
   * `getImage` there is no media area and the pages are the whole carousel.
   */
  renderItem?: (info: RenderItemInfo<T>) => ReactNode;

  /** How whole pages move between positions. Default `'slide'`. See `pageEffects` for options. */
  pageEffect?: PageEffect;
  /**
   * Size of one page along the scroll axis. Smaller than the carousel shows
   * the neighbors at the sides (with `parallax` or `coverflow`, for example).
   * Default: the whole page area.
   */
  pageSize?: number;
  /** Space between pages along the scroll axis. Default 0. */
  pageGap?: number;
  /** Where the current page sits when `pageSize` is smaller than the carousel. Default `center`. */
  pageAlign?: 'center' | 'start';
  snapMode?: SnapMode;
  /** Animation used to settle on a page. Default: a spring. */
  animation?: AnimationConfig;
  /**
   * Tap to change page, for users who would rather tap than swipe. `true` for
   * the defaults, or options. Off by default: when pages contain buttons, a
   * tap on a button would also change the page; use `area: 'media'` then.
   */
  tapToNavigate?: boolean | TapToNavigateOptions;
  /** Customize the pan gesture: thresholds, `simultaneousWithExternalGesture`, extra callbacks. Return the gesture. */
  configureGesture?: (gesture: CarouselPanGesture) => CarouselPanGesture;
  /** Replaceable parts: `Pagination`, `Dot`, `MediaOverlay`, `MediaBackground`. */
  components?: CarouselComponents<T>;
  keyExtractor?: (item: T, index: number) => string;

  /** How the images change between pages. Default `'liquid'`. */
  effect?: MediaEffect;
  liquid?: LiquidOptions;
  /**
   * - `top` (default): media area of `mediaHeight` above the pages.
   * - `background`: the media fills the whole carousel behind the pages.
   */
  mediaPosition?: 'top' | 'background';
  /** Height of the media area when `mediaPosition` is `top`. Default 280. */
  mediaHeight?: number;
  /** How an image fits its area. Default `contain`, which suits product shots on a transparent background. */
  mediaFit?: 'contain' | 'cover';
  /** Space around the image inside the media area. Default 16. */
  mediaPadding?: number;
  /** Color shown as a soft blob while an item's image loads. */
  getPlaceholderColor?: (item: T, index: number) => string;
  /**
   * Disk cache for remote (`{ uri }`) images, with expiry. On by default with
   * `stale-while-revalidate` and a 24 hour `maxAge`; `false` loads every image
   * from the network (the platform's HTTP cache still applies). Needs
   * expo-file-system on native; on web it uses Cache Storage.
   */
  imageCache?: false | ImageCacheOptions;

  direction?: CarouselDirection;
  /** Swipe past the last page to the first and the other way. Default false. */
  loop?: boolean;
  initialIndex?: number;
  /** `true` for the defaults, or options. Pauses while the user touches the carousel. */
  autoplay?: boolean | AutoplayOptions;
  /** Pages kept rendered and images kept loaded on each side of the current one. Default 2. */
  windowSize?: number;
  /**
   * Pages beyond `windowSize` on each side whose remote images are downloaded
   * into the cache ahead of time, at low priority, without rendering them.
   * Default 1; 0 turns it off. Needs the image cache.
   *
   * Images inside the window load by distance: the current page at high
   * priority, its neighbors at normal, the rest at low.
   */
  prefetch?: number;

  /** Allow swiping. Default true. Programmatic navigation still works when false. */
  gestureEnabled?: boolean;

  /** `true` (default) for built-in dots, `false` to hide them, or options. */
  pagination?: boolean | PaginationOptions;
  /** Content under the pagination, such as a button. Gets the current item and navigation helpers. */
  renderFooter?: (info: RenderFooterInfo<T>) => ReactNode;

  /** The nearest page changed, also during a drag. */
  onIndexChange?: (index: number) => void;
  /** A swipe, a programmatic move or an autoplay step started. */
  onScrollStart?: () => void;
  /** The carousel came to rest; `index` is the page in view. */
  onScrollEnd?: (index: number) => void;
  /** Shared value that mirrors the position, to drive other animations from the carousel. */
  positionValue?: SharedValue<number>;

  /** Screen reader label for the carousel. Default "Carousel". */
  accessibilityLabel?: string;
  /** Screen reader text for an item. Default: the `keyExtractor` key. */
  getAccessibilityLabel?: (item: T, index: number) => string;

  ref?: Ref<MorphCarouselRef>;
  style?: StyleProp<ViewStyle>;
  mediaStyle?: StyleProp<ViewStyle>;
  pageStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};
