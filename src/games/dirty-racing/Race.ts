/**
 * Race state machine (Phaser-free): racers, laps & checkpoints, positions,
 * shortcut detection, cones, car-to-car bumps, respawns and rubber banding.
 * The scene feeds player input and turns the emitted events into sfx / popups.
 */
import { rng } from "../engine/pixel";
import { clamp } from "./geom";
import { RacerAI, RIVALS } from "./RacerAI";
import { idxAt, pointAtS, progressAt, type TrackData } from "./Track";
import { BASE_STATS, Car, type CarEventKind, type CarInput, NO_INPUT } from "./Vehicle";

export interface Racer {
  id: number;
  name: string;
  isPlayer: boolean;
  car: Car;
  ai: RacerAI | null;
  started: boolean;
  lapsDone: number;
  nextCp: number;
  cpCount: number;
  s: number;
  finished: boolean;
  finishTime: number;
  lapStart: number;
  lapTimes: number[];
  bestLap: number;
  /** shortcut ids (index) used on the current lap */
  scLap: Set<number>;
  /** shortcut uses this race */
  scUses: number;
  inShortcut: number;
  /** hidden cover id the car is under (0 = none) */
  covered: number;
  rank: number;
  /** seconds spent moving the wrong way */
  wrongWay: number;
  respawnT: number;
}

export type RaceEvent =
  | { type: "car"; racer: Racer; kind: CarEventKind }
  | { type: "lap"; racer: Racer; lap: number; time: number; best: boolean }
  | { type: "finish"; racer: Racer; place: number; time: number }
  | { type: "shortcut"; racer: Racer; sc: number; firstInRace: boolean }
  | { type: "respawn"; racer: Racer }
  | { type: "cone"; racer: Racer; cone: Cone }
  | { type: "bump"; a: Racer; b: Racer; force: number };

export interface Cone {
  x: number;
  y: number;
  hx: number;
  hy: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  knocked: number;
}

export type RacePhase = "countdown" | "racing" | "done";

export class Race {
  readonly td: TrackData;
  readonly racers: Racer[] = [];
  readonly player: Racer;
  readonly cones: Cone[];
  readonly cpS: number[];
  phase: RacePhase = "countdown";
  countdown: number;
  time = 0;
  finishedCount = 0;
  events: RaceEvent[] = [];
  /** shortcut indices the player has entered this race */
  playerSeen = new Set<number>();
  private rand: () => number;

  constructor(td: TrackData, seed = 1, countdown = 3.2) {
    this.td = td;
    this.cpS = td.checkpoints;
    this.countdown = countdown;
    this.rand = rng(seed);
    // grid: rivals in front, SCAMBOY starts at the back
    const order = [0, 1, 2, 3];
    order.forEach((slotIdx, i) => {
      const slot = td.startSlots[slotIdx];
      const isPlayer = i === 3;
      const rival = isPlayer ? null : RIVALS[i];
      const stats = { ...BASE_STATS };
      if (rival) {
        stats.maxSpeed *= rival.personality.speed;
        if (rival.name === "BIG RICO") stats.mass = 1.5;
        if (rival.name === "GRANNY GAS") stats.mass = 0.85;
      }
      const car = new Car(slot.x, slot.y, slot.a, stats);
      const racer: Racer = {
        id: i,
        name: isPlayer ? "SCAMBOY" : rival!.name,
        isPlayer,
        car,
        ai: rival ? new RacerAI(rival.personality, i, td, rng(seed * 31 + i * 7)) : null,
        started: false,
        lapsDone: 0,
        nextCp: 0,
        cpCount: 0,
        s: progressAt(td, slot.x, slot.y),
        finished: false,
        finishTime: 0,
        lapStart: 0,
        lapTimes: [],
        bestLap: 0,
        scLap: new Set(),
        scUses: 0,
        inShortcut: 0,
        covered: 0,
        rank: i + 1,
        wrongWay: 0,
        respawnT: 0,
      };
      racer.ai?.resync(td, car);
      this.racers.push(racer);
    });
    this.player = this.racers[3];
    this.cones = td.cones.map((c) => ({ x: c.x, y: c.y, hx: c.x, hy: c.y, vx: 0, vy: 0, spin: 0, angle: 0, knocked: 0 }));
  }

  get laps() {
    return this.td.def.laps;
  }

  /** race distance used for ranking & rubber banding */
  raceDist(r: Racer) {
    const L = this.td.L;
    const seg = L / this.cpS.length;
    const toNext = (this.cpS[r.nextCp] - r.s + L) % L;
    return r.cpCount * seg - Math.min(toNext, seg * 1.5);
  }

  step(dt: number, playerInput: CarInput) {
    this.events = [];
    const td = this.td;
    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = "racing";
    }
    const racing = this.phase !== "countdown";
    if (racing) this.time += dt;

    const playerDist = this.raceDist(this.player);
    for (const r of this.racers) {
      const car = r.car;
      let input: CarInput = NO_INPUT;
      let scale = 1;
      if (r.ai) {
        const others = this.racers.filter((o) => o !== r && o.car.active).map((o) => o.car);
        input = r.ai.update(td, car, dt, others, racing && !r.finished);
        if (r.finished) input = { ...input, throttle: 0.3, boost: false };
        // mild rubber band relative to the player
        const diff = this.raceDist(r) - playerDist;
        if (!this.player.finished) {
          if (diff > 260) scale = 1 - Math.min(0.09, (diff - 260) / 3000);
          else if (diff < -260) scale = 1 + Math.min(0.08, (-diff - 260) / 3000);
        }
      } else if (racing) {
        input = r.finished ? NO_INPUT : playerInput;
      }
      if (!racing) input = NO_INPUT;
      // short freeze after a respawn (the time penalty)
      if (r.respawnT > 0) {
        r.respawnT -= dt;
        input = NO_INPUT;
      }
      car.events.length = 0;
      const wasFalling = car.falling > 0;
      car.step(td, input, dt, scale);
      for (const kind of car.events) this.events.push({ type: "car", racer: r, kind });

      // fall → respawn after the animation
      if (wasFalling && car.falling <= 0) this.respawn(r);
      if (r.ai?.wantsRespawn) this.respawn(r);

      this.updateProgress(r, dt);
    }
    this.collideCars();
    this.updateCones(dt);
    this.rank();
  }

  private updateProgress(r: Racer, dt: number) {
    const td = this.td;
    const car = r.car;
    const L = td.L;
    const ci = idxAt(td, car.x, car.y);
    r.covered = ci >= 0 ? td.cover[ci] : 0;
    if (!car.active) return;
    const p = progressAt(td, car.x, car.y);
    if (p < 0) return;
    let ds = p - r.s;
    if (ds > L / 2) ds -= L;
    if (ds < -L / 2) ds += L;
    if (ds > 0 && ds < 320 && !r.finished) {
      // crossed checkpoints?
      for (let guard = 0; guard < 3; guard++) {
        const c = this.cpS[r.nextCp];
        const rel = (c - r.s + L) % L;
        if (rel <= 0 || rel > ds) break;
        this.passCheckpoint(r);
      }
    }
    // wrong-way detection (player hint)
    if (ds < -0.5 && car.fwdSpeed > 30) r.wrongWay += dt;
    else if (ds > 0.5) r.wrongWay = Math.max(0, r.wrongWay - dt * 2);
    if (Math.abs(ds) < 320) r.s = p;

    // shortcut usage
    const scId = ci >= 0 ? td.sc[ci] : 0;
    if (scId && scId !== r.inShortcut && !r.finished && r.started) {
      const k = scId - 1;
      if (!r.scLap.has(k)) {
        r.scLap.add(k);
        r.scUses++;
        const first = r.isPlayer && !this.playerSeen.has(k);
        if (r.isPlayer) this.playerSeen.add(k);
        this.events.push({ type: "shortcut", racer: r, sc: k, firstInRace: first });
      }
    }
    r.inShortcut = scId;
  }

  private passCheckpoint(r: Racer) {
    const n = this.cpS.length;
    const wasStart = r.nextCp === 0;
    r.nextCp = (r.nextCp + 1) % n;
    r.cpCount++;
    if (!wasStart) return;
    if (!r.started) {
      r.started = true;
      r.lapStart = this.time;
      return;
    }
    const lapTime = this.time - r.lapStart;
    r.lapTimes.push(lapTime);
    const best = r.bestLap === 0 || lapTime < r.bestLap;
    if (best) r.bestLap = lapTime;
    r.lapStart = this.time;
    r.lapsDone++;
    r.scLap.clear();
    r.ai?.newLap();
    if (r.lapsDone >= this.laps) {
      r.finished = true;
      r.finishTime = this.time;
      this.finishedCount++;
      this.events.push({ type: "finish", racer: r, place: this.finishedCount, time: this.time });
      if (r.isPlayer) this.phase = "done";
    } else {
      this.events.push({ type: "lap", racer: r, lap: r.lapsDone + 1, time: lapTime, best });
    }
  }

  respawn(r: Racer) {
    const td = this.td;
    let x: number;
    let y: number;
    let a: number;
    if (!r.started) {
      const slot = td.startSlots[Math.min(3, r.id)];
      x = slot.x;
      y = slot.y;
      a = slot.a;
    } else {
      const n = this.cpS.length;
      const s = this.cpS[(r.nextCp - 1 + n) % n] + 6;
      const p = pointAtS(td, s);
      // offset sideways if another car sits on the spot
      let off = 0;
      for (const o of this.racers) {
        if (o !== r && Math.hypot(o.car.x - p.x, o.car.y - p.y) < 14) off = off === 0 ? 14 : -off;
      }
      x = p.x - Math.sin(p.a) * off;
      y = p.y + Math.cos(p.a) * off;
      a = p.a;
      r.s = (s + td.L) % td.L;
    }
    r.car.placeAt(x, y, a);
    r.inShortcut = 0;
    r.respawnT = 1;
    r.ai?.resync(td, r.car);
    this.events.push({ type: "respawn", racer: r });
  }

  private collideCars() {
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i].car;
      if (!a.active || a.air > 0) continue;
      for (let j = i + 1; j < rs.length; j++) {
        const b = rs[j].car;
        if (!b.active || b.air > 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius + 1;
        if (d >= min || d < 0.001) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - d;
        const ma = a.stats.mass;
        const mb = b.stats.mass;
        const ka = mb / (ma + mb);
        const kb = ma / (ma + mb);
        const ax = a.x - nx * overlap * ka;
        const ay = a.y - ny * overlap * ka;
        const bx = b.x + nx * overlap * kb;
        const by = b.y + ny * overlap * kb;
        if (!a.blocked(this.td, ax, ay)) {
          a.x = ax;
          a.y = ay;
        }
        if (!b.blocked(this.td, bx, by)) {
          b.x = bx;
          b.y = by;
        }
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn > 0) {
          const imp = vn * 0.9;
          a.vx -= nx * imp * ka;
          a.vy -= ny * imp * ka;
          b.vx += nx * imp * kb;
          b.vy += ny * imp * kb;
          if (vn > 25) this.events.push({ type: "bump", a: rs[i], b: rs[j], force: vn });
        }
      }
    }
  }

  private updateCones(dt: number) {
    for (const c of this.cones) {
      if (c.knocked > 0) {
        c.knocked -= dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= Math.exp(-2.5 * dt);
        c.vy *= Math.exp(-2.5 * dt);
        c.angle += c.spin * dt;
        if (c.knocked <= 0) {
          c.x = c.hx;
          c.y = c.hy;
          c.angle = 0;
        }
        continue;
      }
      for (const r of this.racers) {
        const car = r.car;
        if (!car.active || car.air > 0.05) continue;
        const dx = c.x - car.x;
        const dy = c.y - car.y;
        if (dx * dx + dy * dy < 8 * 8) {
          const sp = car.speed;
          const d = Math.hypot(dx, dy) || 1;
          c.vx = car.vx * 1.15 + (dx / d) * (40 + sp * 0.3);
          c.vy = car.vy * 1.15 + (dy / d) * (40 + sp * 0.3);
          c.spin = (this.rand() - 0.5) * 30;
          c.knocked = 7;
          car.vx *= 0.88;
          car.vy *= 0.88;
          this.events.push({ type: "cone", racer: r, cone: c });
          break;
        }
      }
    }
  }

  private rank() {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return this.raceDist(b) - this.raceDist(a);
    });
    sorted.forEach((r, i) => (r.rank = i + 1));
  }

  /** final classification once the player finished: unfinished rivals are projected */
  results() {
    const est = (r: Racer) => {
      if (r.finished) return r.finishTime;
      const total = this.laps * this.td.L;
      const done = clamp(this.raceDist(r) - (this.td.L / this.cpS.length), 1, total);
      const pace = this.time / Math.max(1, done);
      return this.time + (total - done) * pace;
    };
    return [...this.racers]
      .map((r) => ({ r, time: est(r), est: !r.finished }))
      .sort((a, b) => a.time - b.time);
  }
}
