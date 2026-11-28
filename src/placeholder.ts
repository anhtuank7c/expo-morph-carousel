/**
 * What a page shows while its image loads: the media area filled with the
 * item's placeholder color, gently pulsing (skeleton style). When the image
 * is ready it fades in while the placeholder fades out, so a cut-out on a
 * transparent background never shows the block disappearing at once.
 * Shared by the plain view renderer and the liquid (Skia) layer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Opacity range of the pulse: a soft tint of the color, never a hard block. */
const PULSE_LOW = 0.45;
const PULSE_HIGH = 0.85;
const PULSE_MS = 800;

/** Corner radius of the placeholder: a photo filling its area has square corners, a cut-out gets soft ones. */
export function placeholderRadius(fit: 'contain' | 'cover') {
  return fit === 'cover' ? 0 : 16;
}

export type Placeholder = {
  /** Draw the placeholder. */
  visible: boolean;
  /** The first image fades in (over the placeholder) instead of appearing at once. */
  fadeBase: boolean;
  /** Opacity of the placeholder, on the UI thread. */
  opacity: SharedValue<number>;
  /** The image is ready and starts fading in: fade the placeholder out over `duration`. */
  leave: () => void;
  /** The image has finished fading in: remove the placeholder. */
  reveal: () => void;
};

/**
 * Placeholder state of one page. `imageAtMount`: the image was available on
 * the first render (bundled, or already decoded), so there is no placeholder
 * and no fade.
 */
export function usePlaceholder(
  color: string | undefined,
  imageAtMount: boolean,
  duration: number,
): Placeholder {
  const [readyAtMount] = useState(imageAtMount);
  const [revealed, setRevealed] = useState(false);
  const visible = !!color && !readyAtMount && !revealed;
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(PULSE_HIGH);
  const left = useRef(false);

  // Pulse while loading; still when the system asks for reduced motion.
  useEffect(() => {
    if (!visible || reduceMotion || left.current) return;
    opacity.value = withRepeat(
      withTiming(PULSE_LOW, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion, visible]);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    cancelAnimation(opacity);
    opacity.value = withTiming(0, { duration });
  }, [duration, opacity]);
  const reveal = useCallback(() => setRevealed(true), []);

  return { visible, fadeBase: !!color && !readyAtMount, opacity, leave, reveal };
}
