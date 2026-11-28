/**
 * Data for the real-world demos (stories, vertical feed, flash sale, shop,
 * memories, albums). Photos from Unsplash, free to use under the Unsplash
 * License (https://unsplash.com/license), loaded at the size the carousel
 * asks for through imgix (`w`, `h`, `fit=crop`).
 */

import { WIDTH_STEPS, type ImageTarget } from 'expo-morph-carousel';

/** An Unsplash photo URL cropped to the given size, in physical pixels. */
export function photo(id: string, width: number, height: number, extra = '') {
  return `https://images.unsplash.com/photo-${id}?w=${Math.round(width)}&h=${Math.round(height)}&fit=crop&q=80&fm=jpg${extra}`;
}

/**
 * The photo for a carousel's media area. imgix crops to exactly the box we
 * ask for, so ask for the area itself (in physical pixels, the width rounded
 * up to a step so neighbors share cache entries). `target.width` is sized
 * from the longer side for `cover`, which suits images the server does not
 * crop but is far too big for a tall full-screen area.
 */
export function photoFor(id: string, target: ImageTarget) {
  const px = target.layoutWidth * target.pixelRatio;
  const width = WIDTH_STEPS.find((s) => s >= px) ?? WIDTH_STEPS[WIDTH_STEPS.length - 1];
  return photo(id, width, (width * target.layoutHeight) / Math.max(1, target.layoutWidth));
}

/** A round avatar crop centered on the face. */
export const avatar = (id: string, size = 96) => photo(id, size, size, '&crop=faces');

/* --- stories ------------------------------------------------------------- */

export type StoryUser = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  frames: { id: string; caption: string; time: string }[];
};

export const storyUsers: StoryUser[] = [
  {
    id: 'maya',
    name: 'maya.brews',
    avatar: '1544005313-94ddf0286df2',
    color: '#c77d4a',
    frames: [
      { id: '1564327368633-151ef1d45021', caption: 'Sunday brunch spot ☕', time: '2h' },
      { id: '1516213335993-159eca2981af', caption: 'Latte art level: finally', time: '2h' },
      { id: '1528699633788-424224dc89b5', caption: 'Fresh out of the oven', time: '1h' },
    ],
  },
  {
    id: 'leo',
    name: 'leo.outdoors',
    avatar: '1627686011747-74adda3d2343',
    color: '#2f8a7a',
    frames: [
      { id: '1528543606781-2f6e6857f318', caption: 'Bridge run at dawn', time: '5h' },
      { id: '1502003148287-a82ef80a6abc', caption: 'Lake day', time: '4h' },
      { id: '1520329612326-d6038d1395a1', caption: 'Found the waterfall', time: '3h' },
    ],
  },
  {
    id: 'ana',
    name: 'ana.nights',
    avatar: '1558507652-2d9626c4e67a',
    color: '#3b5bdb',
    frames: [
      { id: '1514439827219-9137a0b99245', caption: 'City lights', time: '8h' },
      { id: '1529619768328-e37af76c6fe5', caption: 'Long exposure test', time: '7h' },
      { id: '1611416370495-50fac9e1b382', caption: 'Skyline from the roof', time: '6h' },
    ],
  },
  {
    id: 'kai',
    name: 'kai.moves',
    avatar: '1498551172505-8ee7ad69f235',
    color: '#d6336c',
    frames: [
      { id: '1512264815082-9999c2d4894d', caption: 'Freeze', time: '12h' },
      { id: '1543893424-907f9ebc6a5d', caption: 'Rehearsal', time: '11h' },
      { id: '1511750931603-12cb2c8d28cc', caption: 'Street session', time: '10h' },
    ],
  },
];

/* --- vertical feed ------------------------------------------------------- */

export type FeedPost = {
  id: string;
  user: string;
  avatar: string;
  caption: string;
  sound: string;
  likes: number;
  comments: number;
  color: string;
};

export const feedPosts: FeedPost[] = [
  {
    id: '1592252054006-0570a10f0838',
    user: 'kai.moves',
    avatar: '1498551172505-8ee7ad69f235',
    caption: 'One take, no cuts. Swipe up for the slow-mo 👀 #dance',
    sound: 'Original sound · kai.moves',
    likes: 48200,
    comments: 1312,
    color: '#3b4a6b',
  },
  {
    id: '1580895456895-cfdf02e4c23f',
    user: 'ana.nights',
    avatar: '1558507652-2d9626c4e67a',
    caption: 'Rainy walk home through the neon district',
    sound: 'Midnight drive · lofi mix',
    likes: 12900,
    comments: 402,
    color: '#5a2a4a',
  },
  {
    id: '1530174883092-c2a7aa3f1cfe',
    user: 'maya.brews',
    avatar: '1544005313-94ddf0286df2',
    caption: 'The perfect espresso in 25 seconds ⏱️ #coffee',
    sound: 'Morning jazz · cafe set',
    likes: 30400,
    comments: 877,
    color: '#5b3a24',
  },
  {
    id: '1589739401762-670be815e704',
    user: 'leo.outdoors',
    avatar: '1627686011747-74adda3d2343',
    caption: 'Packing list for a 3-day hike, in the comments',
    sound: 'Trail mix · acoustic',
    likes: 8700,
    comments: 219,
    color: '#2f3b33',
  },
  {
    id: '1517328894681-0f5dfabd463c',
    user: 'ana.nights',
    avatar: '1558507652-2d9626c4e67a',
    caption: 'Street lamps and old stories',
    sound: 'Night city · ambient',
    likes: 21500,
    comments: 655,
    color: '#3a3326',
  },
  {
    id: '1771345207885-d1d91f4e663f',
    user: 'leo.outdoors',
    avatar: '1627686011747-74adda3d2343',
    caption: 'This bridge is covered in flowers every spring 🌸',
    sound: 'Spring · piano',
    likes: 64100,
    comments: 2048,
    color: '#6b5a4a',
  },
];

/* --- flash sale ---------------------------------------------------------- */

export type Banner = { id: string; title: string; subtitle: string; color: string };

export const banners: Banner[] = [
  {
    id: '1483985988355-763728e1935b',
    title: 'Mid-season sale',
    subtitle: 'Up to 60% off fashion',
    color: '#b0476c',
  },
  {
    id: '1520006403909-838d6b92c22e',
    title: 'New arrivals',
    subtitle: 'Fresh picks every morning',
    color: '#7a5c3e',
  },
  { id: '1555529669-e69e7aa0ba9a', title: 'Free shipping', subtitle: 'On orders over $35', color: '#3e6b7a' },
  {
    id: '1758520387283-303b0b332e89',
    title: 'Weekend deals',
    subtitle: 'Ends Sunday at midnight',
    color: '#8a6a2a',
  },
];

export type Deal = {
  id: string;
  name: string;
  price: number;
  was: number;
  sold: number;
  stock: number;
  color: string;
};

export const deals: Deal[] = [
  {
    id: '1542291026-7eec264c27ff',
    name: 'Runner sneakers',
    price: 59,
    was: 119,
    sold: 412,
    stock: 480,
    color: '#c92a2a',
  },
  {
    id: '1505740420928-5e560c06d30e',
    name: 'Wireless headphones',
    price: 79,
    was: 149,
    sold: 238,
    stock: 400,
    color: '#e8b923',
  },
  {
    id: '1546868871-7041f2a55e12',
    name: 'Smart watch',
    price: 199,
    was: 279,
    sold: 96,
    stock: 200,
    color: '#495057',
  },
  {
    id: '1613040809024-b4ef7ba99bc3',
    name: 'Studio headphones',
    price: 89,
    was: 129,
    sold: 177,
    stock: 220,
    color: '#f783ac',
  },
  {
    id: '1540925819815-17a59df70d64',
    name: 'Vintage camera',
    price: 129,
    was: 189,
    sold: 51,
    stock: 120,
    color: '#7a4a2a',
  },
  {
    id: '1763987300634-7b0822cbf390',
    name: 'Rose perfume',
    price: 39,
    was: 65,
    sold: 301,
    stock: 340,
    color: '#d6336c',
  },
  {
    id: '1629198688000-71f23e745b6e',
    name: 'Skincare set',
    price: 29,
    was: 52,
    sold: 389,
    stock: 420,
    color: '#f0c36d',
  },
  {
    id: '1600185365926-3a2ce3cdb9eb',
    name: 'Court sneakers',
    price: 69,
    was: 99,
    sold: 140,
    stock: 300,
    color: '#e8590c',
  },
];

/* --- shop ---------------------------------------------------------------- */

export type ShopColor = { id: string; name: string; swatch: string; stock: number };

export const shopColors: ShopColor[] = [
  { id: '1542291026-7eec264c27ff', name: 'Crimson', swatch: '#c92a2a', stock: 12 },
  { id: '1606107557195-0e29a4b5b4aa', name: 'Volt', swatch: '#a9e34b', stock: 4 },
  { id: '1491553895911-0055eca6402d', name: 'Graphite', swatch: '#495057', stock: 23 },
  { id: '1600185365483-26d7a4cc7519', name: 'Coral', swatch: '#ff8787', stock: 9 },
  { id: '1525966222134-fcfa99b8ae77', name: 'Burgundy', swatch: '#862e3c', stock: 2 },
];

/* --- memories ------------------------------------------------------------ */

export type Memory = { id: string; place: string; color: string };

export const memories: Memory[] = [
  { id: '1506905925346-21bda4d32df4', place: 'Above the clouds', color: '#5b6478' },
  { id: '1501785888041-af3ef285b470', place: 'Alpine lake', color: '#2fa7a0' },
  { id: '1470071459604-3b5ec3a7fe05', place: 'Misty valley', color: '#6e7a5a' },
  { id: '1441974231531-c6227db76b6e', place: 'Forest path', color: '#3e4a2c' },
  { id: '1433086966358-54859d0ed716', place: 'The waterfall', color: '#3f6b3a' },
  { id: '1507525428034-b723cf961d3e', place: 'Last sunset', color: '#7fc4c8' },
];

/* --- albums -------------------------------------------------------------- */

export type Album = { id: string; title: string; artist: string; color: string; length: number };

export const albums: Album[] = [
  {
    id: '1618005198919-d3d4b5a92ead',
    title: 'Soft Spheres',
    artist: 'Nova Lane',
    color: '#7aa2e3',
    length: 214,
  },
  {
    id: '1604076913837-52ab5629fba9',
    title: 'Afterglow',
    artist: 'The Paper Suns',
    color: '#e8705a',
    length: 187,
  },
  { id: '1620641788421-7a1c342ea42e', title: 'Ultraviolet', artist: 'Mira K', color: '#8e44ad', length: 243 },
  {
    id: '1635776062127-d379bfcba9f8',
    title: 'Night Bloom',
    artist: 'Halcyon',
    color: '#5b2c83',
    length: 199,
  },
  { id: '1669295384050-a1d4357bd1d7', title: 'Tidal', artist: 'Blue Hours', color: '#1c7c7d', length: 226 },
  {
    id: '1604079628040-94301bb21b91',
    title: 'Ember',
    artist: 'Juniper & Ash',
    color: '#e67e22',
    length: 205,
  },
  { id: '1573655349936-de6bed86f839', title: 'Prism', artist: 'Lumen Club', color: '#2c3e50', length: 238 },
];

/** 48200 → "48.2K". */
export function compact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${n}`;
}
