// Builds the guide and reference pages from the README sections (English and
// Vietnamese), so the README and the site never disagree. Run after editing
// a README: `npm run sections` (also run by `npm run build`).
//
// Each page lists the README sections it is made of (by their English
// heading; the Vietnamese README has the same sections in the same order)
// and what goes above them: a live demo and the source it runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const docs = path.resolve(here, '..', 'src', 'content', 'docs');
const BASE = '/expo-morph-carousel';
const REPO = 'https://github.com/anhtuank7c/expo-morph-carousel/blob/main/';

const PAGES = [
  {
    slug: 'getting-started',
    title: ['Getting started', 'Bắt đầu'],
    description: [
      'Install the carousel and its peers, set up web, and check compatibility.',
      'Cài carousel và các thư viện đi kèm, cấu hình web, kiểm tra tương thích.',
    ],
    sections: ['Installation', 'Compatibility'],
    intro: [
      "Install the package, add the libraries it builds on, and the carousel on the right is yours. Next: [Usage](BASE/usage/) shows this demo's code, ready to copy.",
      'Cài package và các thư viện nền là bạn có ngay carousel bên phải. Tiếp theo: [Cách dùng](BASE/vi/usage/) có mã của demo này, chép về là chạy.',
    ],
    demo: 'basic',
  },
  {
    slug: 'usage',
    title: ['Usage', 'Cách dùng'],
    description: ['The smallest useful carousel, ready to copy.', 'Carousel tối giản, chép về dùng ngay.'],
    sections: ['Usage'],
    demo: 'basic',
    source: ['app/basic.tsx'],
  },
  {
    slug: 'reference/props',
    title: ['Props', 'Props'],
    description: ['Every prop of MorphCarousel.', 'Toàn bộ props của MorphCarousel.'],
    sections: ['Props'],
  },
  {
    slug: 'guides/page-layouts',
    title: ['Page layouts', 'Bố cục trang'],
    description: [
      'How whole pages move: parallax, stack, coverflow, cube, flip, tinder and your own.',
      'Cách cả trang di chuyển: parallax, stack, coverflow, cube, flip, tinder và hiệu ứng tự viết.',
    ],
    sections: ['Page layouts'],
    demo: 'layouts?effect=cube',
    demoNote: [
      'Pick another effect under the carousel in the demo: every layout of the table below runs there.',
      'Chọn hiệu ứng khác bên dưới carousel trong demo: mọi bố cục trong bảng bên dưới đều chạy ở đó.',
    ],
    source: ['app/layouts.tsx'],
  },
  {
    slug: 'guides/navigation',
    title: ['Navigation and control', 'Điều hướng và điều khiển'],
    description: [
      'Snapping, animation, tap to navigate, autoplay and the ref API.',
      'Snap, animation, chạm để chuyển trang, autoplay và ref API.',
    ],
    sections: ['Snapping and animation', 'Tap to navigate', 'Controlling the carousel'],
    demo: 'onboarding',
    demoNote: [
      'Skip and Next use the ref API, the background follows `positionValue`.',
      'Skip và Next dùng ref API, màu nền chạy theo `positionValue`.',
    ],
    source: ['app/onboarding.tsx'],
  },
  {
    slug: 'guides/slots',
    title: ['Slots', 'Slots'],
    description: [
      'Replace the pagination, each dot, or draw over and behind the media.',
      'Thay pagination, từng chấm, hoặc vẽ phía trên và phía sau media.',
    ],
    sections: ['Slots', 'Pagination outside the carousel'],
    demo: 'slots',
    demoNote: [
      'Each slot of this page in one screen. More in the examples: the menu tabs and glow of [Food order](BASE/examples/order/), the thumbnail strip of [Shop](BASE/examples/shop/).',
      'Mỗi slot của trang này trong một màn. Thêm trong các ví dụ: thanh tab và quầng sáng của [Đặt món](BASE/vi/examples/order/), dải thumbnail của [Trang sản phẩm](BASE/vi/examples/shop/).',
    ],
    source: ['app/slots.tsx'],
  },
  {
    slug: 'guides/images',
    title: ['Images and caching', 'Ảnh và cache'],
    description: [
      'Responsive images, remote images, the disk cache, load order and prefetching.',
      'Ảnh responsive, ảnh từ mạng, cache trên đĩa, thứ tự tải và tải trước.',
    ],
    sections: ['Responsive images (srcset)', 'Remote images and caching'],
    demo: 'remote',
    source: ['app/remote.tsx', 'data/products.ts'],
  },
  {
    slug: 'guides/media-effects',
    title: ['Media effects', 'Hiệu ứng media'],
    description: [
      'The liquid effect, the presets and your own effects.',
      'Hiệu ứng liquid, các preset và hiệu ứng tự viết.',
    ],
    sections: ['Custom media effects', 'How the liquid effect works'],
    demo: 'playground',
    demoNote: [
      'Every preset, a custom effect and the liquid settings, live.',
      'Mọi preset, một hiệu ứng tự viết và các thông số liquid, chỉnh trực tiếp.',
    ],
    source: ['app/playground.tsx'],
  },
  {
    slug: 'guides/accessibility',
    title: ['Accessibility', 'Accessibility'],
    description: [
      'Screen readers, keyboard and Reduce Motion.',
      'Trình đọc màn hình, bàn phím và Reduce Motion.',
    ],
    sections: ['Accessibility'],
  },
  {
    slug: 'guides/performance',
    title: ['Performance', 'Hiệu năng'],
    description: [
      'What runs where, and how photos are decoded.',
      'Cái gì chạy ở đâu, và ảnh được giải mã thế nào.',
    ],
    sections: ['Performance'],
    demo: 'stress',
    demoNote: [
      '60 photos in a Tinder stack with JS and UI thread probes.',
      '60 ảnh trong chồng thẻ kiểu Tinder, đo JS thread và UI thread.',
    ],
  },
  {
    slug: 'guides/troubleshooting',
    title: ['Troubleshooting', 'Xử lý sự cố'],
    description: ['Common problems and their fixes.', 'Các lỗi thường gặp và cách sửa.'],
    sections: ['Troubleshooting'],
  },
  {
    slug: 'reference/platforms',
    title: ['Platform status', 'Trạng thái nền tảng'],
    description: ['What was tested where.', 'Đã kiểm tra những gì, trên nền tảng nào.'],
    sections: ['Platform status'],
  },
];

/** README sections by English heading: { heading, lines } in both languages. */
function sections(file) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  const out = [];
  let cur = null;
  let fence = false;
  for (const line of lines) {
    if (line.startsWith('```')) fence = !fence;
    if (!fence && line.startsWith('## ')) {
      cur = { heading: line.slice(3).trim(), lines: [line] };
      out.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  return out;
}
const en = sections('README.md');
const vi = sections('README.vi.md');
if (en.length !== vi.length) throw new Error('README.md and README.vi.md have different sections');

const slugify = (h) =>
  h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/ /g, '-');

// Where each README anchor (## and ### headings) ends up, per language.
function anchors(list, lang) {
  const map = {};
  list.forEach((s, i) => {
    const page = PAGES.find((p) => p.sections.includes(en[i].heading));
    for (const line of s.lines) {
      const m = line.match(/^(##+) (.*)/);
      if (m && page)
        map[slugify(m[2])] = `${BASE}${lang === 'vi' ? '/vi' : ''}/${page.slug}/#${slugify(m[2])}`;
    }
  });
  return map;
}
const anchorMap = { en: anchors(en, 'en'), vi: anchors(vi, 'vi') };

/** Markdown from the README into MDX: escape what MDX would read as code, fix links. */
function toMdx(lines, lang, page) {
  let fence = false;
  return lines
    .map((line) => {
      if (line.startsWith('```')) {
        fence = !fence;
        return line;
      }
      if (fence) return line;
      // Links to README anchors and repository files.
      line = line.replace(/\]\(#([^)]+)\)/g, (m, a) => `](${anchorMap[lang][a] ?? `#${a}`})`);
      line = line.replace(/\]\((?!https?:|#|\/)([^)]+)\)/g, (m, p) => `](${REPO}${p})`);
      // Anchors on the props table rows: `| \`name...\` |` → id prop-name.
      if (page.slug === 'reference/props') {
        line = line.replace(
          /^\| `([a-zA-Z]+)/,
          (m, name) => `| <span id="prop-${name.toLowerCase()}"></span>\`${name}`,
        );
      }
      // Outside inline code, braces and < are MDX syntax.
      return line
        .split(/(`[^`]*`)/)
        .map((part, i) =>
          i % 2 ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/<(?!span id=|\/span>)/g, '&lt;'),
        )
        .join('');
    })
    .join('\n')
    .trim();
}

const fill = (text, lang) => text.replaceAll('BASE', BASE);

for (const page of PAGES) {
  for (const [lang, list, i18n] of [
    ['en', en, 0],
    ['vi', vi, 1],
  ]) {
    const body = page.sections.map((h) => {
      const idx = en.findIndex((s) => s.heading === h);
      if (idx < 0) throw new Error(`README section "${h}" not found`);
      const lines = list[idx].lines.slice();
      if (lines[0].slice(3).trim() === page.title[i18n]) lines.shift();
      return toMdx(lines, lang, page);
    });
    const imports = [];
    const top = [];
    if (page.demo || page.source)
      imports.push(
        "import Demo from '~/components/Demo.astro';",
        "import Source from '~/components/Source.astro';",
      );
    if (page.intro) top.push(fill(page.intro[i18n], lang));
    if (page.demo)
      top.push(
        `<Demo route="${page.demo}">\n\n${page.demoNote ? fill(page.demoNote[i18n], lang) : ''}\n\n</Demo>`,
      );
    const bottom = page.source
      ? [
          `## ${lang === 'vi' ? 'Mã nguồn của demo' : 'Source of the demo'}`,
          `<Source files={${JSON.stringify(page.source)}} />`,
        ]
      : [];
    const out = [
      '---',
      `title: ${JSON.stringify(page.title[i18n])}`,
      `description: ${JSON.stringify(page.description[i18n])}`,
      `editUrl: ${REPO.replace('/blob/', '/edit/')}${lang === 'vi' ? 'README.vi.md' : 'README.md'}`,
      '---',
      '',
      `{/* Generated from ${lang === 'vi' ? 'README.vi.md' : 'README.md'} by website/scripts/sections.mjs: edit the README, then run npm run sections. */}`,
      '',
      ...imports,
      imports.length ? '' : null,
      ...top.flatMap((t) => [t, '']),
      ...body.flatMap((b) => [b, '']),
      ...bottom.flatMap((b) => [b, '']),
    ]
      .filter((l) => l !== null)
      .join('\n');
    const file = path.join(docs, lang === 'vi' ? 'vi' : '', `${page.slug}.mdx`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out.trimEnd() + '\n');
  }
}
console.log(`sections: ${PAGES.length} pages × 2 languages`);
