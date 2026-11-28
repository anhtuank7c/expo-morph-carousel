#!/usr/bin/env node
/**
 * Generates the device images of the example: original vector
 * drawings (no brand, no logo, no third-party artwork) rendered with
 * CanvasKit, the WebAssembly build of Skia that @shopify/react-native-skia
 * already installs.
 *
 * - example/assets/devices/*.png: a watch, a phone, a laptop, a mini
 *   computer and a desktop display, each cropped to its own outline on a
 *   transparent background, the kind of image the liquid effect is made for.
 *
 *   node example/scripts/make-devices.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const CanvasKitInit = require('canvaskit-wasm');
const CK = await CanvasKitInit();

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/* --- helpers ------------------------------------------------------------- */

const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16);
  return CK.Color4f(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a);
};
const rect = (x, y, w, h) => CK.XYWHRect(x, y, w, h);
const rrect = (x, y, w, h, r) => CK.RRectXY(rect(x, y, w, h), r, r);
/** Rounded rect with its own radius per corner: top-left, top-right, bottom-right, bottom-left. */
const rrect4 = (x, y, w, h, [tl, tr, br, bl]) =>
  Float32Array.of(x, y, x + w, y + h, tl, tl, tr, tr, br, br, bl, bl);

function paint({ color, shader, stroke, blur, alpha } = {}) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  if (color) p.setColor(color);
  if (shader) p.setShader(shader);
  if (stroke) {
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeCap(CK.StrokeCap.Round);
    p.setStrokeJoin(CK.StrokeJoin.Round);
  }
  if (blur) p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, blur, true));
  if (alpha !== undefined) p.setAlphaf(alpha);
  return p;
}
const linear = (x0, y0, x1, y1, colors, pos = null) =>
  CK.Shader.MakeLinearGradient([x0, y0], [x1, y1], colors, pos, CK.TileMode.Clamp);
const radial = (cx, cy, r, colors, pos = null) =>
  CK.Shader.MakeRadialGradient([cx, cy], r, colors, pos, CK.TileMode.Clamp);

/** Bounding box of the pixels with some coverage. */
function contentBounds(image, w, h) {
  const px = image.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: CK.ColorType.RGBA_8888,
    alphaType: CK.AlphaType.Unpremul,
    colorSpace: CK.ColorSpace.SRGB,
  });
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Draws on a w × h canvas, then saves the given crop (default: tight to the content). */
function render(file, w, h, draw, crop) {
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  draw(canvas);
  const image = surface.makeImageSnapshot();
  const b = crop ?? contentBounds(image, w, h);
  const out = CK.MakeSurface(b.w, b.h);
  out.getCanvas().clear(CK.TRANSPARENT);
  out.getCanvas().drawImage(image, -b.x, -b.y, null);
  const png = out.makeImageSnapshot().encodeToBytes();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
  console.log(`${file.slice(assets.length + 1)}  ${b.w}×${b.h}`);
  return { image, bounds: b };
}

/* --- screens ------------------------------------------------------------- */

const PALETTES = {
  violet: { base: ['#1a0f3d', '#4b23b8', '#8b5cf6'], ribbons: ['#ff5fd2', '#5b8cff', '#c4a6ff'] },
  ocean: { base: ['#04203a', '#0b5fa5', '#22c3d6'], ribbons: ['#5ef2d0', '#7aa8ff', '#e0f7ff'] },
  orchid: { base: ['#2a0a2f', '#a1238f', '#ff7ab6'], ribbons: ['#ffd36e', '#ff4f8b', '#b892ff'] },
  sunset: { base: ['#2b0d3a', '#c2366b', '#ff9a4d'], ribbons: ['#ffd27a', '#ff5f6d', '#8f6bff'] },
};

/** A glowing wallpaper: a gradient with soft light ribbons, clipped to the screen. */
function wallpaper(canvas, x, y, w, h, radius, palette) {
  const p = PALETTES[palette];
  canvas.save();
  canvas.clipRRect(
    typeof radius === 'number' ? rrect(x, y, w, h, radius) : rrect4(x, y, w, h, radius),
    CK.ClipOp.Intersect,
    true,
  );
  canvas.drawRect(
    rect(x, y, w, h),
    paint({
      shader: linear(
        x,
        y,
        x + w * 0.4,
        y + h,
        p.base.map((c) => hex(c)),
      ),
    }),
  );
  const ribbons = [
    { c: p.ribbons[0], y0: 0.25, y1: 0.75, t: 0.22, a: 0.85 },
    { c: p.ribbons[1], y0: 0.7, y1: 0.35, t: 0.16, a: 0.75 },
    { c: p.ribbons[2], y0: 0.55, y1: 0.95, t: 0.1, a: 0.6 },
  ];
  for (const r of ribbons) {
    const path = new CK.PathBuilder();
    path.moveTo(x - w * 0.2, y + h * r.y0);
    path.cubicTo(
      x + w * 0.3,
      y + h * (r.y0 - 0.35),
      x + w * 0.65,
      y + h * (r.y1 + 0.35),
      x + w * 1.2,
      y + h * r.y1,
    );
    canvas.drawPath(
      path.snapshot(),
      paint({ color: hex(r.c, r.a), stroke: Math.min(w, h) * r.t, blur: Math.min(w, h) * 0.06 }),
    );
    path.delete();
  }
  canvas.drawRect(
    rect(x, y, w, h),
    paint({
      shader: radial(x + w * 0.2, y + h * 0.1, Math.max(w, h) * 0.7, [
        hex('#ffffff', 0.28),
        hex('#ffffff', 0),
      ]),
    }),
  );
  canvas.restore();
}

/** Brushed metal gradient across a part. */
const metal = (x0, y0, x1, y1, tone) =>
  tone === 'dark'
    ? linear(
        x0,
        y0,
        x1,
        y1,
        [hex('#4a4e57'), hex('#1b1d22'), hex('#2c2f36'), hex('#0f1013')],
        [0, 0.45, 0.7, 1],
      )
    : linear(
        x0,
        y0,
        x1,
        y1,
        [hex('#f3f4f6'), hex('#c3c8cf'), hex('#e7e9ec'), hex('#9aa0a8')],
        [0, 0.4, 0.65, 1],
      );

/* --- devices ------------------------------------------------------------- */

const devices = join(assets, 'devices');

render(join(devices, 'watch.png'), 720, 1040, (c) => {
  const cx = 360;
  const top = 285;
  const w = 390;
  const h = 460;
  const left = cx - w / 2;
  // bands, woven: a gradient with fine ribs
  for (const [y, hh, corners] of [
    [0, top + 60, [46, 46, 0, 0]],
    [top + h - 60, 1040 - (top + h - 60), [0, 0, 46, 46]],
  ]) {
    const bx = cx - 128;
    c.drawRRect(
      rrect4(bx, y, 256, hh, corners),
      paint({
        shader: linear(bx, 0, bx + 256, 0, [hex('#262a33'), hex('#3d4350'), hex('#20232a')], [0, 0.5, 1]),
      }),
    );
    c.save();
    c.clipRRect(rrect4(bx, y, 256, hh, corners), CK.ClipOp.Intersect, true);
    for (let ry = y + 8; ry < y + hh; ry += 13)
      c.drawRect(rect(bx, ry, 256, 3), paint({ color: hex('#ffffff', 0.05) }));
    c.restore();
  }
  // crown and side button, behind the case
  c.drawRRect(
    rrect(left + w - 8, top + 118, 34, 84, 12),
    paint({ shader: metal(0, top + 118, 0, top + 202, 'dark') }),
  );
  for (let ry = top + 126; ry < top + 196; ry += 8)
    c.drawRect(rect(left + w + 14, ry, 10, 3), paint({ color: hex('#000000', 0.35) }));
  c.drawRRect(
    rrect(left + w - 8, top + 250, 18, 96, 8),
    paint({ shader: metal(0, top + 250, 0, top + 346, 'dark') }),
  );
  // case
  c.drawRRect(rrect(left, top, w, h, 112), paint({ shader: metal(left, top, left + w, top + h, 'dark') }));
  c.drawRRect(rrect(left + 3, top + 3, w - 6, h - 6, 109), paint({ color: hex('#9aa0aa', 0.45), stroke: 3 }));
  // glass and display
  c.drawRRect(rrect(left + 16, top + 16, w - 32, h - 32, 98), paint({ color: hex('#050507') }));
  const sx = left + 34;
  const sy = top + 34;
  const sw = w - 68;
  const sh = h - 68;
  wallpaper(c, sx, sy, sw, sh, 80, 'violet');
  // an analog face: ticks, hands, center
  const fx = sx + sw / 2;
  const fy = sy + sh / 2;
  const R = Math.min(sw, sh) * 0.42;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    const r0 = R * (big ? 0.84 : 0.92);
    c.drawLine(
      fx + Math.sin(a) * r0,
      fy - Math.cos(a) * r0,
      fx + Math.sin(a) * R,
      fy - Math.cos(a) * R,
      paint({ color: hex('#ffffff', big ? 0.95 : 0.45), stroke: big ? 5 : 2 }),
    );
  }
  const hand = (deg, len, width, color) => {
    const a = (deg * Math.PI) / 180;
    c.drawLine(fx, fy, fx + Math.sin(a) * len, fy - Math.cos(a) * len, paint({ color, stroke: width }));
  };
  hand(305, R * 0.52, 12, hex('#ffffff'));
  hand(55, R * 0.78, 8, hex('#ffffff'));
  hand(160, R * 0.86, 3, hex('#ff7ad9'));
  c.drawCircle(fx, fy, 10, paint({ color: hex('#ffffff') }));
  c.drawCircle(fx, fy, 4, paint({ color: hex('#ff7ad9') }));
});

render(join(devices, 'phone.png'), 520, 1000, (c) => {
  const x = 30;
  const y = 20;
  const w = 440;
  const h = 940;
  // side buttons
  c.drawRRect(rrect(x - 7, y + 190, 12, 70, 5), paint({ shader: metal(0, 0, 12, 0, 'dark') }));
  c.drawRRect(rrect(x - 7, y + 280, 12, 70, 5), paint({ shader: metal(0, 0, 12, 0, 'dark') }));
  c.drawRRect(rrect(x + w - 5, y + 240, 12, 110, 5), paint({ shader: metal(0, 0, 12, 0, 'dark') }));
  // frame and glass
  c.drawRRect(rrect(x, y, w, h, 86), paint({ shader: metal(x, y, x + w, y + h, 'dark') }));
  c.drawRRect(rrect(x + 2, y + 2, w - 4, h - 4, 84), paint({ color: hex('#a0a6b0', 0.4), stroke: 3 }));
  c.drawRRect(rrect(x + 10, y + 10, w - 20, h - 20, 76), paint({ color: hex('#040405') }));
  const sx = x + 22;
  const sy = y + 22;
  const sw = w - 44;
  const sh = h - 44;
  wallpaper(c, sx, sy, sw, sh, 64, 'ocean');
  // widgets and icons, frosted
  c.drawRRect(rrect(sx + 28, sy + 120, sw - 56, 150, 34), paint({ color: hex('#ffffff', 0.2) }));
  c.drawRRect(rrect(sx + 52, sy + 150, 150, 26, 13), paint({ color: hex('#ffffff', 0.85) }));
  c.drawRRect(rrect(sx + 52, sy + 196, 220, 18, 9), paint({ color: hex('#ffffff', 0.5) }));
  c.drawRRect(rrect(sx + 52, sy + 226, 120, 18, 9), paint({ color: hex('#ffffff', 0.35) }));
  const icons = [
    '#ffb347',
    '#5ee7a8',
    '#ff6b8b',
    '#7aa2ff',
    '#ffe066',
    '#b18cff',
    '#4dd6ff',
    '#ff8f5c',
    '#9cf2c5',
    '#ff9ad5',
    '#ffd36e',
    '#7ee0ff',
  ];
  const size = 74;
  const gap = (sw - 56 - size * 4) / 3;
  icons.forEach((col, i) => {
    const ix = sx + 28 + (i % 4) * (size + gap);
    const iy = sy + 320 + Math.floor(i / 4) * (size + 40);
    c.drawRRect(
      rrect(ix, iy, size, size, 20),
      paint({ shader: linear(ix, iy, ix + size, iy + size, [hex(col), hex(col, 0.75)]) }),
    );
  });
  // dock
  c.drawRRect(rrect(sx + 20, sy + sh - 128, sw - 40, 104, 36), paint({ color: hex('#ffffff', 0.22) }));
  ['#5ee7a8', '#7aa2ff', '#ff6b8b', '#ffb347'].forEach((col, i) => {
    const ix = sx + 20 + 22 + i * ((sw - 40 - 44 - size) / 3);
    c.drawRRect(rrect(ix, sy + sh - 113, size, size, 20), paint({ color: hex(col) }));
  });
  // punch-hole camera
  c.drawCircle(x + w / 2, y + 62, 15, paint({ color: hex('#000000') }));
  c.drawCircle(x + w / 2, y + 62, 15, paint({ color: hex('#2a2d33'), stroke: 2 }));
  c.drawCircle(x + w / 2 - 4, y + 58, 4, paint({ color: hex('#3a4a6a', 0.9) }));
});

render(join(devices, 'laptop.png'), 1340, 860, (c) => {
  const lx = 130;
  const ly = 20;
  const lw = 1080;
  const lh = 700;
  // lid
  c.drawRRect(
    rrect4(lx, ly, lw, lh, [36, 36, 8, 8]),
    paint({ shader: metal(lx, ly, lx + lw, ly + lh, 'dark') }),
  );
  c.drawRRect(
    rrect4(lx + 2, ly + 2, lw - 4, lh - 4, [34, 34, 7, 7]),
    paint({ color: hex('#9aa0aa', 0.35), stroke: 3 }),
  );
  c.drawRRect(rrect4(lx + 10, ly + 10, lw - 20, lh - 14, [28, 28, 4, 4]), paint({ color: hex('#060608') }));
  const sx = lx + 30;
  const sy = ly + 34;
  const sw = lw - 60;
  const sh = lh - 78;
  wallpaper(c, sx, sy, sw, sh, [12, 12, 4, 4], 'orchid');
  // menu bar, a window and a dock
  c.drawRect(rect(sx, sy, sw, 22), paint({ color: hex('#ffffff', 0.16) }));
  const wx = sx + 120;
  const wy = sy + 90;
  c.drawRRect(rrect(wx, wy, 520, 330, 18), paint({ color: hex('#ffffff', 0.9) }));
  c.drawRRect(rrect4(wx, wy, 520, 40, [18, 18, 0, 0]), paint({ color: hex('#eef0f4') }));
  ['#ff6159', '#ffbd2e', '#28c941'].forEach((col, i) =>
    c.drawCircle(wx + 26 + i * 22, wy + 20, 7, paint({ color: hex(col) })),
  );
  c.drawRRect(
    rrect(wx + 24, wy + 64, 220, 230, 12),
    paint({ shader: linear(wx + 24, wy + 64, wx + 244, wy + 294, [hex('#ff9a8b'), hex('#a18cd1')]) }),
  );
  for (let i = 0; i < 6; i++)
    c.drawRRect(
      rrect(wx + 270, wy + 72 + i * 36, i % 2 ? 160 : 220, 16, 8),
      paint({ color: hex('#c9ceda') }),
    );
  c.drawRRect(rrect(sx + sw - 330, sy + 160, 250, 170, 18), paint({ color: hex('#ffffff', 0.22) }));
  const dw = 420;
  c.drawRRect(rrect(sx + (sw - dw) / 2, sy + sh - 70, dw, 58, 18), paint({ color: hex('#ffffff', 0.24) }));
  ['#5ee7a8', '#7aa2ff', '#ff6b8b', '#ffb347', '#b18cff', '#4dd6ff'].forEach((col, i) =>
    c.drawRRect(
      rrect(sx + (sw - dw) / 2 + 22 + i * 66, sy + sh - 62, 42, 42, 11),
      paint({ color: hex(col) }),
    ),
  );
  c.drawCircle(lx + lw / 2, ly + 20, 5, paint({ color: hex('#2b2f37') }));
  // base: a thin slab, a little wider than the lid
  const by = ly + lh;
  const base = new CK.PathBuilder();
  base.moveTo(lx - 50, by);
  base.lineTo(lx + lw + 50, by);
  base.quadTo(lx + lw + 116, by + 2, lx + lw + 110, by + 26);
  base.quadTo(lx + lw + 104, by + 44, lx + lw + 70, by + 44);
  base.lineTo(lx - 70, by + 44);
  base.quadTo(lx - 104, by + 44, lx - 110, by + 26);
  base.quadTo(lx - 116, by + 2, lx - 50, by);
  base.close();
  c.drawPath(
    base.snapshot(),
    paint({
      shader: linear(0, by, 0, by + 44, [hex('#5b606a'), hex('#2a2d33'), hex('#121316')], [0, 0.45, 1]),
    }),
  );
  c.drawLine(lx - 46, by + 2, lx + lw + 46, by + 2, paint({ color: hex('#c3c8d0', 0.8), stroke: 3 }));
  c.drawRRect(rrect4(lx + lw / 2 - 70, by, 140, 12, [0, 0, 8, 8]), paint({ color: hex('#0d0e10') }));
  base.delete();
});

render(join(devices, 'mini.png'), 1000, 640, (c) => {
  const cx = 500;
  const top = 250; // center of the top face
  const side = 760;
  const flat = 0.36;
  const depth = 120;
  const r = 150;
  const face = (dy, shader) => {
    c.save();
    c.translate(cx, top + dy);
    c.scale(1, flat);
    c.drawRRect(rrect(-side / 2, -side / 2, side, side, r), paint({ shader }));
    c.restore();
  };
  // body sides: the face shifted down, the band between, then the top
  const sideShade = linear(
    cx - side / 2,
    0,
    cx + side / 2,
    0,
    [hex('#8e949c'), hex('#dfe2e6'), hex('#f2f3f5'), hex('#c9cdd3'), hex('#7d838b')],
    [0, 0.3, 0.5, 0.75, 1],
  );
  face(depth, sideShade);
  c.drawRect(rect(cx - side / 2, top, side, depth), paint({ shader: sideShade }));
  // front details: ports and a status light
  const fy = top + (side / 2) * flat + depth * 0.5;
  for (let i = 0; i < 2; i++)
    c.drawRRect(rrect(cx - 250 + i * 60, fy - 6, 42, 14, 6), paint({ color: hex('#2a2d33') }));
  c.drawCircle(cx + 280, fy, 6, paint({ color: hex('#7dffb2') }));
  c.drawCircle(cx + 280, fy, 14, paint({ color: hex('#7dffb2', 0.35), blur: 6 }));
  face(
    0,
    linear(
      cx - side / 2,
      top - (side / 2) * flat,
      cx + side / 2,
      top + (side / 2) * flat,
      [hex('#eceef1'), hex('#d3d7dc'), hex('#b4bac2')],
      [0, 0.55, 1],
    ),
  );
  // rim and a soft sheen on the top
  c.save();
  c.translate(cx, top);
  c.scale(1, flat);
  c.drawRRect(
    rrect(-side / 2 + 4, -side / 2 + 4, side - 8, side - 8, r - 4),
    paint({ color: hex('#ffffff', 0.95), stroke: 8 }),
  );
  c.drawRRect(
    rrect(-side / 2 + 14, -side / 2 + 14, side - 28, side - 28, r - 14),
    paint({ color: hex('#8f959d', 0.35), stroke: 4 }),
  );
  c.drawCircle(-150, -170, 220, paint({ color: hex('#ffffff', 0.4), blur: 110 }));
  c.restore();
  // a dark foot line
  c.save();
  c.translate(cx, top + depth + 4);
  c.scale(1, flat);
  c.drawRRect(
    rrect(-side / 2 + 40, -side / 2 + 40, side - 80, side - 80, r - 30),
    paint({ color: hex('#2a2d33', 0.0) }),
  );
  c.restore();
});

render(join(devices, 'desktop.png'), 1180, 1080, (c) => {
  const x = 60;
  const y = 20;
  const w = 1060;
  const h = 660;
  const cx = x + w / 2;
  // stand: a column and a flat round foot
  c.drawRRect(
    rrect(cx - 60, y + h - 20, 120, 270, 18),
    paint({ shader: metal(cx - 60, 0, cx + 60, 0, 'light') }),
  );
  c.drawOval(
    rect(cx - 250, y + h + 216, 500, 70),
    paint({ shader: linear(0, y + h + 216, 0, y + h + 286, [hex('#f4f5f7'), hex('#aab0b8')]) }),
  );
  c.drawOval(rect(cx - 250, y + h + 226, 500, 70), paint({ color: hex('#6f757e') }));
  c.drawOval(
    rect(cx - 250, y + h + 214, 500, 64),
    paint({ shader: linear(cx - 250, 0, cx + 250, 0, [hex('#c9cdd3'), hex('#f5f6f8'), hex('#b8bdc4')]) }),
  );
  // display
  c.drawRRect(rrect(x, y, w, h, 30), paint({ shader: metal(x, y, x + w, y + h, 'light') }));
  c.drawRRect(rrect(x + 8, y + 8, w - 16, h - 16, 24), paint({ color: hex('#08090b') }));
  const sx = x + 28;
  const sy = y + 28;
  const sw = w - 56;
  const sh = h - 56;
  wallpaper(c, sx, sy, sw, sh, 10, 'sunset');
  // rolling hills in front of the sky
  c.save();
  c.clipRRect(rrect(sx, sy, sw, sh, 10), CK.ClipOp.Intersect, true);
  [
    { yy: 0.62, col: '#5b1f63', a: 0.85 },
    { yy: 0.74, col: '#3b1450', a: 0.95 },
    { yy: 0.86, col: '#22093a', a: 1 },
  ].forEach((l, i) => {
    const p = new CK.PathBuilder();
    p.moveTo(sx, sy + sh * l.yy);
    p.cubicTo(
      sx + sw * 0.3,
      sy + sh * (l.yy - 0.14 + i * 0.03),
      sx + sw * 0.6,
      sy + sh * (l.yy + 0.12),
      sx + sw,
      sy + sh * (l.yy - 0.06),
    );
    p.lineTo(sx + sw, sy + sh);
    p.lineTo(sx, sy + sh);
    p.close();
    c.drawPath(p.snapshot(), paint({ color: hex(l.col, l.a) }));
    p.delete();
  });
  c.drawCircle(sx + sw * 0.7, sy + sh * 0.36, 70, paint({ color: hex('#ffe3a3', 0.95) }));
  c.drawCircle(sx + sw * 0.7, sy + sh * 0.36, 140, paint({ color: hex('#ffd27a', 0.35), blur: 40 }));
  c.restore();
  c.drawCircle(cx, y + 16, 4, paint({ color: hex('#30343b') }));
});
