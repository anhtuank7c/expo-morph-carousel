import type { ImageSourcePropType } from 'react-native';

export type Product = {
  id: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
  /** Shown as a blob while the image loads, and used for accents. */
  color: string;
};

export const products: Product[] = [
  {
    id: 'orb',
    title: 'Meet Orb',
    description: 'A glossy sphere with a soft highlight. Swipe to watch it melt into the next shape.',
    image: require('../assets/shapes/orb.png'),
    color: '#6a4fd8',
  },
  {
    id: 'tile',
    title: 'Explore Tile',
    description: 'A rounded square with a warm gradient, the kind of shape app icons are made of.',
    image: require('../assets/shapes/tile.png'),
    color: '#f0a020',
  },
  {
    id: 'ring',
    title: 'Discover Ring',
    description: 'A torus with a hole in the middle. The liquid effect fills it in, then opens it again.',
    image: require('../assets/shapes/ring.png'),
    color: '#20a890',
  },
  {
    id: 'pill',
    title: 'Experience Pill',
    description: 'A tall capsule. Tall and wide shapes stretch the blob in between.',
    image: require('../assets/shapes/pill.png'),
    color: '#3478f6',
  },
  {
    id: 'heart',
    title: 'Love Heart',
    description: 'Two circles and a point. Watch the point grow out of the blob.',
    image: require('../assets/shapes/heart.png'),
    color: '#eb405a',
  },
];

/**
 * Devices for the product showcase: original drawings (example/scripts/
 * make-devices.mjs), cropped to their outline. Dark bodies and glowing
 * screens of different colors make the liquid morph easy to follow.
 */
export const devices: Product[] = [
  {
    id: 'watch',
    title: 'Meet Orbit Watch',
    description: 'A rounded case on a woven band. Swipe and it melts into the next device.',
    image: require('../assets/devices/watch.png'),
    color: '#6a4fd8',
  },
  {
    id: 'phone',
    title: 'Nova Phone',
    description: 'Edge-to-edge glass with an ocean wallpaper, tall and narrow.',
    image: require('../assets/devices/phone.png'),
    color: '#0b7fc4',
  },
  {
    id: 'laptop',
    title: 'Explore Slate Laptop',
    description: 'A wide screen on a thin base: the blob stretches from tall to wide.',
    image: require('../assets/devices/laptop.png'),
    color: '#c2368f',
  },
  {
    id: 'mini',
    title: 'Cube Mini',
    description: 'A small silver box with no screen at all, seen from above.',
    image: require('../assets/devices/mini.png'),
    color: '#8f959d',
  },
  {
    id: 'desktop',
    title: 'Vista Desktop',
    description: 'A large display with a sunset on a round foot.',
    image: require('../assets/devices/desktop.png'),
    color: '#e0566b',
  },
];

/** Media height of the remote screen's carousel; the home screen prefetches for it. */
export const REMOTE_MEDIA_HEIGHT = 240;
/** Horizontal padding of the remote screen around the carousel. */
export const REMOTE_SIDE_MARGIN = 16;

/** Photos are requested at 4:3; the carousel covers its area and crops the rest. */
export const heightFor = (width: number) => Math.round((width * 3) / 4);

/**
 * An Unsplash image URL at a given size. Unsplash serves through imgix, which
 * resizes on the fly: `w` and `h` in pixels, `fit=crop` fills the box.
 */
export function unsplashUrl(id: string, width: number, height: number) {
  return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop&q=80&fm=jpg`;
}

/**
 * Remote photos for the image-loading demo, from Unsplash (free to use under
 * the Unsplash License, https://unsplash.com/license). `uri` is a fixed 800 px
 * variant; the remote screen builds the URL per size with `unsplashUrl`.
 *
 * Unsplash answers with `Cache-Control: max-age=31536000` (one year), so with
 * `respectHttpHeaders` on, the cache keeps these for a year.
 */
export const photos = [
  { id: '1506905925346-21bda4d32df4', title: 'Sea of clouds', color: '#5b6478' },
  { id: '1501785888041-af3ef285b470', title: 'Alpine lake', color: '#2fa7a0' },
  { id: '1470071459604-3b5ec3a7fe05', title: 'Misty valley', color: '#6e7a5a' },
  { id: '1441974231531-c6227db76b6e', title: 'Forest path', color: '#3e4a2c' },
  { id: '1507525428034-b723cf961d3e', title: 'Beach at sunset', color: '#7fc4c8' },
  { id: '1500530855697-b586d89ba3ee', title: 'Desert road', color: '#a0553c' },
  { id: '1433086966358-54859d0ed716', title: 'Waterfall', color: '#3f6b3a' },
].map((p) => ({
  ...p,
  uri: unsplashUrl(p.id, 800, 600),
}));
