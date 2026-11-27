/**
 * The liquid effect, drawn with React Native Skia.
 *
 * All images of the rendered window are stacked in one Skia layer and
 * cross-fade by page offset. The layer then goes through two image filters:
 *
 *   1. a blur whose radius peaks halfway between two pages, which melts both
 *      images into one soft blob;
 *   2. an alpha threshold (a color matrix on the alpha channel) that cuts the
 *      blurred edge back to a sharp outline, so the blob reads as a solid
 *      liquid shape instead of a haze.
 *
 * Both filters fade to identity when a page is settled, so a resting image is
 * drawn untouched (no halo, no jagged antialiasing).
 *
 * The Skia module is passed in rather than imported: Skia is an optional peer
 * dependency, and on web it can only be evaluated after CanvasKit has loaded.
 * Types come from a type-only import, which does not exist at runtime.
 */
import type * as SkiaModule from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { decodedByteLimit, decodedImageLimit, useCachedUri, type LoadPriority } from '../cache';
import type { ResolvedCacheOptions } from '../cache/ImageCache';
import { clamp, transitionPeak } from '../math';
import { createDecodeQueue, type DecodeRequest } from './decodeQueue';
import { sameSource, type NormalizedSource } from '../responsive';
import { useChosenUri, useImageLayers, type ImageArea } from '../useResponsiveImage';

type Skia = typeof SkiaModule;
type SkImage = SkiaModule.SkImage;
type SkPaint = SkiaModule.SkPaint;

export type LiquidItem = {
  key: string;
  /** Item identity (its key in `data`); the chosen image variant sticks to it. */
  identity: string;
  /** Virtual page index (unbounded with loop). */
  virtual: number;
  source: NormalizedSource;
  placeholderColor?: string;
  /** Download priority: the current page first, then its neighbors. */
  priority: LoadPriority;
};

/**
 * Filter levels per transition. The layer paint is looked up by the
 * transition's progress rounded to one of these levels instead of being
 * built every frame (a paint, a blur and a color filter per frame was the
 * main UI thread cost of the effect). 48 levels: below one point of blur
 * per step at the default blur, finer than a swipe moves per frame.
 */
const FILTER_LEVELS = 48;

export type LiquidDecode = 'scheduled' | 'immediate' | 'onDraw';

export type LiquidLayerProps = {
  items: LiquidItem[];
  position: SharedValue<number>;
  width: number;
  height: number;
  padding: number;
  fit: 'contain' | 'cover';
  blur: number;
  threshold: number;
  sharpness: number;
  /** Keep the image rectangle sharp: blur the content inside it, no alpha threshold. */
  preserveShape: boolean;
  /** When photos are decoded (see LiquidOptions.decode). */
  decode: LiquidDecode;
  /** Disk cache options for remote images, or null to load them directly. */
  cache: ResolvedCacheOptions | null;
  pixelRatio: number;
};

/** Duration of the cross-fade when an image is replaced by a sharper or newer one. */
const SWAP_MS = 220;

/** Where images are drawn: fixed padding, size following the canvas on the UI thread. */
type Rect = { x: number; y: number; width: number; height: number };
/** A rect whose size is decided on the UI thread (zero while the image is not visible). */
type DrawRect = { x: number; y: number; width: SharedValue<number>; height: SharedValue<number> };

export type LiquidLayerComponent = (props: LiquidLayerProps) => React.ReactElement | null;

const IDENTITY_ALPHA = { a: 1, b: 0 };

export function createLiquidLayer(S: Skia): LiquidLayerComponent {
  const { Canvas, Group, Image, Circle, useImage, Skia: SkiaApi, TileMode } = S;

  /**
   * Decoded images by URI, most recently used last. Swiping back and forth,
   * or a loop wrapping around, reuses the decoded image instead of reading
   * and decoding the file again.
   */
  const decoded = new Map<string, { image: SkImage; bytes: number }>();
  let decodedBytes = 0;
  const remember = (uri: string, image: SkImage) => {
    const old = decoded.get(uri);
    if (old) {
      decoded.delete(uri);
      decodedBytes -= old.bytes;
    }
    const bytes = image.width() * image.height() * 4;
    decoded.set(uri, { image, bytes });
    decodedBytes += bytes;
    // Least recently used first; the newest one always stays.
    while (decoded.size > 1 && (decoded.size > decodedImageLimit() || decodedBytes > decodedByteLimit())) {
      const [key, entry] = decoded.entries().next().value!;
      decoded.delete(key);
      decodedBytes -= entry.bytes;
    }
  };
  const decodedImage = (uri: string) => decoded.get(uri)?.image ?? null;

  /**
   * Skia decodes an encoded image lazily, on its first draw. That draw is on
   * the UI thread in the middle of a swipe (a neighbor coming into view), so
   * a large photo would stall the animation for as long as its JPEG takes to
   * decode. Decoding it here, on the JS thread when the page is mounted
   * ahead of time, moves that work out of the animation.
   */
  const decodeNow = (image: SkImage): SkImage => {
    if (Platform.OS === 'web') return image; // CanvasKit decodes on creation
    try {
      return image.makeNonTextureImage() ?? image;
    } catch {
      return image; // no GPU context on this thread: decode on first draw
    }
  };

  const queue = createDecodeQueue<SkiaModule.SkData, SkImage>({
    load: (uri) => SkiaApi.Data.fromURI(uri),
    decode: (data) => {
      const encoded = SkiaApi.Image.MakeImageFromEncoded(data);
      return encoded ? decodeNow(encoded) : null;
    },
    // A plain task, not requestAnimationFrame: animation frame callbacks run
    // before the app's own tasks, so a decode in each frame would hold
    // callbacks such as onIndexChange back until the queue is empty.
    schedule: (fn) => setTimeout(fn, 0),
  });

  function useSkImage(
    source: number | string | null,
    priority: LoadPriority,
    mode: LiquidDecode,
  ): SkImage | null {
    const uri = typeof source === 'string' ? source : null;
    // Bundled assets (`require`) go through Skia's own loader, which resolves them.
    const bundled = useImage(uri === null ? (source ?? undefined) : undefined);
    const [state, setState] = useState<{ uri: string | null; image: SkImage | null }>(() => ({
      uri,
      image: uri ? decodedImage(uri) : null,
    }));
    const priorityRef = useRef(priority);
    const requestRef = useRef<DecodeRequest | null>(null);

    useEffect(() => {
      if (!uri) return;
      const known = decodedImage(uri);
      if (known) {
        remember(uri, known);
        setState((prev) => (prev.uri === uri && prev.image === known ? prev : { uri, image: known }));
        return;
      }
      let alive = true;
      const done = (image: SkImage) => {
        remember(uri, image);
        if (alive) setState({ uri, image });
      };
      if (mode === 'scheduled') {
        const request = queue.request(uri, priorityRef.current, done);
        requestRef.current = request;
        return () => {
          alive = false;
          request.cancel();
          if (requestRef.current === request) requestRef.current = null;
        };
      }
      SkiaApi.Data.fromURI(uri)
        .then((data) => {
          const encoded = SkiaApi.Image.MakeImageFromEncoded(data);
          if (encoded) done(mode === 'immediate' ? decodeNow(encoded) : encoded);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [uri, mode]);

    // The page in view moves up the queue as the user swipes to it.
    useEffect(() => {
      priorityRef.current = priority;
      requestRef.current?.setPriority(priority);
    }, [priority]);

    if (!uri) return bundled;
    return state.uri === uri ? state.image : decodedImage(uri);
  }

  /**
   * One image layer. A layer that replaces another (sharper variant after a
   * rotation, new content after revalidation) starts transparent and fades
   * in over the one below; the image is already decoded when the layer
   * mounts, so the fade starts on its first frame.
   */
  function FadeLayer({
    image,
    id,
    fadeIn,
    opacity,
    rect,
    fit,
    onShown,
  }: {
    image: SkImage;
    id: number;
    fadeIn: boolean;
    opacity: SharedValue<number>;
    rect: DrawRect;
    fit: 'contain' | 'cover';
    onShown: (id: number) => void;
  }) {
    const mix = useSharedValue(fadeIn ? 0 : 1);
    useEffect(() => {
      if (!fadeIn) return;
      mix.value = withTiming(1, { duration: SWAP_MS }, (finished) => {
        if (finished) runOnJS(onShown)(id);
      });
    }, [fadeIn, id, mix, onShown]);
    const layerOpacity = useDerivedValue(() => opacity.value * mix.value);
    return (
      <Image
        image={image}
        fit={fit}
        opacity={layerOpacity}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
      />
    );
  }

  function LiquidImage({
    item,
    position,
    rect,
    area,
    cache,
    decode,
  }: {
    item: LiquidItem;
    position: SharedValue<number>;
    rect: Rect;
    area: ImageArea;
    cache: ResolvedCacheOptions | null;
    decode: LiquidDecode;
  }) {
    const chosen = useChosenUri(item.identity, item.source, area, cache);
    const cached = useCachedUri(chosen, cache, item.priority);
    const image = useSkImage(
      item.source.kind === 'bundled' ? item.source.asset : cached,
      item.priority,
      decode,
    );
    const { layers, onShown } = useImageLayers(image);
    const opacity = useDerivedValue(() => clamp(1 - Math.abs(item.virtual - position.value), 0, 1));
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const r = Math.min(rect.width, rect.height) * 0.32;
    // A page more than one page away has opacity 0 but would still be drawn
    // (and blurred with the layer). A zero size skips it, decided on the UI
    // thread in the same frame as the position, so a fast fling never shows
    // a page a frame late.
    const { width, height } = rect;
    const drawWidth = useDerivedValue(() => (opacity.value > 0 ? width : 0));
    const drawHeight = useDerivedValue(() => (opacity.value > 0 ? height : 0));
    const drawRect = useMemo<DrawRect>(
      () => ({ x: rect.x, y: rect.y, width: drawWidth, height: drawHeight }),
      [drawHeight, drawWidth, rect.x, rect.y],
    );

    if (layers.length === 0) {
      if (!item.placeholderColor) return null;
      return <Circle cx={cx} cy={cy} r={r} color={item.placeholderColor} opacity={opacity} />;
    }
    return (
      <Group>
        {layers.map((l, i) => (
          <FadeLayer
            key={l.id}
            id={l.id}
            image={l.value}
            fadeIn={i > 0}
            opacity={opacity}
            rect={drawRect}
            fit={area.fit}
            onShown={onShown}
          />
        ))}
      </Group>
    );
  }

  const LiquidImageMemo = memo(LiquidImage, (a, b) => {
    const x = a.item;
    const y = b.item;
    return (
      a.position === b.position &&
      a.rect === b.rect &&
      a.area === b.area &&
      a.cache === b.cache &&
      a.decode === b.decode &&
      x.key === y.key &&
      x.identity === y.identity &&
      x.virtual === y.virtual &&
      sameSource(x.source, y.source) &&
      x.placeholderColor === y.placeholderColor &&
      x.priority === y.priority
    );
  });

  function LiquidLayer({
    items,
    position,
    width,
    height,
    padding,
    fit,
    blur,
    threshold,
    sharpness,
    preserveShape,
    decode,
    cache,
    pixelRatio,
  }: LiquidLayerProps) {
    // Every paint the transition can use, built once on the JS thread when
    // the options or the size change. A frame only picks one: no allocation
    // on the UI thread while swiping.
    const imageWidth = Math.max(width - padding * 2, 0);
    const imageHeight = Math.max(height - padding * 2, 0);
    const paints = useMemo(() => {
      const list: SkPaint[] = [];
      for (let i = 0; i <= FILTER_LEVELS; i++) {
        const t = i / FILTER_LEVELS;
        const paint = SkiaApi.Paint();
        list.push(paint);
        if (i === 0) continue; // at rest: no filter, the image is drawn untouched
        const sigma = blur * t;
        if (preserveShape) {
          // Photos keep their rectangle: the blur stays inside the image area
          // and repeats the edge pixels (Clamp) instead of mixing in the
          // transparent outside, so edges stay opaque and corners square. No
          // alpha threshold, which is what rounds the corners off.
          const crop = SkiaApi.XYWHRect(padding, padding, imageWidth, imageHeight);
          paint.setImageFilter(SkiaApi.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null, crop));
          continue;
        }
        // alpha' = a·alpha + b. At t = 1 the line crosses 0.5 at `threshold`
        // with slope `sharpness`; at t = 0 it is the identity.
        const a = IDENTITY_ALPHA.a + (sharpness - 1) * t;
        const b = IDENTITY_ALPHA.b + (0.5 - sharpness * threshold) * t;
        // prettier-ignore
        const matrix = [
          1, 0, 0, 0, 0,
          0, 1, 0, 0, 0,
          0, 0, 1, 0, 0,
          0, 0, 0, a, b,
        ];
        const blurred = SkiaApi.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null);
        paint.setImageFilter(
          SkiaApi.ImageFilter.MakeColorFilter(SkiaApi.ColorFilter.MakeMatrix(matrix), blurred),
        );
      }
      return list;
    }, [blur, imageHeight, imageWidth, padding, preserveShape, sharpness, threshold]);

    const layer = useDerivedValue(() => paints[Math.round(transitionPeak(position.value) * FILTER_LEVELS)]);

    // Stable objects, so the memoized images do not re-render with the layer.
    const rect = useMemo<Rect>(
      () => ({ x: padding, y: padding, width: imageWidth, height: imageHeight }),
      [imageHeight, imageWidth, padding],
    );
    const area = useMemo<ImageArea>(
      () => ({ width: imageWidth, height: imageHeight, pixelRatio, fit }),
      [fit, imageHeight, imageWidth, pixelRatio],
    );

    if (width <= 0 || height <= 0) return null;
    return (
      // The size comes from the media area's layout (React state), not from
      // Canvas onSize: onSize measures the view on the UI thread in every
      // frame, for as long as the canvas is mounted, and warns while the view
      // has no layout yet. After a rotation, the image is drawn at the old
      // size for the one frame before the re-render.
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group layer={layer}>
          {items.map((item) => (
            <LiquidImageMemo
              key={item.key}
              item={item}
              position={position}
              rect={rect}
              area={area}
              cache={cache}
              decode={decode}
            />
          ))}
        </Group>
      </Canvas>
    );
  }

  return LiquidLayer;
}
