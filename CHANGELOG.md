# Changelog

All notable changes to this package are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Until 1.0.0, a minor version (0.x.0) may contain breaking changes; they are listed under **Breaking**.

## [Unreleased]

## [0.1.0] - 2026-11-27

First public release.

### Added

- `MorphCarousel`: a carousel whose media area morphs between pages while the page content slides.
- `liquid` effect drawn with React Native Skia: blur and alpha threshold that peak halfway between pages and vanish at rest. Tunable with `liquid={{ blur, threshold, sharpness }}`. Falls back to `crossfade` without Skia, while CanvasKit loads on web, and with Reduce Motion.
- Presets `crossfade`, `slide`, `parallax`, `stack`, and custom worklet effects (`MediaEffectFn`).
- Paging: snap, one page per swipe, fling, rubber band, `loop` in both directions, `direction="vertical"`, right-to-left layouts.
- `autoplay` that pauses on touch and while a screen reader is on.
- `ref` API (`scrollTo`, `next`, `prev`, `getIndex`), `onIndexChange`, `positionValue`, `renderFooter`.
- `Pagination` with dots that stretch into a pill and follow the gesture; usable on its own.
- Images from `require()` or `{ uri }`, `contain` or `cover`, placeholder colors, `windowSize` to keep neighbors loaded.
- Disk cache for remote images with expiry (`imageCache` prop, on by default): `stale-while-revalidate`, `cache-first` or `network-first`; lifetime from `maxAge` or `Cache-Control` / `Expires`; conditional revalidation with `ETag` / `Last-Modified`; `maxStale`, `headers`, `getCacheKey` for signed URLs; LRU size and count limits. Stored with expo-file-system on native (optional) and Cache Storage on web. Decoded Skia images are kept in a small in-memory LRU.
- `imageCache` API: `configure`, `prefetch`, `getEntry`, `stats`, `onStats`, `remove`, `clear`.
- Accessibility: one adjustable element with increment and decrement actions, keyboard navigation on web.
- `configureSkiaWeb` to set where CanvasKit is loaded from on web.

[Unreleased]: https://github.com/anhtuank7c/expo-morph-carousel/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/anhtuank7c/expo-morph-carousel/releases/tag/v0.1.0
