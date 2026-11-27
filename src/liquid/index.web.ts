/**
 * Web: Skia runs on CanvasKit, a WebAssembly build that has to be downloaded
 * before any Skia module is evaluated (Skia's web entry reads
 * `global.CanvasKit` when it loads). So the liquid layer loads asynchronously:
 * the carousel shows the cross-fade effect until CanvasKit is ready, then
 * switches to the liquid layer.
 *
 * The `.wasm` file is fetched from `/canvaskit.wasm` by default. Copy it into
 * your app's `public/` folder with `npx setup-skia-web`, or point
 * `configureSkiaWeb({ locateFile })` at another URL.
 */
import { useEffect, useState } from 'react';

import { createLiquidLayer, type LiquidLayerComponent } from './createLiquidLayer';

declare const require: (id: string) => unknown;

type LoadOptions = { locateFile?: (file: string) => string };

let options: LoadOptions = {};
let cached: LiquidLayerComponent | null | undefined;
let pending: Promise<LiquidLayerComponent | null> | undefined;

export function configureSkiaWeb(next: LoadOptions) {
  options = next;
}

function load(): Promise<LiquidLayerComponent | null> {
  pending ??= (async () => {
    try {
      const web = require('@shopify/react-native-skia/lib/module/web') as {
        LoadSkiaWeb: (opts?: LoadOptions) => Promise<void>;
      };
      await web.LoadSkiaWeb(options.locateFile ? { locateFile: options.locateFile } : undefined);
      cached = createLiquidLayer(require('@shopify/react-native-skia') as never);
    } catch (error) {
      console.warn('[expo-morph-carousel] Skia could not load on web, using crossfade instead.', error);
      cached = null;
    }
    return cached;
  })();
  return pending;
}

export function useLiquidLayer(enabled: boolean): LiquidLayerComponent | null {
  const [layer, setLayer] = useState<LiquidLayerComponent | null>(() => cached ?? null);

  useEffect(() => {
    if (!enabled || cached !== undefined) return;
    let alive = true;
    void load().then((loaded) => {
      if (alive && loaded) setLayer(() => loaded);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return enabled ? layer : null;
}

export type { LiquidItem, LiquidLayerComponent, LiquidLayerProps } from './createLiquidLayer';
