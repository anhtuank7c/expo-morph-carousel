// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const repo = 'https://github.com/anhtuank7c/expo-morph-carousel';

export default defineConfig({
  site: 'https://anhtuank7c.github.io',
  base: '/expo-morph-carousel',
  // The example sources shown on the pages live outside the site folder.
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [
    starlight({
      title: 'Morph Carousel',
      description:
        'A carousel for Expo and React Native whose images melt into each other like liquid: live demos, copyable code, slots.',
      logo: { src: './src/assets/logo.svg', alt: 'Morph Carousel' },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: repo },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/expo-morph-carousel' },
      ],
      editLink: { baseUrl: `${repo}/edit/main/website/` },
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        vi: { label: 'Tiếng Việt', lang: 'vi' },
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start here',
          translations: { vi: 'Bắt đầu' },
          items: [{ slug: 'getting-started' }, { slug: 'usage' }],
        },
        {
          label: 'Examples',
          translations: { vi: 'Ví dụ' },
          items: [
            { slug: 'examples' },
            {
              label: 'Real-world apps',
              translations: { vi: 'Ứng dụng thực tế' },
              items: [
                { slug: 'examples/stories' },
                { slug: 'examples/feed' },
                { slug: 'examples/flash-sale' },
                { slug: 'examples/shop' },
                { slug: 'examples/memories' },
                { slug: 'examples/albums' },
              ],
            },
            {
              label: 'Showcases',
              translations: { vi: 'Trưng bày' },
              items: [
                { slug: 'examples/product' },
                { slug: 'examples/order' },
                { slug: 'examples/onboarding' },
                { slug: 'examples/remote' },
              ],
            },
          ],
        },
        {
          label: 'Guides',
          translations: { vi: 'Hướng dẫn' },
          items: [
            { slug: 'guides/media-effects' },
            { slug: 'guides/page-layouts' },
            { slug: 'guides/navigation' },
            { slug: 'guides/slots' },
            { slug: 'guides/images' },
            { slug: 'guides/accessibility' },
            { slug: 'guides/performance' },
            { slug: 'guides/troubleshooting' },
          ],
        },
        {
          label: 'Reference',
          translations: { vi: 'Tham khảo' },
          items: [{ slug: 'reference/props' }, { slug: 'reference/platforms' }],
        },
      ],
    }),
  ],
});
