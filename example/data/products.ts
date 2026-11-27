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
 * Remote photos for the image-loading demo, from Unsplash (free to use under
 * the Unsplash License, https://unsplash.com/license). The imgix parameters
 * ask for an 800 px wide JPEG cropped to 4:3, about 60–200 KB each.
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
  uri: `https://images.unsplash.com/photo-${p.id}?w=800&h=600&fit=crop&q=80&fm=jpg`,
}));
