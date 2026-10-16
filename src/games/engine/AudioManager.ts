/**
 * AudioManager — 100% synthesized chiptune audio via the Web Audio API.
 * No audio files: sound effects and looping music are generated at runtime.
 *
 * Browser autoplay rules: the AudioContext is resumed on the first user gesture
 * (see Audio.unlock(), wired up by the console).
 */

export type SfxName =
  | "boot"
  | "move"
  | "select"
  | "back"
  | "pause"
  | "click"
  | "punch"
  | "hit"
  | "heavyHit"
  | "whoosh"
  | "jump"
  | "land"
  | "flex"
  | "ko"
  | "pickup"
  | "break"
  | "coin"
  | "countdown"
  | "go"
  | "boost"
  | "crash"
  | "skid"
  | "lap"
  | "shuffle"
  | "lift"
  | "correct"
  | "wrong"
  | "win"
  | "lose"
  | "achievement"
  | "error"
  | "fall"
  | "spring"
  | "alarm"
  | "horn"
  | "secret"
  | "hurt"
  | "step";

export type SongName = "menu" | "shell" | "racing" | "rampage" | "boss";

type Wave = OscillatorType | "pulse25" | "pulse12";

interface ToneOpts {
  type?: Wave;
  freq: number;
  to?: number;
  slide?: "exp" | "lin";
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
  dest?: AudioNode;
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  delay?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  dest?: AudioNode;
}

const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function noteFreq(n: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  if (!m) return 440;
  const semis = NOTE_INDEX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

interface Song {
  bpm: number;
  lead: string[];
  bass: string[];
  arp?: string[];
  drums: string[];
}

const SONGS: Record<SongName, Song> = {
  menu: {
    bpm: 116,
    lead: [
      "E5 - G5 - C6 - - G5 A5 - G5 - E5 - D5 -",
      "C5 - - - A4 - C5 - E5 - - D5 - C5 B4 -",
      "A4 - C5 - F5 - A5 - G5 - F5 - E5 - C5 -",
      "D5 - - - G5 - - - B4 - D5 - G4 - . .",
    ],
    bass: [
      "C3 . C3 . G2 . C3 . C3 . G2 . C3 . E3 .",
      "A2 . A2 . E2 . A2 . A2 . E2 . A2 . C3 .",
      "F2 . F2 . C3 . F2 . F2 . C3 . F2 . A2 .",
      "G2 . G2 . D3 . G2 . G2 . D3 . B2 . G2 .",
    ],
    arp: [
      "C6 G5 E5 G5 C6 G5 E5 G5 C6 G5 E5 G5 C6 G5 E5 G5",
      "A5 E5 C5 E5 A5 E5 C5 E5 A5 E5 C5 E5 A5 E5 C5 E5",
      "A5 F5 C5 F5 A5 F5 C5 F5 A5 F5 C5 F5 A5 F5 C5 F5",
      "B5 G5 D5 G5 B5 G5 D5 G5 B5 G5 D5 G5 B5 G5 D5 G5",
    ],
    drums: ["k . h . s . h . k k h . s . h h"],
  },
  shell: {
    bpm: 104,
    lead: [
      "D5 . F5 . A5 - G5 F5 . D5 . . C5 - D5 .",
      "F5 . E5 . D5 - - . A4 . C5 . D5 - - .",
      "G5 . F5 . E5 . G5 - F5 . E5 . D5 . C5 .",
      "D5 - - - A4 . . C5 D5 - - - . . . .",
    ],
    bass: [
      "D3 . . . A2 . . . C3 . . . A2 . . .",
      "G2 . . . D3 . . . F3 . . . D3 . . .",
      "C3 . . . G2 . . . E3 . . . G2 . . .",
      "D3 . . . A2 . . . D3 . C3 . A2 . . .",
    ],
    drums: ["k . . h s . h . k . h k s . h ."],
  },
  racing: {
    bpm: 160,
    lead: [
      "A5 . A5 . G5 . E5 - - . C5 . D5 . E5 .",
      "G5 . G5 . F5 . D5 - - . B4 . C5 . D5 .",
      "E5 . E5 . F5 . G5 . A5 - - . G5 . E5 .",
      "A5 - - - B5 - - - C6 - - - E5 . . .",
    ],
    bass: [
      "A2 A3 A2 A3 A2 A3 A2 A3 F2 F3 F2 F3 F2 F3 F2 F3",
      "G2 G3 G2 G3 G2 G3 G2 G3 E2 E3 E2 E3 E2 E3 E2 E3",
      "F2 F3 F2 F3 F2 F3 F2 F3 G2 G3 G2 G3 G2 G3 G2 G3",
      "A2 A3 A2 A3 A2 A3 A2 A3 E2 E3 E2 E3 G2 G3 G#2 G#3",
    ],
    drums: ["k . h . s . h k k . h . s . h h"],
  },
  rampage: {
    bpm: 132,
    lead: [
      "E5 . . E5 . G5 . A5 . . G5 . E5 . D5 .",
      "E5 . . E5 . G5 . B5 . A5 . G5 . E5 . .",
      "C6 . B5 . A5 . G5 . A5 . . . E5 . G5 .",
      "B5 - - - A5 - G5 - F#5 - - - . . . .",
    ],
    bass: [
      "E2 . E3 . . E2 D3 . E2 . . G2 . A2 B2 .",
      "E2 . E3 . . E2 D3 . E2 . . G2 . B2 D3 .",
      "C3 . C3 . . C3 B2 . A2 . A2 . . A2 G2 .",
      "B2 . B2 . . B2 A2 . B2 . D#3 . F#3 . B2 .",
    ],
    drums: ["k . h k s . h . k k h . s . h s"],
  },
  boss: {
    bpm: 150,
    lead: [
      "E5 F5 E5 . B4 . E5 . F5 G5 F5 . E5 . . .",
      "E5 F5 E5 . C5 . E5 . G5 F5 E5 . D5 . . .",
    ],
    bass: [
      "E2 E2 E3 E2 E2 E3 E2 F2 E2 E2 E3 E2 E2 E3 F2 E2",
      "E2 E2 E3 E2 E2 E3 E2 F2 C2 C2 C3 C2 D2 D3 F2 E2",
    ],
    drums: ["k h s h k k s h k h s h k s s s"],
  },
};

interface ParsedEvent {
  step: number;
  note: string;
  len: number;
}

function parseChannel(bars: string[]): { events: ParsedEvent[]; length: number } {
  const tokens = bars.join(" ").trim().split(/\s+/);
  const events: ParsedEvent[] = [];
  let last: ParsedEvent | null = null;
  tokens.forEach((t, i) => {
    if (t === "-") {
      if (last) last.len++;
      return;
    }
    if (t === ".") {
      last = null;
      return;
    }
    last = { step: i, note: t, len: 1 };
    events.push(last);
  });
  return { events, length: tokens.length };
}

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private waves: Partial<Record<Wave, PeriodicWave>> = {};

  private muted = false;
  private musicVol = 0.6;
  private sfxVol = 0.8;

  private songName: SongName | null = null;
  private parsed: { lead: ReturnType<typeof parseChannel>; bass: ReturnType<typeof parseChannel>; arp?: ReturnType<typeof parseChannel>; drums: ReturnType<typeof parseChannel> } | null = null;
  private stepIndex = 0;
  private nextStepTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private duck = 1;

  private engine: { o1: OscillatorNode; o2: OscillatorNode; f: BiquadFilterNode; g: GainNode } | null = null;
  private lastSfx: Partial<Record<SfxName, number>> = {};

  /** Create (if needed) and resume the context. Call from a user gesture. */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") {
      this.resumeAt = performance.now();
      void ctx.resume().catch(() => {});
    }
  }

  private resumeAt = 0;

  /** false while autoplay-blocked, so sounds don't pile up and fire late */
  private canPlay(ctx: AudioContext) {
    return ctx.state === "running" || performance.now() - this.resumeAt < 600;
  }

  get running() {
    return !!this.ctx && this.ctx.state === "running";
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch {
      return null;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    // soft clip-ish compressor so stacked sfx don't distort
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.connect(this.master);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(comp);
    this.sfxBus.connect(comp);
    this.applyGains();

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const pulse = (duty: number) => {
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return ctx.createPeriodicWave(real, imag);
    };
    this.waves.pulse25 = pulse(0.25);
    this.waves.pulse12 = pulse(0.125);
    return ctx;
  }

  configure(opts: { muted?: boolean; musicVolume?: number; sfxVolume?: number }) {
    if (opts.muted !== undefined) this.muted = opts.muted;
    if (opts.musicVolume !== undefined) this.musicVol = opts.musicVolume;
    if (opts.sfxVolume !== undefined) this.sfxVol = opts.sfxVolume;
    this.applyGains();
  }

  private applyGains() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.55 * this.duck, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.02);
  }

  /** lower music (e.g. while paused) */
  setDuck(on: boolean) {
    this.duck = on ? 0.3 : 1;
    this.applyGains();
  }

  // ---------------------------------------------------------------- primitives

  tone(o: ToneOpts) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const type = o.type ?? "square";
    if (type === "pulse25" || type === "pulse12") osc.setPeriodicWave(this.waves[type]!);
    else osc.type = type;
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to !== undefined) {
      if (o.slide === "lin") osc.frequency.linearRampToValueAtTime(o.to, t + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
    }
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  noise(o: NoiseOpts) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? "lowpass";
    f.frequency.setValueAtTime(o.freq ?? 4000, t);
    if (o.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.02);
  }

  /** play a short melody: notes like "C5", "." rest; step in seconds */
  jingle(notes: string[], step: number, type: Wave = "pulse25", vol = 0.16) {
    notes.forEach((n, i) => {
      if (n === "." || n === "-") return;
      let len = 1;
      while (notes[i + len] === "-") len++;
      this.tone({ type, freq: noteFreq(n), dur: step * len * 0.95, vol, delay: i * step });
      this.tone({ type: "triangle", freq: noteFreq(n) / 2, dur: step * len * 0.95, vol: vol * 0.9, delay: i * step });
    });
  }

  // ---------------------------------------------------------------- sound effects

  sfx(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx || this.muted || !this.canPlay(ctx)) return;
    // simple rate limiting so spammy events don't pile up
    const now = performance.now();
    const last = this.lastSfx[name] ?? 0;
    if (now - last < 30) return;
    this.lastSfx[name] = now;

    switch (name) {
      case "boot":
        this.tone({ type: "pulse25", freq: noteFreq("C6"), dur: 0.12, vol: 0.18 });
        this.tone({ type: "pulse25", freq: noteFreq("C7"), dur: 0.9, vol: 0.18, delay: 0.1 });
        this.tone({ type: "triangle", freq: noteFreq("C5"), dur: 0.9, vol: 0.12, delay: 0.1 });
        break;
      case "move":
        this.tone({ type: "pulse25", freq: 880, dur: 0.05, vol: 0.12 });
        break;
      case "click":
        this.tone({ type: "square", freq: 1400, dur: 0.025, vol: 0.06 });
        break;
      case "select":
        this.tone({ type: "pulse25", freq: 660, dur: 0.06, vol: 0.14 });
        this.tone({ type: "pulse25", freq: 1320, dur: 0.12, vol: 0.14, delay: 0.06 });
        break;
      case "back":
        this.tone({ type: "pulse25", freq: 660, dur: 0.06, vol: 0.12 });
        this.tone({ type: "pulse25", freq: 440, dur: 0.1, vol: 0.12, delay: 0.06 });
        break;
      case "pause":
        this.jingle(["E6", "C6", "E6", "C6"], 0.06, "pulse25", 0.1);
        break;
      case "punch":
        this.noise({ dur: 0.08, vol: 0.35, filter: "lowpass", freq: 2500, to: 300 });
        this.tone({ type: "square", freq: 180, to: 60, dur: 0.08, vol: 0.25 });
        break;
      case "hit":
        this.noise({ dur: 0.12, vol: 0.4, filter: "bandpass", freq: 1200, to: 200, q: 0.8 });
        this.tone({ type: "square", freq: 220, to: 50, dur: 0.12, vol: 0.25 });
        break;
      case "heavyHit":
        this.noise({ dur: 0.25, vol: 0.5, filter: "lowpass", freq: 3000, to: 100 });
        this.tone({ type: "sawtooth", freq: 160, to: 30, dur: 0.25, vol: 0.3 });
        break;
      case "whoosh":
        this.noise({ dur: 0.12, vol: 0.12, filter: "bandpass", freq: 600, to: 3000, q: 2 });
        break;
      case "jump":
        this.tone({ type: "pulse25", freq: 220, to: 660, dur: 0.15, vol: 0.14 });
        break;
      case "land":
        this.noise({ dur: 0.06, vol: 0.18, filter: "lowpass", freq: 600, to: 100 });
        break;
      case "step":
        this.noise({ dur: 0.03, vol: 0.06, filter: "lowpass", freq: 500, to: 150 });
        break;
      case "flex":
        this.tone({ type: "sawtooth", freq: 82, dur: 0.6, vol: 0.25 });
        this.tone({ type: "sawtooth", freq: 123, dur: 0.6, vol: 0.2 });
        this.tone({ type: "pulse25", freq: 330, to: 990, dur: 0.4, vol: 0.12, delay: 0.05 });
        this.noise({ dur: 0.6, vol: 0.3, filter: "lowpass", freq: 4000, to: 80, delay: 0.1 });
        break;
      case "ko":
        this.tone({ type: "square", freq: 440, to: 55, dur: 0.5, vol: 0.2 });
        this.noise({ dur: 0.35, vol: 0.4, filter: "lowpass", freq: 2000, to: 60 });
        break;
      case "pickup":
        this.jingle(["C6", "E6", "G6", "C7"], 0.05, "pulse25", 0.12);
        break;
      case "coin":
        this.tone({ type: "pulse25", freq: noteFreq("B5"), dur: 0.07, vol: 0.13 });
        this.tone({ type: "pulse25", freq: noteFreq("E6"), dur: 0.25, vol: 0.13, delay: 0.07 });
        break;
      case "break":
        this.noise({ dur: 0.3, vol: 0.45, filter: "highpass", freq: 1500, to: 400 });
        this.noise({ dur: 0.2, vol: 0.3, filter: "lowpass", freq: 800, to: 100, delay: 0.05 });
        break;
      case "countdown":
        this.tone({ type: "pulse25", freq: noteFreq("A5"), dur: 0.2, vol: 0.18 });
        break;
      case "go":
        this.tone({ type: "pulse25", freq: noteFreq("A6"), dur: 0.5, vol: 0.2 });
        this.tone({ type: "triangle", freq: noteFreq("A4"), dur: 0.5, vol: 0.18 });
        break;
      case "boost":
        this.tone({ type: "sawtooth", freq: 120, to: 600, dur: 0.4, vol: 0.14 });
        this.noise({ dur: 0.5, vol: 0.2, filter: "bandpass", freq: 800, to: 4000, q: 1 });
        break;
      case "crash":
        this.noise({ dur: 0.3, vol: 0.45, filter: "lowpass", freq: 1800, to: 120 });
        this.tone({ type: "square", freq: 120, to: 40, dur: 0.2, vol: 0.2 });
        break;
      case "skid":
        this.noise({ dur: 0.25, vol: 0.12, filter: "bandpass", freq: 2400, to: 1800, q: 6 });
        break;
      case "lap":
        this.jingle(["G5", "C6", "E6", "G6"], 0.07, "pulse25", 0.13);
        break;
      case "shuffle":
        this.noise({ dur: 0.07, vol: 0.12, filter: "bandpass", freq: 1800, to: 900, q: 3 });
        break;
      case "lift":
        this.tone({ type: "triangle", freq: 300, to: 600, dur: 0.15, vol: 0.18 });
        break;
      case "correct":
        this.jingle(["C6", "E6", "G6", "C7", "-", "-"], 0.07, "pulse25", 0.15);
        break;
      case "wrong":
        this.jingle(["G4", "F#4", "F4", "E4", "-", "-"], 0.12, "square", 0.12);
        break;
      case "win":
        this.jingle(["C5", "E5", "G5", "C6", ".", "G5", "C6", "-", "-", "-"], 0.11, "pulse25", 0.15);
        break;
      case "lose":
        this.jingle(["C5", ".", "G4", ".", "E4", "-", "A4", "B4", "A4", "G#4", "-", "-"], 0.13, "pulse25", 0.13);
        break;
      case "achievement":
        this.jingle(["E6", "G6", "E7", "-", "C7", "D7", "G7", "-", "-"], 0.06, "pulse12", 0.12);
        break;
      case "secret":
        this.jingle(["G5", "F#5", "D#5", "A4", "G#4", "E5", "G#5", "C6"], 0.07, "pulse25", 0.12);
        break;
      case "error":
        this.tone({ type: "square", freq: 110, dur: 0.15, vol: 0.15 });
        break;
      case "fall":
        this.tone({ type: "triangle", freq: 900, to: 80, dur: 0.8, vol: 0.18 });
        break;
      case "spring":
        this.tone({ type: "pulse25", freq: 200, to: 900, dur: 0.25, vol: 0.14 });
        this.tone({ type: "pulse25", freq: 400, to: 1200, dur: 0.2, vol: 0.08, delay: 0.1 });
        break;
      case "alarm":
        this.tone({ type: "square", freq: 880, dur: 0.12, vol: 0.12 });
        this.tone({ type: "square", freq: 660, dur: 0.12, vol: 0.12, delay: 0.14 });
        break;
      case "horn":
        this.tone({ type: "sawtooth", freq: 330, dur: 0.3, vol: 0.12 });
        this.tone({ type: "sawtooth", freq: 415, dur: 0.3, vol: 0.1 });
        break;
      case "hurt":
        this.tone({ type: "square", freq: 300, to: 120, dur: 0.18, vol: 0.18 });
        this.noise({ dur: 0.1, vol: 0.25, filter: "lowpass", freq: 1500, to: 200 });
        break;
    }
  }

  // ---------------------------------------------------------------- music

  playMusic(name: SongName) {
    if (this.songName === name && this.timer) return;
    this.stopMusic();
    const ctx = this.ensure();
    if (!ctx) return;
    const song = SONGS[name];
    this.songName = name;
    this.parsed = {
      lead: parseChannel(song.lead),
      bass: parseChannel(song.bass),
      arp: song.arp ? parseChannel(song.arp) : undefined,
      drums: parseChannel(song.drums),
    };
    this.stepIndex = 0;
    this.nextStepTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.songName = null;
    this.parsed = null;
  }

  get currentSong() {
    return this.songName;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.parsed || !this.songName) return;
    if (ctx.state !== "running") {
      this.nextStepTime = ctx.currentTime + 0.05;
      return;
    }
    const song = SONGS[this.songName];
    const stepDur = 60 / song.bpm / 4;
    // if we fell far behind (tab hidden), resync
    if (this.nextStepTime < ctx.currentTime - 0.2) this.nextStepTime = ctx.currentTime + 0.05;
    while (this.nextStepTime < ctx.currentTime + 0.12) {
      this.playStep(this.stepIndex, this.nextStepTime, stepDur);
      this.stepIndex++;
      this.nextStepTime += stepDur;
    }
  }

  private playStep(i: number, t: number, stepDur: number) {
    const p = this.parsed!;
    const ctx = this.ctx!;
    const dl = t - ctx.currentTime;
    const at = (ch: { events: ParsedEvent[]; length: number }) => {
      const s = i % ch.length;
      return ch.events.filter((e) => e.step === s);
    };
    for (const e of at(p.lead)) {
      this.tone({ type: "pulse25", freq: noteFreq(e.note), dur: stepDur * e.len * 0.92, vol: 0.12, delay: dl, dest: this.musicBus });
    }
    for (const e of at(p.bass)) {
      this.tone({ type: "triangle", freq: noteFreq(e.note), dur: stepDur * e.len * 0.9, vol: 0.32, delay: dl, dest: this.musicBus });
    }
    if (p.arp) {
      for (const e of at(p.arp)) {
        this.tone({ type: "pulse12", freq: noteFreq(e.note), dur: stepDur * 0.6, vol: 0.035, delay: dl, dest: this.musicBus });
      }
    }
    for (const e of at(p.drums)) {
      if (e.note === "k") {
        this.tone({ type: "sine", freq: 150, to: 40, dur: 0.14, vol: 0.55, delay: dl, dest: this.musicBus });
      } else if (e.note === "s") {
        this.noise({ dur: 0.12, vol: 0.22, filter: "bandpass", freq: 1900, q: 0.7, delay: dl, dest: this.musicBus });
        this.tone({ type: "triangle", freq: 220, to: 120, dur: 0.06, vol: 0.12, delay: dl, dest: this.musicBus });
      } else if (e.note === "h") {
        this.noise({ dur: 0.035, vol: 0.07, filter: "highpass", freq: 7000, delay: dl, dest: this.musicBus });
      }
    }
  }

  // ---------------------------------------------------------------- car engine

  engineStart() {
    const ctx = this.ensure();
    if (!ctx || this.engine) return;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = "sawtooth";
    o2.type = "square";
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0;
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    o1.frequency.value = 50;
    o2.frequency.value = 25;
    o1.start();
    o2.start();
    this.engine = { o1, o2, f, g };
  }

  /** speed 0..1(+), throttle 0..1 */
  engineUpdate(speed: number, throttle: number) {
    if (!this.engine || !this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.max(0, Math.min(1.4, speed));
    const base = 42 + s * 120;
    this.engine.o1.frequency.setTargetAtTime(base, t, 0.05);
    this.engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    this.engine.f.frequency.setTargetAtTime(350 + s * 1300 + throttle * 300, t, 0.05);
    this.engine.g.gain.setTargetAtTime(this.muted ? 0 : 0.035 + throttle * 0.035 + s * 0.02, t, 0.05);
  }

  engineStop() {
    if (!this.engine) return;
    const { o1, o2, g } = this.engine;
    try {
      g.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.03);
      o1.stop(this.ctx!.currentTime + 0.15);
      o2.stop(this.ctx!.currentTime + 0.15);
    } catch {
      /* already stopped */
    }
    this.engine = null;
  }

  /** stop everything game-specific (music keeps playing unless stopMusic) */
  stopAllLoops() {
    this.engineStop();
  }
}

export const Audio = new AudioManagerImpl();
