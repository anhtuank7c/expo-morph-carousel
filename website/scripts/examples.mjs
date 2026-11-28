// Builds the example pages and the gallery (English and Vietnamese) from one
// list: what the demo is, how it works, what it uses and which files to show.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '..', 'src', 'content', 'docs');
const BASE = '/expo-morph-carousel';

// `name:page#anchor` links a chip elsewhere than the props table.
const REF = 'ref API:guides/navigation/#controlling-the-carousel';
const SLOT = (s) => `${s} slot:guides/slots/#slots`;

export const EXAMPLES = [
  {
    slug: 'stories',
    route: 'stories',
    gif: 'ios/stories.gif',
    group: 'real',
    title: ['Stories', 'Stories'],
    summary: [
      'Stories like the social apps: people turn like a cube, their photos melt into each other.',
      'Stories như các mạng xã hội: người dùng xoay như khối lập phương, ảnh của mỗi người tan vào nhau.',
    ],
    steps: [
      [
        'Tap an avatar in the tray: a full-screen viewer opens on that person.',
        'The people are the pages of an outer carousel with `pageEffect="cube"` and no media: swipe to the next person.',
        'Each person\'s photos are an inner carousel with `mediaPosition="background"`, `mediaFit="cover"` and `liquid.preserveShape`: the rectangle stays sharp while the content melts.',
        'The inner carousel has `gestureEnabled={false}`. A Pressable on top sends taps on the left third to `ref.prev()` and the rest to `ref.next()`; a long press pauses.',
        'A Reanimated timing fills the progress bar of the current photo and calls `next()` at the end; the last photo hands over to the next person.',
        'The tray prefetches every photo at the size the viewer will ask for (`usePrefetchImages` with `imageTargetFor`), so a story opens without waiting.',
      ],
      [
        'Chạm một avatar trong khay: trình xem toàn màn hình mở ra ở người đó.',
        'Mỗi người là một trang của carousel ngoài với `pageEffect="cube"` và không có media: vuốt để sang người kế tiếp.',
        'Ảnh của mỗi người là một carousel trong với `mediaPosition="background"`, `mediaFit="cover"` và `liquid.preserveShape`: khung ảnh giữ nguyên, chỉ nội dung tan.',
        'Carousel trong có `gestureEnabled={false}`. Một Pressable phủ lên chuyển chạm ở một phần ba bên trái thành `ref.prev()`, phần còn lại thành `ref.next()`; nhấn giữ để tạm dừng.',
        'Một timing của Reanimated làm đầy thanh tiến trình của ảnh hiện tại và gọi `next()` khi hết; ảnh cuối chuyển sang người kế tiếp.',
        'Khay tải trước mọi ảnh đúng kích thước trình xem sẽ xin (`usePrefetchImages` với `imageTargetFor`), nên story mở ra không phải chờ.',
      ],
    ],
    uses: [
      'pageEffect',
      'mediaPosition',
      'mediaFit',
      'liquid',
      'gestureEnabled',
      'animation',
      'onIndexChange',
      REF,
      'usePrefetchImages:guides/images/#load-order-and-prefetching',
    ],
    files: ['app/stories.tsx', 'data/demos.ts'],
  },
  {
    slug: 'feed',
    route: 'feed',
    gif: 'ios/feed.gif',
    group: 'real',
    title: ['Vertical feed', 'Feed dọc'],
    summary: [
      'A full-screen feed like the short-video apps, swiped up and down.',
      'Feed toàn màn hình như các ứng dụng video ngắn, vuốt lên xuống.',
    ],
    steps: [
      [
        '`direction="vertical"` pages up and down; each post is a full-screen page over its photo (`mediaPosition="background"`).',
        'The photo URL is built for the area the carousel measures (`getImage(item, index, target)`), so it is never larger than needed.',
        'Double tap anywhere to like: two taps within 280 ms play a heart burst.',
        'While a post is in view (`index === current` from `onIndexChange`) the record turns and the progress bar fills.',
        'The chip at the top switches `effect` between `liquid`, `slide` and `parallax` on the same carousel.',
      ],
      [
        '`direction="vertical"` chuyển trang lên xuống; mỗi bài là một trang toàn màn hình nằm trên ảnh của nó (`mediaPosition="background"`).',
        'URL ảnh được dựng theo vùng carousel đo được (`getImage(item, index, target)`), nên không bao giờ lớn hơn cần thiết.',
        'Chạm hai lần ở bất kỳ đâu để thả tim: hai lần chạm cách nhau dưới 280 ms bật hiệu ứng trái tim.',
        'Khi bài đang hiện (`index === current` từ `onIndexChange`), đĩa nhạc quay và thanh tiến trình chạy.',
        'Chip ở trên cùng đổi `effect` giữa `liquid`, `slide` và `parallax` ngay trên carousel đó.',
      ],
    ],
    uses: [
      'direction',
      'mediaPosition',
      'mediaFit',
      'effect',
      'liquid',
      'getImage',
      'renderItem',
      'onIndexChange',
    ],
    files: ['app/feed.tsx', 'data/demos.ts'],
  },
  {
    slug: 'flash-sale',
    route: 'flash-sale',
    gif: 'ios/flash-sale.gif',
    group: 'real',
    title: ['Flash sale', 'Flash sale'],
    summary: [
      "A shopping app's sale page: a looping banner, a countdown, deal cards and a deal of the day.",
      'Trang khuyến mãi của ứng dụng mua sắm: banner vòng lặp, đếm ngược, thẻ deal và deal trong ngày.',
    ],
    steps: [
      [
        'The banner loops and autoplays (`loop`, `autoplay={{ interval: 3500 }}`); photos melt with `liquid.preserveShape`. `footerStyle` lays the dots over the photo.',
        'The deal row is a card carousel without media: `pageSize` 44% of the width, `pageAlign="start"` and `pageGap` show the next cards, `snapMode="momentum"` glides over several with a fling.',
        'Each card is plain React Native: image, discount badge, price and a "sold" bar.',
        'The deal of the day puts the product photo in the media area (`mediaHeight`, `mediaFit="cover"`), the name and price slide underneath and `renderFooter` holds the Buy button in the item\'s color.',
      ],
      [
        'Banner chạy vòng lặp và tự chuyển (`loop`, `autoplay={{ interval: 3500 }}`); ảnh tan vào nhau với `liquid.preserveShape`. `footerStyle` đặt các chấm đè lên ảnh.',
        'Hàng deal là carousel thẻ không có media: `pageSize` 44% bề rộng, `pageAlign="start"` và `pageGap` để lộ các thẻ kế tiếp, `snapMode="momentum"` lướt qua nhiều thẻ khi vuốt mạnh.',
        'Mỗi thẻ là React Native thuần: ảnh, nhãn giảm giá, giá và thanh "đã bán".',
        'Deal trong ngày đặt ảnh sản phẩm vào vùng media (`mediaHeight`, `mediaFit="cover"`), tên và giá trượt bên dưới, `renderFooter` chứa nút Mua theo màu của sản phẩm.',
      ],
    ],
    uses: [
      'loop',
      'autoplay',
      'tapToNavigate',
      'pagination',
      'footerStyle',
      'pageSize',
      'pageGap',
      'pageAlign',
      'snapMode',
      'windowSize',
      'mediaHeight',
      'renderFooter',
    ],
    files: ['app/flash-sale.tsx', 'data/demos.ts'],
  },
  {
    slug: 'shop',
    route: 'shop',
    gif: 'ios/shop.gif',
    group: 'real',
    title: ['Shop product page', 'Trang sản phẩm'],
    summary: [
      'A product page: a gallery of the colors with a thumbnail strip, swatches, sizes and a cart bar.',
      'Trang chi tiết sản phẩm: thư viện ảnh theo màu với dải thumbnail, ô màu, size và thanh giỏ hàng.',
    ],
    steps: [
      [
        'The gallery is a square media area (`mediaHeight={width}`, `mediaFit="cover"`, `mediaPadding={0}`); the colors are its pages.',
        "The `Pagination` slot is a strip of thumbnails. Each frame reads the carousel's `position` on the UI thread, so it follows the finger, and a tap calls `scrollTo(i)`.",
        'The color swatches below call `ref.scrollTo(i)`; `onIndexChange` keeps the title, the stock line and the cart button color in sync.',
        "Tap the photo itself to go to the next color (`tapToNavigate={{ area: 'media' }}`), which leaves the buttons on the page alone.",
      ],
      [
        'Thư viện ảnh là một vùng media vuông (`mediaHeight={width}`, `mediaFit="cover"`, `mediaPadding={0}`); các màu là các trang của nó.',
        'Slot `Pagination` là dải thumbnail. Khung chọn đọc `position` của carousel trên UI thread nên chạy theo ngón tay, chạm vào thì gọi `scrollTo(i)`.',
        'Các ô màu bên dưới gọi `ref.scrollTo(i)`; `onIndexChange` giữ tiêu đề, dòng tồn kho và màu nút giỏ hàng khớp nhau.',
        "Chạm vào ảnh để sang màu kế tiếp (`tapToNavigate={{ area: 'media' }}`), không ảnh hưởng tới các nút trên trang.",
      ],
    ],
    uses: [
      SLOT('Pagination'),
      'components',
      'mediaHeight',
      'mediaFit',
      'mediaPadding',
      'liquid',
      'tapToNavigate',
      'onIndexChange',
      REF,
    ],
    files: ['app/shop.tsx', 'data/demos.ts'],
  },
  {
    slug: 'memories',
    route: 'memories',
    gif: 'ios/memories.gif',
    group: 'real',
    title: ['Memories', 'Kỷ niệm'],
    summary: [
      'A trip slideshow like the photo apps make: slow zoom, liquid transitions, tap to skip.',
      'Trình chiếu kỷ niệm như các ứng dụng ảnh: zoom chậm, chuyển cảnh liquid, chạm để bỏ qua.',
    ],
    steps: [
      [
        'Full-screen photos (`mediaPosition="background"`, `mediaFit="cover"`) with a slow, wide liquid melt (`liquid={{ preserveShape: true, blur: 40 }}`, `animation={{ type: \'timing\', duration: 900 }}`).',
        'The carousel sits in an Animated.View that zooms in on one photo and out on the next (Ken Burns), so a page change never jumps.',
        'A timing fills the progress bar and calls `ref.next()`; with `loop` the trip starts over.',
        '`tapToNavigate` goes back on the left side and forward elsewhere, like stories.',
      ],
      [
        'Ảnh toàn màn hình (`mediaPosition="background"`, `mediaFit="cover"`) tan chậm và rộng (`liquid={{ preserveShape: true, blur: 40 }}`, `animation={{ type: \'timing\', duration: 900 }}`).',
        'Carousel nằm trong một Animated.View phóng to ở ảnh này và thu nhỏ ở ảnh kế (Ken Burns), nên chuyển trang không bị giật.',
        'Một timing làm đầy thanh tiến trình rồi gọi `ref.next()`; nhờ `loop` chuyến đi lặp lại từ đầu.',
        '`tapToNavigate` lùi khi chạm bên trái và tiến khi chạm chỗ khác, như stories.',
      ],
    ],
    uses: ['mediaPosition', 'mediaFit', 'liquid', 'animation', 'loop', 'tapToNavigate', 'onIndexChange', REF],
    files: ['app/memories.tsx', 'data/demos.ts'],
  },
  {
    slug: 'albums',
    route: 'albums',
    gif: 'ios/albums.gif',
    group: 'real',
    title: ['Albums', 'Album nhạc'],
    summary: [
      'A music player: a coverflow of album covers over a blurred copy of the cover.',
      'Trình phát nhạc: coverflow bìa album trên nền là bản làm mờ của bìa.',
    ],
    steps: [
      [
        'The covers are pages without media; `pageEffect={pageEffects.coverflow({ angle: 52, scale: 0.8, spacing: 0.56 })}` with a `pageSize` of 64% shows the neighbors turned away.',
        '`positionValue` mirrors the position into a shared value: each blurred backdrop fades by its distance from it, on the UI thread.',
        'With `loop` the position keeps counting; the backdrop compares on the circle.',
        'The player buttons call `ref.prev()` and `ref.next()`; the end of a track skips to the next album.',
      ],
      [
        'Các bìa là trang không có media; `pageEffect={pageEffects.coverflow({ angle: 52, scale: 0.8, spacing: 0.56 })}` với `pageSize` 64% để lộ các bìa bên cạnh xoay nghiêng.',
        '`positionValue` phản chiếu vị trí ra một shared value: mỗi nền mờ mờ dần theo khoảng cách tới nó, trên UI thread.',
        'Có `loop` thì vị trí cứ tăng mãi; nền mờ so khoảng cách trên vòng tròn.',
        'Các nút trình phát gọi `ref.prev()` và `ref.next()`; hết bài thì sang album kế tiếp.',
      ],
    ],
    uses: [
      'pageEffect',
      'pageEffects.coverflow:guides/page-layouts/#page-layouts',
      'pageSize',
      'loop',
      'positionValue',
      'tapToNavigate',
      REF,
    ],
    files: ['app/albums.tsx', 'data/demos.ts'],
  },
  {
    slug: 'product',
    route: 'product',
    gif: 'ios/product.gif',
    group: 'show',
    title: ['Product showcase', 'Trưng bày sản phẩm'],
    summary: [
      'Product shots cut out to their outline, tall and wide in turn: the liquid pours one outline into the next.',
      'Ảnh sản phẩm cắt sát viền, xen kẽ dáng dọc và ngang: khối liquid rót từ dáng này sang dáng kia.',
    ],
    steps: [
      [
        'PNGs on a transparent background are what the liquid effect is made for: the blob takes the outline of one product and reforms as the next.',
        '`mediaHeight` and `mediaPadding` give the products room; `mediaFit` is `contain` by default.',
        "`getPlaceholderColor` shows a soft blob of the product's color while it loads.",
        '`renderFooter` gets the current item: the button takes its color.',
      ],
      [
        'Ảnh PNG nền trong suốt là thứ hiệu ứng liquid sinh ra để dùng: khối lỏng lấy viền của sản phẩm này rồi đông lại thành sản phẩm kế tiếp.',
        '`mediaHeight` và `mediaPadding` chừa chỗ cho sản phẩm; `mediaFit` mặc định là `contain`.',
        '`getPlaceholderColor` hiện một khối mờ màu của sản phẩm trong lúc ảnh tải.',
        '`renderFooter` nhận item hiện tại: nút lấy màu của nó.',
      ],
    ],
    uses: [
      'getImage',
      'getPlaceholderColor',
      'mediaHeight',
      'mediaPadding',
      'tapToNavigate',
      'renderItem',
      'renderFooter',
    ],
    files: ['app/product.tsx', 'data/products.ts'],
  },
  {
    slug: 'order',
    route: 'order',
    gif: 'ios/food-order.gif',
    group: 'show',
    title: ['Food order', 'Đặt món'],
    summary: [
      'A cola bottle, a burger, a sundae and fries: real photos on one baseline, menu tabs and a cart.',
      'Chai cola, burger, ly sundae và khoai tây chiên: ảnh thật trên cùng một đường đáy, thanh tab menu và giỏ hàng.',
    ],
    steps: [
      [
        'The photos share one square frame and stand on its bottom edge, so they keep their real proportions and the liquid stretches from tall to wide.',
        "The `Pagination` slot is the tab bar: a pill moves with `position` and takes each item's color with `interpolateColor`.",
        "The `MediaBackground` slot draws a glow in the item's tint and a floor shadow whose width follows the item.",
        '`renderFooter` adds the current item to a small cart kept in state.',
      ],
      [
        'Các ảnh dùng chung một khung vuông và đứng trên cạnh đáy, nên giữ đúng tỉ lệ thật và khối liquid kéo từ dáng cao sang dáng rộng.',
        'Slot `Pagination` là thanh tab: viên chỉ báo chạy theo `position` và đổi màu theo món bằng `interpolateColor`.',
        'Slot `MediaBackground` vẽ quầng sáng theo màu của món và bóng đổ dưới chân rộng hẹp theo món.',
        '`renderFooter` thêm món hiện tại vào giỏ hàng lưu trong state.',
      ],
    ],
    uses: [
      SLOT('Pagination'),
      SLOT('MediaBackground'),
      'components',
      'mediaFit',
      'mediaHeight',
      'mediaPadding',
      'tapToNavigate',
      'renderFooter',
    ],
    files: ['app/order.tsx'],
  },
  {
    slug: 'onboarding',
    route: 'onboarding',
    group: 'show',
    title: ['Onboarding', 'Onboarding'],
    summary: [
      'A full-screen introduction: media in the background, Skip and Next driven by the ref API.',
      'Màn giới thiệu toàn màn hình: media làm nền, Skip và Next điều khiển bằng ref API.',
    ],
    steps: [
      [
        '`mediaPosition="background"` puts the media behind the pages; `mediaStyle` keeps it in the upper half and `pageStyle` pushes the text down.',
        '`positionValue` drives the background tint with `interpolateColor` as the finger moves.',
        'Next calls `ref.next()`; on the last page it closes the screen.',
      ],
      [
        '`mediaPosition="background"` đặt media phía sau các trang; `mediaStyle` giữ nó ở nửa trên và `pageStyle` đẩy chữ xuống dưới.',
        '`positionValue` điều khiển màu nền bằng `interpolateColor` theo ngón tay.',
        'Next gọi `ref.next()`; ở trang cuối thì đóng màn hình.',
      ],
    ],
    uses: ['mediaPosition', 'mediaStyle', 'pageStyle', 'positionValue', 'pagination', 'renderFooter', REF],
    files: ['app/onboarding.tsx', 'data/products.ts'],
  },
  {
    slug: 'remote',
    route: 'remote',
    group: 'show',
    title: ['Remote images', 'Ảnh từ mạng'],
    summary: [
      'Photos from the network with the disk cache, prefetching and a live cache panel.',
      'Ảnh tải từ mạng với cache trên đĩa, tải trước và bảng thông tin cache trực tiếp.',
    ],
    steps: [
      [
        '`getImage(item, index, target)` builds an imgix URL for the size the carousel measured.',
        'The disk cache keeps the photos for as long as their `Cache-Control` says (`respectHttpHeaders`); the panel shows its live stats.',
        'The home screen prefetches these photos at the same size, so this screen opens with them ready.',
        'Toggles switch tap to navigate and `liquid.preserveShape` (keep the corners while morphing).',
      ],
      [
        '`getImage(item, index, target)` dựng URL imgix theo kích thước carousel đo được.',
        'Cache trên đĩa giữ ảnh lâu đúng như `Cache-Control` cho phép (`respectHttpHeaders`); bảng hiển thị số liệu cache trực tiếp.',
        'Màn Home tải trước các ảnh này đúng kích thước, nên màn này mở ra là có ảnh.',
        'Các công tắc bật tắt chạm để chuyển trang và `liquid.preserveShape` (giữ góc ảnh khi morph).',
      ],
    ],
    uses: [
      'getImage',
      'imageCache',
      'prefetch',
      'liquid',
      'tapToNavigate',
      'useImageCacheStats:guides/images/#inspecting-and-clearing',
    ],
    files: ['app/remote.tsx', 'data/products.ts'],
  },
];

const t = (pair, vi) => pair[vi ? 1 : 0];

for (const vi of [false, true]) {
  const prefix = `${BASE}${vi ? '/vi' : ''}`;
  for (const ex of EXAMPLES) {
    const body = [
      '---',
      `title: ${JSON.stringify(t(ex.title, vi))}`,
      `description: ${JSON.stringify(t(ex.summary, vi))}`,
      '---',
      '',
      `{/* Generated by website/scripts/examples.mjs. */}`,
      '',
      "import Demo from '~/components/Demo.astro';",
      "import Source from '~/components/Source.astro';",
      "import Uses from '~/components/Uses.astro';",
      '',
      t(ex.summary, vi),
      '',
      `<Demo route="${ex.route}">`,
      '',
      `### ${vi ? 'Hoạt động thế nào' : 'How it works'}`,
      '',
      ...ex.steps[vi ? 1 : 0].map((s, i) => `${i + 1}. ${s}`),
      '',
      `<Uses items={${JSON.stringify(ex.uses)}} />`,
      '',
      '</Demo>',
      '',
      `## ${vi ? 'Mã nguồn đầy đủ' : 'Full source'}`,
      '',
      vi
        ? 'Đây chính là mã đang chạy trong khung điện thoại. Chép về, đổi dữ liệu là dùng được.'
        : 'This is the code running in the phone. Copy it, swap the data, and it is yours.',
      '',
      `<Source files={${JSON.stringify(ex.files)}} />`,
      '',
    ].join('\n');
    const file = path.join(docs, vi ? 'vi' : '', 'examples', `${ex.slug}.mdx`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }

  // The gallery.
  const card = (ex) =>
    `  <a href="${prefix}/examples/${ex.slug}/">${ex.gif ? `<img src="${BASE}/media/${ex.gif}" alt="" loading="lazy" />` : ''}<div class="text"><strong>${t(ex.title, vi)}</strong><span>${t(ex.summary, vi)}</span></div></a>`;
  const group = (g) =>
    EXAMPLES.filter((e) => e.group === g)
      .map(card)
      .join('\n');
  const gallery = [
    '---',
    `title: ${JSON.stringify(vi ? 'Ví dụ' : 'Examples')}`,
    `description: ${JSON.stringify(vi ? 'Mỗi ví dụ chạy trực tiếp, kèm cách hoạt động và toàn bộ mã nguồn.' : 'Every example runs live, with how it works and its full source.')}`,
    '---',
    '',
    `{/* Generated by website/scripts/examples.mjs. */}`,
    '',
    vi
      ? 'Mỗi ví dụ là một màn của app ví dụ: mở ra để chạy thử trong khung điện thoại, đọc cách nó hoạt động, rồi chép mã nguồn đầy đủ.'
      : 'Each example is a screen of the example app: open one to run it in a phone frame, read how it works, then copy the full source.',
    '',
    `## ${vi ? 'Ứng dụng thực tế' : 'Real-world apps'}`,
    '',
    '<div class="gallery not-content">',
    group('real'),
    '</div>',
    '',
    `## ${vi ? 'Trưng bày' : 'Showcases'}`,
    '',
    '<div class="gallery not-content">',
    group('show'),
    '</div>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(docs, vi ? 'vi' : '', 'examples', 'index.mdx'), gallery);
}
console.log(`examples: ${EXAMPLES.length} pages × 2 languages and the gallery`);
