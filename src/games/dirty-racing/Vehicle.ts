/**
 * Arcade car physics (Phaser-free). Separate forward / lateral velocity with a
 * grip model so the handbrake produces proper drifts. Collides against the
 * track's terrain grid, handles ramps, chasms, oil and boost pads.
 */
import { cellAt, speedMul, type TrackData } from "./Track";
import { GRIP_MUL, IS_FALL, IS_SOLID, T } from "./terrain";
import { clamp } from "./geom";

export interface CarStats {
  maxSpeed: number;
  accel: number;
  brake: number;
  reverseMax: number;
  turnRate: number;
  grip: number;
  driftGrip: number;
  boostMul: number;
  mass: number;
}

export const BASE_STATS: CarStats = {
  maxSpeed: 182,
  accel: 190,
  brake: 330,
  reverseMax: 70,
  turnRate: 3.4,
  grip: 9,
  driftGrip: 1.7,
  boostMul: 1.4,
  mass: 1,
};

export interface CarInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
}

export const NO_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };

export type CarEventKind = "crash" | "bump" | "jump" | "land" | "fall" | "oil" | "pad" | "boostStart";

export class Car {
  x: number;
  y: number;
  angle: number;
  vx = 0;
  vy = 0;
  readonly radius = 5;
  stats: CarStats;
  /** airborne time left / total */
  air = 0;
  airTotal = 0;
  /** >0 while falling into a chasm */
  falling = 0;
  /** >0 while spinning out on oil */
  spin = 0;
  spinDir = 1;
  boostMeter = 0.35;
  boosting = false;
  /** pad-boost time left */
  padBoost = 0;
  drifting = false;
  surface: number = T.ROAD;
  throttle = 0;
  /** speed lost in the last wall hit (for effects) */
  lastImpact = 0;
  events: CarEventKind[] = [];
  /** grace period after landing so ramps don't re-launch */
  private landGrace = 0;

  constructor(x: number, y: number, angle: number, stats: CarStats) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.stats = stats;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
  get fwdSpeed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }
  get latSpeed() {
    return -this.vx * Math.sin(this.angle) + this.vy * Math.cos(this.angle);
  }
  /** 0..1 height while airborne */
  get height() {
    if (this.air <= 0 || this.airTotal <= 0) return 0;
    return Math.sin(Math.PI * (1 - this.air / this.airTotal));
  }
  get active() {
    return this.falling <= 0;
  }

  placeAt(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.air = 0;
    this.falling = 0;
    this.spin = 0;
    this.padBoost = 0;
    this.boosting = false;
    this.drifting = false;
  }

  blocked(td: TrackData, x: number, y: number) {
    const r = this.radius;
    if (IS_SOLID[cellAt(td, x, y)]) return true;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (IS_SOLID[cellAt(td, x + Math.cos(a) * r, y + Math.sin(a) * r)]) return true;
    }
    return false;
  }

  /**
   * Advance the car. `speedScale` is the AI rubber band (1 for the player).
   * Events produced this step are appended to `this.events`.
   */
  step(td: TrackData, input: CarInput, dt: number, speedScale = 1) {
    const st = this.stats;
    if (this.falling > 0) {
      this.falling -= dt;
      this.vx *= Math.exp(-6 * dt);
      this.vy *= Math.exp(-6 * dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.boosting = false;
      this.drifting = false;
      return;
    }
    this.landGrace = Math.max(0, this.landGrace - dt);
    const airborne = this.air > 0;
    const t = airborne ? T.ROAD : cellAt(td, this.x, this.y);
    this.surface = t;

    // ------------------------------------------------ boost
    // hysteresis: need a little charge to start, then burn until empty
    const charge = this.boosting ? this.boostMeter > 0 : this.boostMeter > 0.15;
    const wantBoost = input.boost && charge && !airborne && this.spin <= 0;
    if (wantBoost && !this.boosting) this.events.push("boostStart");
    this.boosting = wantBoost;
    if (this.boosting) this.boostMeter = Math.max(0, this.boostMeter - dt * 0.5);
    else this.boostMeter = Math.min(1, this.boostMeter + dt * 0.035);
    if (this.padBoost > 0) this.padBoost -= dt;
    const boostOn = this.boosting || this.padBoost > 0;

    if (airborne) {
      this.air -= dt;
      this.drifting = false;
      this.move(td, dt);
      if (this.air <= 0) {
        this.air = 0;
        this.landGrace = 0.3;
        this.events.push("land");
        if (IS_FALL[cellAt(td, this.x, this.y)]) this.startFall();
      }
      return;
    }

    if (IS_FALL[t]) {
      this.startFall();
      return;
    }

    // ------------------------------------------------ special surfaces
    if (t === T.PAD && this.padBoost < 0.6) {
      if (this.padBoost <= 0) this.events.push("pad");
      this.padBoost = 1.1;
    }
    if (t === T.OIL && this.spin <= 0 && this.speed > 55) {
      this.spin = 0.85;
      this.spinDir = this.latSpeed >= 0 ? 1 : -1;
      this.events.push("oil");
    }

    const spinning = this.spin > 0;
    if (spinning) this.spin -= dt;
    const thr = spinning ? 0 : input.throttle;
    const brk = spinning ? 0 : input.brake;
    const steer = spinning ? 0 : input.steer;
    const hb = !spinning && input.handbrake;
    this.throttle = thr;

    let vmax = st.maxSpeed * speedMul(td, t) * speedScale;
    let accel = st.accel;
    if (boostOn) {
      vmax = Math.max(vmax, st.maxSpeed * speedScale) * st.boostMul * (t === T.ROAD || t === T.CURB ? 1 : 0.85);
      accel *= 2.2;
    }

    // ------------------------------------------------ steering (rotate heading first)
    const vf0 = this.fwdSpeed;
    const speedFactor = clamp(Math.abs(vf0) / 42, 0, 1) * (1 - 0.18 * clamp(Math.abs(vf0) / 260, 0, 1));
    let turn = steer * st.turnRate * speedFactor * (vf0 >= 0 ? 1 : -1);
    if (hb) turn *= 1.35;
    this.angle += turn * dt;
    if (spinning) this.angle += this.spinDir * 11 * dt * clamp(this.spin / 0.85 + 0.2, 0, 1);

    // ------------------------------------------------ decompose relative to new heading
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    let vf = this.vx * fx + this.vy * fy;
    let vl = -this.vx * fy + this.vy * fx;

    if (thr > 0 && vf < vmax) vf += accel * thr * dt * (1 - 0.55 * clamp(vf / vmax, 0, 1));
    if (brk > 0) {
      if (vf > 6) vf = Math.max(0, vf - st.brake * brk * dt);
      else vf = Math.max(-st.reverseMax, vf - st.accel * 0.6 * brk * dt);
    }
    if (thr <= 0 && brk <= 0) {
      const c = Math.min(Math.abs(vf), 55 * dt);
      vf -= Math.sign(vf) * c;
    }
    // soft speed cap (strong off-road drag)
    if (vf > vmax) vf -= (vf - vmax) * Math.min(1, 2.6 * dt);
    if (vf < -st.reverseMax) vf = -st.reverseMax;
    if (hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 38 * dt);

    const grip = (hb ? st.driftGrip : spinning ? 1.2 : st.grip) * GRIP_MUL[t];
    vl *= Math.exp(-grip * dt);

    this.drifting = Math.abs(vl) > 28 && Math.abs(vf) > 55;
    if (this.drifting && !this.boosting) this.boostMeter = Math.min(1, this.boostMeter + dt * 0.3);

    this.vx = fx * vf - fy * vl;
    this.vy = fy * vf + fx * vl;

    // ------------------------------------------------ ramp launch
    if (t === T.RAMP && vf > 40 && this.landGrace <= 0) {
      this.airTotal = 0.3 + vf * 0.003;
      this.air = this.airTotal;
      this.events.push("jump");
    }

    this.move(td, dt);
  }

  private startFall() {
    this.falling = 1.1;
    this.air = 0;
    this.boosting = false;
    this.events.push("fall");
  }

  /** integrate position with axis-separated wall sliding */
  private move(td: TrackData, dt: number) {
    const dist = Math.hypot(this.vx, this.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 2));
    const sx = (this.vx * dt) / n;
    const sy = (this.vy * dt) / n;
    let hitX = 0;
    let hitY = 0;
    for (let i = 0; i < n; i++) {
      if (!hitX) {
        if (this.blocked(td, this.x + sx, this.y)) hitX = Math.abs(this.vx);
        else this.x += sx;
      }
      if (!hitY) {
        if (this.blocked(td, this.x, this.y + sy)) hitY = Math.abs(this.vy);
        else this.y += sy;
      }
    }
    if (hitX) this.vx *= -0.25;
    if (hitY) this.vy *= -0.25;
    const impact = Math.max(hitX, hitY);
    if (impact > 0) {
      // glancing hits keep most of the tangential speed
      const keep = impact > 90 ? 0.72 : 0.9;
      this.vx *= keep;
      this.vy *= keep;
      this.lastImpact = impact;
      if (impact > 70) this.events.push("crash");
    }
  }
}
