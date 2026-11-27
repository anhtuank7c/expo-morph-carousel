/**
 * Pure paging math. Every function is a worklet so it runs on the UI thread
 * inside gesture and animation callbacks, and has no React Native imports so
 * it can be unit tested with plain Node (`npm test`).
 *
 * Positions are in page units: 0 is the first page fully in view, 1.5 is
 * halfway between the second and the third page. With `loop`, the position is
 * unbounded (… -1, 0, 1 … n, n+1 …) and maps onto the data with `wrap`.
 */

/** `i` mapped into 0..n-1, also for negative numbers. */
export function wrap(i: number, n: number): number {
  'worklet';
  if (n <= 0) return 0;
  return ((i % n) + n) % n;
}

export function clamp(x: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(x, min), max);
}

/**
 * 0 when a page is settled, rising to 1 exactly halfway between two pages.
 * Drives the blur and the alpha threshold of the liquid effect, so both peak
 * in the middle of a transition and vanish when the carousel rests.
 */
export function transitionPeak(position: number): number {
  'worklet';
  const frac = position - Math.floor(position);
  return frac <= 0.5 ? frac * 2 : (1 - frac) * 2;
}

/**
 * Shortest signed distance from `position` to page `index` on a ring of `n`
 * pages. Used by pagination dots so that, with loop, the step from the last
 * page to the first moves the indicator across one dot instead of all of them.
 */
export function ringOffset(index: number, position: number, n: number): number {
  'worklet';
  if (n <= 0) return 0;
  let d = wrap(index - position, n);
  if (d > n / 2) d -= n;
  return d;
}

/**
 * Drag past the first or last page: the page follows the finger with
 * increasing resistance (iOS-style rubber band) instead of stopping dead.
 */
export function rubberBand(position: number, min: number, max: number, dimension = 1): number {
  'worklet';
  const rubber = (over: number) => (1 - 1 / ((over * 0.55) / dimension + 1)) * dimension;
  if (position < min) return min - rubber(min - position);
  if (position > max) return max + rubber(position - max);
  return position;
}

/**
 * Page to settle on when the finger lifts.
 *
 * - A fling (|velocity| above `flingVelocity`, in pages per second) moves one
 *   page in its direction.
 * - Otherwise the nearest page wins.
 * - One swipe never moves more than one page away from where it started,
 *   like a native pager.
 */
export function snapTarget(
  start: number,
  position: number,
  velocity: number,
  count: number,
  loop: boolean,
  flingVelocity = 0.6,
): number {
  'worklet';
  let target: number;
  if (velocity > flingVelocity) target = Math.floor(position) + 1;
  else if (velocity < -flingVelocity) target = Math.ceil(position) - 1;
  else target = Math.round(position);
  target = clamp(target, start - 1, start + 1);
  if (!loop) target = clamp(target, 0, Math.max(count - 1, 0));
  return target;
}

/**
 * Page to settle on with `snapMode="momentum"`: the gesture keeps going for
 * `momentum` seconds at the release velocity (pages per second), slowing down
 * linearly, then rounds to the nearest page. A hard fling can skip several
 * pages; a slow release behaves like `snapTarget`.
 */
export function momentumTarget(
  position: number,
  velocity: number,
  count: number,
  loop: boolean,
  momentum = 0.35,
): number {
  'worklet';
  // Distance of a linear slow-down from `velocity` to 0 over `momentum` s.
  let target = Math.round(position + (velocity * momentum) / 2);
  if (!loop) target = clamp(target, 0, Math.max(count - 1, 0));
  return target;
}

/**
 * Virtual page indexes to render around `center`: `radius` pages on each side.
 * Without loop the window stops at the data bounds; with loop it continues and
 * the caller maps each virtual index onto the data with `wrap`.
 */
export function pageWindow(center: number, radius: number, count: number, loop: boolean): number[] {
  if (count <= 0) return [];
  const from = loop ? center - radius : Math.max(0, center - radius);
  const to = loop ? center + radius : Math.min(count - 1, center + radius);
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  // With loop and few items, two virtual pages can show the same item. Keep
  // them: they are different positions on screen (left and right neighbour).
  return out;
}

/**
 * Virtual position nearest to `current` that shows data index `index`.
 * With loop, `scrollTo(0)` from the last page goes forward one page instead of
 * rewinding through every page.
 */
export function nearestVirtual(index: number, current: number, count: number, loop: boolean): number {
  'worklet';
  if (!loop || count <= 0) return clamp(index, 0, Math.max(count - 1, 0));
  const rounded = Math.round(current);
  const base = rounded - wrap(rounded, count);
  const candidates = [base + index - count, base + index, base + index + count];
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(c - current) < Math.abs(best - current)) best = c;
  return best;
}
