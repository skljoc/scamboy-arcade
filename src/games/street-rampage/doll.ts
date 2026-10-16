/**
 * Paper-doll pixel painter for STREET RAMPAGE.
 *
 * Characters are assembled from shaded primitives (capsules / ellipses / polys) drawn on
 * separate layers. Each layer gets its own 1px ink outline before being composited, which
 * gives the classic 16-bit look with readable limb separation. Shading uses a fake 3D
 * normal per primitive and a fixed light from the upper-left-front, producing a 4-tone ramp.
 *
 * Pure module (no Phaser) so it can be rendered offline for inspection.
 */
import { PixelCanvas, type Color } from "../engine/pixel";
import { PAL } from "../engine/palette";

/** highlight, light, base, shadow */
export type Ramp = readonly [Color, Color, Color, Color];
export type P = readonly [number, number];

export const INK = PAL.ink;

const LX = -0.48;
const LY = -0.62;
const LZ = 0.62;

export function mul(c: Color, k: number): Color {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: Color, b: Color, t: number): Color {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

/** darker version of a ramp, used for limbs on the far side of the body */
export function dim(r: Ramp, k = 0.82): Ramp {
  return [mul(r[0], k), mul(r[1], k), mul(r[2], k), mul(r[3], k)];
}

/** build a 4-tone ramp from a base colour */
export function rampOf(base: Color, hi?: Color): Ramp {
  return [hi ?? mix(base, 0xffffff, 0.55), mix(base, 0xffffff, 0.22), base, mix(mul(base, 0.6), 0x2a1640, 0.25)];
}

function tone(nx: number, ny: number, bias: number): number {
  const nz2 = 1 - nx * nx - ny * ny;
  const nz = nz2 > 0 ? Math.sqrt(nz2) : 0;
  const d = nx * LX + ny * LY + nz * LZ + bias;
  return d > 0.9 ? 0 : d > 0.58 ? 1 : d > 0.18 ? 2 : 3;
}

/**
 * A drawing layer. Coordinates are relative to the anchor (ax, ay) which is the ground
 * point under the character.
 */
export class Layer {
  readonly pc: PixelCanvas;
  outlined = true;
  constructor(
    w: number,
    h: number,
    readonly ax: number,
    readonly ay: number,
  ) {
    this.pc = new PixelCanvas(w, h);
  }

  px(x: number, y: number, c: Color) {
    this.pc.set(Math.floor(this.ax + x), Math.floor(this.ay + y), c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color) {
    this.pc.rect(Math.floor(this.ax + x), Math.floor(this.ay + y), w, h, c);
    return this;
  }

  line(a: P, b: P, c: Color, t = 1) {
    this.pc.line(this.ax + a[0], this.ay + a[1], this.ax + b[0], this.ay + b[1], c, t);
    return this;
  }

  /** shaded ellipse */
  ell(cx: number, cy: number, rx: number, ry: number, r: Ramp, bias = 0) {
    if (rx <= 0.3 || ry <= 0.3) return this;
    const X = this.ax + cx;
    const Y = this.ay + cy;
    for (let y = Math.floor(Y - ry - 1); y <= Math.ceil(Y + ry + 1); y++) {
      for (let x = Math.floor(X - rx - 1); x <= Math.ceil(X + rx + 1); x++) {
        const nx = (x + 0.5 - X) / rx;
        const ny = (y + 0.5 - Y) / ry;
        if (nx * nx + ny * ny > 1) continue;
        this.pc.set(x, y, r[tone(nx, ny, bias)]);
      }
    }
    return this;
  }

  /** flat ellipse */
  fell(cx: number, cy: number, rx: number, ry: number, c: Color) {
    this.pc.ellipse(this.ax + cx, this.ay + cy, rx, ry, c);
    return this;
  }

  /** tapered capsule from a (radius ra) to b (radius rb), shaded as a cylinder */
  cap(a: P, b: P, ra: number, rb: number, r: Ramp, bias = 0) {
    const ax = this.ax + a[0];
    const ay = this.ay + a[1];
    const bx = this.ax + b[0];
    const by = this.ay + b[1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 0.0001;
    const rm = Math.max(ra, rb) + 1;
    const x0 = Math.floor(Math.min(ax, bx) - rm);
    const x1 = Math.ceil(Math.max(ax, bx) + rm);
    const y0 = Math.floor(Math.min(ay, by) - rm);
    const y1 = Math.ceil(Math.max(ay, by) + rm);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + dx * t;
        const cy = ay + dy * t;
        const rr = ra + (rb - ra) * t;
        const ox = px - cx;
        const oy = py - cy;
        const d2 = ox * ox + oy * oy;
        if (d2 > rr * rr) continue;
        this.pc.set(x, y, r[tone(ox / rr, oy / rr, bias)]);
      }
    }
    return this;
  }

  /** polygon with rim shading (light upper-left edge, dark lower-right edge) */
  poly(points: P[], r: Ramp, rim = 1) {
    const tmp = new PixelCanvas(this.pc.w, this.pc.h);
    tmp.poly(
      points.map(([x, y]) => [this.ax + x, this.ay + y] as [number, number]),
      0xffffff,
    );
    for (let y = 0; y < tmp.h; y++) {
      for (let x = 0; x < tmp.w; x++) {
        if (!tmp.isOpaque(x, y)) continue;
        let c = r[2];
        const lightEdge = !tmp.isOpaque(x - 1, y) || !tmp.isOpaque(x, y - 1);
        let darkEdge = false;
        for (let k = 1; k <= rim + 1; k++) {
          if (!tmp.isOpaque(x + k, y) || !tmp.isOpaque(x, y + k)) darkEdge = true;
        }
        if (lightEdge) c = r[1];
        else if (darkEdge) c = r[3];
        this.pc.set(x, y, c);
      }
    }
    return this;
  }

  /** ascii art with palette, top-left at (x, y) */
  art(rows: string[], pal: Record<string, Color>, x: number, y: number, flip = false) {
    this.pc.draw(rows, pal, Math.round(this.ax + x), Math.round(this.ay + y), flip);
    return this;
  }
}

/** Composite layers back-to-front, outlining each one. */
export function compose(w: number, h: number, layers: Layer[], ink: Color = INK): PixelCanvas {
  const out = new PixelCanvas(w, h);
  for (const l of layers) {
    if (l.outlined) l.pc.outline(ink);
    out.blit(l.pc, 0, 0);
  }
  return out;
}

// ------------------------------------------------------------------ vector helpers

export const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
export const scl = (a: P, k: number): P => [a[0] * k, a[1] * k];
export const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const len = (a: P) => Math.hypot(a[0], a[1]);
export const norm = (a: P): P => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** perpendicular (rotated 90° clockwise in screen space: up -> right) */
export const perp = (a: P): P => [-a[1], a[0]];

/** two-bone IK: returns the middle joint. side=+1 bends to the right of a->c direction. */
export function ik(a: P, c: P, l1: number, l2: number, side: 1 | -1): P {
  const d0 = sub(c, a);
  let d = len(d0);
  d = Math.max(0.001, Math.min(d, l1 + l2 - 0.01));
  const u = norm(d0);
  const k = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - k * k));
  const p = add(a, scl(u, k));
  const pp: P = [-u[1], u[0]];
  return add(p, scl(pp, -h * side));
}

/** rotate ascii rows 90° counter-clockwise (top -> left) */
export function rotCCW(rows: string[]): string[] {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const out: string[] = [];
  for (let ny = 0; ny < w; ny++) {
    let s = "";
    for (let nx = 0; nx < h; nx++) s += rows[nx][w - 1 - ny] ?? ".";
    out.push(s);
  }
  return out;
}

/** rotate ascii rows 90° clockwise (top -> right) */
export function rotCW(rows: string[]): string[] {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const out: string[] = [];
  for (let ny = 0; ny < w; ny++) {
    let s = "";
    for (let nx = 0; nx < h; nx++) s += rows[h - 1 - nx][ny] ?? ".";
    out.push(s);
  }
  return out;
}

/** scale ascii rows by an integer factor */
export function scaleRows(rows: string[], k: number): string[] {
  const out: string[] = [];
  for (const r of rows) {
    let s = "";
    for (const ch of r) s += ch.repeat(k);
    for (let i = 0; i < k; i++) out.push(s);
  }
  return out;
}
