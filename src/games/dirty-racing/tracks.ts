/**
 * The three DIRTY RACING tracks. Pure data — see Track.ts for how it is built.
 * Coordinates are world pixels. Main loops run clockwise on screen.
 */
import { T } from "./terrain";
import type { TrackDef, Zone } from "./Track";
import type { P, Rect } from "./geom";

// ------------------------------------------------------------------ helpers
const cones = (pts: Array<[number, number]>): Zone[] => pts.map(([x, y]) => ({ k: "cone", x, y }));

/** uniformly scale a track layout (positions and areas; prop sizes stay) */
function scaleDef(d: TrackDef, k: number): TrackDef {
  const sp = (p: P): P => [Math.round(p[0] * k), Math.round(p[1] * k)];
  const sr = (r: Rect): Rect => ({ x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) });
  const zone = (z: Zone): Zone => {
    switch (z.k) {
      case "rect":
      case "nofill":
        return { ...z, r: sr(z.r) };
      case "circle":
        return { ...z, x: z.x * k, y: z.y * k, r: z.r * k };
      case "poly":
        return { ...z, pts: z.pts.map(sp) };
      case "prop":
        return { ...z, p: { ...z.p, x: Math.round(z.p.x * k), y: Math.round(z.p.y * k) } };
      default:
        return { ...z, x: Math.round(z.x * k), y: Math.round(z.y * k) };
    }
  };
  return {
    ...d,
    size: Math.round((d.size * k) / 16) * 16,
    start: sp(d.start),
    main: d.main.map(sp),
    shortcuts: d.shortcuts.map((s) => ({
      ...s,
      pts: s.pts.map(sp),
      cover: s.cover && { ...s.cover, rects: s.cover.rects.map(sr) },
    })),
    zones: d.zones.map(zone),
  };
}

// =================================================================== 1. SCAM CITY
const scamCity: TrackDef = {
  name: "SCAM CITY",
  short: "CITY",
  theme: "city",
  size: 1216,
  roadWidth: 56,
  round: 36,
  laps: 3,
  seed: 1101,
  offSpeed: 0.7,
  start: [150, 780],
  main: [
    [150, 1050],
    [150, 150],
    [520, 150],
    [520, 420],
    [760, 420],
    [760, 150],
    [1060, 150],
    [1060, 1050],
    [830, 1050],
    [830, 720],
    [560, 720],
    [560, 1050],
  ],
  shortcuts: [
    {
      id: "alley",
      name: "BACK ALLEY",
      hidden: true,
      pts: [
        [520, 226],
        [520, 262],
        [544, 282],
        [736, 282],
        [760, 260],
        [760, 230],
      ],
      round: 18,
      width: 28,
      surface: T.ALLEY,
      cover: { rects: [{ x: 566, y: 252, w: 148, h: 58 }], style: "roof" },
      ai: [0, 0.1, 0.25],
    },
    {
      id: "lot",
      name: "PARKING LOT",
      hidden: false,
      pts: [
        [760, 376],
        [1060, 376],
      ],
      width: 40,
      surface: T.LOT,
      ai: [0.2, 0.35, 0.25],
    },
    {
      id: "canal",
      name: "CANAL JUMP",
      hidden: false,
      pts: [
        [930, 1050],
        [470, 1050],
      ],
      width: 44,
      surface: T.ROAD,
      ai: [0, 0.2, 0.3],
      launch: true,
    },
  ],
  zones: [
    // ---- parking lot
    { k: "rect", t: T.LOT, r: { x: 800, y: 300, w: 220, h: 150 } },
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap((i): Zone[] => {
      const x = 812 + i * 17;
      const out: Zone[] = [];
      const col = [0xe63946, 0x3a86ff, 0xffd23f, 0xece7dc, 0x3fb950, 0x7b4bc4, 0xf4a24c][(i * 5) % 7];
      if (i % 3 !== 1) out.push({ k: "prop", p: { kind: "parked", x, y: 322, rot: Math.PI / 2, color: col } });
      if (i % 4 !== 2) out.push({ k: "prop", p: { kind: "parked", x, y: 430, rot: -Math.PI / 2, color: col ^ 0x202020 } });
      return out;
    }),
    // badly parked cars sticking into the aisle
    { k: "prop", p: { kind: "parked", x: 880, y: 345, rot: Math.PI / 2 + 0.35, color: 0xf4a24c } },
    { k: "prop", p: { kind: "parked", x: 965, y: 408, rot: -Math.PI / 2 - 0.4, color: 0x2a9d8f } },
    ...cones([
      [930, 360],
      [936, 392],
    ]),
    { k: "decal", kind: "arrow", x: 840, y: 376, a: 0 },
    { k: "circle", t: T.OIL, x: 985, y: 388, r: 7 },
    { k: "decal", kind: "arrow", x: 1000, y: 376, a: 0 },
    // ---- back alley
    { k: "decal", kind: "tyres", x: 548, y: 282, a: 0, w: 30 },
    { k: "decal", kind: "tyres", x: 735, y: 282, a: 0, w: 30 },
    { k: "decal", kind: "trash", x: 552, y: 271 },
    { k: "decal", kind: "puddle", x: 680, y: 286 },
    { k: "rect", t: T.PAD, r: { x: 624, y: 270, w: 16, h: 24 }, force: true },
    { k: "decal", kind: "trash", x: 728, y: 294 },
    // ---- canal
    { k: "nofill", r: { x: 586, y: 748, w: 218, h: 468 } },
    { k: "rect", t: T.WATER, r: { x: 650, y: 772, w: 92, h: 444 }, force: true },
    { k: "rect", t: T.RAMP, r: { x: 744, y: 1030, w: 26, h: 40 }, force: true },
    { k: "rect", t: T.GRASS, r: { x: 600, y: 772, w: 42, h: 250 } },
    { k: "rect", t: T.GRASS, r: { x: 750, y: 772, w: 42, h: 250 } },
    { k: "rect", t: T.GRASS, r: { x: 600, y: 1078, w: 42, h: 138 } },
    { k: "rect", t: T.GRASS, r: { x: 750, y: 1078, w: 42, h: 138 } },
    { k: "prop", p: { kind: "tree", x: 620, y: 800, w: 16 } },
    { k: "prop", p: { kind: "tree", x: 772, y: 830, w: 18 } },
    { k: "prop", p: { kind: "tree", x: 618, y: 900, w: 14 } },
    { k: "prop", p: { kind: "tree", x: 774, y: 950, w: 16 } },
    { k: "prop", p: { kind: "tree", x: 620, y: 990, w: 16 } },
    { k: "prop", p: { kind: "tree", x: 620, y: 1130, w: 16 } },
    { k: "prop", p: { kind: "tree", x: 772, y: 1160, w: 16 } },
    { k: "prop", p: { kind: "barrier", x: 776, y: 1022, w: 24, h: 6 } },
    { k: "prop", p: { kind: "barrier", x: 776, y: 1074, w: 24, h: 6 } },
    { k: "prop", p: { kind: "sign", x: 880, y: 1008 } },
    { k: "decal", kind: "chevron", x: 800, y: 1050, a: Math.PI },
  ],
};

// =================================================================== 2. DESERT HUSTLE
const desertHustle: TrackDef = scaleDef({
  name: "DESERT HUSTLE",
  short: "DESERT",
  theme: "desert",
  size: 1600,
  roadWidth: 54,
  laps: 3,
  seed: 2202,
  offSpeed: 0.55,
  start: [400, 1432],
  main: [
    [260, 1420],
    [560, 1440],
    [700, 1240],
    [900, 1080],
    [1100, 1240],
    [1240, 1440],
    [1440, 1360],
    [1470, 1120],
    [1360, 960],
    [1140, 900],
    [1060, 760],
    [1150, 620],
    [1380, 580],
    [1470, 400],
    [1380, 200],
    [1160, 200],
    [1060, 360],
    [860, 540],
    [640, 520],
    [520, 330],
    [400, 200],
    [220, 250],
    [160, 480],
    [300, 640],
    [480, 760],
    [430, 960],
    [240, 1060],
    [160, 1250],
  ],
  shortcuts: [
    {
      id: "riverbed",
      name: "DRY RIVERBED",
      hidden: false,
      pts: [
        [520, 1440],
        [900, 1452],
        [1280, 1436],
      ],
      smooth: true,
      width: 44,
      surface: T.DIRT,
      ai: [0.15, 0.35, 0.2],
    },
    {
      id: "jump",
      name: "CANYON JUMP",
      hidden: false,
      pts: [
        [1410, 1010],
        [1405, 800],
        [1400, 560],
      ],
      smooth: true,
      width: 44,
      surface: T.ROAD,
      ai: [0, 0.25, 0.35],
      launch: true,
    },
    {
      id: "mine",
      name: "OLD MINE",
      hidden: true,
      pts: [
        [1190, 200],
        [820, 204],
        [470, 236],
      ],
      smooth: true,
      width: 32,
      surface: T.TUNNEL,
      cover: { rects: [{ x: 640, y: 168, w: 420, h: 72 }], style: "rock" },
      ai: [0, 0.05, 0.2],
    },
    {
      id: "canyon",
      name: "HIDDEN CANYON",
      hidden: true,
      pts: [
        [168, 520],
        [178, 800],
        [205, 1110],
      ],
      smooth: true,
      width: 30,
      surface: T.DIRT,
      cover: { rects: [{ x: 140, y: 690, w: 84, h: 230 }], style: "rock" },
      ai: [0, 0.2, 0.1],
    },
  ],
  zones: [
    // riverbed: soft sand patches and boulders beside the dirt
    { k: "circle", t: T.HEAVY, x: 760, y: 1470, r: 16 },
    { k: "circle", t: T.HEAVY, x: 1040, y: 1428, r: 14 },
    { k: "prop", p: { kind: "boulder", x: 690, y: 1426, w: 14 } },
    { k: "prop", p: { kind: "boulder", x: 905, y: 1474, w: 16 } },
    { k: "prop", p: { kind: "boulder", x: 1150, y: 1424, w: 12 } },
    { k: "decal", kind: "tyres", x: 620, y: 1446, a: 0, w: 40 },
    // canyon chasm for the jump (east-west gash)
    {
      k: "poly",
      t: T.CHASM,
      force: true,
      pts: [
        [1190, 712],
        [1300, 700],
        [1420, 716],
        [1600, 704],
        [1600, 800],
        [1440, 806],
        [1320, 798],
        [1196, 792],
      ],
    },
    { k: "rect", t: T.RAMP, r: { x: 1384, y: 808, w: 44, h: 26 }, force: true },
    { k: "nofill", r: { x: 1180, y: 680, w: 420, h: 150 } },
    { k: "prop", p: { kind: "sign", x: 1374, y: 900 } },
    { k: "decal", kind: "chevron", x: 1406, y: 860, a: -Math.PI / 2 },
    // mesa above the mine
    {
      k: "poly",
      t: T.WALL,
      onlyOff: true,
      pts: [
        [600, 120],
        [760, 60],
        [1000, 70],
        [1130, 120],
        [1110, 280],
        [990, 400],
        [780, 450],
        [640, 410],
        [580, 260],
      ],
    },
    { k: "decal", kind: "tyres", x: 1140, y: 200, a: Math.PI, w: 36 },
    { k: "rect", t: T.PAD, r: { x: 812, y: 192, w: 18, h: 26 }, force: true },
    { k: "circle", t: T.OIL, x: 960, y: 196, r: 8, force: true },
    { k: "decal", kind: "crack", x: 1100, y: 186 },
    // rock formation hiding the slot canyon
    {
      k: "poly",
      t: T.WALL,
      onlyOff: true,
      pts: [
        [90, 600],
        [200, 560],
        [260, 640],
        [380, 730],
        [400, 860],
        [350, 960],
        [240, 1000],
        [150, 1070],
        [80, 1000],
        [60, 800],
      ],
    },
    { k: "decal", kind: "tyres", x: 168, y: 560, a: Math.PI / 2, w: 30 },
    { k: "rect", t: T.PAD, r: { x: 166, y: 792, w: 24, h: 16 }, force: true },
    { k: "decal", kind: "crack", x: 152, y: 600 },
  ],
}, 0.85);

// =================================================================== 3. MILLIONAIRE BOULEVARD
const millionaire: TrackDef = {
  name: "MILLIONAIRE BOULEVARD",
  short: "BLVD",
  theme: "lux",
  size: 1408,
  roadWidth: 58,
  round: 64,
  laps: 3,
  seed: 3303,
  offSpeed: 0.62,
  start: [380, 190],
  main: [
    [190, 190],
    [600, 190],
    [600, 400],
    [860, 400],
    [860, 190],
    [1220, 190],
    [1220, 690],
    [990, 690],
    [990, 920],
    [1220, 920],
    [1220, 1220],
    [680, 1220],
    [680, 1010],
    [440, 1010],
    [440, 1220],
    [190, 1220],
  ],
  shortcuts: [
    {
      id: "construction",
      name: "CONSTRUCTION ZONE",
      hidden: false,
      pts: [
        [520, 190],
        [600, 192],
        [640, 204],
        [680, 194],
        [720, 177],
        [760, 190],
        [800, 204],
        [850, 192],
        [940, 190],
      ],
      smooth: true,
      width: 46,
      surface: T.DIRT,
      ai: [0.1, 0.35, 0.3],
    },
    {
      id: "golf",
      name: "GOLF COURSE",
      hidden: false,
      pts: [
        [1220, 600],
        [1220, 1010],
      ],
      width: 36,
      surface: T.PATH,
      ai: [0.25, 0.3, 0.2],
    },
    {
      id: "tunnel",
      name: "PRIVATE TUNNEL",
      hidden: true,
      pts: [
        [740, 1220],
        [380, 1220],
      ],
      width: 34,
      surface: T.TUNNEL,
      cover: { rects: [{ x: 486, y: 1188, w: 176, h: 64 }], style: "garden" },
      ai: [0, 0.1, 0.25],
    },
    {
      id: "garden",
      name: "GARDEN PATH",
      hidden: true,
      pts: [
        [190, 760],
        [250, 640],
        [290, 540],
        [300, 420],
        [400, 290],
        [500, 190],
      ],
      smooth: true,
      width: 30,
      surface: T.PATH,
      cover: {
        rects: [
          { x: 250, y: 380, w: 80, h: 190 },
          { x: 320, y: 270, w: 90, h: 70 },
        ],
        style: "canopy",
      },
      ai: [0.05, 0.15, 0.2],
    },
  ],
  zones: [
    // construction zone: slalom of barriers, cones, oil and an excavator
    { k: "prop", p: { kind: "barrier", x: 640, y: 166, w: 6, h: 26 } },
    { k: "prop", p: { kind: "barrier", x: 720, y: 190, w: 6, h: 24 } },
    { k: "prop", p: { kind: "barrier", x: 800, y: 166, w: 6, h: 26 } },
    { k: "circle", t: T.OIL, x: 760, y: 205, r: 9 },
    { k: "circle", t: T.HEAVY, x: 690, y: 205, r: 10 },
    ...cones([
      [600, 172],
      [610, 208],
      [680, 178],
      [760, 172],
      [840, 206],
      [880, 176],
    ]),
    { k: "prop", p: { kind: "excavator", x: 690, y: 236, w: 30, h: 22 } },
    { k: "prop", p: { kind: "pipes", x: 760, y: 236, w: 40, h: 14 } },
    { k: "rect", t: T.DIRT, r: { x: 628, y: 222, w: 204, h: 40 }, onlyOff: true },
    { k: "nofill", r: { x: 628, y: 218, w: 204, h: 150 } },
    // golf course
    { k: "nofill", r: { x: 1019, y: 720, w: 389, h: 172 } },
    { k: "rect", t: T.GRASS, r: { x: 1019, y: 720, w: 389, h: 172 }, onlyOff: true },
    { k: "circle", t: T.HEAVY, x: 1180, y: 760, r: 14 },
    { k: "circle", t: T.HEAVY, x: 1262, y: 860, r: 16 },
    { k: "circle", t: T.WATER, x: 1100, y: 840, r: 26 },
    { k: "prop", p: { kind: "flag", x: 1320, y: 780 } },
    { k: "prop", p: { kind: "tree", x: 1360, y: 860, w: 18 } },
    { k: "prop", p: { kind: "tree", x: 1060, y: 760, w: 16 } },
    // private tunnel estate + hint
    { k: "decal", kind: "tyres", x: 700, y: 1220, a: Math.PI, w: 30 },
    { k: "rect", t: T.PAD, r: { x: 566, y: 1206, w: 14, h: 28 }, force: true },
    // botanical garden enclosing the garden path
    { k: "rect", t: T.WALL, onlyOff: true, r: { x: 232, y: 232, w: 330, h: 540 } },
    { k: "decal", kind: "tyres", x: 206, y: 740, a: -Math.PI / 3, w: 26 },
    { k: "rect", t: T.PAD, r: { x: 288, y: 470, w: 22, h: 14 }, force: true },
    { k: "prop", p: { kind: "fountain", x: 1090, y: 560, w: 44 } },
  ],
};

export const TRACKS: TrackDef[] = [scamCity, desertHustle, millionaire];
