import { clamp } from './math';
import type { MediaEffectFn, MediaEffectInput, MediaFrameStyle } from './types';

/**
 * Built-in media effects for the view-based media layer (every effect except
 * `liquid`, which is drawn with Skia). Each one maps the signed page offset of
 * an image to its opacity and transform on the UI thread.
 */

/** Sign that turns "next page" into the on-screen direction it travels from. */
function axis(input: MediaEffectInput) {
  'worklet';
  const sign = input.rtl ? -1 : 1;
  const size = input.direction === 'vertical' ? input.height : input.width;
  return { sign, size, vertical: input.direction === 'vertical' };
}

function translate(vertical: boolean, value: number) {
  'worklet';
  return vertical ? { translateY: value } : { translateX: value };
}

export const crossfade: MediaEffectFn = ({ offset }) => {
  'worklet';
  return { opacity: clamp(1 - Math.abs(offset), 0, 1) };
};

export const slide: MediaEffectFn = (input) => {
  'worklet';
  const { sign, size, vertical } = axis(input);
  return {
    opacity: Math.abs(input.offset) < 1.5 ? 1 : 0,
    transform: [translate(vertical, input.offset * size * sign)],
  };
};

export const parallax: MediaEffectFn = (input) => {
  'worklet';
  const { sign, size, vertical } = axis(input);
  return {
    opacity: clamp(1 - Math.abs(input.offset) * 1.2, 0, 1),
    transform: [translate(vertical, input.offset * size * 0.5 * sign)],
  };
};

/**
 * The image on its way out shrinks and fades in place; the incoming one slides
 * in over it. Feels like dealing cards.
 */
export const stack: MediaEffectFn = (input) => {
  'worklet';
  const { sign, size, vertical } = axis(input);
  const { offset } = input;
  if (offset <= 0) {
    // current or already passed: stays, shrinks, fades
    const t = clamp(-offset, 0, 1);
    return {
      opacity: 1 - t,
      zIndex: 1,
      transform: [{ scale: 1 - 0.2 * t }],
    };
  }
  // coming next: slides in from the side, above the current image
  return {
    opacity: offset < 1.5 ? 1 : 0,
    zIndex: 2,
    transform: [translate(vertical, offset * size * sign)],
  };
};

export const presets = { crossfade, slide, parallax, stack } as const;

export function resolveEffect(effect: MediaEffectFn | keyof typeof presets): MediaEffectFn {
  return typeof effect === 'function' ? effect : presets[effect];
}

export type { MediaFrameStyle };
