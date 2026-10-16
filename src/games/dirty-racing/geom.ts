/**
 * Small Phaser-free geometry toolkit used by the track builder, the AI and the
 * headless verification scripts.
 */
export type P = [number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A dense, evenly resampled polyline with cumulative arc length and tangents. */
export interface Path {
  n: number;
  x: Float32Array;
  y: Float32Array;
  /** cumulative arc length at each sample */
  s: Float32Array;
  /** unit tangent */
  tx: Float32Array;
  ty: Float32Array;
  len: number;
  closed: boolean;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** wrap angle to [-PI, PI] */
export function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** squared distance from p to segment ab, plus the segment parameter t */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return { d2: cx * cx + cy * cy, t };
}

/**
 * Replace every interior corner of a polyline by a circular arc of radius r
 * (clamped to half the adjacent segment lengths). Great for 90° city streets.
 */
export function roundCorners(pts: P[], r: number, closed: boolean): P[] {
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    if (!closed && (i === 0 || i === n - 1)) {
      out.push([cur[0], cur[1]]);
      continue;
    }
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const ax = prev[0] - cur[0];
    const ay = prev[1] - cur[1];
    const bx = next[0] - cur[0];
    const by = next[1] - cur[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    const ux = ax / la;
    const uy = ay / la;
    const vx = bx / lb;
    const vy = by / lb;
    const cos = clamp(ux * vx + uy * vy, -1, 1);
    const ang = Math.acos(cos); // interior angle
    if (ang > Math.PI - 0.02) {
      out.push([cur[0], cur[1]]);
      continue;
    }
    const tanHalf = Math.tan(ang / 2);
    let d = r / tanHalf; // distance from corner to tangent points
    d = Math.min(d, la * 0.5, lb * 0.5);
    const rr = d * tanHalf;
    const p1: P = [cur[0] + ux * d, cur[1] + uy * d];
    const p2: P = [cur[0] + vx * d, cur[1] + vy * d];
    // centre along bisector
    let bxs = ux + vx;
    let bys = uy + vy;
    const bl = Math.hypot(bxs, bys);
    bxs /= bl;
    bys /= bl;
    const cd = rr / Math.sin(ang / 2);
    const cx = cur[0] + bxs * cd;
    const cy = cur[1] + bys * cd;
    let a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
    const a2 = Math.atan2(p2[1] - cy, p2[0] - cx);
    let da = wrapAngle(a2 - a1);
    const steps = Math.max(2, Math.ceil(Math.abs(da) * rr / 4));
    da /= steps;
    for (let k = 0; k <= steps; k++) {
      out.push([cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr]);
      a1 += da;
    }
  }
  return out;
}

/** Centripetal-ish Catmull-Rom smoothing (uniform parameterisation is fine here). */
export function catmull(pts: P[], closed: boolean, perSeg = 12): P[] {
  const out: P[] = [];
  const n = pts.length;
  const get = (i: number): P => {
    if (closed) return pts[((i % n) + n) % n];
    return pts[clamp(i, 0, n - 1)];
  };
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

/** Resample a polyline at a fixed spacing. */
export function resample(pts: P[], spacing: number, closed: boolean): Path {
  const src = closed ? [...pts, pts[0]] : pts;
  // cumulative length
  const cum: number[] = [0];
  for (let i = 1; i < src.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const count = closed ? Math.max(3, Math.round(total / spacing)) : Math.max(2, Math.round(total / spacing) + 1);
  const step = closed ? total / count : total / (count - 1);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const ss = new Float32Array(count);
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const d = Math.min(total, i * step);
    while (seg < src.length - 2 && cum[seg + 1] < d) seg++;
    const l = cum[seg + 1] - cum[seg];
    const t = l > 0 ? (d - cum[seg]) / l : 0;
    xs[i] = lerp(src[seg][0], src[seg + 1][0], t);
    ys[i] = lerp(src[seg][1], src[seg + 1][1], t);
    ss[i] = d;
  }
  return finishPath(xs, ys, closed);
}

export function finishPath(xs: Float32Array, ys: Float32Array, closed: boolean): Path {
  const n = xs.length;
  const s = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  const len = closed ? s[n - 1] + Math.hypot(xs[0] - xs[n - 1], ys[0] - ys[n - 1]) : s[n - 1];
  const tx = new Float32Array(n);
  const ty = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const b = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    const dx = xs[b] - xs[a];
    const dy = ys[b] - ys[a];
    const l = Math.hypot(dx, dy) || 1;
    tx[i] = dx / l;
    ty[i] = dy / l;
  }
  return { n, x: xs, y: ys, s, tx, ty, len, closed };
}

/** Rotate a closed path so sample `k` becomes index 0 (arc lengths recomputed). */
export function rotatePath(p: Path, k: number): Path {
  const xs = new Float32Array(p.n);
  const ys = new Float32Array(p.n);
  for (let i = 0; i < p.n; i++) {
    xs[i] = p.x[(i + k) % p.n];
    ys[i] = p.y[(i + k) % p.n];
  }
  return finishPath(xs, ys, true);
}

/** Index of the path sample nearest to (x, y) (brute force). */
export function nearestIndex(p: Path, x: number, y: number) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < p.n; i++) {
    const d = (p.x[i] - x) ** 2 + (p.y[i] - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Index of nearest sample searching only near `from` (wraps for closed paths). */
export function nearestLocal(p: Path, x: number, y: number, from: number, back: number, fwd: number) {
  let best = from;
  let bd = Infinity;
  for (let o = -back; o <= fwd; o++) {
    let i = from + o;
    if (p.closed) i = ((i % p.n) + p.n) % p.n;
    else if (i < 0 || i >= p.n) continue;
    const d = (p.x[i] - x) ** 2 + (p.y[i] - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Simple value-noise for terrain detail (deterministic, seeded). */
export function hash2(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function valueNoise(x: number, y: number, scale: number, seed: number) {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export function pointInPoly(x: number, y: number, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
