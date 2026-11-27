# expo-morph-carousel

[English](https://github.com/anhtuank7c/expo-morph-carousel/blob/main/README.md) | **Tiếng Việt**

Carousel cho Expo, trong đó các ảnh tan vào nhau như chất lỏng trong lúc các trang trượt. Dựng bằng React Native Skia và Reanimated 4, kèm các preset chuyển cảnh đơn giản hơn, loop, autoplay, trượt dọc, hỗ trợ trình đọc màn hình và web.

<p align="center">
  <img src="https://raw.githubusercontent.com/anhtuank7c/expo-morph-carousel/main/docs/demo/product.gif" width="320" alt="Một thẻ sản phẩm: quả cầu tím tan thành ô bo góc màu cam, rồi thành vòng tròn xanh, viên nang xanh dương và trái tim đỏ, trong khi tiêu đề và mô tả trượt bên dưới">
</p>

## Tính năng

- **Liquid morph.** Giữa hai trang, ảnh hiện tại tan thành một khối lỏng rồi đông lại thành ảnh kế tiếp. Hiệu ứng được vẽ bằng Skia trên UI thread và tắt hẳn khi trang đứng yên, nên ảnh lúc nghỉ không bao giờ bị mờ.
- **Preset và hiệu ứng tự viết.** `crossfade`, `slide`, `parallax`, `stack`, hoặc một worklet của bạn nhận khoảng cách trang và trả về opacity, transform.
- **Hành vi pager quen thuộc.** Snap theo trang, mỗi lần vuốt một trang, vuốt nhanh (fling), co giãn ở hai đầu, `loop` theo cả hai chiều, trượt ngang hoặc `vertical`, hỗ trợ bố cục phải sang trái.
- **Autoplay** tạm dừng khi người dùng chạm vào carousel và khi trình đọc màn hình đang bật.
- **Điều khiển từ code.** `ref.scrollTo(index)`, `next()`, `prev()`, `onIndexChange`, một shared value phản chiếu vị trí để dùng cho animation khác, và render prop cho footer kèm item hiện tại.
- **Bố cục trang** cho cả tấm thẻ: `parallax`, `stack`, `coverflow`, `cube`, `flip`, `fade`, `scale-fade`, `rotate`, `tinder`, hoặc worklet tự viết; trang hẹp hơn carousel để lộ trang kế bên; snap `page`, `momentum` hoặc `free`; spring hoặc timing.
- **Slots** giống expo-morph-menu: thay pagination, từng chấm, hoặc vẽ phía trên và phía sau media bằng component của bạn.
- **Chấm phân trang biến hình** chạy theo ngón tay và bấm được.
- **Ảnh.** `require()` cục bộ hoặc `{ uri }` từ mạng, `contain` hoặc `cover`, màu placeholder cho từng item, ảnh lân cận được tải sẵn nên vuốt hiếm khi phải chờ.
- **Ảnh responsive.** Khai báo danh sách kích thước (`srcset`) hoặc dựng URL CDN theo kích thước đo được; carousel chọn ảnh phù hợp với vùng hiển thị và mật độ điểm ảnh, và sau khi xoay màn hình thì crossfade sang ảnh nét hơn mà không chớp.
- **Cache ảnh có thời hạn.** Ảnh từ mạng được lưu trên đĩa (Cache Storage trên web) với thời hạn lấy từ `maxAge` hoặc header `Cache-Control` của server. Mặc định là `stale-while-revalidate`: ảnh đã cache hiện ngay, ảnh hết hạn được kiểm tra lại bằng `ETag` (một phản hồi 304 không tốn byte ảnh nào) và được thay khi server có bản mới.
- **Accessibility.** Carousel là một phần tử adjustable: với VoiceOver hoặc TalkBack, vuốt lên hoặc xuống để đổi trang, item hiện tại được đọc lên. Trên web dùng phím mũi tên, Home và End. Khi bật Reduce Motion, hiệu ứng chuyển về cross-fade.
- **iOS, Android và web.** Chạy được trong Expo Go.

## Cài đặt

```bash
npx expo install expo-morph-carousel @shopify/react-native-skia expo-file-system \
  react-native-reanimated react-native-worklets react-native-gesture-handler
```

Hai gói trong số này là tuỳ chọn:

| Gói | Cần cho | Nếu không cài |
| --- | --- | --- |
| `@shopify/react-native-skia` | Hiệu ứng `liquid` (mặc định) | Carousel dùng `crossfade` |
| `expo-file-system` | Cache ảnh từ mạng trên đĩa ở iOS và Android | Ảnh từ mạng được tải lại mỗi lần (HTTP cache của nền tảng vẫn có tác dụng) |

`babel.config.js` phải dùng `babel-preset-expo`, preset này bật Babel plugin cho worklets. Bọc app trong `GestureHandlerRootView`.

### Web

Trên web, Skia chạy trên CanvasKit, một file WebAssembly mà app của bạn phải phục vụ. Chép nó vào `public/` một lần:

```bash
npx setup-skia-web public
```

Carousel tải CanvasKit ở nền và hiển thị cross-fade cho tới khi tải xong. Muốn tải file từ chỗ khác thì gọi `configureSkiaWeb({ locateFile: (file) => 'https://…/' + file })` trước khi carousel đầu tiên được render.

## Tương thích

| | Hỗ trợ |
| --- | --- |
| Expo SDK | 58 trở lên |
| React Native | 0.80 trở lên (New Architecture) |
| Reanimated | 4 trở lên, kèm `react-native-worklets` |
| React Native Skia | 2 trở lên (tùy chọn) |
| Nền tảng | iOS, Android, web |
| Expo Go | Có. Package không có native code riêng |

## Sử dụng

```tsx
import { MorphCarousel } from 'expo-morph-carousel';

const products = [
  { id: 'watch', title: 'Watch', description: '…', image: require('./assets/watch.png') },
  { id: 'phone', title: 'Phone', description: '…', image: require('./assets/phone.png') },
  { id: 'laptop', title: 'Laptop', description: '…', image: { uri: 'https://…/laptop.png' } },
];

export function Showcase() {
  return (
    <MorphCarousel
      data={products}
      keyExtractor={(p) => p.id}
      getImage={(p) => p.image}
      getAccessibilityLabel={(p) => p.title}
      style={{ height: 520, borderRadius: 28, backgroundColor: '#fff' }}
      renderItem={({ item }) => (
        <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '700' }}>{item.title}</Text>
          <Text style={{ textAlign: 'center' }}>{item.description}</Text>
        </View>
      )}
      renderFooter={({ item, next }) => <Button title="Continue" onPress={next} />}
    />
  );
}
```

Carousel cần có kích thước: đặt `height` hoặc `flex: 1` trong `style`. Vùng media chiếm `mediaHeight` ở trên (hoặc cả carousel với `mediaPosition="background"`), các trang chiếm phần còn lại, chấm phân trang và footer nằm bên dưới.

Hiệu ứng liquid đẹp nhất với ảnh nền trong suốt như ảnh sản phẩm, icon hay hình minh họa, nơi đường viền của vật thể thay đổi giữa các trang. Với ảnh chụp (`mediaFit="cover"`), nó làm các hình chữ nhật tan vào nhau.

## Props

| Prop | Mặc định | Mô tả |
| --- | --- | --- |
| `data` | bắt buộc | Danh sách item |
| `getImage(item, index, target)` | | Ảnh cho vùng media (không có thì không có vùng media): `require(...)`, `{ uri }`, danh sách biến thể `{ uri, width, height }`, hoặc URL dựng từ `target` (xem [Ảnh responsive](#ảnh-responsive-srcset)) |
| `renderItem({ item, index, offset })` | | Nội dung trang hoặc cả một thẻ. `offset` là khoảng cách của trang tới vị trí hiện tại (shared value) |
| `pageEffect` | `'slide'` | Cách cả trang chuyển động: `'slide'`, `'parallax'`, `'stack'`, `'coverflow'`, `'cube'`, `'flip'`, `'fade'`, `'scale-fade'`, `'rotate'`, `'tinder'`, `pageEffects.<tên>(tuỳ chọn)` hoặc một worklet (xem [Bố cục trang](#bố-cục-trang)) |
| `pageSize` | vùng trang | Kích thước một trang theo trục cuộn; nhỏ hơn thì lộ các trang kế bên |
| `pageGap` | `0` | Khoảng cách giữa các trang |
| `pageAlign` | `'center'` | `'center'` hoặc `'start'` |
| `snapMode` | `'page'` | `'page'`, `'momentum'` hoặc `'free'` |
| `tapToNavigate` | `false` | `true` hoặc `{ mode, backZone, area }` (`mode` là `'sides'` hoặc `'forward'`, `backZone` 0.3, `area` là `'all'` hoặc `'media'`): chạm để chuyển trang (xem [Chạm để chuyển trang](#chạm-để-chuyển-trang)) |
| `animation` | spring | `{ type: 'spring', damping, stiffness, mass }` hoặc `{ type: 'timing', duration }` |
| `components` | | Slot: `Pagination`, `Dot`, `MediaOverlay`, `MediaBackground` (xem [Slots](#slots)) |
| `configureGesture(pan)` | | Chỉnh pan gesture (ngưỡng, gesture chạy song song) rồi trả về. Nên memo |
| `keyExtractor(item, index)` | index | Key ổn định cho từng item |
| `effect` | `'liquid'` | `'liquid'`, `'crossfade'`, `'slide'`, `'parallax'`, `'stack'` hoặc một worklet (xem bên dưới) |
| `liquid` | | `{ blur = 28, threshold = 0.5, sharpness = 24, preserveShape = false }`. `blur` lớn hơn cho khối tròn hơn; `threshold` thấp hơn giữ lại nhiều quầng mờ hơn. `preserveShape` giữ khung chữ nhật của ảnh sắc nét (không bo góc), chỉ phần nội dung tan vào nhau, dành cho ảnh chụp |
| `mediaPosition` | `'top'` | `'top'` hoặc `'background'` |
| `mediaHeight` | `280` | Chiều cao vùng media khi nằm trên |
| `mediaFit` | `'contain'` | `'contain'` hoặc `'cover'` |
| `mediaPadding` | `16` | Khoảng cách quanh ảnh trong vùng media |
| `getPlaceholderColor(item, index)` | | Màu của khối mờ hiển thị khi ảnh đang tải |
| `imageCache` | bật | Tuỳ chọn cho ảnh từ mạng (xem [Ảnh từ mạng và cache](#ảnh-từ-mạng-và-cache)), hoặc `false` |
| `direction` | `'horizontal'` | `'horizontal'` hoặc `'vertical'` |
| `loop` | `false` | Vuốt qua trang cuối về trang đầu, và ngược lại |
| `initialIndex` | `0` | Trang hiển thị đầu tiên |
| `autoplay` | `false` | `true` hoặc `{ interval = 4000, reverse = false, whenScreenReaderEnabled = false }` |
| `windowSize` | `2` | Số trang được render và số ảnh được giữ tải ở mỗi bên trang hiện tại |
| `prefetch` | `1` | Số trang ngoài cửa sổ mỗi bên được tải ảnh trước, ở mức ưu tiên thấp |
| `gestureEnabled` | `true` | Cho phép vuốt. Điều hướng qua `ref` vẫn hoạt động khi tắt |
| `pagination` | `true` | `false`, hoặc tuỳ chọn: `activeColor`, `inactiveColor`, `size`, `activeWidth`, `gap`, `pressable`, `style` |
| `renderFooter(api)` | | Nội dung dưới chấm phân trang. Nhận `item`, `index`, `count`, `position`, `scrollTo`, `next`, `prev` |
| `onIndexChange(index)` | | Gọi khi trang gần nhất thay đổi, kể cả trong lúc kéo |
| `onScrollStart()` | | Một cú vuốt, lệnh điều hướng hoặc bước autoplay bắt đầu |
| `onScrollEnd(index)` | | Carousel dừng lại ở trang `index` |
| `positionValue` | | `SharedValue<number>` phản chiếu vị trí tính theo trang |
| `accessibilityLabel` | `'Carousel'` | Nhãn của carousel cho trình đọc màn hình |
| `getAccessibilityLabel(item, index)` | key | Văn bản đọc cho item hiện tại |
| `ref` | | `{ scrollTo(index, { animated }), next({ count, animated }), prev({ count, animated }), getIndex() }` |
| `style`, `mediaStyle`, `pageStyle`, `footerStyle`, `testID` | | |

## Bố cục trang

Không có `getImage` thì carousel là carousel thẻ thuần: `renderItem` là cả tấm thẻ và `pageEffect` quyết định thẻ chuyển động thế nào. Có `getImage` thì page effect áp cho phần nội dung bên dưới vùng media.

Hai loại hiệu ứng độc lập và kết hợp được với nhau: `effect` (mặc định `liquid`) morph ảnh trong vùng media, còn `pageEffect` di chuyển các trang. Liquid vẫn là mặc định; page effect được thêm vào bên cạnh chứ không thay thế nó. Màn Layouts trong app ví dụ cho thấy ảnh liquid phía trên và các thẻ chuyển động theo từng page effect bên dưới.

```tsx
import { MorphCarousel, pageEffects } from 'expo-morph-carousel';

<MorphCarousel
  data={cards}
  renderItem={({ item }) => <Card item={item} />}
  pageEffect="coverflow" // hoặc pageEffects.coverflow({ angle: 60, spacing: 0.5 })
  pageSize={280} // hẹp hơn carousel: lộ các trang kế bên hai bên
  pageGap={12}
  style={{ height: 380 }}
/>
```

| Hiệu ứng | Trông thế nào | Tuỳ chọn |
| --- | --- | --- |
| `slide` | Các trang nằm cạnh nhau | |
| `parallax` | Trang hiện tại đủ cỡ, trang kế bên nhỏ hơn và gần hơn. Dùng với `pageSize` | `scale` 0.84, `offset` 0, `opacity` 1 |
| `stack` | Một chồng bài: thẻ sau nằm chờ phía sau, thẻ hiện tại trượt ra | `visible` 3, `spacing` 16, `scaleStep` 0.06, `opacityStep` 0.18, `rotation` 0, `stackAxis` `'across'` |
| `coverflow` | Trang kế bên xoay 3D và chồng lên nhau | `angle` 48, `scale` 0.82, `spacing` 0.62 |
| `cube` | Các mặt của khối lập phương xoay quanh cạnh | |
| `flip` | Thẻ lật tại chỗ; trang sau là mặt lưng | |
| `fade` | Crossfade tại chỗ | |
| `scale-fade` | Trang cũ co lại và mờ dần, trang mới từ lớn hơn một chút thu về | `scale` 0.86 |
| `rotate` | Các trang đung đưa theo cung tròn | `angle` 14, `drop` 24 |
| `tinder` | Một chồng thẻ; thẻ trên cùng bị ném ra kèm nghiêng | `visible` 2, `angle` 18 |

Mọi hiệu ứng chạy được cả ngang lẫn dọc và tự lật chiều trong bố cục phải sang trái. Khi bật Reduce Motion, các hiệu ứng theo tên chuyển về `slide`.

Bố cục phải sang trái theo `I18nManager.isRTL`: chiều tiến là sang trái, vuốt sang phải để tiến, chấm phân trang và vùng chạm được lật lại. Trong app Expo, bố cục RTL chỉ được bật khi có `"extra": { "supportsRTL": true }` trong `app.json`.

Hiệu ứng tự viết là một worklet nhận `offset` của trang (0 đang hiện, 1 trang sau, -1 trang trước, số lẻ khi đang chuyển), `step` (khoảng cách giữa hai trang), kích thước trang và viewport, `direction`, `rtl`, rồi trả về `opacity`, `zIndex`, `transform` và `transformOrigin`. Phải tự tính cả phần dịch chuyển:

```tsx
const door: PageEffectFn = ({ offset, step }) => {
  'worklet';
  const o = Math.max(-1, Math.min(1, offset));
  return {
    zIndex: Math.round(100 - Math.abs(offset) * 10),
    transformOrigin: o > 0 ? 'left center' : 'right center',
    transform: [{ perspective: 800 }, { translateX: offset * step }, { rotateY: `${o * -60}deg` }],
  };
};
```

`renderItem` cũng nhận `offset` dạng shared value, để animate nội dung bên trong thẻ tách biệt với thẻ:

```tsx
renderItem={({ item, offset }) => <Card item={item} offset={offset} />}

// trong Card
const title = useAnimatedStyle(() => ({
  transform: [{ translateX: interpolate(offset.value, [-1, 0, 1], [-60, 0, 60]) }],
}));
```

## Snap và animation

| `snapMode` | Hành vi |
| --- | --- |
| `page` (mặc định) | Mỗi lần vuốt một trang; vuốt nhanh sang trang kế |
| `momentum` | Vuốt mạnh lướt qua nhiều trang rồi snap vào trang gần nhất |
| `free` | Lướt và dừng ở bất kỳ đâu, như scroll view |

`animation` quyết định cách carousel dừng lại, sau cú vuốt và cho `scrollTo`, `next`, chấm phân trang, autoplay: spring giữ vận tốc ngón tay (mặc định `{ damping: 26, stiffness: 220 }`) hoặc `{ type: 'timing', duration }`.

`onScrollStart` được gọi khi một cú vuốt, lệnh điều hướng hoặc bước autoplay bắt đầu, `onScrollEnd(index)` khi carousel dừng hẳn. `configureGesture` nhận pan gesture để chỉnh, ví dụ cho chạy song song với gesture của view cha:

```tsx
const configureGesture = useCallback((pan) => pan.simultaneousWithExternalGesture(parentPan), [parentPan]);
```

## Chạm để chuyển trang

Có người dùng thích chạm hơn là vuốt. Với `tapToNavigate`, một lần chạm sẽ chuyển trang:

```tsx
<MorphCarousel tapToNavigate … /> // 30% bên trái để lùi, phần còn lại để tiến
<MorphCarousel tapToNavigate={{ mode: 'forward' }} … /> // chạm đâu cũng tiến
<MorphCarousel tapToNavigate={{ area: 'media' }} … /> // chỉ nhận chạm trên vùng ảnh
```

| Tuỳ chọn | Mặc định | |
| --- | --- | --- |
| `mode` | `'sides'` | `sides`: phần đầu `backZone` để lùi, còn lại để tiến, như stories. `forward`: chạm đâu cũng tiến |
| `backZone` | `0.3` | Tỉ lệ vùng để lùi |
| `area` | `'all'` | `media`: chỉ tính chạm trên vùng ảnh |

Phần đầu là bên trái, là phía trên khi trượt dọc, là bên phải trong bố cục phải sang trái. Khi `pageSize` nhỏ hơn carousel, chạm vào trang kế bên đang ló ra sẽ chuyển sang trang đó. Vuốt vẫn hoạt động bình thường: chạm chỉ được tính khi ngón tay không di chuyển, và chạm vào carousel đang đứng yên không gọi `onScrollEnd`.

Tính năng tắt mặc định vì chạm vào nút bên trong trang cũng sẽ chuyển trang; nếu trang có nút, dùng `area: 'media'`.

## Slots

Giống expo-morph-menu, các phần hiển thị có thể thay bằng component của bạn qua `components`. Mỗi slot nhận `position` của carousel dạng shared value, nên animate theo ngón tay ngay trên UI thread.

| Slot | Props | Mặc định |
| --- | --- | --- |
| `Pagination` | `count`, `index`, `position`, `loop`, `direction`, `scrollTo(i)` | Chấm biến hình. `null` để ẩn |
| `Dot` | `index`, `count`, `active` (shared value 0–1), `direction`, `onPress` | Chấm dạng viên thuốc. Dùng trong pagination có sẵn |
| `MediaOverlay` | `item`, `index`, `count`, `position`, `width`, `height` | Không có. Vẽ phía trên media, không nhận chạm |
| `MediaBackground` | như trên | Không có. Vẽ phía sau media |

```tsx
function StoryPagination({ count, position, scrollTo }: PaginationSlotProps) {
  // mỗi trang một thanh, tự lấp đầy khi vuốt (xem example/app/slots.tsx)
}

function NumberDot({ index, active, onPress }: DotSlotProps) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.8 + active.value * 0.35 }] }));
  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.dot, style]}>
        <Text>{index + 1}</Text>
      </Animated.View>
    </Pressable>
  );
}

<MorphCarousel components={{ Pagination: StoryPagination, MediaOverlay: Caption, MediaBackground: Tint }} … />
```

`renderItem` và `renderFooter` cũng là slot: nội dung trang và phần nằm dưới chấm phân trang.

## Ảnh responsive (srcset)

Carousel đo vùng media, nhân với mật độ điểm ảnh của thiết bị và chọn ảnh vừa đủ nét mà không tải thừa. Có hai cách khai báo các kích thước.

**Danh sách biến thể**, dạng `srcset` của React Native (`width` là `w`-descriptor):

```tsx
getImage={(p) => [
  { uri: `${p.base}-640.jpg`, width: 640, height: 480 },
  { uri: `${p.base}-1280.jpg`, width: 1280, height: 960 },
  { uri: `${p.base}-2560.jpg`, width: 2560, height: 1920 },
]}
```

Biến thể nhỏ nhất mà vẫn đủ rộng sẽ được chọn; nếu có `height`, `cover` và `contain` tính cả tỉ lệ khung hình. Biến thể đã có trong cache được ưu tiên nếu không lớn quá 2 lần mức cần.

**URL dựng theo kích thước**, cho các CDN ảnh (imgix, Cloudinary, Unsplash, resizer kiểu Next.js). Tham số thứ ba là kích thước cần, tính bằng pixel vật lý, làm tròn lên một trong vài bậc (`WIDTH_STEPS`: 320, 480, 640, 750, 828, 1080, 1200, 1440, 1920, 2560, …) để CDN và cache chỉ thấy vài URL cho mỗi ảnh, thay vì mỗi thiết bị một URL:

```tsx
getImage={(p, i, target) => ({
  uri: `https://images.unsplash.com/photo-${p.id}?w=${target.width}&h=${target.height}&fit=crop`,
})}
```

`target` gồm `width`, `height`, `pixelRatio`, `layoutWidth`, `layoutHeight` (dp) và `fit`.

Không cần `sizes`: HTML cần nó vì trình duyệt chọn ảnh trước khi layout, còn carousel chọn sau khi layout.

**Xoay màn hình và đổi kích thước.** Khi vùng ảnh lớn lên (dọc sang ngang, chia đôi màn hình, đổi cỡ cửa sổ trên web), biến thể nét hơn được tải ở nền trong khi ảnh hiện tại vẫn hiển thị, rồi crossfade trong 220 ms sau khi decode xong. Khi vùng ảnh nhỏ đi, ảnh nét đang hiện được giữ nguyên và không tải gì thêm, giống trình duyệt. Ảnh được vẽ lại theo kích thước mới ngay trong khung hình đổi layout, nên khi xoay không có khung nào vẽ theo kích thước cũ hay bị trống.

## Ảnh từ mạng và cache

Ảnh từ mạng (`{ uri: 'https://…' }`) đi qua một cache trên đĩa, bật sẵn mặc định. Mỗi ảnh được lưu kèm thời điểm tải và thời điểm hết hạn.

```tsx
// Hằng số ở cấp module (hoặc useMemo): carousel memo tuỳ chọn theo identity.
const CACHE = {
  strategy: 'stale-while-revalidate', // mặc định
  maxAge: 6 * 60 * 60 * 1000, // 6 giờ khi server không gửi Cache-Control
} as const;

<MorphCarousel imageCache={CACHE} getImage={(p) => ({ uri: p.imageUrl })} … />
```

| Chiến lược | Đã cache, còn hạn | Đã cache, hết hạn | Chưa cache |
| --- | --- | --- | --- |
| `stale-while-revalidate` (mặc định) | Hiện ngay, không gửi request | Hiện ngay, kiểm tra lại ở nền, thay ảnh nếu server có bản mới. Quá `maxStale` thì chờ mạng | Tải về |
| `cache-first` | Hiện ngay, không gửi request | Chờ mạng; bản cũ là phương án dự phòng khi mất mạng | Tải về |
| `network-first` | Kiểm tra lại trước khi hiện; bản đã cache là dự phòng khi mất mạng | Như cột bên | Tải về |

Thời hạn của ảnh:

- Nếu server gửi `Cache-Control: max-age` (hoặc `Expires`), dùng thời hạn đó. `no-cache` nghĩa là "luôn kiểm tra lại", `no-store` nghĩa là "không ghi xuống đĩa". Đặt `respectHttpHeaders: false` để luôn dùng `maxAge`.
- Nếu không, dùng `maxAge` (mặc định 24 giờ).

Khi kiểm tra lại, cache gửi `If-None-Match` / `If-Modified-Since`. Nếu ảnh không đổi, server trả 304 và không có dữ liệu ảnh nào được truyền. Nếu ảnh đã đổi, file mới mang tên mới nên view ảnh tải lại, và file cũ bị xoá. Ảnh đang nằm trên màn hình cũng được kiểm tra lại khi hết hạn, không chỉ lúc mount.

Tuỳ chọn của `imageCache`:

| Tuỳ chọn | Mặc định | Mô tả |
| --- | --- | --- |
| `strategy` | `'stale-while-revalidate'` | Xem bảng trên |
| `maxAge` | 24 giờ | Thời hạn (ms) khi server không gửi |
| `maxStale` | 7 ngày | `stale-while-revalidate` còn được hiện ảnh cũ bao lâu sau khi hết hạn, trong lúc chờ ảnh mới |
| `respectHttpHeaders` | `true` | Dùng `Cache-Control` / `Expires` và tuân theo `no-store` |
| `headers` | | Header cho request, ví dụ `Authorization` |
| `getCacheKey(url)` | URL | Cho URL ký (signed URL) có query đổi mỗi lần: `(url) => url.split('?')[0]` |

Truyền `imageCache={false}` để tải thẳng từ mạng.

### Thứ tự tải và tải trước

Mọi lượt tải đi qua một hàng đợi, giới hạn số request song song (mặc định 4), với ba mức ưu tiên:

| Mức ưu tiên | Dùng cho |
| --- | --- |
| `high` | Ảnh của trang đang xem |
| `normal` | Các trang kế bên (cách một trang) |
| `low` | Các trang xa hơn trong cửa sổ render, prefetch, revalidate ở nền |

Khi người dùng vuốt, ảnh của trang mới được đẩy lên đầu hàng đợi, nên vuốt nhanh không phải chờ ảnh của các trang đã đi qua.

Ngoài cửa sổ render (`windowSize`), carousel tải trước ảnh của `prefetch` trang nữa mỗi bên (mặc định 1) mà không render, chọn đúng biến thể mà trang đó sẽ chọn khi mount. `prefetch={0}` để tắt.

Để tải ảnh trước khi carousel tồn tại (màn hình tiếp theo, một item trong danh sách sắp hiện ra), dùng hook hoặc hàm:

```tsx
import { imageTargetFor, usePrefetchImages, imageCache } from 'expo-morph-carousel';

// Ở màn hình trước: dựng đúng các URL mà carousel sẽ yêu cầu
const target = imageTargetFor({ width: screenWidth - 32, height: 240 }, PixelRatio.get(), 'cover');
const { loaded, total, failed, done } = usePrefetchImages(
  products.map((p) => cdnUrl(p.image, target.width)),
  { priority: 'low' }, // mặc định; `enabled: false` để chờ
);

// Hoặc gọi trực tiếp, ví dụ sau khi API danh sách trả về
await imageCache.prefetch(urls, cacheOptions, 'low');
```

`imageTargetFor` chính là hàm carousel dùng để tạo `target` cho `getImage`, nên URL tải trước trùng với URL carousel sẽ yêu cầu.

### Giới hạn

| Cấu hình | Mặc định | |
| --- | --- | --- |
| `maxSize` | 100 MB | Dung lượng trên đĩa. File ít dùng nhất bị xoá trước |
| `maxEntries` | 500 | Số file trên đĩa |
| `maxConcurrent` | 4 | Số lượt tải song song; phần còn lại chờ theo thứ tự ưu tiên |
| `decodedImages` | 24 | Số ảnh đã decode giữ trong bộ nhớ cho hiệu ứng liquid. Mỗi ảnh tốn rộng × cao × 4 byte (ảnh 1080×810 ≈ 3,5 MB), nên 24 ảnh như vậy ≈ 84 MB. Hạ xuống nếu dùng ảnh lớn trên máy ít RAM |

```ts
imageCache.configure({ maxSize: 50 * 1024 * 1024, maxEntries: 300, maxConcurrent: 6, decodedImages: 12 });
imageCache.getConfig(); // giá trị hiện tại
```

`configure` có hiệu lực ngay; hạ `maxSize` hoặc `maxEntries` sẽ xoá bớt ngay. Nên gọi một lần lúc khởi động (ví dụ trong root layout).

### Xem và xoá cache

```ts
imageCache.getEntry(url); // { fetchedAt, expiresAt, etag, size, … }
imageCache.stats(); // { hits, misses, revalidations, notModified, updates, errors, entries, size, active, queued }
const stats = useImageCacheStats(); // như trên, cập nhật trực tiếp, cho bảng debug
await imageCache.remove(url);
await imageCache.clear(); // ví dụ khi đăng xuất
```

File được lưu trong `<thư mục cache>/expo-morph-carousel/` trên iOS và Android (hệ điều hành có thể xoá khi thiếu dung lượng) và trong Cache Storage trên web. Ảnh đã decode cũng được giữ trong bộ nhớ (24 ảnh gần nhất), nên vuốt qua lại không phải decode lại.

Để thử, app ví dụ có một server ảnh local gửi `ETag` và `Cache-Control`, và có thể đổi ảnh:

```bash
npm run image-server --workspace example   # http://localhost:8090, max-age 30 giây
adb reverse tcp:8090 tcp:8090               # Android emulator
```

Mở "Remote images" trong app ví dụ. Bảng thông tin hiện thời điểm tải ảnh hiện tại, ảnh còn hạn bao lâu, và các bộ đếm của cache; nút "Swap images on server" đổi nội dung mà mọi URL trả về.

## Điều khiển carousel

```tsx
const carousel = useRef<MorphCarouselRef>(null);
const position = useSharedValue(0);

// Đổi màu nền theo item hiện tại trong lúc vuốt
const background = useAnimatedStyle(() => ({
  backgroundColor: interpolateColor(position.value, [0, 1, 2], ['#efe9ff', '#fff3df', '#e2f6f1']),
}));

<MorphCarousel ref={carousel} positionValue={position} onIndexChange={setIndex} … />
<Button title="Next" onPress={() => carousel.current?.next()} />
```

Khi `loop` tắt, `next()` ở trang cuối quay về trang đầu, đúng như nút "Next" và autoplay thường cần. Khi `loop` bật, `scrollTo(0)` từ trang cuối tiến thêm một trang thay vì tua ngược qua tất cả các trang.

## Hiệu ứng media tự viết

Một hiệu ứng media nhận khoảng cách có dấu từ trang của ảnh tới vị trí hiện tại (`offset`: 0 là đang hiển thị, -1 là lùi một trang, 0.5 là nửa đường tới trang sau) và trả về opacity, transform. Nó chạy trên UI thread nên phải là worklet:

```tsx
import type { MediaEffectFn } from 'expo-morph-carousel';

const flip: MediaEffectFn = ({ offset }) => {
  'worklet';
  const angle = Math.max(-1, Math.min(1, offset)) * 90;
  return {
    opacity: Math.abs(offset) < 0.5 ? 1 : 0,
    transform: [{ perspective: 800 }, { rotateY: `${angle}deg` }],
  };
};

<MorphCarousel effect={flip} … />
```

Đầu vào còn có `width`, `height`, `direction` và `rtl`. Các preset có sẵn được export dưới tên `mediaEffects` nếu bạn muốn bọc lại một preset.

## Chấm phân trang đặt ở chỗ khác

`<Pagination>` được export. Truyền cho nó cùng shared value:

```tsx
<MorphCarousel pagination={false} positionValue={position} ref={carousel} … />
<Pagination count={data.length} position={position} onPress={(i) => carousel.current?.scrollTo(i)} />
```

## Hiệu ứng liquid hoạt động thế nào

Mọi ảnh gần trang hiện tại được xếp chồng trong một layer Skia và cross-fade theo khoảng cách trang. Sau đó layer đi qua hai bộ lọc:

1. Blur, với bán kính đạt đỉnh ở giữa hai trang. Hai ảnh tan vào nhau thành một hình mềm.
2. Alpha threshold, tức một color matrix trên kênh alpha, cắt viền mờ về lại một đường viền sắc. Hình mềm trở thành một khối đặc thay vì một đám mờ.

Cả hai bộ lọc tỉ lệ theo một đường tam giác: bằng 0 khi ở đúng trang và bằng 1 ở giữa hai trang, nên trang đứng yên được vẽ nguyên vẹn.

Với ảnh chụp (`mediaFit="cover"`), bước cắt alpha còn làm bo tròn góc và ăn vào mép khung chữ nhật trong lúc chuyển. `liquid={{ preserveShape: true }}` giữ nguyên khung: blur chỉ nằm trong vùng ảnh và lặp lại điểm ảnh ở mép, không có bước cắt alpha, nên góc vẫn vuông và chỉ phần nội dung tan vào nhau. Các trang chữ là view React Native thông thường và trượt; chỉ vùng media được vẽ bằng Skia.

## Accessibility

- Vùng media và các trang tạo thành một phần tử với role `adjustable` (`slider` trên web). Người dùng VoiceOver và TalkBack vuốt lên hoặc xuống để đổi trang; giá trị được đọc như "Watch, 1 / 3".
- Footer nằm ngoài phần tử đó nên các nút bên trong vẫn truy cập được.
- Autoplay dừng khi trình đọc màn hình đang bật, trừ khi đặt `autoplay.whenScreenReaderEnabled`.
- Khi bật Reduce Motion, `liquid` và các preset khác chuyển về `crossfade`, và snap không có animation.
- Trên web carousel nhận focus được: phím mũi tên chuyển một trang (lên/xuống khi trượt dọc), Home và End về hai đầu.

## Hiệu năng

- Chỉ `windowSize` trang mỗi bên được render; phần còn lại của `data` không tốn gì.
- Gesture, snap, hiệu ứng và chấm phân trang chạy trên UI thread. React chỉ render lại khi trang gần nhất thay đổi.
- Bộ lọc Skia chỉ được tạo trong lúc đang chuyển trang. Khi đứng yên, layer chỉ là một lần vẽ ảnh.
- Giữ ảnh gần với kích thước hiển thị. Ảnh 4000 px bị blur mỗi frame sẽ nặng trên điện thoại Android cũ; giảm `liquid.blur` cũng giúp.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân và cách sửa |
| --- | --- |
| Không thấy gì | Carousel không có chiều cao. Đặt `style={{ height: … }}` hoặc `flex: 1` trong một parent có kích thước |
| Thấy cross-fade thay vì liquid | Chưa cài Skia, đang bật Reduce Motion, hoặc (web) CanvasKit chưa tải xong. Kiểm tra `public/canvaskit.wasm` đã có chưa (`npx setup-skia-web public`) |
| Vuốt lại cuộn ScrollView cha | Carousel ngang nhận cử chỉ kéo ngang quá 10 px; kéo dọc thuộc về parent. Carousel dọc trong ScrollView dọc thì đặt chiều cao cố định cho carousel và chấp nhận hai bên tranh nhau cử chỉ |
| Lỗi worklet như "… is not a worklet" | Hiệu ứng tự viết thiếu `'worklet';`, hoặc `babel.config.js` không dùng `babel-preset-expo`. Xoá cache Metro bằng `npx expo start -c` |
| Ảnh từ mạng mãi là placeholder | Tải ảnh thất bại; `imageCache.stats().errors` đếm số lần lỗi. Trên Android, lỗi HTTPS (ví dụ chứng chỉ của proxy) hiện trong logcat dưới dạng `System.err`. URL `http://` không mã hoá cần `usesCleartextTraffic` ở bản release |
| Ảnh đã cập nhật trên server mà app chưa hiện | Ảnh vẫn còn hạn: giảm `maxAge`, cho server gửi `Cache-Control: max-age` ngắn hơn, hoặc gọi `imageCache.remove(url)` |

## Trạng thái nền tảng

| Nền tảng | Đã kiểm tra bằng |
| --- | --- |
| Android | Emulator Android 17 (API 37), Expo Go: mọi hiệu ứng media và page effect, slots, snap mode và chạm để chuyển trang (ngang, dọc và phải sang trái), loop, chấm phân trang, ref API, và cache trên đĩa với server ảnh local (dùng cache khi còn hạn, kiểm tra lại bằng 304, thay ảnh sau khi hết hạn, giữ cache qua các lần mở lại app) |
| Web | Chrome desktop: hiệu ứng liquid với CanvasKit, điều hướng bằng bàn phím, ảnh từ mạng, cache bằng Cache Storage qua các lần tải lại trang |
| iOS | Chưa kiểm tra |

Hoan nghênh các báo cáo từ iOS.

## Phát triển

```bash
npm install
npm run example          # app ví dụ trong Expo Go
npm run check            # typecheck, ESLint, Prettier, unit test
npm test                 # chỉ unit test cho phần toán phân trang
npm run build            # biên dịch ra lib/
```

App ví dụ (`example/`) import package từ `src/` và có sáu màn: trưng bày sản phẩm, onboarding toàn màn hình, bố cục trang, slots, playground cho các hiệu ứng media và thư viện ảnh từ mạng kèm bảng thông tin cache. Các hình trong ví dụ được tạo bằng `npm run make-assets --workspace example` (cần ffmpeg).

`npm install` cũng cài một pre-commit hook chạy ESLint và Prettier trên các file đã stage và chạy typecheck.

## Đóng góp và báo lỗi

- Lỗi: mở issue bằng [form báo lỗi](https://github.com/anhtuank7c/expo-morph-carousel/issues/new?template=bug_report.yml).
- Ý tưởng và câu hỏi: [đề xuất tính năng](https://github.com/anhtuank7c/expo-morph-carousel/issues/new?template=feature_request.yml) hoặc [Discussions](https://github.com/anhtuank7c/expo-morph-carousel/discussions).
- Pull request: xem [CONTRIBUTING.md](https://github.com/anhtuank7c/expo-morph-carousel/blob/main/CONTRIBUTING.md).
- Lỗi bảo mật: xem [SECURITY.md](https://github.com/anhtuank7c/expo-morph-carousel/blob/main/SECURITY.md).
- Ghi chú phát hành: [CHANGELOG.md](https://github.com/anhtuank7c/expo-morph-carousel/blob/main/CHANGELOG.md).

Cùng tác giả: [expo-morph-menu](https://github.com/anhtuank7c/expo-morph-menu), một nút nổi biến hình thành menu và thành các route toàn màn hình.

## Giấy phép

MIT
