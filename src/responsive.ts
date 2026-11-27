/**
 * Responsive image selection, the carousel's version of `srcset` + `sizes`.
 *
 * HTML needs `sizes` because the browser picks an image before layout. The
 * carousel picks after layout: it knows the real size of the media area, so it
 * only needs the candidates (`srcset`) and the device pixel ratio.
 *
 * Pure functions, no React Native imports, unit tested with Node.
 */

export type ImageCandidate = {
  uri: string;
  /** Intrinsic width in pixels, like the `w` descriptor of `srcset`. */
  width: number;
  /** Intrinsic height in pixels; lets `cover` and `contain` account for the aspect ratio. */
  height?: number;
  headers?: Record<string, string>;
};

/** Size the carousel asks `getImage` for, in physical pixels. */
export type ImageTarget = {
  /** Width to request, rounded up to one of `WIDTH_STEPS`. */
  width: number;
  /** Height matching `width` at the media area's aspect ratio. */
  height: number;
  pixelRatio: number;
  /** Size of the image area in layout points (dp). */
  layoutWidth: number;
  layoutHeight: number;
  fit: 'contain' | 'cover';
};

/**
 * Widths a target is rounded up to, so a CDN URL built from `target.width`
 * has a handful of variants per image instead of one per device (which would
 * defeat both the CDN cache and the carousel's own).
 */
export const WIDTH_STEPS = [
  160, 240, 320, 480, 640, 750, 828, 1080, 1200, 1440, 1600, 1920, 2048, 2560, 3200, 3840,
];

export function stepUp(px: number): number {
  for (const s of WIDTH_STEPS) if (s >= px) return s;
  return Math.ceil(px / 512) * 512;
}

export type NormalizedSource =
  { kind: 'none' } | { kind: 'bundled'; asset: number } | { kind: 'uri'; candidates: ImageCandidate[] };

type AnySource =
  | number
  | { uri?: string; width?: number; height?: number; headers?: Record<string, string> }
  | readonly { uri?: string; width?: number; height?: number; headers?: Record<string, string> }[]
  | null
  | undefined;

/**
 * Turns a React Native image source into candidates. A single `{ uri }`
 * becomes one candidate of unknown (infinite) width; an array of
 * `{ uri, width, height }` is a `srcset`.
 */
export function normalizeSource(source: AnySource): NormalizedSource {
  if (typeof source === 'number') return { kind: 'bundled', asset: source };
  if (!source) return { kind: 'none' };
  const list = Array.isArray(source) ? source : [source as Exclude<AnySource, number | readonly unknown[]>];
  const candidates: ImageCandidate[] = [];
  for (const s of list) {
    if (!s?.uri) continue;
    candidates.push({
      uri: s.uri,
      width: s.width && s.width > 0 ? s.width : Number.POSITIVE_INFINITY,
      height: s.height,
      headers: s.headers,
    });
  }
  return candidates.length ? { kind: 'uri', candidates } : { kind: 'none' };
}

/**
 * Pixel width an image must have to look sharp in a `width × height` (dp)
 * area at `pixelRatio`.
 *
 * - `contain`: the image fits inside the area, so with a known aspect ratio a
 *   tall image in a wide area needs less than the full width.
 * - `cover`: the image fills the area and is cropped, so a tall area needs
 *   more width than the area has.
 */
export function requiredWidth(
  area: { width: number; height: number },
  pixelRatio: number,
  fit: 'contain' | 'cover',
  aspect?: number,
): number {
  const w = area.width * pixelRatio;
  const h = area.height * pixelRatio;
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return fit === 'cover' ? Math.max(w, h) : w;
  return fit === 'cover' ? Math.max(w, h * aspect) : Math.min(w, h * aspect);
}

/**
 * The candidate to show.
 *
 * 1. Among candidates at least `required` wide, one already in the cache wins,
 *    as long as it is not more than twice the needed size (no 4K file for a
 *    thumbnail).
 * 2. Otherwise the smallest candidate that is wide enough.
 * 3. If none is wide enough, the largest.
 */
export function pickCandidate(
  candidates: ImageCandidate[],
  required: number,
  isCached?: (uri: string) => boolean,
): ImageCandidate | undefined {
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort((a, b) => a.width - b.width);
  const enough = sorted.filter((c) => c.width >= required);
  if (enough.length === 0) return sorted[sorted.length - 1];
  if (isCached) {
    const cached = enough.find((c) => isCached(c.uri) && c.width <= required * 2);
    if (cached) return cached;
  }
  return enough[0];
}

/**
 * Sticky choice while an item stays mounted: switch only to a sharper image.
 * After rotating to a smaller area the sharper image already on screen stays,
 * which costs nothing and avoids a visible swap (browsers do the same).
 */
export function shouldSwitch(current: { uri: string; width: number } | null, next: ImageCandidate): boolean {
  if (!current) return true;
  if (current.uri === next.uri) return false;
  // Same or larger: a sharper variant, or new content at the same size.
  return next.width >= current.width;
}

/** The target passed to a `getImage(item, index, target)` function. */
export function makeTarget(
  area: { width: number; height: number },
  pixelRatio: number,
  fit: 'contain' | 'cover',
): ImageTarget {
  const px = Math.max(area.width, fit === 'cover' ? area.height : 0) * pixelRatio;
  const width = stepUp(px);
  const ratio = area.width > 0 ? area.height / area.width : 1;
  return {
    width,
    height: Math.round(width * ratio),
    pixelRatio,
    layoutWidth: area.width,
    layoutHeight: area.height,
    fit,
  };
}
