/**
 * Page effects: how whole pages (cards) move, scale, turn and fade as they
 * leave and enter. Every effect is a worklet that maps a page's signed offset
 * from the current position to a style, so it runs on the UI thread for every
 * visible page and frame.
 *
 * Each preset is a factory with options, so `pageEffects.stack({ visible: 4 })`
 * and the plain name `'stack'` both work.
 */
import { clamp } from './math';
type CarouselDirection = 'horizontal' | 'vertical';

export type PageEffectInput = {
  /**
   * Signed distance of this page from the current position, in pages: 0 in
   * view, 1 the next page, -1 the previous one, 0.5 halfway. Same sign in both
   * directions and in right-to-left layouts.
   */
  offset: number;
  /** Distance between two pages along the scroll axis, in points (page size + gap). */
  step: number;
  /** Size of one page. */
  width: number;
  height: number;
  /** Size of the carousel's page area. */
  viewportWidth: number;
  viewportHeight: number;
  direction: CarouselDirection;
  /** Right-to-left horizontal layout: "forward" is to the left on screen. */
  rtl: boolean;
};

type Transform =
  | { translateX: number }
  | { translateY: number }
  | { scale: number }
  | { scaleX: number }
  | { scaleY: number }
  | { rotate: string }
  | { rotateX: string }
  | { rotateY: string }
  | { perspective: number };

export type PageFrameStyle = {
  opacity?: number;
  zIndex?: number;
  transform?: Transform[];
  /** CSS-like origin for rotations, for example `'left center'`. */
  transformOrigin?: string;
};

export type PageEffectFn = (input: PageEffectInput) => PageFrameStyle;

/* --- helpers ------------------------------------------------------------- */

/** Translation along the scroll axis, mirrored for right-to-left. */
function along(input: PageEffectInput, distance: number): Transform {
  'worklet';
  if (input.direction === 'vertical') return { translateY: distance };
  return { translateX: input.rtl ? -distance : distance };
}

/** Translation across the scroll axis. */
function across(input: PageEffectInput, distance: number): Transform {
  'worklet';
  return input.direction === 'vertical' ? { translateX: distance } : { translateY: distance };
}

/** Rotation that turns a page around the axis perpendicular to scrolling. */
function turn(input: PageEffectInput, degrees: number): Transform {
  'worklet';
  if (input.direction === 'vertical') return { rotateX: `${-degrees}deg` };
  return { rotateY: `${input.rtl ? -degrees : degrees}deg` };
}

function lerp(a: number, b: number, t: number) {
  'worklet';
  return a + (b - a) * t;
}

/* --- presets --------------------------------------------------------------- */

/** Pages side by side, moving with the finger. */
export function slide(): PageEffectFn {
  return (input) => {
    'worklet';
    return { transform: [along(input, input.offset * input.step)] };
  };
}

export type ParallaxOptions = {
  /** Scale of the neighbors. Default 0.84. */
  scale?: number;
  /** How much closer the neighbors sit than a full step, in points. Default 0. */
  offset?: number;
  /** Opacity of the neighbors. Default 1. */
  opacity?: number;
};

/** The current page full size, neighbors smaller and closer. Use with a `pageSize` smaller than the viewport. */
export function parallax({ scale = 0.84, offset = 0, opacity = 1 }: ParallaxOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const d = Math.abs(input.offset);
    const t = clamp(d, 0, 1);
    const s = d <= 1 ? lerp(1, scale, t) : scale * lerp(1, scale, clamp(d - 1, 0, 1));
    return {
      opacity: lerp(1, opacity, t),
      zIndex: Math.round(100 - d * 10),
      transform: [along(input, input.offset * (input.step - offset)), { scale: s }],
    };
  };
}

export type StackOptions = {
  /** Cards visible behind the current one. Default 3. */
  visible?: number;
  /** Distance between stacked cards, in points. Default 16. */
  spacing?: number;
  /** Scale lost per card back. Default 0.06. */
  scaleStep?: number;
  /** Opacity lost per card back. Default 0.18. */
  opacityStep?: number;
  /** Tilt of a card leaving the stack, in degrees. Default 0. */
  rotation?: number;
  /** Stack the waiting cards along the scroll axis (`'along'`) or below (`'across'`). Default `'across'`. */
  stackAxis?: 'along' | 'across';
};

/**
 * A deck: the next cards wait behind the current one, and the current one
 * slides off when it is swiped.
 */
export function stack({
  visible = 3,
  spacing = 16,
  scaleStep = 0.06,
  opacityStep = 0.18,
  rotation = 0,
  stackAxis = 'across',
}: StackOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const o = input.offset;
    if (o < 0) {
      // Leaving: slides off along the axis and tilts.
      const t = clamp(-o, 0, 1);
      return {
        opacity: 1 - clamp(-o - 1, 0, 1),
        zIndex: 200,
        transform: [
          along(input, o * input.step * 1.1),
          { rotate: `${(input.rtl ? -1 : 1) * -rotation * t}deg` },
        ],
      };
    }
    const depth = o;
    const offsetPx = depth * spacing;
    return {
      opacity:
        clamp(1 - depth * opacityStep, 0, 1) * (depth > visible ? clamp(visible + 1 - depth, 0, 1) : 1),
      zIndex: Math.round(100 - depth * 10),
      transform: [
        stackAxis === 'along' ? along(input, offsetPx) : across(input, offsetPx),
        { scale: 1 - depth * scaleStep },
      ],
    };
  };
}

export type CoverflowOptions = {
  /** Rotation of the neighbors, in degrees. Default 48. */
  angle?: number;
  /** Scale of the neighbors. Default 0.82. */
  scale?: number;
  /** Fraction of a step between neighbors; below 1 they overlap. Default 0.62. */
  spacing?: number;
};

/** Neighbors turned away in 3D and overlapping, like album covers. */
export function coverflow({ angle = 48, scale = 0.82, spacing = 0.62 }: CoverflowOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const o = input.offset;
    const t = clamp(Math.abs(o), 0, 1);
    return {
      zIndex: Math.round(100 - Math.abs(o) * 10),
      opacity: clamp(2.5 - Math.abs(o), 0, 1),
      transform: [
        { perspective: 900 },
        along(input, o * input.step * spacing),
        turn(input, -clamp(o, -1, 1) * angle),
        { scale: lerp(1, scale, t) },
      ],
    };
  };
}

export type CubeOptions = {
  /**
   * Distance of the eye from the screen, in points. Smaller is a stronger
   * perspective. Default 2.5 × the larger side of a page.
   */
  perspective?: number;
};

/**
 * Where one face of the cube is drawn, as transforms React Native supports
 * on every platform (no translateZ, which Android ignores).
 *
 * The cube has the page's length as its side and its center that length / 2
 * behind the screen; it is turned by `offset × 90°` and seen by one eye at
 * `eye` in front of the page's center. The face is drawn around its
 * leading edge (u = 0): scaled (`along` the scroll axis, `across` it),
 * turned by the real angle, seen through a perspective centered on that
 * edge, then moved to the edge's projected position. With the scale applied
 * first (the order of a view's own transform on Android), that perspective
 * is the edge's depth from the eye times `along`. `across` is the edge's
 * perspective factor; `along` also corrects for the eye being off the
 * edge's axis. Every point of the face then lands where the real cube puts
 * it (see test/cube.test.ts), so neighboring faces share their edge.
 *
 * Returns null when the face looks away from the eye (or is nearly edge-on).
 */
export function cubeFace(
  offset: number,
  side: number,
  eye: number,
): { translate: number; along: number; across: number; perspective: number; angle: number } | null {
  'worklet';
  const a = (offset * Math.PI) / 2;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  if (cos < 0.05) return null;
  const h = side / 2;
  // Leading and trailing edges: position along the axis (from the page
  // center) and depth (toward the eye, the screen at 0).
  const x1 = h * (sin - cos);
  const z1 = h * (sin + cos - 1);
  const x2 = h * (sin + cos);
  const z2 = h * (cos - sin - 1);
  const d1 = eye - z1;
  const p1 = (x1 * eye) / d1;
  const p2 = (x2 * eye) / (eye - z2);
  if (p2 - p1 < 1e-3) return null; // seen from behind
  const across = eye / d1;
  const along = (across * (cos - (x1 * sin) / d1)) / cos;
  return {
    translate: p1 + h,
    along,
    across,
    perspective: along * d1,
    angle: (a * 180) / Math.PI,
  };
}

/**
 * Pages are the faces of a turning cube: neighboring faces share an edge
 * and the cube is seen through one perspective, so it reads as a solid
 * block. Give the pages content that fills them edge to edge (no margin,
 * no rounded corners) and no `pageGap`.
 */
export function cube({ perspective }: CubeOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const o = input.offset;
    if (Math.abs(o) >= 1) return { opacity: 0 };
    const vertical = input.direction === 'vertical';
    const side = vertical ? input.height : input.width;
    const eye = perspective ?? Math.max(input.width, input.height) * 2.5;
    // In right-to-left layouts the next face is on the left.
    const face = cubeFace(input.rtl && !vertical ? -o : o, side, eye);
    if (!face) return { opacity: 0 };
    const zIndex = Math.round(100 - Math.abs(o) * 10);
    if (vertical) {
      return {
        opacity: 1,
        zIndex,
        transformOrigin: 'center top',
        // Applied last to first: scale, turn, perspective, move.
        transform: [
          { translateY: face.translate },
          { perspective: face.perspective },
          // rotateX turns the bottom toward the eye for positive angles.
          { rotateX: `${-face.angle}deg` },
          { scaleY: face.along },
          { scaleX: face.across },
        ],
      };
    }
    return {
      opacity: 1,
      zIndex,
      transformOrigin: 'left center',
      // Applied last to first: scale, turn, perspective, move.
      transform: [
        { translateX: face.translate },
        { perspective: face.perspective },
        { rotateY: `${face.angle}deg` },
        { scaleX: face.along },
        { scaleY: face.across },
      ],
    };
  };
}

/** The page turns over in place like a card; the next page is its back. */
export function flip(): PageEffectFn {
  return (input) => {
    'worklet';
    const o = clamp(input.offset, -1, 1);
    // Each side is only visible while it faces the viewer.
    return {
      opacity: Math.abs(o) < 0.5 ? 1 : 0,
      zIndex: Math.abs(o) < 0.5 ? 100 : 0,
      transform: [{ perspective: 1000 }, turn(input, o * 180)],
    };
  };
}

/** Pages stay in place and cross-fade. */
export function fade(): PageEffectFn {
  return (input) => {
    'worklet';
    return {
      opacity: clamp(1 - Math.abs(input.offset), 0, 1),
      zIndex: Math.round(100 - Math.abs(input.offset) * 10),
    };
  };
}

export type ScaleFadeOptions = {
  /** Scale the outgoing page shrinks to (the incoming one grows from `2 - scale`). Default 0.86. */
  scale?: number;
};

/** The outgoing page shrinks and fades while the incoming one settles in from slightly larger. */
export function scaleFade({ scale = 0.86 }: ScaleFadeOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const o = input.offset;
    const t = clamp(Math.abs(o), 0, 1);
    return {
      opacity: 1 - t,
      zIndex: Math.round(100 - Math.abs(o) * 10),
      transform: [{ scale: o < 0 ? lerp(1, scale, t) : lerp(1, 2 - scale, t) }],
    };
  };
}

export type RotateOptions = {
  /** Tilt of the neighbors, in degrees. Default 14. */
  angle?: number;
  /** How far the neighbors drop, in points. Default 24. */
  drop?: number;
};

/** Pages swing on an arc: neighbors tilt and drop. */
export function rotate({ angle = 14, drop = 24 }: RotateOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const o = input.offset;
    const d = Math.abs(o);
    return {
      zIndex: Math.round(100 - d * 10),
      transform: [
        along(input, o * input.step),
        across(input, Math.min(d, 2) * drop),
        { rotate: `${(input.rtl ? -1 : 1) * o * angle}deg` },
      ],
    };
  };
}

export type TinderOptions = {
  /** Cards visible behind the top one. Default 2. */
  visible?: number;
  /** Tilt of a card thrown off, in degrees. Default 18. */
  angle?: number;
};

/** A pile of cards: the top card is thrown off with a tilt, the next one grows into place. */
export function tinder({ visible = 2, angle = 18 }: TinderOptions = {}): PageEffectFn {
  return (input) => {
    'worklet';
    const o = input.offset;
    if (o < 0) {
      const t = clamp(-o, 0, 1);
      return {
        opacity: 1 - clamp(-o - 0.6, 0, 1),
        zIndex: 200,
        transform: [
          along(input, o * input.step * 1.3),
          across(input, t * 30),
          { rotate: `${(input.rtl ? 1 : -1) * t * angle}deg` },
        ],
      };
    }
    return {
      opacity: o > visible ? clamp(visible + 1 - o, 0, 1) : 1,
      zIndex: Math.round(100 - o * 10),
      transform: [
        { scale: 1 - Math.min(o, visible + 1) * 0.05 },
        across(input, Math.min(o, visible + 1) * 10),
      ],
    };
  };
}

/** Factories by name, for custom options: `pageEffects.stack({ visible: 4 })`. */
export const pageEffects = {
  slide,
  parallax,
  stack,
  coverflow,
  cube,
  flip,
  fade,
  scaleFade,
  rotate,
  tinder,
};

export type PageEffectName =
  | 'slide'
  | 'parallax'
  | 'stack'
  | 'coverflow'
  | 'cube'
  | 'flip'
  | 'fade'
  | 'scale-fade'
  | 'rotate'
  | 'tinder';

export type PageEffect = PageEffectName | PageEffectFn;

const BY_NAME: Record<PageEffectName, () => PageEffectFn> = {
  slide,
  parallax: () => parallax(),
  stack: () => stack(),
  coverflow: () => coverflow(),
  cube: () => cube(),
  flip,
  fade,
  'scale-fade': () => scaleFade(),
  rotate: () => rotate(),
  tinder: () => tinder(),
};

export function resolvePageEffect(effect: PageEffect): PageEffectFn {
  return typeof effect === 'function' ? effect : BY_NAME[effect]();
}
