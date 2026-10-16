/**
 * Shared SCAMBOY colour palette (16-bit inspired) — use these everywhere so
 * the three games feel like one universe.
 */
export const PAL = {
  // brand
  navy: 0x1d2a5c,
  navyDark: 0x111a3c,
  navyLight: 0x34478c,
  magenta: 0xd02a6b,
  magentaDark: 0x8e1546,
  magentaLight: 0xf0609a,
  offwhite: 0xece7dc,
  shell: 0xd9d4c7,

  // outline / ink
  ink: 0x15131c,
  black: 0x000000,
  white: 0xffffff,

  // SCAMBOY character
  cap: 0x24242c,
  capHi: 0x45454f,
  capPatch: 0xdcd8cc,
  skin: 0xf4c9a0,
  skinShade: 0xdb9b72,
  skinDark: 0xa5634a,
  hair: 0x3b2618,
  eye: 0x15131c,
  mouth: 0x7a2d2d,

  // 16-bit world colours
  red: 0xe63946,
  redDark: 0x9b1d2a,
  orange: 0xf4a24c,
  orangeDark: 0xc0632a,
  yellow: 0xffd23f,
  yellowDark: 0xd19a1a,
  green: 0x3fb950,
  greenDark: 0x23753a,
  grass: 0x5aa83c,
  grassDark: 0x3e7d2c,
  teal: 0x2a9d8f,
  blue: 0x3a86ff,
  blueDark: 0x1f4fb0,
  sky: 0x8ecae6,
  skyDark: 0x5b9bc2,
  purple: 0x7b4bc4,
  purpleDark: 0x4b2a85,
  brown: 0x8b5a2b,
  brownDark: 0x5c3a1c,
  sand: 0xe8c98a,
  sandDark: 0xc9a062,
  gray: 0x8a8d99,
  grayDark: 0x55586a,
  grayLight: 0xc4c6d0,
  asphalt: 0x4a4c58,
  asphaltDark: 0x3a3c46,
  brick: 0xa8483c,
  brickDark: 0x7a2f28,
  denim: 0x2f4f8f,
  denimDark: 0x1f3566,

  // classic LCD (boot / menu)
  lcd0: 0xc8d4a0,
  lcd1: 0x91a26c,
  lcd2: 0x4f5e3a,
  lcd3: 0x1e2a18,
} as const;

/** #rrggbb string for Phaser text etc. */
export const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");
