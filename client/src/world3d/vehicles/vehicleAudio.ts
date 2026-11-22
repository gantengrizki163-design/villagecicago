import type { VehicleCategory } from '../../types/game';

const MUTE_KEY = 'cicalengka_vehicle_audio_muted';

class VehicleAudioEngine {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private running = false;
  private muted = false;
  private lastSkidAt = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.muted = window.localStorage.getItem(MUTE_KEY) === '1';
      } catch {
        this.muted = false;
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(mute: boolean): void {
    this.muted = mute;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MUTE_KEY, mute ? '1' : '0');
      } catch {
        // Abaikan kegagalan storage
      }
    }
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(mute ? 0 : 0.035, this.ctx.currentTime, 0.05);
    }
  }

  startEngine(isElectric = false, category: VehicleCategory = 'motor'): void {
    if (this.running) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = isElectric ? 'sine' : category === 'motor' ? 'sawtooth' : 'triangle';
      osc2.type = isElectric ? 'triangle' : 'sine';

      const baseFreq = isElectric ? 140 : category === 'motor' ? 54 : 38;
      osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc2.frequency.setValueAtTime(baseFreq * 2, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isElectric ? 620 : category === 'motor' ? 420 : 280, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setTargetAtTime(this.muted ? 0 : isElectric ? 0.024 : 0.035, ctx.currentTime, 0.12);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      this.oscPrimary = osc1;
      this.oscHarmonic = osc2;
      this.filter = filter;
      this.gain = gain;
      this.running = true;
    } catch {
      this.stopEngine();
    }
  }

  updateEngine(speedRatio: number, isElectric: boolean, category: VehicleCategory, hasFuel: boolean): void {
    if (this.muted || !hasFuel) {
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }
    if (!this.running || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.filter || !this.gain) {
      return;
    }

    const r = Math.max(0, Math.min(1, speedRatio));
    const t = this.ctx.currentTime;
    const minFreq = isElectric ? 140 : category === 'motor' ? 54 : 38;
    const maxFreq = isElectric ? 430 : category === 'motor' ? 168 : 118;
    const freq = minFreq + (maxFreq - minFreq) * r;

    this.oscPrimary.frequency.setTargetAtTime(freq, t, 0.06);
    this.oscHarmonic.frequency.setTargetAtTime(freq * (isElectric ? 1.5 : 2), t, 0.06);
    this.filter.frequency.setTargetAtTime(
      isElectric ? 600 + r * 900 : category === 'motor' ? 380 + r * 620 : 240 + r * 420,
      t,
      0.08
    );
    const vol = (isElectric ? 0.02 : 0.028) + r * (isElectric ? 0.028 : 0.036);
    this.gain.gain.setTargetAtTime(vol, t, 0.08);
  }

  stopEngine(): void {
    this.running = false;
    try {
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
      const o1 = this.oscPrimary;
      const o2 = this.oscHarmonic;
      window.setTimeout(() => {
        try {
          o1?.stop();
          o2?.stop();
          o1?.disconnect();
          o2?.disconnect();
        } catch {
          // Abaikan
        }
      }, 90);
    } catch {
      // Abaikan
    }
    this.oscPrimary = null;
    this.oscHarmonic = null;
    this.filter = null;
    this.gain = null;
  }

  playEngineStart(isElectric = false): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isElectric ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isElectric ? 340 : 65, now);
      osc.frequency.exponentialRampToValueAtTime(isElectric ? 620 : 120, now + 0.18);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Abaikan
    }
  }

  playHorn(category: VehicleCategory = 'motor'): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const gain = ctx.createGain();

      oscA.type = 'sawtooth';
      oscB.type = 'square';
      if (category === 'motor') {
        oscA.frequency.setValueAtTime(520, now);
        oscB.frequency.setValueAtTime(645, now);
      } else {
        oscA.frequency.setValueAtTime(385, now);
        oscB.frequency.setValueAtTime(485, now);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
      gain.gain.setValueAtTime(0.065, now + 0.19);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      oscA.start(now);
      oscB.start(now);
      oscA.stop(now + 0.28);
      oscB.stop(now + 0.28);
    } catch {
      // Abaikan
    }
  }

  playCrash(severity = 0.5): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);

      const vol = Math.min(0.12, 0.04 + severity * 0.07);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Abaikan
    }
  }

  playTurnSignalTick(onPhase = true): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(onPhase ? 920 : 680, now);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Abaikan
    }
  }

  playEngineSputter(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.setValueAtTime(58, now + 0.09);
      osc.frequency.setValueAtTime(84, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.34);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.setValueAtTime(0.015, now + 0.1);
      gain.gain.setValueAtTime(0.04, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // Abaikan
    }
  }

  playSkidChirp(): void {
    if (this.muted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastSkidAt < 450) return;
    this.lastSkidAt = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } catch {
      // Abaikan
    }
  }
}

export const vehicleAudio = new VehicleAudioEngine();
