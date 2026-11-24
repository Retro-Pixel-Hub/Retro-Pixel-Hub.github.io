/**
 * Chiptune audio, synthesised live with the Web Audio API — square, triangle
 * and noise channels like the original handheld. No audio files needed, so it
 * works offline and weighs nothing.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz

class ChipAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxOn = true;
    this.musicOn = false;
    this._musicTimer = null;
    this._step = 0;
    this._nextTime = 0;
    this._noise = null;
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  setSfx(on) { this.sfxOn = on; }
  setMusic(on) {
    this.musicOn = on;
    if (on) this.startMusic(); else this.stopMusic();
  }
  suspend() { this.ctx?.suspend(); }
  resume() { if (this.ctx && (this.sfxOn || this.musicOn)) this.ctx.resume(); }

  // ---- primitives -----------------------------------------------------------

  tone({ freq, to = null, type = 'square', dur = 0.08, vol = 0.5, when = 0, dest = null, duty = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (type === 'pulse' && duty) {
      osc.setPeriodicWave(this._pulseWave(duty));
    } else {
      osc.type = type === 'pulse' ? 'square' : type;
    }
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(dest || this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.4, when = 0, lowpass = 2000 }) {
    if (!this.ctx) return;
    if (!this._noise) {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lowpass, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _pulseWave(duty) {
    this._waves ??= new Map();
    if (this._waves.has(duty)) return this._waves.get(duty);
    const n = 32;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    const w = this.ctx.createPeriodicWave(real, imag);
    this._waves.set(duty, w);
    return w;
  }

  // ---- sound effects ----------------------------------------------------------

  play(name) {
    if (!this.sfxOn || !this.ctx) return;
    const s = SFX[name];
    if (s) s(this);
  }

  // ---- music: a tiny original 4-bar loop on two channels -------------------------

  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.05;
    this._musicTimer = setInterval(() => this._schedule(), 50);
  }
  stopMusic() {
    clearInterval(this._musicTimer);
    this._musicTimer = null;
  }
  _schedule() {
    const stepDur = 60 / 132 / 2; // eighth notes at 132 BPM
    while (this._nextTime < this.ctx.currentTime + 0.2) {
      const i = this._step % MELODY.length;
      const when = this._nextTime - this.ctx.currentTime;
      if (MELODY[i]) this.tone({ freq: NOTE(MELODY[i]), type: 'pulse', duty: 0.25, dur: stepDur * 0.9, vol: 0.22, when, dest: this.musicGain });
      const b = BASS[Math.floor(i / 2) % BASS.length];
      if (i % 2 === 0 && b) this.tone({ freq: NOTE(b), type: 'triangle', dur: stepDur * 1.8, vol: 0.45, when, dest: this.musicGain });
      if (i % 4 === 2) this.noiseHat(when);
      this._nextTime += stepDur;
      this._step++;
    }
  }
  noiseHat(when) { this.noise({ dur: 0.03, vol: 0.06, when, lowpass: 9000 }); }
}

// Original melody (C major pentatonic noodle), 32 eighth-note steps. 0 = rest.
const MELODY = [
  72, 0, 76, 79, 81, 0, 79, 76, 74, 0, 76, 74, 72, 0, 67, 0,
  69, 0, 72, 74, 76, 0, 74, 72, 74, 76, 79, 76, 74, 0, 72, 0,
];
const BASS = [48, 48, 55, 55, 57, 57, 53, 55];

const SFX = {
  move: (a) => a.tone({ freq: 880, dur: 0.03, vol: 0.18, type: 'pulse', duty: 0.125 }),
  select: (a) => {
    a.tone({ freq: 660, dur: 0.06, vol: 0.3 });
    a.tone({ freq: 990, dur: 0.08, vol: 0.3, when: 0.06 });
  },
  back: (a) => a.tone({ freq: 440, to: 220, dur: 0.1, vol: 0.25 }),
  eat: (a) => {
    a.tone({ freq: NOTE(76), dur: 0.05, vol: 0.35, type: 'pulse', duty: 0.25 });
    a.tone({ freq: NOTE(83), dur: 0.07, vol: 0.35, type: 'pulse', duty: 0.25, when: 0.045 });
  },
  combo: (a) => {
    [79, 83, 86, 91].forEach((n, i) => a.tone({ freq: NOTE(n), dur: 0.05, vol: 0.28, type: 'pulse', duty: 0.25, when: i * 0.035 }));
  },
  golden: (a) => {
    [72, 76, 79, 84, 88, 91].forEach((n, i) => a.tone({ freq: NOTE(n), dur: 0.07, vol: 0.3, type: 'pulse', duty: 0.5, when: i * 0.045 }));
  },
  spawnGolden: (a) => {
    a.tone({ freq: NOTE(96), dur: 0.05, vol: 0.15, type: 'triangle' });
    a.tone({ freq: NOTE(100), dur: 0.08, vol: 0.15, type: 'triangle', when: 0.06 });
  },
  turn: (a) => a.tone({ freq: 1400, dur: 0.012, vol: 0.06, type: 'pulse', duty: 0.125 }),
  tick: (a) => a.tone({ freq: 523, dur: 0.08, vol: 0.3 }),
  go: (a) => a.tone({ freq: 1046, dur: 0.18, vol: 0.32 }),
  die: (a) => {
    a.noise({ dur: 0.35, vol: 0.5, lowpass: 3000 });
    a.tone({ freq: 400, to: 60, dur: 0.55, vol: 0.4, type: 'square', when: 0.05 });
  },
  pop: (a) => a.tone({ freq: 300 + Math.random() * 300, to: 90, dur: 0.06, vol: 0.12, type: 'square' }),
  pause: (a) => {
    a.tone({ freq: 784, dur: 0.06, vol: 0.25 });
    a.tone({ freq: 523, dur: 0.08, vol: 0.25, when: 0.07 });
  },
  levelup: (a) => {
    [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => a.tone({ freq: NOTE(n + 12), dur: 0.09, vol: 0.3, type: 'pulse', duty: 0.25, when: i * 0.08 }));
  },
  record: (a) => {
    [72, 76, 79, 84].forEach((n, i) => a.tone({ freq: NOTE(n), dur: 0.12, vol: 0.3, type: 'pulse', duty: 0.5, when: i * 0.1 }));
  },
  boot: (a) => {
    a.tone({ freq: NOTE(84), dur: 0.09, vol: 0.3, type: 'pulse', duty: 0.5 });
    a.tone({ freq: NOTE(96), dur: 0.5, vol: 0.3, type: 'pulse', duty: 0.5, when: 0.09 });
  },
};

export const audio = new ChipAudio();
