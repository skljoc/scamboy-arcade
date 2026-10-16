/**
 * Track builder — turns a TrackDef (centreline + shortcuts + zones) into the
 * runtime data used by physics, AI, lap logic and the art renderer.
 * Phaser-free so it can be verified headlessly.
 */
import { CELL, IS_DRIVE, IS_FALL, IS_SOLID, SPEED_MUL, T, type TerrainId, type Theme } from "./terrain";
import {
  catmull,
  hash2,
  nearestIndex,
  pointInPoly,
  resample,
  rotatePath,
  roundCorners,
  segDist2,
  valueNoise,
  type P,
  type Path,
  type Rect,
} from "./geom";
import { rng } from "../engine/pixel";

export type CoverStyle = "roof" | "rock" | "canopy" | "garden";

export interface ShortcutDef {
  id: string;
  name: string;
  hidden: boolean;
  pts: P[];
  /** corner radius for rounding (default) or smooth catmull-rom spline */
  round?: number;
  smooth?: boolean;
  width: number;
  surface: TerrainId;
  cover?: { rects: Rect[]; style: CoverStyle };
  /** per-rival chance per lap to take this route */
  ai: [number, number, number];
  /** AI should go flat out + boost here (ramp jumps) */
  launch?: boolean;
}

export type PropKind =
  | "building"
  | "tree"
  | "palm"
  | "cactus"
  | "boulder"
  | "parked"
  | "dumpster"
  | "barrier"
  | "mansion"
  | "excavator"
  | "fountain"
  | "bush"
  | "flag"
  | "sign"
  | "pipes"
  | "statue"
  | "kiosk";

export interface Prop {
  kind: PropKind;
  /** centre for round props, top-left for rect props */
  x: number;
  y: number;
  w: number;
  h: number;
  round: boolean;
  solid: boolean;
  /** 0 = horizontal, 1 = vertical, or angle in radians for parked cars */
  rot: number;
  color: number;
  seed: number;
  /** extra style flags (e.g. building roof style, mansion pool side) */
  style: number;
}

export type Zone =
  | { k: "rect"; t: TerrainId; r: Rect; force?: boolean; onlyOff?: boolean }
  | { k: "circle"; t: TerrainId; x: number; y: number; r: number; force?: boolean; onlyOff?: boolean }
  | { k: "poly"; t: TerrainId; pts: P[]; force?: boolean; onlyOff?: boolean }
  | { k: "prop"; p: Partial<Prop> & { kind: PropKind; x: number; y: number } }
  | { k: "cone"; x: number; y: number }
  | { k: "nofill"; r: Rect }
  | { k: "decal"; kind: DecalKind; x: number; y: number; a?: number; w?: number; h?: number };

export type DecalKind = "tyres" | "crack" | "puddle" | "arrow" | "chevron" | "trash" | "skid" | "manhole" | "sign";

export interface TrackDef {
  name: string;
  short: string;
  theme: Theme;
  size: number;
  roadWidth: number;
  main: P[];
  /** rectilinear rounding radius, or smooth spline when undefined */
  round?: number;
  start: P;
  shortcuts: ShortcutDef[];
  zones: Zone[];
  offSpeed: number;
  seed: number;
  laps: number;
}

export interface ShortcutData {
  def: ShortcutDef;
  index: number;
  path: Path;
  sEntry: number;
  sExit: number;
  span: number;
  entryIdx: number;
  exitIdx: number;
  /** arc length along the spine where it leaves / re-joins the main road */
  aOut: number;
  aIn: number;
}

export interface TrackData {
  def: TrackDef;
  w: number;
  h: number;
  gw: number;
  gh: number;
  grid: Uint8Array;
  /** shortcut core id (index + 1) */
  sc: Uint8Array;
  /** hidden cover id (index into covers + 1) */
  cover: Uint8Array;
  covers: Array<{ r: Rect; style: CoverStyle; sc: number }>;
  /** distance (px) to main centreline for cells near it */
  roadD: Float32Array;
  /** main arc length near road (for art stripes) */
  mainS: Float32Array;
  /** 4px progress grid */
  pw: number;
  ph: number;
  prog: Float32Array;
  main: Path;
  L: number;
  shortcuts: ShortcutData[];
  props: Prop[];
  cones: Array<{ x: number; y: number }>;
  decals: Array<{ kind: DecalKind; x: number; y: number; a: number; w: number; h: number }>;
  checkpoints: number[];
  startSlots: Array<{ x: number; y: number; a: number }>;
}

const PCELL = 4;
const PROG_R = 120;

function stampPath(
  path: Path,
  radius: number,
  gw: number,
  gh: number,
  cell: number,
  cb: (ci: number, d: number, s: number) => void,
) {
  const segs = path.closed ? path.n : path.n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % path.n;
    const ax = path.x[i];
    const ay = path.y[i];
    const bx = path.x[j];
    const by = path.y[j];
    const segLen = Math.hypot(bx - ax, by - ay);
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - radius) / cell));
    const x1 = Math.min(gw - 1, Math.floor((Math.max(ax, bx) + radius) / cell));
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - radius) / cell));
    const y1 = Math.min(gh - 1, Math.floor((Math.max(ay, by) + radius) / cell));
    const r2 = radius * radius;
    for (let cy = y0; cy <= y1; cy++) {
      const py = (cy + 0.5) * cell;
      for (let cx = x0; cx <= x1; cx++) {
        const px = (cx + 0.5) * cell;
        const { d2, t } = segDist2(px, py, ax, ay, bx, by);
        if (d2 > r2) continue;
        cb(cy * gw + cx, Math.sqrt(d2), path.s[i] + t * segLen);
      }
    }
  }
}

function buildPath(pts: P[], closed: boolean, round: number | undefined, smooth: boolean | undefined): Path {
  let poly: P[];
  if (smooth) poly = catmull(pts, closed, 16);
  else if (round !== undefined && round > 0) poly = roundCorners(pts, round, closed);
  else poly = pts;
  return resample(poly, 4, closed);
}

/** Lightweight route geometry (no grids) for previews / mini-maps. */
export function routePaths(def: TrackDef): { main: Path; spines: Path[] } {
  return {
    main: buildPath(def.main, true, def.round, def.round === undefined),
    spines: def.shortcuts.map((sd) => buildPath(sd.pts, false, sd.round ?? 10, sd.smooth)),
  };
}

/** Chamfer distance transform (in px) from all cells where `src` is true. */
function distanceField(gw: number, gh: number, src: (i: number) => boolean): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(gw * gh);
  for (let i = 0; i < d.length; i++) d[i] = src(i) ? 0 : INF;
  const a = CELL;
  const b = CELL * Math.SQRT2;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a);
      if (y > 0) {
        v = Math.min(v, d[i - gw] + a);
        if (x > 0) v = Math.min(v, d[i - gw - 1] + b);
        if (x < gw - 1) v = Math.min(v, d[i - gw + 1] + b);
      }
      d[i] = v;
    }
  }
  for (let y = gh - 1; y >= 0; y--) {
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x;
      let v = d[i];
      if (x < gw - 1) v = Math.min(v, d[i + 1] + a);
      if (y < gh - 1) {
        v = Math.min(v, d[i + gw] + a);
        if (x < gw - 1) v = Math.min(v, d[i + gw + 1] + b);
        if (x > 0) v = Math.min(v, d[i + gw - 1] + b);
      }
      d[i] = v;
    }
  }
  return d;
}

function makeProp(p: Partial<Prop> & { kind: PropKind; x: number; y: number }, seed: number): Prop {
  const defaults: Record<PropKind, { w: number; h: number; round: boolean; solid: boolean }> = {
    building: { w: 48, h: 48, round: false, solid: true },
    tree: { w: 14, h: 14, round: true, solid: true },
    palm: { w: 8, h: 8, round: true, solid: true },
    cactus: { w: 8, h: 8, round: true, solid: true },
    boulder: { w: 14, h: 14, round: true, solid: true },
    parked: { w: 12, h: 20, round: false, solid: true },
    dumpster: { w: 18, h: 10, round: false, solid: true },
    barrier: { w: 24, h: 6, round: false, solid: true },
    mansion: { w: 120, h: 100, round: false, solid: true },
    excavator: { w: 30, h: 22, round: false, solid: true },
    fountain: { w: 40, h: 40, round: true, solid: true },
    bush: { w: 8, h: 8, round: true, solid: false },
    flag: { w: 6, h: 6, round: true, solid: false },
    sign: { w: 6, h: 6, round: true, solid: true },
    pipes: { w: 40, h: 14, round: false, solid: true },
    statue: { w: 14, h: 14, round: true, solid: true },
    kiosk: { w: 20, h: 14, round: false, solid: true },
  };
  const d = defaults[p.kind];
  return {
    kind: p.kind,
    x: p.x,
    y: p.y,
    w: p.w ?? d.w,
    h: p.h ?? d.h,
    round: p.round ?? d.round,
    solid: p.solid ?? d.solid,
    rot: p.rot ?? 0,
    color: p.color ?? 0,
    seed: p.seed ?? seed,
    style: p.style ?? 0,
  };
}

/** collision radius of round props is a bit smaller than their art */
function propFootprint(p: Prop, cb: (x0: number, y0: number, x1: number, y1: number, circle: boolean) => void) {
  if (p.round) {
    const r = p.kind === "tree" ? p.w * 0.3 : p.kind === "palm" ? 3 : p.w * 0.45;
    cb(p.x - r, p.y - r, p.x + r, p.y + r, true);
  } else if (p.kind === "parked") {
    // rotated parked car: approximate with axis box of rotated rect
    const c = Math.abs(Math.cos(p.rot));
    const s = Math.abs(Math.sin(p.rot));
    const hw = (p.h * c + p.w * s) / 2 - 1;
    const hh = (p.h * s + p.w * c) / 2 - 1;
    cb(p.x - hw, p.y - hh, p.x + hw, p.y + hh, false);
  } else cb(p.x, p.y, p.x + p.w, p.y + p.h, false);
}

export function buildTrack(def: TrackDef): TrackData {
  const W = def.size;
  const H = def.size;
  const gw = W / CELL;
  const gh = H / CELL;
  const N = gw * gh;
  const grid = new Uint8Array(N);
  const sc = new Uint8Array(N);
  const cover = new Uint8Array(N);
  const roadD = new Float32Array(N).fill(1e9);
  const mainS = new Float32Array(N);
  const reserved = new Uint8Array(N); // nofill
  const R = rng(def.seed);
  const halfW = def.roadWidth / 2;

  // ---------------------------------------------------------------- main loop
  let main = buildPath(def.main, true, def.round, def.round === undefined);
  main = rotatePath(main, nearestIndex(main, def.start[0], def.start[1]));
  const L = main.len;
  stampPath(main, halfW + 18, gw, gh, CELL, (ci, d, s) => {
    if (d < roadD[ci]) {
      roadD[ci] = d;
      mainS[ci] = s;
    }
  });
  for (let i = 0; i < N; i++) if (roadD[i] <= halfW) grid[i] = T.ROAD;

  // ---------------------------------------------------------------- shortcuts
  const shortcuts: ShortcutData[] = [];
  const scD = new Float32Array(N).fill(1e9);
  const scA = new Float32Array(N); // arc length along shortcut
  const scOwner = new Uint8Array(N);
  def.shortcuts.forEach((sd, k) => {
    const path = buildPath(sd.pts, false, sd.round ?? 10, sd.smooth);
    // where does the spine leave / re-join the main road?
    const onMain = (i: number) => {
      const cx = Math.floor(path.x[i] / CELL);
      const cy = Math.floor(path.y[i] / CELL);
      return roadD[cy * gw + cx] <= halfW;
    };
    let iOut = 0;
    while (iOut < path.n - 1 && onMain(iOut + 1)) iOut++;
    let iIn = path.n - 1;
    while (iIn > 0 && onMain(iIn - 1)) iIn--;
    if (iIn <= iOut) {
      iOut = 0;
      iIn = path.n - 1;
    }
    const entryIdx = nearestIndex(main, path.x[iOut], path.y[iOut]);
    const exitIdx = nearestIndex(main, path.x[iIn], path.y[iIn]);
    const sEntry = main.s[entryIdx];
    const sExit = main.s[exitIdx];
    const span = (sExit - sEntry + L) % L;
    shortcuts.push({
      def: sd,
      index: k,
      path,
      sEntry,
      sExit,
      span,
      entryIdx,
      exitIdx,
      aOut: path.s[iOut],
      aIn: path.s[iIn],
    });
    const hw = sd.width / 2;
    stampPath(path, hw + 10, gw, gh, CELL, (ci, d, a) => {
      if (d < scD[ci]) {
        scD[ci] = d;
        scA[ci] = a;
        scOwner[ci] = k + 1;
      }
      if (d <= hw) {
        if (grid[ci] !== T.ROAD) grid[ci] = sd.surface;
        // core region: away from the mouths so brushing the entrance doesn't count
        const f = a / path.len;
        if (f > 0.18 && f < 0.82 && roadD[ci] > halfW + 4) sc[ci] = k + 1;
      }
    });
  });

  // ---------------------------------------------------------------- zones
  const props: Prop[] = [];
  const cones: Array<{ x: number; y: number }> = [];
  const decals: TrackData["decals"] = [];
  const paint = (ci: number, t: TerrainId, force?: boolean, onlyOff?: boolean) => {
    if (onlyOff && grid[ci] !== T.OFF) return;
    if (!force && (grid[ci] === T.ROAD || grid[ci] === T.CURB) && roadD[ci] <= halfW) return;
    grid[ci] = t;
  };
  for (const z of def.zones) {
    if (z.k === "rect") {
      const x0 = Math.max(0, Math.floor(z.r.x / CELL));
      const y0 = Math.max(0, Math.floor(z.r.y / CELL));
      const x1 = Math.min(gw, Math.ceil((z.r.x + z.r.w) / CELL));
      const y1 = Math.min(gh, Math.ceil((z.r.y + z.r.h) / CELL));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) paint(y * gw + x, z.t, z.force, z.onlyOff);
    } else if (z.k === "circle") {
      const x0 = Math.max(0, Math.floor((z.x - z.r) / CELL));
      const y0 = Math.max(0, Math.floor((z.y - z.r) / CELL));
      const x1 = Math.min(gw - 1, Math.ceil((z.x + z.r) / CELL));
      const y1 = Math.min(gh - 1, Math.ceil((z.y + z.r) / CELL));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const px = (x + 0.5) * CELL - z.x;
          const py = (y + 0.5) * CELL - z.y;
          if (px * px + py * py <= z.r * z.r) paint(y * gw + x, z.t, z.force, z.onlyOff);
        }
    } else if (z.k === "poly") {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of z.pts) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      for (let y = Math.max(0, Math.floor(minY / CELL)); y <= Math.min(gh - 1, Math.ceil(maxY / CELL)); y++)
        for (let x = Math.max(0, Math.floor(minX / CELL)); x <= Math.min(gw - 1, Math.ceil(maxX / CELL)); x++)
          if (pointInPoly((x + 0.5) * CELL, (y + 0.5) * CELL, z.pts)) paint(y * gw + x, z.t, z.force, z.onlyOff);
    } else if (z.k === "prop") {
      props.push(makeProp(z.p, Math.floor(R() * 1e6)));
    } else if (z.k === "cone") {
      cones.push({ x: z.x, y: z.y });
    } else if (z.k === "nofill") {
      const x0 = Math.max(0, Math.floor(z.r.x / CELL));
      const y0 = Math.max(0, Math.floor(z.r.y / CELL));
      const x1 = Math.min(gw, Math.ceil((z.r.x + z.r.w) / CELL));
      const y1 = Math.min(gh, Math.ceil((z.r.y + z.r.h) / CELL));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) reserved[y * gw + x] = 1;
    } else if (z.k === "decal") {
      decals.push({ kind: z.kind, x: z.x, y: z.y, a: z.a ?? 0, w: z.w ?? 16, h: z.h ?? 16 });
    }
  }

  // ---------------------------------------------------------------- curbs on main road edges
  for (let i = 0; i < N; i++) {
    if (grid[i] === T.ROAD && roadD[i] > halfW - 4 && roadD[i] <= halfW) grid[i] = T.CURB;
  }
  // re-open curbs where a shortcut leaves the road (so the mouth reads as an opening)
  for (let i = 0; i < N; i++) {
    const o = scOwner[i];
    if (grid[i] === T.CURB && o > 0 && scD[i] <= def.shortcuts[o - 1].width / 2) grid[i] = T.ROAD;
  }

  // ---------------------------------------------------------------- explicit props → solid
  const stampProp = (p: Prop) => {
    if (!p.solid) return;
    propFootprint(p, (x0, y0, x1, y1, circle) => {
      const cx0 = Math.max(0, Math.floor(x0 / CELL));
      const cy0 = Math.max(0, Math.floor(y0 / CELL));
      const cx1 = Math.min(gw - 1, Math.floor((x1 - 0.01) / CELL));
      const cy1 = Math.min(gh - 1, Math.floor((y1 - 0.01) / CELL));
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const r = (x1 - x0) / 2;
      for (let y = cy0; y <= cy1; y++)
        for (let x = cx0; x <= cx1; x++) {
          if (circle) {
            const dx = (x + 0.5) * CELL - mx;
            const dy = (y + 0.5) * CELL - my;
            if (dx * dx + dy * dy > r * r) continue;
          }
          grid[y * gw + x] = T.WALL;
        }
    });
  };
  props.forEach(stampProp);

  // ---------------------------------------------------------------- theme autofill
  const dist = distanceField(gw, gh, (i) => (grid[i] !== T.OFF && grid[i] !== T.WALL) || reserved[i] === 1);
  const before = props.length;
  autofill(def, grid, dist, reserved, gw, gh, props, R, main, halfW);
  for (let i = before; i < props.length; i++) stampProp(props[i]);

  // ---------------------------------------------------------------- hidden covers
  const covers: TrackData["covers"] = [];
  shortcuts.forEach((s) => {
    const cv = s.def.cover;
    if (!cv) return;
    for (const r of cv.rects) {
      covers.push({ r, style: cv.style, sc: s.index + 1 });
      const id = covers.length;
      for (let y = Math.floor(r.y / CELL); y < Math.ceil((r.y + r.h) / CELL); y++)
        for (let x = Math.floor(r.x / CELL); x < Math.ceil((r.x + r.w) / CELL); x++) {
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          cover[y * gw + x] = id;
        }
    }
  });

  // ---------------------------------------------------------------- progress grid (4px)
  const pw = W / PCELL;
  const ph = H / PCELL;
  const prog = new Float32Array(pw * ph).fill(-1);
  const progD = new Float32Array(pw * ph).fill(1e9);
  stampPath(main, PROG_R, pw, ph, PCELL, (ci, d, s) => {
    if (d < progD[ci]) {
      progD[ci] = d;
      prog[ci] = s % L;
    }
  });
  const mainProgD = progD.slice();
  for (const s of shortcuts) {
    const hw = s.def.width / 2 + 14;
    const aLen = Math.max(1, s.aIn - s.aOut);
    stampPath(s.path, hw, pw, ph, PCELL, (ci, d, a) => {
      // cells on the main road keep main-road progress
      if (mainProgD[ci] <= halfW + 2) return;
      if (d < progD[ci] && d < mainProgD[ci] - 2) {
        progD[ci] = d;
        const f = Math.min(1, Math.max(0, (a - s.aOut) / aLen));
        prog[ci] = (s.sEntry + f * s.span) % L;
      }
    });
  }

  // ---------------------------------------------------------------- checkpoints & grid
  const NCP = 10;
  const checkpoints: number[] = [];
  for (let i = 0; i < NCP; i++) checkpoints.push((L * i) / NCP);
  const startSlots: TrackData["startSlots"] = [];
  for (let k = 0; k < 4; k++) {
    const back = 30 + Math.floor(k / 2) * 34 + (k % 2) * 12;
    const i = pathIndexAtS(main, L - back);
    const tx = main.tx[i];
    const ty = main.ty[i];
    const side = k % 2 === 0 ? -1 : 1;
    startSlots.push({
      x: main.x[i] - ty * side * 12,
      y: main.y[i] + tx * side * 12,
      a: Math.atan2(ty, tx),
    });
  }

  return {
    def,
    w: W,
    h: H,
    gw,
    gh,
    grid,
    sc,
    cover,
    covers,
    roadD,
    mainS,
    pw,
    ph,
    prog,
    main,
    L,
    shortcuts,
    props,
    cones,
    decals,
    checkpoints,
    startSlots,
  };
}

// ======================================================================= autofill

const ROOF_COLORS = [0x8a8d99, 0xa8483c, 0x6d7d8c, 0xb59b74, 0x5f6f62, 0x7a6a8a, 0x9a8a72, 0x4f6f8f];

function autofill(
  def: TrackDef,
  grid: Uint8Array,
  dist: Float32Array,
  reserved: Uint8Array,
  gw: number,
  gh: number,
  props: Prop[],
  R: () => number,
  main: Path,
  halfW: number,
) {
  const seed = def.seed;
  if (def.theme === "city" || def.theme === "lux") {
    const margin = def.theme === "city" ? 14 : 22;
    const B = 8; // block px
    const bc = B / CELL;
    const bw = Math.floor(def.size / B);
    const bh = Math.floor(def.size / B);
    const free = new Uint8Array(bw * bh);
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        let ok = 1;
        for (let y = by * bc; y < (by + 1) * bc && ok; y++)
          for (let x = bx * bc; x < (bx + 1) * bc; x++) {
            const i = y * gw + x;
            if (dist[i] < margin || reserved[i] || grid[i] !== T.OFF) {
              ok = 0;
              break;
            }
          }
        free[by * bw + bx] = ok;
      }
    const used = new Uint8Array(bw * bh);
    const minB = def.theme === "city" ? 4 : 9;
    const maxB = def.theme === "city" ? 13 : 20;
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        const i0 = by * bw + bx;
        if (!free[i0] || used[i0]) continue;
        const tw = minB + Math.floor(R() * (maxB - minB + 1));
        const th = minB + Math.floor(R() * (maxB - minB + 1));
        // grow width
        let w = 0;
        while (w < tw && bx + w < bw && free[by * bw + bx + w] && !used[by * bw + bx + w]) w++;
        let h = 0;
        outer: while (h < th && by + h < bh) {
          for (let x = bx; x < bx + w; x++) if (!free[(by + h) * bw + x] || used[(by + h) * bw + x]) break outer;
          h++;
        }
        const minAccept = def.theme === "city" ? 3 : 6;
        if (w < minAccept || h < minAccept) {
          if (w > 0 && h > 0)
            for (let y = by; y < by + h; y++)
              for (let x = bx; x < bx + w; x++) {
                used[y * bw + x] = 1;
                // luxury estates: leftover pockets become walled gardens (no lawn cut-throughs)
                if (def.theme === "lux")
                  for (let cy = y * bc; cy < (y + 1) * bc; cy++)
                    for (let cx = x * bc; cx < (x + 1) * bc; cx++) grid[cy * gw + cx] = T.WALL;
              }
          continue;
        }
        // leave a trailing 1-block gap sometimes (narrow service gaps between buildings)
        const gapR = def.theme === "city" && R() < 0.35 && w > 5 ? 1 : 0;
        const gapB = def.theme === "city" && R() < 0.35 && h > 5 ? 1 : 0;
        for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) used[y * bw + x] = 1;
        const px = bx * B;
        const py = by * B;
        const pwid = (w - gapR) * B;
        const phei = (h - gapB) * B;
        if (def.theme === "city") {
          const park = w >= 7 && h >= 7 && R() < 0.18;
          if (park) {
            for (let y = py / CELL; y < (py + phei) / CELL; y++)
              for (let x = px / CELL; x < (px + pwid) / CELL; x++) grid[y * gw + x] = T.GRASS;
            const nt = Math.floor((pwid * phei) / 900) + 2;
            for (let t = 0; t < nt; t++) {
              props.push(
                makeProp(
                  {
                    kind: "tree",
                    x: px + 10 + R() * (pwid - 20),
                    y: py + 10 + R() * (phei - 20),
                    w: 14 + Math.floor(R() * 6),
                  },
                  Math.floor(R() * 1e6),
                ),
              );
            }
          } else {
            props.push(
              makeProp(
                {
                  kind: "building",
                  x: px,
                  y: py,
                  w: pwid,
                  h: phei,
                  color: ROOF_COLORS[Math.floor(R() * ROOF_COLORS.length)],
                  style: Math.floor(R() * 4),
                },
                Math.floor(R() * 1e6),
              ),
            );
          }
        } else {
          props.push(
            makeProp(
              { kind: "mansion", x: px, y: py, w: pwid, h: phei, style: Math.floor(R() * 4), color: Math.floor(R() * 4) },
              Math.floor(R() * 1e6),
            ),
          );
        }
      }
    if (def.theme === "lux") {
      // palms lining the boulevard
      const step = 72;
      for (let s = 20; s < main.len; s += step) {
        const i = Math.min(main.n - 1, Math.round((s / main.len) * main.n));
        for (const side of [-1, 1]) {
          const x = main.x[i] - main.ty[i] * side * (halfW + 11);
          const y = main.y[i] + main.tx[i] * side * (halfW + 11);
          if (!clearOfDrive(grid, gw, gh, x, y, 9)) continue;
          props.push(makeProp({ kind: "palm", x, y }, Math.floor(R() * 1e6)));
        }
      }
    } else {
      // street lamps / kiosks are decorative only (drawn by art); add a few trees on sidewalks
      const step = 140;
      for (let s = 60; s < main.len; s += step) {
        const i = Math.min(main.n - 1, Math.round((s / main.len) * main.n));
        const side = hash2(i, 3, seed) < 0.5 ? -1 : 1;
        const x = main.x[i] - main.ty[i] * side * (halfW + 8);
        const y = main.y[i] + main.tx[i] * side * (halfW + 8);
        if (!clearOfDrive(grid, gw, gh, x, y, 7)) continue;
        props.push(makeProp({ kind: "tree", x, y, w: 12 }, Math.floor(R() * 1e6)));
      }
    }
  } else {
    // desert: rock fields far from the road, cacti & boulders in the sand
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        if (grid[i] !== T.OFF || reserved[i]) continue;
        const n = valueNoise(x * CELL, y * CELL, 90, seed) * 0.75 + valueNoise(x * CELL, y * CELL, 18, seed + 7) * 0.25;
        const margin = 30 + (1 - n) * (1 - n) * 260;
        if (dist[i] >= margin) grid[i] = T.WALL;
      }
    const tries = Math.floor((def.size * def.size) / 2600);
    for (let t = 0; t < tries; t++) {
      const x = 8 + R() * (def.size - 16);
      const y = 8 + R() * (def.size - 16);
      const ci = Math.floor(y / CELL) * gw + Math.floor(x / CELL);
      if (grid[ci] !== T.OFF || reserved[ci]) continue;
      const d = dist[ci];
      if (d < 14) continue;
      const roll = R();
      if (roll < 0.35) {
        if (!clearOfDrive(grid, gw, gh, x, y, 12)) continue;
        props.push(makeProp({ kind: "cactus", x, y, w: 8 + Math.floor(R() * 4) }, Math.floor(R() * 1e6)));
      } else if (roll < 0.55) {
        if (!clearOfDrive(grid, gw, gh, x, y, 14)) continue;
        props.push(makeProp({ kind: "boulder", x, y, w: 10 + Math.floor(R() * 8) }, Math.floor(R() * 1e6)));
      } else {
        props.push(makeProp({ kind: "bush", x, y, w: 6 + Math.floor(R() * 4) }, Math.floor(R() * 1e6)));
      }
    }
  }
}

function clearOfDrive(grid: Uint8Array, gw: number, gh: number, x: number, y: number, r: number) {
  const cx0 = Math.max(0, Math.floor((x - r) / CELL));
  const cy0 = Math.max(0, Math.floor((y - r) / CELL));
  const cx1 = Math.min(gw - 1, Math.floor((x + r) / CELL));
  const cy1 = Math.min(gh - 1, Math.floor((y + r) / CELL));
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const t = grid[cy * gw + cx];
      if (IS_DRIVE[t] || IS_FALL[t] || t === T.WALL) return false;
    }
  return true;
}

// ======================================================================= queries

export function cellAt(td: TrackData, x: number, y: number): number {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= td.gw || cy >= td.gh) return T.WALL;
  return td.grid[cy * td.gw + cx];
}

export function solidAt(td: TrackData, x: number, y: number) {
  return IS_SOLID[cellAt(td, x, y)] === 1;
}

export function idxAt(td: TrackData, x: number, y: number) {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= td.gw || cy >= td.gh) return -1;
  return cy * td.gw + cx;
}

export function progressAt(td: TrackData, x: number, y: number): number {
  const cx = Math.floor(x / PCELL);
  const cy = Math.floor(y / PCELL);
  if (cx < 0 || cy < 0 || cx >= td.pw || cy >= td.ph) return -1;
  return td.prog[cy * td.pw + cx];
}

export function speedMul(td: TrackData, t: number) {
  return t === T.OFF ? td.def.offSpeed : SPEED_MUL[t];
}

/** sample index of a path at arc length s (wraps for closed paths) */
export function pathIndexAtS(m: Path, s: number) {
  const ss = m.closed ? ((s % m.len) + m.len) % m.len : s;
  let lo = 0;
  let hi = m.n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m.s[mid] <= ss) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** world position + heading of main centreline at arc length s */
export function pointAtS(td: TrackData, s: number) {
  const m = td.main;
  const i = pathIndexAtS(m, s);
  return { x: m.x[i], y: m.y[i], a: Math.atan2(m.ty[i], m.tx[i]), i };
}
