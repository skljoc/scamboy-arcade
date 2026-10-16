/**
 * ShuffleSystem — pure, dependency-free shell game logic.
 *
 * Terminology
 *  - slot:  a fixed table position, 0 = left, 1 = middle, 2 = right.
 *  - order: order[slot] = id of the cup currently standing on that slot.
 *  - move:  a permutation of slots. `mapSlot(s, move)` says where the cup standing
 *           on slot `s` ends up. Fakes are the identity permutation.
 *
 * The stone always belongs to a cup id; its slot is simply `order.indexOf(stoneCup)`.
 * Nothing here is random about the outcome: the result of a round is fully determined
 * by the real permutations applied to the order.
 */

export const SLOTS = 3;

export type Order = readonly number[];

export type FakeStyle = "feint" | "twitch";

export type Move =
  /** exchange the cups on slots a and b */
  | { kind: "swap"; a: number; b: number }
  /** all three cups shift one slot; dir 1 = to the right (right-most wraps to the left) */
  | { kind: "rotate"; dir: 1 | -1 }
  /** visual trick only — identity permutation */
  | { kind: "fake"; style: FakeStyle; a: number; b: number };

export interface LevelConfig {
  level: number;
  tier: 0 | 1 | 2;
  tierName: string;
  /** number of real (order-changing) moves — a sequence uses `moves` or `moves + 1`
   *  (random) so the final position never follows a predictable parity pattern */
  moves: number;
  /** number of fake moves mixed in */
  fakes: number;
  /** duration of one cup movement (ms) */
  moveMs: number;
  /** time for the hands to reach the cups before a move (ms) */
  reachMs: number;
  /** pause between moves (ms) */
  gapMs: number;
  /** chance that a swap is between the two outer cups */
  nonAdjacent: number;
  /** chance that a move is a three-cup rotation */
  rotate: number;
  /** chance that a move involves the stone's current slot */
  stoneBias: number;
  /** allow the same swap twice in a row (a "double back") */
  allowUndo: boolean;
}

export const TIER_NAMES = ["BEGINNER", "HUSTLER", "MASTER SCAMMER"] as const;
export const MAX_LEVEL = 10;

type Row = [moves: number, fakes: number, moveMs: number, reachMs: number, gapMs: number, nonAdj: number, rotate: number, bias: number];

const TABLE: Row[] = [
  // moves fakes moveMs reach gap  nonAdj rotate bias
  [3, 0, 640, 260, 170, 0, 0, 0.7], // 1
  [4, 0, 560, 230, 150, 0, 0, 0.65], // 2
  [5, 0, 490, 200, 130, 0, 0, 0.6], // 3
  [6, 0, 410, 170, 95, 0.3, 0.15, 0.55], // 4
  [7, 0, 365, 150, 80, 0.35, 0.2, 0.55], // 5
  [8, 0, 325, 135, 70, 0.4, 0.25, 0.6], // 6
  [10, 2, 275, 115, 50, 0.4, 0.25, 0.6], // 7
  [11, 3, 245, 105, 40, 0.45, 0.3, 0.62], // 8
  [13, 4, 215, 95, 32, 0.45, 0.3, 0.65], // 9
  [15, 5, 190, 85, 26, 0.5, 0.32, 0.68], // 10
];

export function tierOf(level: number): 0 | 1 | 2 {
  return level <= 3 ? 0 : level <= 6 ? 1 : 2;
}

export function levelConfig(level: number): LevelConfig {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const [moves, fakes, moveMs, reachMs, gapMs, nonAdjacent, rotate, stoneBias] = TABLE[lv - 1];
  const tier = tierOf(lv);
  return {
    level: lv,
    tier,
    tierName: TIER_NAMES[tier],
    moves,
    fakes,
    moveMs,
    reachMs,
    gapMs,
    nonAdjacent,
    rotate,
    stoneBias,
    allowUndo: tier === 2,
  };
}

export function isReal(m: Move): boolean {
  return m.kind !== "fake";
}

/** Where does the cup standing on `slot` end up after `move`? */
export function mapSlot(slot: number, move: Move): number {
  switch (move.kind) {
    case "swap":
      return slot === move.a ? move.b : slot === move.b ? move.a : slot;
    case "rotate":
      return (slot + move.dir + SLOTS) % SLOTS;
    case "fake":
      return slot;
  }
}

/** Returns the new order after applying `move` (input is not mutated). */
export function applyMove(order: Order, move: Move): number[] {
  const next = new Array<number>(order.length);
  for (let s = 0; s < order.length; s++) next[mapSlot(s, move)] = order[s];
  return next;
}

export function applySequence(order: Order, moves: readonly Move[]): number[] {
  let o = [...order];
  for (const m of moves) o = applyMove(o, m);
  return o;
}

/** true when `order` is a permutation of 0..n-1 */
export function isValidOrder(order: Order): boolean {
  if (order.length !== SLOTS) return false;
  const seen = new Array<boolean>(SLOTS).fill(false);
  for (const id of order) {
    if (!Number.isInteger(id) || id < 0 || id >= SLOTS || seen[id]) return false;
    seen[id] = true;
  }
  return true;
}

function sameSwap(a: Move | undefined, b: Move): boolean {
  if (!a || a.kind !== "swap" || b.kind !== "swap") return false;
  return Math.min(a.a, a.b) === Math.min(b.a, b.b) && Math.max(a.a, a.b) === Math.max(b.a, b.b);
}

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/**
 * Generate a shuffle sequence for a level.
 * @param stoneSlot slot of the stone before shuffling (used to bias moves towards the stone)
 */
export function generateSequence(level: number, stoneSlot: number, random: () => number = Math.random): Move[] {
  const cfg = levelConfig(level);
  const count = cfg.moves + (random() < 0.5 ? 1 : 0);
  for (let attempt = 0; attempt < 32; attempt++) {
    const real: Move[] = [];
    let s = stoneSlot;
    let stoneMoved = false;
    for (let i = 0; i < count; i++) {
      let m: Move;
      let guard = 0;
      do {
        if (cfg.rotate > 0 && random() < cfg.rotate) {
          m = { kind: "rotate", dir: random() < 0.5 ? 1 : -1 };
        } else {
          const pairs: Array<[number, number]> = [
            [0, 1],
            [1, 2],
          ];
          if (cfg.nonAdjacent > 0 && random() < cfg.nonAdjacent) pairs.push([0, 2]);
          let candidates = pairs;
          if (random() < cfg.stoneBias) {
            const withStone = pairs.filter(([a, b]) => a === s || b === s);
            if (withStone.length) candidates = withStone;
          }
          const [a, b] = pick(candidates, random);
          m = random() < 0.5 ? { kind: "swap", a, b } : { kind: "swap", a: b, b: a };
        }
        guard++;
      } while (!cfg.allowUndo && sameSwap(real[real.length - 1], m) && guard < 12);
      const ns = mapSlot(s, m);
      if (ns !== s) stoneMoved = true;
      s = ns;
      real.push(m);
    }
    if (!stoneMoved && attempt < 31) continue;

    // sprinkle in the fakes (never as the very first move, so the shuffle opens honestly)
    const seq = [...real];
    for (let f = 0; f < cfg.fakes; f++) {
      const at = 1 + Math.floor(random() * seq.length);
      const style: FakeStyle = random() < 0.55 ? "feint" : "twitch";
      if (style === "feint") {
        const pairs: Array<[number, number]> = [
          [0, 1],
          [1, 2],
          [0, 2],
        ];
        const [a, b] = pick(pairs, random);
        seq.splice(at, 0, { kind: "fake", style, a, b });
      } else {
        const a = Math.floor(random() * SLOTS) % SLOTS;
        seq.splice(at, 0, { kind: "fake", style, a, b: a });
      }
    }
    return seq;
  }
  // unreachable in practice: the loop always returns on its final attempt
  return [{ kind: "swap", a: stoneSlot, b: stoneSlot === 1 ? 0 : 1 }];
}

/** Seeded PRNG (mulberry32) — handy for deterministic tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
