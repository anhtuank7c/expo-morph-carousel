# Contributing

Thanks for helping. Issues and pull requests can be written in English or Vietnamese.

## Reporting a bug

Use the [bug report form](https://github.com/anhtuank7c/expo-morph-carousel/issues/new?template=bug_report.yml). A report that can be reproduced gets fixed first, so please include:

- versions of `expo-morph-carousel`, Expo SDK, React Native, Reanimated and React Native Skia
- platform and OS version, device or simulator, Expo Go or a development build
- the `<MorphCarousel>` props you use, ideally as a change to [`example/`](example)
- a screen recording for anything visual; for the liquid effect, a slow swipe shows the most

Security issues: see [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Requirements: Node 22.18 or later (the unit tests run TypeScript directly), npm 10 or later.

```bash
git clone https://github.com/anhtuank7c/expo-morph-carousel.git
cd expo-morph-carousel
npm install            # also installs the pre-commit hook
npm run example        # example app in Expo Go
```

The package source is in `src/`. The example app imports it from `src/` through Metro, so a change shows up after a reload with no build step. For web, run `npm run web --workspace example`, which also copies `canvaskit.wasm` into `example/public/`.

Code map:

| File | Role |
| --- | --- |
| `src/MorphCarousel.tsx` | Component: layout, gesture, render window, autoplay, accessibility |
| `src/math.ts` | Pure paging math (snap target, rubber band, ring distance, render window). Unit tested |
| `src/effects.ts` | View-based presets |
| `src/liquid/` | Skia liquid layer; `index.ts` loads Skia on native, `index.web.ts` loads CanvasKit first |
| `src/Pagination.tsx` | Dots |

## Before opening a pull request

```bash
npm run check          # typecheck, ESLint, Prettier check, unit tests
```

The pre-commit hook runs ESLint and Prettier on staged files and the typecheck. CI runs `npm run check` and a package build on every pull request.

For changes to paging or the liquid effect, also:

- add a unit test in `test/` when the change is in `src/math.ts`
- try iOS, Android and web, with and without `loop`, horizontal and vertical
- check the liquid effect with a slow drag and at rest (a page at rest must look exactly like the original image)

## Pull requests

- One topic per pull request. Refactors and behavior changes in separate pull requests.
- Commit messages: imperative mood, short subject line.
- Update `CHANGELOG.md` under **Unreleased** for any change a user of the package would notice.
- Update both language versions of a document you change (`README.md` and `README.vi.md`). If you only write one language, say so in the pull request.
- A change to the public API (exports of `src/index.ts`, props) needs a note on compatibility in the pull request description.

## Releasing (maintainers)

1. Move the **Unreleased** entries in `CHANGELOG.md` under a new version heading.
2. `npm version <patch|minor|major>`: updates `package.json` and creates the `vX.Y.Z` tag.
3. `git push --follow-tags`. The `Release` workflow checks, builds and publishes to npm with provenance, then creates the GitHub release.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
