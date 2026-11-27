# Changelog

All notable changes to this package are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Until 1.0.0, a minor version (0.x.0) may contain breaking changes; they are listed under **Breaking**.

## [Unreleased]

### Performance

- Photos for the liquid effect are decoded on the JS thread when their page mounts, ahead of time, through a queue (one per task, the page in view first, skipped when the page left the window). Skia decodes lazily on first draw, which put a 20–45 ms JPEG decode (1080×810 photo, Android emulator) on the UI thread in the middle of a swipe. On a Redmi Note 8 Pro, 40 pages dropped 40–41 frames before and 0–1 after.
- The liquid filters are built once per size and options instead of every frame (no paint, blur or color filter allocated on the UI thread while swiping).
- Pages more than one page away are not drawn by the liquid layer (zero size, decided on the UI thread).
- Pages and media items are memoized: the re-render when the current page changes mid-swipe no longer renders every item again.
- The position mirror for `positionValue` does not run when no shared value is passed.

### Added

- `liquid.decode`: `'scheduled'` (default), `'immediate'` or `'onDraw'` (Skia's lazy decoding).
- Example: Stress test screen (60 photos in a Tinder stack, JS and UI thread probes, unattended runs with `?decode=…&auto=40&gap=350`).
- `imageCache.configure({ decodedBytes })`: memory budget for decoded images (default 96 MB), next to the `decodedImages` count.

## [0.1.0] - 2026-11-27

First public release.

### Added

- `MorphCarousel`: a carousel whose media area morphs between pages while the page content slides.
- `liquid` effect drawn with React Native Skia: blur and alpha threshold that peak halfway between pages and vanish at rest. Tunable with `liquid={{ blur, threshold, sharpness }}`. Falls back to `crossfade` without Skia, while CanvasKit loads on web, and with Reduce Motion.
- Presets `crossfade`, `slide`, `parallax`, `stack`, and custom worklet effects (`MediaEffectFn`).
- Paging: snap, one page per swipe, fling, rubber band, `loop` in both directions, `direction="vertical"`, right-to-left layouts.
- `autoplay` that pauses on touch and while a screen reader is on.
- `ref` API (`scrollTo`, `next`, `prev`, `getIndex`), `onIndexChange`, `positionValue`, `renderFooter`.
- `Pagination` with dots that stretch into a pill and follow the gesture; usable on its own, each dot replaceable.
- Page effects for whole pages or cards (`pageEffect`): `slide`, `parallax`, `stack`, `coverflow`, `cube`, `flip`, `fade`, `scale-fade`, `rotate`, `tinder`, with option factories in `pageEffects`, and custom worklets (`PageEffectFn`). `pageSize`, `pageGap` and `pageAlign` show the neighbors. `getImage` is optional, so the carousel also works as a plain card carousel.
- `renderItem` receives the page's `offset` as a shared value, to animate content inside a page.
- `snapMode`: `page`, `momentum` (a fling glides over several pages), `free` (no snapping). `animation`: spring or timing.
- `liquid.preserveShape`: keep the image rectangle sharp during the morph (no rounded, eaten-in corners); only the content melts. For photos.
- `tapToNavigate`: tap to change page (`sides` like stories or `forward`, `backZone`, `area: 'media'`); a tap on a peeking neighbor goes to it.
- `onScrollStart`, `onScrollEnd(index)`, `configureGesture(pan)`, and `next` / `prev` with `count`.
- Slots through `components`: `Pagination`, `Dot`, `MediaOverlay`, `MediaBackground`.
- Images from `require()` or `{ uri }`, `contain` or `cover`, placeholder colors, `windowSize` to keep neighbors loaded.
- Disk cache for remote images with expiry (`imageCache` prop, on by default): `stale-while-revalidate`, `cache-first` or `network-first`; lifetime from `maxAge` or `Cache-Control` / `Expires`; conditional revalidation with `ETag` / `Last-Modified`; `maxStale`, `headers`, `getCacheKey` for signed URLs; LRU size and count limits. Stored with expo-file-system on native (optional) and Cache Storage on web. Decoded Skia images are kept in a small in-memory LRU.
- Responsive images: `getImage` may return a list of `{ uri, width, height }` variants (`srcset`) or build a URL from its third argument `target` (physical pixels, rounded to `WIDTH_STEPS`). The carousel picks by measured area, pixel ratio and fit, prefers a cached variant, never downgrades a mounted image, and cross-fades to a sharper variant after a rotation or resize. Images are redrawn at the new size in the layout frame (Skia `onSize`), so a rotation shows no stale or empty frame.
- Download queue with priorities (`high` for the page in view, `normal` for neighbors, `low` for the rest, prefetches and revalidations) and a parallel limit; queued downloads move up when their page comes into view.
- `prefetch` prop (default 1): images of pages beyond the render window are downloaded ahead without rendering.
- `usePrefetchImages(urls, { enabled, priority, cache })` with progress, `useImageCacheStats()`, and `imageTargetFor()` to build the same URLs the carousel will request.
- `imageCache` API: `configure` (`maxSize` 100 MB, `maxEntries` 500, `maxConcurrent` 4, `decodedImages` 24 by default), `getConfig`, `prefetch` (with priority, returns loaded and failed counts), `getEntry`, `stats` (now with `active` and `queued`), `onStats`, `remove`, `clear`.
- Accessibility: one adjustable element with increment and decrement actions, keyboard navigation on web.
- `configureSkiaWeb` to set where CanvasKit is loaded from on web.

[Unreleased]: https://github.com/anhtuank7c/expo-morph-carousel/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/anhtuank7c/expo-morph-carousel/releases/tag/v0.1.0
