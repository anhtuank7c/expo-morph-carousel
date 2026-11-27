/**
 * Hooks shared by the Skia and the view-based media layers: choosing the
 * candidate for the current area, and swapping images without a flash.
 */
import { useCallback, useState } from 'react';

import { isCachedSync } from './cache';
import type { ResolvedCacheOptions } from './cache/ImageCache';
import { pickCandidate, requiredWidth, shouldSwitch, type NormalizedSource } from './responsive';

export type ImageArea = { width: number; height: number; pixelRatio: number; fit: 'contain' | 'cover' };

/**
 * URI to show for one item, chosen from its candidates for the current area.
 *
 * Sticky per item (`identity`): after a rotation to a smaller area, the
 * sharper image already chosen stays; after a rotation to a larger one, the
 * sharper candidate is chosen and the caller swaps it in once loaded.
 */
export function useChosenUri(
  identity: string,
  source: NormalizedSource,
  area: ImageArea,
  cache: ResolvedCacheOptions | null,
): string | null {
  const candidates = source.kind === 'uri' ? source.candidates : null;
  const withHeight = candidates?.find((c) => c.height && Number.isFinite(c.width));
  const aspect = withHeight ? withHeight.width / withHeight.height! : undefined;
  const required = requiredWidth(area, area.pixelRatio, area.fit, aspect);
  const pick = candidates
    ? pickCandidate(candidates, required, cache ? (uri) => isCachedSync(uri, cache) : undefined)
    : undefined;

  const [chosen, setChosen] = useState<{ identity: string; uri: string; width: number } | null>(null);
  let current = chosen && chosen.identity === identity ? chosen : null;
  if (pick && shouldSwitch(current, pick)) {
    current = { identity, uri: pick.uri, width: pick.width };
    // Adjusting state during render (React's pattern for "state derived from
    // props that only moves forward"): the next render sees it and stops.
    setChosen(current);
  }
  return current?.uri ?? null;
}

/**
 * Layers for a flash-free swap. `value` is the newest loaded image; when it
 * changes, it is pushed on top and fades in over the previous one, which is
 * dropped once the fade is done (`onShown`). Nothing is ever replaced in
 * place, so there is no frame without an image.
 */
export function useImageLayers<V>(value: V | null) {
  const [layers, setLayers] = useState<{ value: V; id: number }[]>([]);
  const [lastId, setLastId] = useState(0);
  const top = layers[layers.length - 1];
  if (value !== null && value !== top?.value) {
    const id = lastId + 1;
    setLastId(id);
    setLayers([...layers, { value, id }]);
  }
  /** Called by a layer when its fade-in has finished: drop everything below it. */
  const onShown = useCallback((id: number) => {
    setLayers((list) => {
      const at = list.findIndex((l) => l.id === id);
      return at > 0 ? list.slice(at) : list;
    });
  }, []);
  return { layers, onShown };
}
