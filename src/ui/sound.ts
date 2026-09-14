import { settings } from '../core/storage';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!settings().sound) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOptions {
  from: number;
  to?: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  delay?: number;
}

function tone({ from, to = from, type = 'square', dur = 0.09, gain = 0.09, delay = 0 }: ToneOptions): void {
  const context = audio();
  if (!context) return;
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const amp = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(context.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Short synthesised blips — no audio files, nothing to download. */
export const sfx = {
  tap: () => tone({ from: 320, type: 'triangle', dur: 0.05, gain: 0.05 }),
  place: () => {
    tone({ from: 180, to: 90, type: 'square', dur: 0.08, gain: 0.08 });
    tone({ from: 520, to: 780, type: 'triangle', dur: 0.12, gain: 0.06, delay: 0.02 });
  },
  erase: () => tone({ from: 240, to: 130, type: 'sawtooth', dur: 0.09, gain: 0.05 }),
  wrong: () => {
    tone({ from: 150, to: 110, type: 'square', dur: 0.16, gain: 0.07 });
    tone({ from: 98, type: 'square', dur: 0.16, gain: 0.05, delay: 0.05 });
  },
  hint: () => tone({ from: 660, to: 990, type: 'triangle', dur: 0.16, gain: 0.06 }),
  win: () => {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone({ from: freq, type: 'square', dur: 0.16, gain: 0.07, delay: i * 0.09 }),
    );
  },
};
