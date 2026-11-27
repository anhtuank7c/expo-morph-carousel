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
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useCachedUri } from '../cache';
import type { ResolvedCacheOptions } from '../cache/ImageCache';
import { clamp, transitionPeak } from '../math';

type Skia = typeof SkiaModule;
type SkImage = SkiaModule.SkImage;

export type LiquidItem = {
  key: string;
  /** Virtual page index (unbounded with loop). */
  virtual: number;
  source: number | string | null;
  placeholderColor?: string;
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
};

/** Decoded images kept in memory per app. */
const DECODED_LIMIT = 24;

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
    while (decoded.size > DECODED_LIMIT) decoded.delete(decoded.keys().next().value!);
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

  function LiquidImage({
    item,
    position,
    rect,
    fit,
    cache,
  }: {
    item: LiquidItem;
    position: SharedValue<number>;
    rect: { x: number; y: number; width: number; height: number };
    fit: 'contain' | 'cover';
    cache: ResolvedCacheOptions | null;
  }) {
    const remote = typeof item.source === 'string' ? item.source : null;
    const cached = useCachedUri(remote, cache);
    const image = useSkImage(remote === null ? item.source : cached);
    const opacity = useDerivedValue(() => clamp(1 - Math.abs(item.virtual - position.value), 0, 1));

    if (!image) {
      if (!item.placeholderColor) return null;
      const r = Math.min(rect.width, rect.height) * 0.32;
      return (
        <Circle
          cx={rect.x + rect.width / 2}
          cy={rect.y + rect.height / 2}
          r={r}
          color={item.placeholderColor}
          opacity={opacity}
        />
      );
    }
    return <Image image={image} fit={fit} opacity={opacity} {...rect} />;
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

    if (width <= 0 || height <= 0) return null;
    const rect = {
      x: padding,
      y: padding,
      width: Math.max(width - padding * 2, 0),
      height: Math.max(height - padding * 2, 0),
    };
    return (
      <Canvas style={{ width, height }} pointerEvents="none">
        <Group layer={layer}>
          {items.map((item) => (
            <LiquidImage key={item.key} item={item} position={position} rect={rect} fit={fit} cache={cache} />
          ))}
        </Group>
      </Canvas>
    );
  }

  return LiquidLayer;
}
