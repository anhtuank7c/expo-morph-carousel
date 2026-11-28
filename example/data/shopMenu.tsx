import { Ionicons } from '@expo/vector-icons';
import type { MorphItem } from 'expo-morph-menu';

/**
 * The info button on the shop product page is expo-morph-menu, the sister
 * package (https://anhtuank7c.github.io/expo-morph-menu/): the button grows
 * into a card, a row grows into a full-screen route, `app/(sheet)/[key].tsx`.
 */

export type ShopInfo = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; lines: string[] };

export const SHOP_INFO: ShopInfo[] = [
  {
    key: 'size-guide',
    label: 'Size guide',
    icon: 'resize-outline',
    lines: [
      '38 · 24.0 cm',
      '39 · 24.7 cm',
      '40 · 25.3 cm',
      '41 · 26.0 cm',
      '42 · 26.7 cm',
      '43 · 27.3 cm',
      '44 · 28.0 cm',
    ],
  },
  {
    key: 'reviews',
    label: 'Reviews',
    icon: 'star-outline',
    lines: [
      '★★★★★ Light and comfy from day one.',
      '★★★★★ True to size, the knit breathes well.',
      '★★★★☆ Great for walks, a bit soft for runs.',
    ],
  },
  {
    key: 'shipping',
    label: 'Shipping & returns',
    icon: 'cube-outline',
    lines: ['Free shipping on orders over $35.', 'Delivered in 2–4 days.', 'Free returns within 30 days.'],
  },
];

export const SHOP_MENU: MorphItem[] = SHOP_INFO.map((info) => ({
  key: info.key,
  label: info.label,
  tint: '#1c1c1e',
  icon: ({ size, color }) => <Ionicons name={info.icon} size={size} color={color} />,
  href: { pathname: '/(sheet)/[key]', params: { key: info.key } },
}));

/** The button's icon: product info rather than the default plus. */
export function ShopMenuIcon({ size, color }: { size: number; color: string }) {
  return <Ionicons name="information" size={size} color={color} />;
}
