/**
 * Pixel art for items, destructible props, debris, hazards, effects and HUD parts.
 * Pure module (PixelCanvas only).
 */
import { PixelCanvas, rng } from "../engine/pixel";
import { PAL } from "../engine/palette";
import { Layer, compose, rampOf, mix, mul, type Ramp } from "./doll";

const K = PAL.ink;

function art(rows: string[], pal: Record<string, number>): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const pc = new PixelCanvas(w, rows.length);
  pc.draw(rows, pal, 0, 0);
  return pc;
}

// ------------------------------------------------------------------ items

export function itemFrames(): Record<string, PixelCanvas> {
  const shake = art(
    [
      "...KKKKKK...",
      "..KMMMMMmK..",
      "..KMmMMMmK..",
      ".KKKKKKKKKK.",
      ".KWWWWWWwsK.",
      ".KWhWWWWwsK.",
      ".KWhMMMMwsK.",
      ".KWhMWWMwsK.",
      ".KWhMMMMwsK.",
      ".KWhMWWWwsK.",
      ".KWhMWWWwsK.",
      ".KWWWWWWwsK.",
      ".KWhWWWWwsK.",
      "..KWWWWwsK..",
      "...KKKKKK...",
    ],
    { K, M: PAL.magenta, m: PAL.magentaDark, W: 0xf6f3ec, w: 0xd9d4ca, h: 0xffffff, s: 0xa8a2b4 },
  );
  const burger = art(
    [
      "....KKKKKK....",
      "..KKBBBBBBKK..",
      ".KBBhBBBBhBBK.",
      "KBBBBBBhBBBBbK",
      "KbBBBBBBBBBbbK",
      "KGGgGGGgGGgGGK",
      "KYYYYYYYYYYYYK",
      "KMMMMMMMMMMMMK",
      "KmmmmmmmmmmmmK",
      ".KBBBBBBBBBbK.",
      "..KKKKKKKKKK..",
    ],
    { K, B: 0xe8a050, b: 0xb06a28, h: 0xfff0c0, G: PAL.green, g: PAL.greenDark, Y: PAL.yellow, M: 0x7a3a22, m: 0x4e2414 },
  );
  const cash = art(
    [
      "KKKKKKKKKKKKKK",
      "KGGGGGgYYgGGGK",
      "KGgggGgYYgGggK",
      "KGg$gGgYYgGg$K",
      "KGgggGgYYgGggK",
      "KGGGGGgYYgGGGK",
      "KKKKKKKKKKKKKK",
      "KgggggggggggggK",
      ".KKKKKKKKKKKKK",
    ].map((r) => r.slice(0, 14)),
    { K, G: 0x7ccf6a, g: 0x3f8f4a, Y: PAL.yellow, $: 0x1f5a2a },
  );
  const watch = art(
    [
      "....KKKK....",
      "....KYYK....",
      "...KKKKKK...",
      "..KYYYYYYK..",
      ".KYWWWWWWYK.",
      ".KYWWKWWWYK.",
      ".KYWWKKKWYK.",
      ".KYWWWWWWYK.",
      "..KYYYYYYK..",
      "...KKKKKK...",
      "....KYYK....",
      "....KKKK....",
    ],
    { K, Y: PAL.yellow, W: 0xf6f3ec },
  );
  const gem = art(
    [
      "...KKKKKK...",
      "..KhCCcCCK..",
      ".KhhCCcCCcK.",
      "KKKKKKKKKKKK",
      ".KCChCCcCCK.",
      "..KCChCcCK..",
      "...KCCcCK...",
      "....KCcK....",
      ".....KK.....",
    ],
    { K, C: 0x5ad8ff, c: 0x2a8ad0, h: 0xffffff },
  );
  return { burger, shake, cash, watch, gem };
}

// ------------------------------------------------------------------ destructible props (frame 0 intact, 1 damaged)

function trashCan(damaged: boolean): PixelCanvas {
  const l = new Layer(22, 30, 11, 29);
  const metal: Ramp = [0xe4e8ee, 0xb8bec8, 0x868d9c, 0x4e5464];
  l.cap([0, -4], [0, -20], 8.5, 8.5, metal);
  for (let y = -18; y <= -5; y += 4) l.line([-8, y], [8, y], metal[3]);
  const lid = new Layer(22, 30, 11, 29);
  lid.ell(0, -23, 10, 3.2, metal, 0.1);
  lid.rect(-2, -27, 5, 2, metal[2]);
  if (damaged) {
    l.ell(-3, -12, 3, 2.5, metal, -0.4);
    l.line([2, -16], [5, -10], K);
    lid.ell(3, -24, 4, 2, metal, -0.3);
  }
  // garbage peeking
  const g = new Layer(22, 30, 11, 29);
  g.ell(-4, -26, 3, 2, rampOf(0x6fa04a), 0);
  g.ell(4, -25, 2.5, 1.8, rampOf(0xe0d080), 0);
  return compose(22, 30, [g, l, lid]);
}

function crate(damaged: boolean): PixelCanvas {
  const l = new Layer(26, 26, 13, 25);
  const wood: Ramp = [0xf0c27a, 0xd49a54, 0xa86e34, 0x6e4420];
  l.poly([[-11, -22], [11, -22], [11, 0], [-11, 0]], wood);
  const pc = compose(26, 26, [l]);
  const dark = wood[3];
  pc.strokeRect(4, 5, 18, 18, dark);
  pc.line(4, 5, 21, 22, dark, 2);
  if (!damaged) pc.line(21, 5, 4, 22, dark, 2);
  for (const y of [9, 14, 19]) pc.line(5, y, 20, y, mix(wood[2], dark, 0.3));
  if (damaged) {
    pc.line(8, 3, 12, 12, K);
    pc.line(12, 12, 10, 18, K);
    pc.line(18, 20, 22, 14, K);
    pc.rect(14, 8, 3, 2, K);
  }
  for (const [x, y] of [
    [5, 6],
    [20, 6],
    [5, 21],
    [20, 21],
  ])
    pc.set(x, y, 0xd8dce6);
  return pc;
}

function drum(damaged: boolean): PixelCanvas {
  const l = new Layer(22, 30, 11, 29);
  const red: Ramp = [0xff9a8a, 0xe85a4a, 0xb02a2a, 0x681418];
  l.cap([0, -4], [0, -21], 8.5, 8.5, red);
  const top = new Layer(22, 30, 11, 29);
  top.ell(0, -24, 8.5, 2.6, [0x9a9aa8, 0x7a7a88, 0x5a5a68, 0x3a3a48]);
  const pc = compose(22, 30, [l, top]);
  for (const y of [11, 20]) pc.line(3, y, 18, y, 0x681418);
  // hazard sign
  pc.draw(["..Y..", ".YKY.", "YYKYY", "YYYYY"], { Y: PAL.yellow, K }, 8, 13);
  if (damaged) {
    pc.line(5, 8, 9, 14, K);
    pc.line(15, 22, 18, 17, K);
    pc.ellipse(14, 9, 2, 1.5, 0x681418);
  }
  return pc;
}

function booth(damaged: boolean): PixelCanvas {
  const W = 30;
  const H = 62;
  const l = new Layer(W, H, 15, 61);
  const body: Ramp = [0x8ab0ff, 0x4f7ad8, 0x2f4f9f, 0x1a2c60];
  l.poly([[-12, -58], [12, -58], [12, 0], [-12, 0]], body);
  const pc = compose(W, H, [l]);
  // sign
  pc.rect(5, 5, 20, 7, 0xf6f3ec);
  pc.draw(["KKK.K.K.KKK.K..K.KKK", "K.K.KKK.K.K.KK.K.KK.", "K...K.K.KKK.K.KK.KKK"], { K: 0x2f4f9f }, 5, 7);
  // glass panes
  const glass = 0x9fd8e8;
  for (let i = 0; i < 2; i++) {
    const x = 6 + i * 10;
    pc.rect(x, 15, 8, 36, glass);
    pc.line(x + 1, 17, x + 4, 14 + 6, 0xe8fbff);
    pc.line(x + 1, 30, x + 6, 25, 0xe8fbff);
    pc.strokeRect(x - 1, 14, 10, 38, 0x1a2c60);
  }
  // phone silhouette
  pc.rect(9, 28, 4, 7, 0x2a2a33);
  pc.rect(10, 26, 2, 2, 0x2a2a33);
  if (damaged) {
    pc.line(7, 18, 13, 30, K);
    pc.line(13, 30, 9, 40, K);
    pc.line(18, 20, 24, 34, K);
    pc.line(24, 34, 19, 46, K);
    pc.rect(16, 36, 3, 3, PAL.navyDark);
  }
  pc.rect(3, 58, 24, 3, 0x1a2c60);
  return pc;
}

function vending(damaged: boolean): PixelCanvas {
  const W = 30;
  const H = 52;
  const l = new Layer(W, H, 15, 51);
  const body: Ramp = [0xff9cc4, 0xf0609a, 0xd02a6b, 0x7e1240];
  l.poly([[-13, -49], [13, -49], [13, 0], [-13, 0]], body);
  const pc = compose(W, H, [l]);
  // glowing window with cans
  pc.rect(4, 5, 15, 30, 0x2a1830);
  const cols = [PAL.red, PAL.blue, PAL.yellow, PAL.green, 0xf6f3ec];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) {
      const x = 5 + c * 5;
      const y = 7 + r * 7;
      pc.rect(x, y, 3, 5, cols[(r * 3 + c) % cols.length]);
      pc.set(x, y, 0xffffff);
    }
  pc.rect(4, 37, 15, 5, 0x1a1214);
  // buttons + coin slot
  for (let i = 0; i < 5; i++) pc.rect(21, 6 + i * 5, 4, 3, i % 2 ? PAL.yellow : 0xf6f3ec);
  pc.rect(22, 33, 2, 5, K);
  pc.draw(["W.W.WWW.WWW.WWW", "WWW.W.W.W.W.WWW"], { W: 0xffffff }, 5, 45 - 2);
  if (damaged) {
    pc.line(6, 8, 12, 20, 0xd8f0ff);
    pc.line(12, 20, 8, 30, 0xd8f0ff);
    pc.line(14, 12, 18, 26, 0xd8f0ff);
    pc.rect(20, 14, 6, 2, K);
  }
  return pc;
}

export function propFrames(): Record<string, PixelCanvas[]> {
  return {
    can: [trashCan(false), trashCan(true)],
    crate: [crate(false), crate(true)],
    drum: [drum(false), drum(true)],
    booth: [booth(false), booth(true)],
    vending: [vending(false), vending(true)],
  };
}

/** debris chunks: 0 lid, 1 metal shard, 2 plank, 3 splinter, 4 glass, 5 banana, 6 paper, 7 soda can */
export function debrisFrames(): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  const mk = (rows: string[], pal: Record<string, number>) => {
    const pc = new PixelCanvas(12, 12);
    pc.draw(rows, pal, Math.floor((12 - rows[0].length) / 2), Math.floor((12 - rows.length) / 2));
    return pc;
  };
  out.push(mk(["..KKKKK..", ".KhhMMMK.", "KMMMMMMMK", ".KKKKKKK."], { K, h: 0xe4e8ee, M: 0x868d9c }));
  out.push(mk(["KKK...", "KhMK..", ".KMMK.", "..KMMK", "...KK."], { K, h: 0xe4e8ee, M: 0x868d9c }));
  out.push(mk(["KKKKKKKKKK", "KWWwWWWWwK", "KwwwwwwwwK", "KKKKKKKKKK"], { K, W: 0xd49a54, w: 0xa86e34 }));
  out.push(mk(["KK....", "KWK...", ".KWK..", "..KwK.", "...KK."], { K, W: 0xd49a54, w: 0xa86e34 }));
  out.push(mk([".K.", "KhK", "KGK", "KGK", ".K."], { K: 0x5a8aa0, h: 0xffffff, G: 0xbfeaf8 }));
  out.push(mk(["....KK", "...KYK", "..KYYK", "KKYYK.", "KYYK..", ".KK..."], { K, Y: PAL.yellow }));
  out.push(mk(["KKKKK", "KWWwK", "KWwWK", "KKKKK"], { K, W: 0xf6f3ec, w: 0xbab4a8 }));
  out.push(mk([".KKK.", "KRRhK", "KRWRK", "KRRRK", ".KKK."], { K, R: PAL.red, W: 0xffffff, h: 0xff9a9a }));
  return out;
}

// ------------------------------------------------------------------ hazards

export function carFrames(): PixelCanvas[] {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 2; f++) {
    const W = 112;
    const H = 46;
    const body = new Layer(W, H, 56, 44);
    const paint: Ramp = [0xffe08a, 0xffc93f, 0xe09a10, 0x8a5a08];
    // lower body + cabin (car faces left: front at negative x)
    body.poly(
      [
        [-52, -20],
        [-48, -26],
        [-28, -28],
        [-16, -40],
        [18, -40],
        [30, -28],
        [50, -26],
        [53, -18],
        [52, -9],
        [-52, -9],
      ],
      paint,
    );
    const wheels = new Layer(W, H, 56, 44);
    const tyre: Ramp = [0x6a6a78, 0x45454f, 0x2a2a33, 0x16161c];
    for (const wx of [-33, 33]) {
      wheels.ell(wx, -9, 9, 9, tyre);
      wheels.ell(wx, -9, 4.5, 4.5, [0xffffff, 0xd8dce6, 0x9aa0ae, 0x5a6070]);
    }
    const pc = compose(W, H, [body, wheels]);
    // windows
    pc.poly(
      [
        [43, 15],
        [53, 6],
        [71, 6],
        [71, 15],
      ],
      0x6ab0d0,
    );
    pc.poly(
      [
        [74, 6],
        [86, 6],
        [97, 15],
        [74, 15],
      ],
      0x6ab0d0,
    );
    pc.line(45, 14, 53, 7, 0xd8f4ff);
    pc.line(76, 13, 82, 7, 0xd8f4ff);
    // racing stripe, headlight, door line
    pc.rect(4, 24, 104, 2, PAL.ink);
    pc.rect(4, 22, 104, 2, 0xf6f3ec);
    pc.rect(4, 19, 5, 3, 0xffffe0);
    pc.rect(104, 19, 4, 3, PAL.red);
    pc.line(72, 16, 72, 33, paint[3]);
    // wheel spokes rotate
    for (const wx of [23, 89]) {
      const a = f * (Math.PI / 4);
      for (let i = 0; i < 2; i++) {
        const ang = a + i * (Math.PI / 2);
        pc.line(wx + Math.cos(ang) * 4, 35 + Math.sin(ang) * 4, wx - Math.cos(ang) * 4, 35 - Math.sin(ang) * 4, 0x5a6070);
      }
    }
    frames.push(pc);
  }
  return frames;
}

/** rolling wooden barrel, 4 frames */
export function barrelFrames(): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const l = new Layer(22, 22, 11, 21);
    const wood: Ramp = [0xe8b070, 0xc8843c, 0x96582a, 0x5a3014];
    l.ell(0, -10, 9.5, 9.5, wood);
    const pc = compose(22, 22, [l]);
    const a = (f / 4) * Math.PI;
    for (let i = 0; i < 3; i++) {
      const ang = a + (i * Math.PI) / 3;
      const dx = Math.cos(ang) * 8;
      const dy = Math.sin(ang) * 8;
      pc.line(11 - dx, 11 - dy, 11 + dx, 11 + dy, i === 0 ? 0x3a3a48 : 0x5a3014);
    }
    pc.ring(11, 11, 6, 6, 0x5a3014, 1);
    pc.circle(11, 11, 2, 0x3a3a48);
    out.push(pc);
  }
  return out;
}

export function potFrame(): PixelCanvas {
  return art(
    [
      "..R..r..R..",
      ".RrR.RrRrR.",
      "..RgR.gRR..",
      "...gGgGg...",
      "KKKKKKKKKKK",
      "KTTTTTTTttK",
      ".KTTTTTTtK.",
      ".KThTTTTtK.",
      "..KTTTTtK..",
      "..KTTTTtK..",
      "...KKKKK...",
    ],
    { K, R: PAL.red, r: PAL.magentaLight, g: PAL.greenDark, G: PAL.green, T: 0xd8783c, t: 0xa04c20, h: 0xf0a070 },
  );
}

export function bagFrame(): PixelCanvas {
  return art(
    [
      "....KKK....",
      "...KYyK....",
      "..KKKKKK...",
      ".KBBBBBBK..",
      "KBBbYYbBBK.",
      "KBBYbBBBBK.",
      "KBBbYYbBBK.",
      "KBBBBbYBBK.",
      "KBBbYYbBBK.",
      ".KBBBBBBK..",
      "..KKKKKK...",
    ],
    { K, Y: PAL.yellow, y: PAL.yellowDark, B: 0xc9a062, b: 0x8b6a3a },
  );
}

// ------------------------------------------------------------------ effects

export function shadowCanvas(rx: number, ry: number): PixelCanvas {
  const pc = new PixelCanvas(rx * 2 + 2, ry * 2 + 2);
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const nx = (x + 0.5 - (rx + 1)) / rx;
      const ny = (y + 0.5 - (ry + 1)) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) pc.set(x, y, 0x0a0812, d < 0.55 ? 130 : 90);
    }
  return pc;
}

/** impact spark burst: 4 frames */
export function sparkFrames(big: boolean): PixelCanvas[] {
  const S = big ? 36 : 26;
  const c = S / 2;
  const out: PixelCanvas[] = [];
  const r = rng(big ? 7 : 3);
  const rays = Array.from({ length: big ? 10 : 8 }, (_, i) => ({
    a: (i / (big ? 10 : 8)) * Math.PI * 2 + r() * 0.4,
    l: 0.6 + r() * 0.4,
  }));
  for (let f = 0; f < 4; f++) {
    const pc = new PixelCanvas(S, S);
    const t = (f + 1) / 4;
    const R = (S / 2 - 1) * (0.45 + t * 0.55);
    for (const ray of rays) {
      const len = R * ray.l;
      const inner = f >= 2 ? len * 0.5 : 0;
      const x0 = c + Math.cos(ray.a) * inner;
      const y0 = c + Math.sin(ray.a) * inner;
      const x1 = c + Math.cos(ray.a) * len;
      const y1 = c + Math.sin(ray.a) * len;
      pc.line(x0, y0, x1, y1, f < 2 ? PAL.yellow : PAL.orange, f === 0 && big ? 2 : 1);
    }
    if (f < 2) {
      pc.circle(c, c, (big ? 7 : 5) * (1 - f * 0.3), PAL.yellow);
      pc.circle(c, c, (big ? 5 : 3.5) * (1 - f * 0.3), 0xffffff);
    } else if (f === 2) {
      pc.ring(c, c, R * 0.55, R * 0.55, 0xffffff, 1);
    }
    out.push(pc);
  }
  return out;
}

/** dust puff: 4 frames 18x14 */
export function dustFrames(): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const l = new Layer(20, 16, 10, 15);
    const k = 1 + f * 0.35;
    const col: Ramp = [0xf4ecdc, 0xd8ccb4, 0xb0a28a, 0x7a6e5c];
    if (f < 3) {
      l.ell(-4 * k, -4 - f, 3.5 * (1 - f * 0.15), 3 * (1 - f * 0.15), col);
      l.ell(4 * k, -4 - f, 3.2 * (1 - f * 0.15), 2.8 * (1 - f * 0.15), col);
      l.ell(0, -6 - f, 4 * (1 - f * 0.2), 3.5 * (1 - f * 0.2), col);
    } else {
      l.ell(-6, -6, 1.5, 1.5, col);
      l.ell(6, -7, 1.5, 1.5, col);
      l.ell(0, -9, 1.5, 1.5, col);
    }
    const pc = compose(20, 16, [l], 0x5a4e3c);
    out.push(pc);
  }
  return out;
}

/** sparkle twinkle: 4 frames 11x11 */
export function sparkleFrames(): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  const sizes = [2, 4, 5, 3];
  sizes.forEach((s, i) => {
    const pc = new PixelCanvas(11, 11);
    pc.line(5, 5 - s, 5, 5 + s, i === 2 ? 0xffffff : PAL.yellow);
    pc.line(5 - s, 5, 5 + s, 5, i === 2 ? 0xffffff : PAL.yellow);
    if (s > 3) {
      pc.set(4, 4, PAL.yellow);
      pc.set(6, 4, PAL.yellow);
      pc.set(4, 6, PAL.yellow);
      pc.set(6, 6, PAL.yellow);
    }
    pc.set(5, 5, 0xffffff);
    out.push(pc);
  });
  return out;
}

/** shockwave ring frame (ellipse squash 0.36) */
export function ringFrame(r: number, inner: number, outer: number, squash = 0.36): PixelCanvas {
  const ry = Math.max(3, r * squash);
  const pc = new PixelCanvas(Math.ceil(r * 2 + 6), Math.ceil(ry * 2 + 6));
  const cx = pc.w / 2;
  const cy = pc.h / 2;
  pc.ring(cx, cy, r + 1, ry + 1, mul(outer, 0.55), 1);
  pc.ring(cx, cy, r, ry, outer, 2);
  pc.ring(cx, cy, r - 2, Math.max(1, ry - 2), inner, 1);
  const rr = rng(Math.round(r));
  for (let i = 0; i < r / 4; i++) {
    const a = rr() * Math.PI * 2;
    pc.set(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (ry + 2), inner);
  }
  return pc;
}

export function warnFrame(): PixelCanvas {
  return art(
    [
      "......KK......",
      ".....KYYK.....",
      ".....KYYK.....",
      "....KYYYYK....",
      "....KYKKYK....",
      "...KYYKKYYK...",
      "...KYYKKYYK...",
      "..KYYYKKYYYK..",
      "..KYYYYYYYYK..",
      ".KYYYYKKYYYYK.",
      ".KYYYYKKYYYYK.",
      "KYYYYYYYYYYYYK",
      "KKKKKKKKKKKKKK",
    ],
    { K, Y: PAL.yellow },
  );
}

export function goFrame(): PixelCanvas {
  const rows = [
    ".KKKKKK...KKKKKK.....KK......",
    "KWWWWWWK.KWWWWWWK....KWK.....",
    "KWWKKKKK.KWWKKWWK....KWWK....",
    "KWWK.....KWWK.KWWKKKKKWWWK...",
    "KWWK.KKK.KWWK.KWWWWWWWWWWWK..",
    "KWWK.KWWKKWWK.KWWWWWWWWWWWWK.",
    "KWWK..KWKKWWK.KWWWWWWWWWWWK..",
    "KWWKKKKWKKWWKKKWWKKKKKWWWK...",
    "KWWWWWWWK.KWWWWWWK...KWWK....",
    ".KKKKKKK...KKKKKK....KWK.....",
    ".....................KK......",
  ];
  return art(rows, { K, W: PAL.yellow });
}

export function targetFrame(): PixelCanvas {
  const pc = new PixelCanvas(24, 10);
  pc.ring(12, 5, 11, 4.5, PAL.red, 1);
  pc.ring(12, 5, 6, 2.5, PAL.red, 1);
  pc.line(12, 0, 12, 9, PAL.red);
  return pc;
}

// ------------------------------------------------------------------ HUD

export function hudPanel(): PixelCanvas {
  const pc = new PixelCanvas(320, 36);
  pc.fill(PAL.navyDark);
  for (let x = 0; x < 320; x += 2) pc.set(x, 1, PAL.navy);
  pc.rect(0, 33, 320, 1, PAL.magenta);
  pc.rect(0, 34, 320, 1, PAL.magentaDark);
  pc.rect(0, 35, 320, 1, K);
  // portrait frame
  pc.rect(3, 3, 26, 26, K);
  pc.rect(4, 4, 24, 24, PAL.magenta);
  pc.rect(5, 5, 22, 22, 0x2a3a7a);
  return pc;
}

export function barFrame(w: number, h: number): PixelCanvas {
  const pc = new PixelCanvas(w + 4, h + 4);
  pc.rect(0, 0, w + 4, h + 4, K);
  pc.rect(1, 1, w + 2, h + 2, PAL.offwhite);
  pc.rect(2, 2, w, h, 0x2a1a24);
  return pc;
}

export function barFill(w: number, h: number, base: number): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  const r = rampOf(base);
  pc.rect(0, 0, w, h, r[2]);
  pc.rect(0, 0, w, 1, r[0]);
  if (h > 3) pc.rect(0, 1, w, 1, r[1]);
  pc.rect(0, h - 1, w, 1, r[3]);
  for (let x = 7; x < w; x += 8) pc.rect(x, 0, 1, h, mix(r[2], K, 0.35));
  return pc;
}

export function lifeIcon(): PixelCanvas {
  return art(
    [
      "..KKKKK...",
      ".KCCCcCK..",
      "KCCCCCCCKK",
      "KDDDDDDDDK",
      "KKKKKKKKKK",
      "KHSSSSSSK.",
      "KsSKSSKSK.",
      "KSSSSSSSK.",
      ".KSKKKSK..",
      "..KKKKK...",
    ],
    { K, C: 0x2f2f3a, D: 0x1d1d25, c: PAL.capPatch, H: PAL.hair, S: PAL.skin, s: PAL.skinShade },
  );
}
