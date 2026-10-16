/** Terrain cell ids stored in the track's Uint8Array grid (2px cells). */
export const T = {
  OFF: 0, // theme off-road: sidewalk / sand / lawn
  ROAD: 1,
  WALL: 2,
  DIRT: 3,
  CHASM: 4,
  RAMP: 5,
  OIL: 6,
  HEAVY: 7, // deep sand / bunker
  LOT: 8, // parking-lot asphalt
  ALLEY: 9, // dark narrow back-alley asphalt
  PATH: 10, // garden gravel path
  WATER: 11, // canal / pond (falls in)
  GRASS: 12, // park lawn
  TUNNEL: 13, // concrete tunnel floor
  CURB: 14, // painted curb strip (drivable)
  PAD: 15, // boost pad
} as const;
export type TerrainId = (typeof T)[keyof typeof T];

export const CELL = 2;

export type Theme = "city" | "desert" | "lux";

/** physics tables indexed by terrain id */
export const SPEED_MUL = new Float32Array(16);
export const GRIP_MUL = new Float32Array(16);
export const IS_SOLID = new Uint8Array(16);
export const IS_FALL = new Uint8Array(16);
export const IS_DUSTY = new Uint8Array(16);
export const IS_DRIVE = new Uint8Array(16); // part of a designed route (for autofill clearance)

(() => {
  SPEED_MUL.fill(1);
  GRIP_MUL.fill(1);
  SPEED_MUL[T.OFF] = 0.62; // overridden per theme via offSpeed
  SPEED_MUL[T.DIRT] = 0.86;
  SPEED_MUL[T.HEAVY] = 0.45;
  SPEED_MUL[T.LOT] = 0.97;
  SPEED_MUL[T.ALLEY] = 0.95;
  SPEED_MUL[T.PATH] = 0.94;
  SPEED_MUL[T.GRASS] = 0.6;
  GRIP_MUL[T.DIRT] = 0.7;
  GRIP_MUL[T.HEAVY] = 0.6;
  GRIP_MUL[T.OFF] = 0.8;
  GRIP_MUL[T.GRASS] = 0.75;
  GRIP_MUL[T.OIL] = 0.15;
  GRIP_MUL[T.PATH] = 0.85;
  IS_SOLID[T.WALL] = 1;
  IS_FALL[T.CHASM] = 1;
  IS_FALL[T.WATER] = 1;
  for (const t of [T.OFF, T.DIRT, T.HEAVY, T.GRASS, T.PATH]) IS_DUSTY[t] = 1;
  for (const t of [T.ROAD, T.DIRT, T.RAMP, T.OIL, T.LOT, T.ALLEY, T.PATH, T.TUNNEL, T.CURB, T.HEAVY, T.PAD]) IS_DRIVE[t] = 1;
})();
