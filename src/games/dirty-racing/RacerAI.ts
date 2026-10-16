/**
 * Rival driver AI (Phaser-free). Each rival follows the main centreline or a
 * shortcut spine, steering at a speed-dependent look-ahead point, braking for
 * corners, drifting, boosting on straights and ramps, making the odd mistake.
 */
import { clamp, nearestIndex, nearestLocal, wrapAngle, type Path } from "./geom";
import type { TrackData } from "./Track";
import type { Car, CarInput } from "./Vehicle";

export interface Personality {
  name: string;
  /** top speed multiplier */
  speed: number;
  /** 0..1 cornering skill */
  corner: number;
  /** 0..1 how much they lean on other cars */
  aggression: number;
  /** mistakes per second */
  mistakes: number;
  drifter: boolean;
  lane: number;
  /** how eagerly they burn boost (0..1) */
  boostHappy: number;
}

export interface Neighbour {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class RacerAI {
  readonly p: Personality;
  readonly slot: number;
  /** -1 = main loop, otherwise shortcut index */
  mode = -1;
  idx = 0;
  private decided = new Set<number>();
  private pending = -1;
  private spineStart: number[];
  private spineEnd: number[];
  private mistakeT = 0;
  private mistakeSteer = 0;
  private mistakeLift = false;
  private stuckT = 0;
  private reverseT = 0;
  private reverseSteer = 0;
  private driftT = 0;
  private boostHold = 0;
  private rand: () => number;
  /** set when the AI has been stuck so long it wants a respawn */
  wantsRespawn = false;

  /** probability of taking shortcut k on a lap */
  chance: (k: number) => number;

  constructor(p: Personality, slot: number, td: TrackData, rand: () => number) {
    this.p = p;
    this.slot = slot;
    this.rand = rand;
    this.chance = (k) => td.shortcuts[k].def.ai[slot] ?? 0;
    this.spineStart = td.shortcuts.map((s) => nearestIndex(td.main, s.path.x[0], s.path.y[0]));
    this.spineEnd = td.shortcuts.map((s) => nearestIndex(td.main, s.path.x[s.path.n - 1], s.path.y[s.path.n - 1]));
  }

  /** called when a new lap begins: re-roll shortcut decisions */
  newLap() {
    this.decided.clear();
  }

  /** after a respawn on the main loop */
  resync(td: TrackData, car: Car) {
    this.mode = -1;
    this.pending = -1;
    this.idx = nearestIndex(td.main, car.x, car.y);
    this.stuckT = 0;
    this.reverseT = 0;
    this.wantsRespawn = false;
  }

  private path(td: TrackData): Path {
    return this.mode < 0 ? td.main : td.shortcuts[this.mode].path;
  }

  /** point `d` px ahead of the current index along the route (spine → main) */
  private ahead(td: TrackData, d: number) {
    const steps = Math.round(d / 4);
    let mode = this.mode;
    let j = this.idx + steps;
    if (mode < 0) {
      const m = td.main;
      // planned shortcut ahead: continue onto its spine
      if (this.pending >= 0) {
        const toStart = (this.spineStart[this.pending] - this.idx + m.n) % m.n;
        if (toStart < steps && toStart < m.n / 2) {
          mode = this.pending;
          j = steps - toStart;
        }
      }
      if (mode < 0) {
        const i = (this.idx + steps) % m.n;
        return { x: m.x[i], y: m.y[i], tx: m.tx[i], ty: m.ty[i], spine: false };
      }
    }
    const sp = td.shortcuts[mode].path;
    if (j < sp.n) return { x: sp.x[j], y: sp.y[j], tx: sp.tx[j], ty: sp.ty[j], spine: true };
    const m = td.main;
    const i = (this.spineEnd[mode] + (j - sp.n + 1)) % m.n;
    return { x: m.x[i], y: m.y[i], tx: m.tx[i], ty: m.ty[i], spine: false };
  }

  update(
    td: TrackData,
    car: Car,
    dt: number,
    others: Neighbour[],
    racing: boolean,
  ): CarInput {
    const input: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
    if (!car.active) return input;

    // ---------------------------------------------------- track position
    const P = this.path(td);
    this.idx = nearestLocal(P, car.x, car.y, this.idx, 3, 14);
    if (this.mode < 0) {
      const m = td.main;
      // roll shortcut decisions when approaching a spine start
      td.shortcuts.forEach((_s, k) => {
        if (this.decided.has(k)) return;
        const dAhead = (m.s[this.spineStart[k]] - m.s[this.idx] + td.L) % td.L;
        if (dAhead < 90) {
          this.decided.add(k);
          if (this.rand() < this.chance(k)) this.pending = k;
        }
      });
      if (this.pending >= 0) {
        const k = this.pending;
        const dAhead = (m.s[this.spineStart[k]] - m.s[this.idx] + td.L) % td.L;
        if (dAhead < 6 || dAhead > td.L - 30) {
          this.mode = k;
          this.pending = -1;
          this.idx = nearestLocal(td.shortcuts[k].path, car.x, car.y, 0, 0, 12);
        }
      }
    } else {
      const sp = td.shortcuts[this.mode].path;
      if (this.idx >= sp.n - 3) {
        const end = this.spineEnd[this.mode];
        this.mode = -1;
        this.idx = end;
      }
    }

    if (!racing) return input;

    const sc = this.mode >= 0 ? td.shortcuts[this.mode] : null;
    const launch = !!sc?.def.launch;
    const speed = car.fwdSpeed;
    const vmax = car.stats.maxSpeed;

    // ---------------------------------------------------- steering target
    const look = 16 + Math.max(0, speed) * 0.26;
    const tgt = this.ahead(td, look);
    const narrow = sc ? sc.def.width < 40 : false;
    const lane = sc || tgt.spine ? 0 : this.p.lane;
    let tx = tgt.x - tgt.ty * lane;
    let ty = tgt.y + tgt.tx * lane;

    // avoid / bump other cars
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const o of others) {
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const along = dx * fx + dy * fy;
      const side = -dx * fy + dy * fx;
      if (along > 0 && along < 34 && Math.abs(side) < 14) {
        const oSpeed = o.vx * fx + o.vy * fy;
        if (oSpeed < speed - 8) {
          if (this.p.aggression > 0.6 && along < 18) continue; // ram it
          const push = narrow ? 0 : (side >= 0 ? -1 : 1) * 9;
          tx += -fy * push;
          ty += fx * push;
        }
      }
    }

    const desired = Math.atan2(ty - car.y, tx - car.x);
    let diff = wrapAngle(desired - car.angle);
    // mistakes
    if (this.mistakeT > 0) {
      this.mistakeT -= dt;
      diff += this.mistakeSteer;
    } else if (!launch && this.rand() < this.p.mistakes * dt) {
      this.mistakeT = 0.25 + this.rand() * 0.35;
      this.mistakeSteer = (this.rand() - 0.5) * 0.9;
      this.mistakeLift = this.rand() < 0.4;
    }
    input.steer = clamp(diff * 3.2, -1, 1);

    // ---------------------------------------------------- speed control
    const here = this.ahead(td, 0);
    const baseA = Math.atan2(here.ty, here.tx);
    let maxTurn = 0;
    const horizon = 30 + Math.max(0, speed) * 0.75;
    for (let d = 16; d <= horizon; d += 16) {
      const a = this.ahead(td, d);
      const turn = Math.abs(wrapAngle(Math.atan2(a.ty, a.tx) - baseA));
      // nearer turns matter more
      maxTurn = Math.max(maxTurn, turn * (1 - (d / horizon) * 0.35));
    }
    const k = 0.5 - this.p.corner * 0.16;
    let target = vmax * this.p.speed * Math.max(0.5, 1 - maxTurn * k);
    if (Math.abs(diff) > 0.8) target = Math.min(target, vmax * 0.55);
    if (launch) target = vmax * 2;

    if (this.mistakeT > 0 && this.mistakeLift) {
      input.throttle = 0;
    } else if (speed < target - 4) input.throttle = 1;
    else if (speed > target + 14) input.brake = clamp((speed - target) / 60, 0.2, 1);
    else input.throttle = 0.4;

    // drift through sharp bends (style + boost charge)
    if (this.driftT > 0) {
      this.driftT -= dt;
      input.handbrake = true;
      input.throttle = 1;
      input.brake = 0;
    } else if (this.p.drifter && maxTurn > 0.9 && speed > 120 && Math.abs(diff) > 0.25 && !narrow) {
      this.driftT = 0.22;
    }

    // boost: on straights or when launching off a ramp
    if (launch) input.boost = car.boosting || car.boostMeter > 0.15;
    else if (this.boostHold > 0) {
      this.boostHold -= dt;
      input.boost = maxTurn < 0.6;
    } else if (maxTurn < 0.2 && speed > vmax * 0.65 && car.boostMeter > 0.55 - this.p.boostHappy * 0.3) {
      if (this.rand() < (0.5 + this.p.boostHappy * 0.5) * dt * 4) {
        this.boostHold = 0.5 + this.rand() * 0.7;
        input.boost = true;
      }
    }

    // ---------------------------------------------------- unstick
    const offPath = Math.hypot(here.x - car.x, here.y - car.y) > 46;
    if ((Math.abs(speed) < 16 || offPath) && car.air <= 0) {
      this.stuckT += dt;
      if (this.stuckT > 4.5) this.wantsRespawn = true;
    } else if (Math.abs(speed) > 50 && !offPath) this.stuckT = Math.max(0, this.stuckT - dt * 2);
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      input.throttle = 0;
      input.brake = 1;
      input.boost = false;
      input.handbrake = false;
      input.steer = this.reverseSteer;
      return input;
    }
    if (Math.abs(speed) < 14 && this.stuckT > 1 && this.stuckT < 1.1 + dt) {
      this.reverseT = 0.8;
      this.reverseSteer = diff > 0 ? -1 : 1;
    }
    if (Math.abs(speed) < 14 && this.stuckT > 2.6 && this.stuckT < 2.6 + dt) {
      this.reverseT = 0.8;
      this.reverseSteer = diff > 0 ? -1 : 1;
    }

    return input;
  }
}

/** The three rivals: name, livery and driving style */
export interface RivalDef {
  name: string;
  body: number;
  bodyDark: number;
  accent: number;
  personality: Personality;
}

export const RIVALS: RivalDef[] = [
  {
    name: "GRANNY GAS",
    body: 0x9b6bd6,
    bodyDark: 0x5e3a96,
    accent: 0xf3d6f0,
    personality: {
      name: "GRANNY GAS",
      speed: 0.975,
      corner: 1,
      aggression: 0.1,
      mistakes: 0.02,
      drifter: false,
      lane: -8,
      boostHappy: 0.2,
    },
  },
  {
    name: "SIR SKIDMARK",
    body: 0x3fb950,
    bodyDark: 0x1f6b32,
    accent: 0xffd23f,
    personality: {
      name: "SIR SKIDMARK",
      speed: 0.99,
      corner: 0.75,
      aggression: 0.35,
      mistakes: 0.08,
      drifter: true,
      lane: 0,
      boostHappy: 0.8,
    },
  },
  {
    name: "BIG RICO",
    body: 0xe63946,
    bodyDark: 0x8e1d28,
    accent: 0xffd23f,
    personality: {
      name: "BIG RICO",
      speed: 1.03,
      corner: 0.45,
      aggression: 0.9,
      mistakes: 0.12,
      drifter: false,
      lane: 8,
      boostHappy: 0.5,
    },
  },
];
