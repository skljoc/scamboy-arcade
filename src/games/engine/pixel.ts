/**
 * Tiny programmatic pixel-art toolkit.
 *
 * All SCAMBOY sprites are drawn at runtime into PixelCanvas buffers (1 unit = 1 game pixel)
 * and registered as Phaser textures / sprite sheets. To replace art later, swap the
 * draw functions for loaded PNG sprite sheets with the same keys & frame layout.
 */
import type * as PhaserNS from "phaser";

/** 0xRRGGBB colour */
export type Color = number;

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  /** RGBA stored as 0xAABBGGRR (little-endian ImageData layout); 0 = transparent */
  readonly buf: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint32Array(w * h);
  }

  private static pack(c: Color, a = 255) {
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  private static unpack(v: number): Color {
    const r = v & 255;
    const g = (v >> 8) & 255;
    const b = (v >> 16) & 255;
    return (r << 16) | (g << 8) | b;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: Color, alpha = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return this;
    this.buf[y * this.w + x] = PixelCanvas.pack(c, alpha);
    return this;
  }

  /** returns colour or null when transparent */
  get(x: number, y: number): Color | null {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return null;
    const v = this.buf[y * this.w + x];
    if (v >>> 24 === 0) return null;
    return PixelCanvas.unpack(v);
  }

  isOpaque(x: number, y: number) {
    if (!this.inBounds(x, y)) return false;
    return this.buf[y * this.w + x] >>> 24 !== 0;
  }

  clear(x: number, y: number) {
    if (this.inBounds(x, y)) this.buf[y * this.w + x] = 0;
    return this;
  }

  fill(c: Color) {
    this.buf.fill(PixelCanvas.pack(c));
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    const v = PixelCanvas.pack(c);
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * this.w;
      for (let xx = x0; xx < x1; xx++) this.buf[row + xx] = v;
    }
    return this;
  }

  /** outlined rectangle (1px border) */
  strokeRect(x: number, y: number, w: number, h: number, c: Color) {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Color) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    return this.rect(x0, y, x1 - x0 + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: Color) {
    if (y1 < y0) [y0, y1] = [y1, y0];
    return this.rect(x, y0, 1, y1 - y0 + 1, c);
  }

  /** Bresenham line, optional thickness (square brush) */
  line(x0: number, y0: number, x1: number, y1: number, c: Color, thickness = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((thickness - 1) / 2);
    for (;;) {
      if (thickness <= 1) this.set(x0, y0, c);
      else this.rect(x0 - off, y0 - off, thickness, thickness, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** filled ellipse centred at cx,cy (accepts .5 centres for even sizes) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color) {
    if (rx <= 0 || ry <= 0) return this;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, c: Color) {
    return this.ellipse(cx, cy, r, r, c);
  }

  /** ring / ellipse outline of thickness t */
  ring(cx: number, cy: number, rx: number, ry: number, c: Color, t = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        const nx2 = (x + 0.5 - cx) / Math.max(0.1, rx - t);
        const ny2 = (y + 0.5 - cy) / Math.max(0.1, ry - t);
        if (d <= 1 && nx2 * nx2 + ny2 * ny2 > 1) this.set(x, y, c);
      }
    }
    return this;
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: Color) {
    r = Math.min(r, Math.floor(w / 2), Math.floor(h / 2));
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        let inside = true;
        const cxs = xx < r ? r - 0.5 : xx >= w - r ? w - r - 0.5 : -1;
        const cys = yy < r ? r - 0.5 : yy >= h - r ? h - r - 0.5 : -1;
        if (cxs >= 0 && cys >= 0) {
          const dx = xx - cxs;
          const dy = yy - cys;
          inside = dx * dx + dy * dy <= r * r;
        }
        if (inside) this.set(x + xx, y + yy, c);
      }
    }
    return this;
  }

  /** filled polygon (even-odd scanline) */
  poly(points: Array<[number, number]>, c: Color) {
    if (points.length < 3) return this;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, py] of points) {
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
          xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  /**
   * Draw ASCII-art rows. Each char maps through `palette`; '.' or ' ' (or unmapped) = skip.
   */
  draw(rows: string[], palette: Record<string, Color>, dx = 0, dy = 0, flipX = false) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const col = palette[ch];
        if (col === undefined) continue;
        const px = flipX ? dx + (row.length - 1 - x) : dx + x;
        this.set(px, dy + y, col);
      }
    }
    return this;
  }

  /** copy opaque pixels of src onto this canvas */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false, flipY = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.buf[y * src.w + x];
        if (v >>> 24 === 0) continue;
        const tx = dx + (flipX ? src.w - 1 - x : x);
        const ty = dy + (flipY ? src.h - 1 - y : y);
        if (this.inBounds(tx, ty)) this.buf[ty * this.w + tx] = v;
      }
    }
    return this;
  }

  /** returns a copy */
  clone() {
    const c = new PixelCanvas(this.w, this.h);
    c.buf.set(this.buf);
    return c;
  }

  /** horizontally mirrored copy */
  flipped() {
    const c = new PixelCanvas(this.w, this.h);
    c.blit(this, 0, 0, true);
    return c;
  }

  /** Adds a 1px outline around every opaque region. */
  outline(c: Color, diagonals = false) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.isOpaque(x, y)) continue;
        const n =
          this.isOpaque(x - 1, y) ||
          this.isOpaque(x + 1, y) ||
          this.isOpaque(x, y - 1) ||
          this.isOpaque(x, y + 1) ||
          (diagonals &&
            (this.isOpaque(x - 1, y - 1) ||
              this.isOpaque(x + 1, y - 1) ||
              this.isOpaque(x - 1, y + 1) ||
              this.isOpaque(x + 1, y + 1)));
        if (n) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    return this;
  }

  /** replace every pixel of colour `from` with `to` */
  replace(from: Color, to: Color) {
    const f = PixelCanvas.pack(from);
    const t = PixelCanvas.pack(to);
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] === f) this.buf[i] = t;
    return this;
  }

  /** multiply every opaque pixel's rgb by k (0..2) — handy for shading variants */
  tint(k: number) {
    for (let i = 0; i < this.buf.length; i++) {
      const v = this.buf[i];
      if (v >>> 24 === 0) continue;
      const c = PixelCanvas.unpack(v);
      const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
      const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
      const b = Math.min(255, Math.round((c & 255) * k));
      this.buf[i] = PixelCanvas.pack((r << 16) | (g << 8) | b, v >>> 24);
    }
    return this;
  }

  /** fill every opaque pixel with a single colour (silhouette / flash frames) */
  silhouette(c: Color) {
    const p = PixelCanvas.pack(c);
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] >>> 24 !== 0) this.buf[i] = p;
    return this;
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.buf);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}

/** Seeded PRNG (mulberry32) so procedural art is stable between runs. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Register a single image texture. No-op if the key exists. */
export function registerTexture(scene: PhaserNS.Scene, key: string, pc: PixelCanvas) {
  if (scene.textures.exists(key)) return;
  scene.textures.addCanvas(key, pc.toCanvas());
}

/**
 * Register frames as a sprite sheet texture with numeric frame names 0..n-1,
 * compatible with scene.anims.generateFrameNumbers(key, ...).
 */
export function registerSheet(
  scene: PhaserNS.Scene,
  key: string,
  frames: PixelCanvas[],
  frameW?: number,
  frameH?: number,
) {
  if (scene.textures.exists(key) || frames.length === 0) return;
  const fw = frameW ?? frames[0].w;
  const fh = frameH ?? frames[0].h;
  const cols = Math.min(frames.length, Math.max(1, Math.floor(2048 / fw)));
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelCanvas(cols * fw, rows * fh);
  frames.forEach((f, i) => sheet.blit(f, (i % cols) * fw, Math.floor(i / cols) * fh));
  const tex = scene.textures.addCanvas(key, sheet.toCanvas());
  if (!tex) return;
  frames.forEach((_, i) => tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
}

/** Convenience: create an animation from frame indices if it doesn't exist yet. */
export function registerAnim(
  scene: PhaserNS.Scene,
  key: string,
  texture: string,
  frames: number[],
  frameRate = 10,
  repeat = -1,
) {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: frames.map((f) => ({ key: texture, frame: f })),
    frameRate,
    repeat,
  });
}
