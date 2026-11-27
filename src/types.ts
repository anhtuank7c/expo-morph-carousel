import type { ReactNode, Ref } from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { ImageCacheOptions } from './cache/ImageCache';
import type { ImageTarget } from './responsive';

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

export type RenderItemInfo<T> = {
  item: T;
  index: number;
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
  next: (options?: { animated?: boolean }) => void;
  prev: (options?: { animated?: boolean }) => void;
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
  getImage: (item: T, index: number, target: ImageTarget) => ImageSourcePropType;
  /** Page content that slides with the gesture: title, description, anything. */
  renderItem?: (info: RenderItemInfo<T>) => ReactNode;
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
  /** Spring used when a page snaps into place. */
  spring?: SpringOptions;
  /** Allow swiping. Default true. Programmatic navigation still works when false. */
  gestureEnabled?: boolean;

  /** `true` (default) for built-in dots, `false` to hide them, or options. */
  pagination?: boolean | PaginationOptions;
  /** Content under the pagination, such as a button. Gets the current item and navigation helpers. */
  renderFooter?: (info: RenderFooterInfo<T>) => ReactNode;

  onIndexChange?: (index: number) => void;
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
