import type { LevelDef } from "./pulse-core";
import {
  DEFAULT_AUDIO,
  degreeFor,
  degreeToMidi,
  drumVoiceFor,
  keyForLevel,
  midiToFreq,
  nodeRanks,
  type AudioSettings,
  type DrumVoice,
  type LevelKey,
} from "./music";

const DEMO_KEY: LevelKey = { root: 48, mode: "major" };

function makeDistortionCurve() {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 5);
  return curve;
}

export class PulseAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private curve?: ReturnType<typeof makeDistortionCurve>;
  private guitarCache = new Map<number, AudioBuffer>();
  private drone: { gain: GainNode; oscs: OscillatorNode[] } | null = null;

  private readonly key: LevelKey;
  private readonly ranks: Map<string, number>;
  private readonly count: number;

  constructor(level: LevelDef | null, private settings: AudioSettings = DEFAULT_AUDIO) {
    this.key = level ? keyForLevel(level.id) : DEMO_KEY;
    this.ranks = level ? nodeRanks(level) : new Map();
    this.count = level ? level.nodes.length : 0;
  }

  // ---------- controls ----------

  update(settings: AudioSettings): void {
    this.settings = settings;
    this.applyVolume(false);
    this.syncDrone();
  }

  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const limiter = ctx.createDynamicsCompressor();
      const master = ctx.createGain();
      master.connect(limiter);
      limiter.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.applyVolume(true);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.syncDrone();
  }

  step(nodeId: string, delaySec = 0): void {
    const rank = this.ranks.get(nodeId);
    if (rank === undefined || !this.ctx || this.settings.muted) return;
    this.playRank(rank, this.ctx.currentTime + delaySec);
  }

  win(): void {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted) return;
    const t0 = ctx.currentTime + 0.25;
    if (this.settings.instrument === "drums") {
      (["kick", "hat", "snare", "tom", "kick", "openhat"] as DrumVoice[]).forEach((v, i) =>
        this.drum(v, t0 + i * 0.11)
      );
    } else {
      [5, 6, 7, 9, 10].forEach((d, i) => this.note(degreeToMidi(this.key, d), t0 + i * 0.11));
    }
  }

  preview(): void {
    this.resume();
    const ctx = this.ctx;
    if (!ctx || this.settings.muted) return;
    const t0 = ctx.currentTime + 0.05;
    if (this.settings.instrument === "drums") {
      (["kick", "hat", "snare", "hat", "kick", "tom", "snare", "openhat"] as DrumVoice[]).forEach((v, i) =>
        this.drum(v, t0 + i * 0.22)
      );
    } else {
      [0, 2, 1, 4, 3, 6, 5, 7].forEach((d, i) => this.note(degreeToMidi(DEMO_KEY, d), t0 + i * 0.24));
    }
  }

  destroy(): void {
    this.stopDrone();
    void this.ctx?.close();
    this.ctx = undefined;
  }

  private applyVolume(instant: boolean): void {
    if (!this.ctx || !this.master) return;
    const v = this.settings.muted ? 0 : this.settings.volume ** 2;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, instant ? 0.001 : 0.03);
  }

  private syncDrone(): void {
    const want = this.settings.drone && !this.settings.muted && this.count > 0;
    if (want && !this.drone) this.startDrone();
    else if (!want && this.drone) this.stopDrone();
  }

  private startDrone(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.8);
    gain.connect(this.master);
    const oscs = [0, 7].map((offset, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiToFreq(this.key.root + offset);
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.5;
      o.connect(g);
      g.connect(gain);
      o.start();
      return o;
    });
    this.drone = { gain, oscs };
  }

  private stopDrone(): void {
    const d = this.drone;
    const ctx = this.ctx;
    this.drone = null;
    if (!d || !ctx) return;
    d.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    d.oscs.forEach((o) => o.stop(ctx.currentTime + 1));
  }

  // ---------- base ----------

  private playRank(rank: number, t: number): void {
    if (this.settings.instrument === "drums") this.drum(drumVoiceFor(rank, this.count), t);
    else this.note(degreeToMidi(this.key, degreeFor(rank, this.count)), t);
  }

  private note(midi: number, t: number): void {
    switch (this.settings.instrument) {
      case "piano":
        return this.piano(midiToFreq(midi), t);
      case "guitar":
        return this.guitar(midi, t);
      default:
        return this.synth(midiToFreq(midi), t);
    }
  }

  private synth(freq: number, t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.7);
  }

  /** piano */
  private piano(freq: number, t: number): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    const dur = Math.min(2.4, Math.max(0.6, 2.8 - freq / 400));
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.5, t + 0.004);
    out.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    out.connect(this.master!);

    [[1, 0.7], [2, 0.3], [3, 0.14], [4, 0.06]].forEach(([mult, amp], i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq * mult * (i === 1 ? 1.002 : 1);
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur / (1 + i * 0.6));
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  /** electric guitar */
  private guitar(midi: number, t: number): void {
    const ctx = this.ctx!;
    this.curve ??= makeDistortionCurve();

    const src = ctx.createBufferSource();
    const { buffer, actualFreq } = this.stringBuffer(midi);
    src.buffer = buffer;
    src.playbackRate.value = midiToFreq(midi) / actualFreq;

    const pre = ctx.createGain();
    pre.gain.value = 2.5;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.curve;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const out = ctx.createGain();
    out.gain.value = 0.08;

    src.connect(pre);
    pre.connect(shaper);
    shaper.connect(lp);
    lp.connect(out);
    out.connect(this.master!);
    src.start(t);
  }

  private stringBuffer(midi: number): { buffer: AudioBuffer; actualFreq: number } {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const n = Math.max(2, Math.round(sr / midiToFreq(midi)));
    const actualFreq = sr / (n + 0.5);
    const cached = this.guitarCache.get(midi);
    if (cached) return { buffer: cached, actualFreq };

    const len = Math.floor(sr * 1.6);
    const data = new Float32Array(len);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
      data[i] = prev;
    }
    for (let i = n; i < len; i++) {
      const a = data[i - n];
      const b = i - n - 1 >= 0 ? data[i - n - 1] : a;
      data[i] = 0.5 * (a + b) * 0.997;
    }
    const buffer = ctx.createBuffer(1, len, sr);
    buffer.copyToChannel(data, 0);
    this.guitarCache.set(midi, buffer);
    return { buffer, actualFreq };
  }

  // ---------- drums ----------

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const ctx = this.ctx!;
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    return this.noise;
  }

  private drum(v: DrumVoice, t: number): void {
    const ctx = this.ctx!;
    const out = this.master!;

    const tone = (f0: number, f1: number, sweep: number, peak: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };

    const noise = (type: BiquadFilterType, freq: number, peak: number, dur: number) => {
      const s = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = this.noiseBuffer();
      f.type = type;
      f.frequency.value = freq;
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(out);
      s.start(t);
      s.stop(t + dur + 0.05);
    };

    switch (v) {
      case "kick":
        return tone(160, 45, 0.12, 0.9, 0.35);
      case "tom":
        return tone(220, 110, 0.15, 0.6, 0.3);
      case "snare":
        noise("bandpass", 1800, 0.5, 0.18);
        return tone(190, 150, 0.05, 0.25, 0.1);
      case "hat":
        return noise("highpass", 7000, 0.22, 0.05);
      case "openhat":
        return noise("highpass", 7000, 0.2, 0.28);
    }
  }
}
