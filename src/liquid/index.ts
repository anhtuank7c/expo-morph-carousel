/**
 * Native: Skia is a regular native module, so it can be required right away.
 * The `require` sits in a try/catch, which Metro treats as an optional
 * dependency: without `@shopify/react-native-skia` the app still bundles and
 * the carousel falls back to the cross-fade effect.
 */
import { createLiquidLayer, type LiquidLayerComponent } from './createLiquidLayer';

declare const require: (id: string) => unknown;

let cached: LiquidLayerComponent | null | undefined;

function load(): LiquidLayerComponent | null {
  if (cached === undefined) {
    try {
      cached = createLiquidLayer(require('@shopify/react-native-skia') as never);
    } catch {
      cached = null;
    }
  }
  return cached;
}

/** The Skia liquid layer, or `null` when Skia is not installed. */
export function useLiquidLayer(enabled: boolean): LiquidLayerComponent | null {
  return enabled ? load() : null;
}

/** Web only. Kept here so both platforms export the same API. */
export function configureSkiaWeb(_options: { locateFile?: (file: string) => string }) {}

export type { LiquidItem, LiquidLayerComponent, LiquidLayerProps } from './createLiquidLayer';
