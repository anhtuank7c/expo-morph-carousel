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

/** Remote photos for the image-loading demo (picsum.photos, fixed ids). */
export const photos = [
  { id: '1015', title: 'River', color: '#55707a' },
  { id: '1039', title: 'Waterfall', color: '#4d5a3d' },
  { id: '1043', title: 'Lake', color: '#6b7f96' },
  { id: '1050', title: 'Coast', color: '#9fb2c4' },
  { id: '1069', title: 'Jellyfish', color: '#1c2a4a' },
  { id: '1074', title: 'Lion', color: '#8a7a55' },
  { id: '1080', title: 'Strawberries', color: '#a3242c' },
].map((p) => ({ ...p, uri: `https://picsum.photos/id/${p.id}/800/600` }));
