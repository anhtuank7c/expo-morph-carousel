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
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { decodedImageLimit, useCachedUri, type LoadPriority } from '../cache';
import type { ResolvedCacheOptions } from '../cache/ImageCache';
import { clamp, transitionPeak } from '../math';
import type { NormalizedSource } from '../responsive';
import { useChosenUri, useImageLayers, type ImageArea } from '../useResponsiveImage';

type Skia = typeof SkiaModule;
type SkImage = SkiaModule.SkImage;

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
  /** Disk cache options for remote images, or null to load them directly. */
  cache: ResolvedCacheOptions | null;
  pixelRatio: number;
};

/** Duration of the cross-fade when an image is replaced by a sharper or newer one. */
const SWAP_MS = 220;

/** Where images are drawn: fixed padding, size following the canvas on the UI thread. */
type Rect = { x: number; y: number; width: SharedValue<number>; height: SharedValue<number> };

export type LiquidLayerComponent = (props: LiquidLayerProps) => React.ReactElement | null;

const IDENTITY_ALPHA = { a: 1, b: 0 };

export function createLiquidLayer(S: Skia): LiquidLayerComponent {
  const { Canvas, Group, Image, Circle, useImage, Skia: SkiaApi, TileMode } = S;

  /**
   * Decoded images by URI, most recently used last. Swiping back and forth,
   * or a loop wrapping around, reuses the decoded image instead of reading
   * and decoding the file again.
   */
  const decoded = new Map<string, SkImage>();
  const remember = (uri: string, image: SkImage) => {
    decoded.delete(uri);
    decoded.set(uri, image);
    while (decoded.size > decodedImageLimit()) decoded.delete(decoded.keys().next().value!);
  };

  function useSkImage(source: number | string | null): SkImage | null {
    const uri = typeof source === 'string' ? source : null;
    // Bundled assets (`require`) go through Skia's own loader, which resolves them.
    const bundled = useImage(uri === null ? (source ?? undefined) : undefined);
    const [state, setState] = useState<{ uri: string | null; image: SkImage | null }>(() => ({
      uri,
      image: uri ? (decoded.get(uri) ?? null) : null,
    }));

    useEffect(() => {
      if (!uri) return;
      const known = decoded.get(uri);
      if (known) {
        remember(uri, known);
        setState((prev) => (prev.uri === uri && prev.image === known ? prev : { uri, image: known }));
        return;
      }
      let alive = true;
      SkiaApi.Data.fromURI(uri)
        .then((data) => {
          const image = SkiaApi.Image.MakeImageFromEncoded(data);
          if (!image) return;
          remember(uri, image);
          if (alive) setState({ uri, image });
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [uri]);

    if (!uri) return bundled;
    return state.uri === uri ? state.image : (decoded.get(uri) ?? null);
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
    rect: Rect;
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
  }: {
    item: LiquidItem;
    position: SharedValue<number>;
    rect: Rect;
    area: ImageArea;
    cache: ResolvedCacheOptions | null;
  }) {
    const chosen = useChosenUri(item.identity, item.source, area, cache);
    const cached = useCachedUri(chosen, cache, item.priority);
    const image = useSkImage(item.source.kind === 'bundled' ? item.source.asset : cached);
    const { layers, onShown } = useImageLayers(image);
    const opacity = useDerivedValue(() => clamp(1 - Math.abs(item.virtual - position.value), 0, 1));
    const cx = useDerivedValue(() => rect.x + rect.width.value / 2);
    const cy = useDerivedValue(() => rect.y + rect.height.value / 2);
    const r = useDerivedValue(() => Math.min(rect.width.value, rect.height.value) * 0.32);

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
            rect={rect}
            fit={area.fit}
            onShown={onShown}
          />
        ))}
      </Group>
    );
  }

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
    cache,
    pixelRatio,
  }: LiquidLayerProps) {
    const layer = useDerivedValue(() => {
      const t = transitionPeak(position.value);
      const paint = SkiaApi.Paint();
      if (t < 0.002) return paint;
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
      const sigma = blur * t;
      const blurred = SkiaApi.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null);
      paint.setImageFilter(
        SkiaApi.ImageFilter.MakeColorFilter(SkiaApi.ColorFilter.MakeMatrix(matrix), blurred),
      );
      return paint;
    });

    // The canvas fills the media area and reports its size on the UI thread,
    // in the same frame as the layout. Drawing from React state instead lags
    // a render behind, which after a rotation shows one frame drawn at the
    // old width.
    const canvasSize = useSharedValue({ width, height });
    const rectWidth = useDerivedValue(() => Math.max(canvasSize.value.width - padding * 2, 0));
    const rectHeight = useDerivedValue(() => Math.max(canvasSize.value.height - padding * 2, 0));

    if (width <= 0 || height <= 0) return null;
    const rect: Rect = { x: padding, y: padding, width: rectWidth, height: rectHeight };
    const area: ImageArea = {
      width: Math.max(width - padding * 2, 0),
      height: Math.max(height - padding * 2, 0),
      pixelRatio,
      fit,
    };
    return (
      <Canvas style={StyleSheet.absoluteFill} onSize={canvasSize} pointerEvents="none">
        <Group layer={layer}>
          {items.map((item) => (
            <LiquidImage
              key={item.key}
              item={item}
              position={position}
              rect={rect}
              area={area}
              cache={cache}
            />
          ))}
        </Group>
      </Canvas>
    );
  }

  return LiquidLayer;
}
