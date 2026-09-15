import { settings } from '../core/storage';

let ctx: AudioContext | null = null;
let unlockBound = false;

/** Scheduling exactly at currentTime lands in the past by the time the audio
 *  thread picks it up, and the whole envelope is skipped. Always keep a lead. */
const LEAD = 0.02;

function createContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Browsers only let audio start from a real user gesture, and iOS additionally
 * wants a buffer actually played inside that gesture before it unmutes the
 * context. So the first tap on the page does both.
 */
function unlock(): void {
  if (!settings().sound) return;
  const context = createContext();
  if (!context) return;
  void context.resume();
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.start(0);
  } catch {
    /* nothing to unlock on this browser */
  }
  if (context.state === 'running') detachUnlock();
}

function detachUnlock(): void {
  if (!unlockBound) return;
  document.removeEventListener('pointerdown', unlock);
  document.removeEventListener('keydown', unlock);
  document.removeEventListener('touchend', unlock);
  unlockBound = false;
}

export function armAudio(): void {
  if (unlockBound) return;
  unlockBound = true;
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchend', unlock);
}

function audio(): AudioContext | null {
  if (!settings().sound) return null;
  const context = createContext();
  if (!context) return null;
  if (context.state !== 'running') void context.resume();
  return context;
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
  const start = context.currentTime + LEAD + delay;
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
  /** Call from inside a user gesture when sound is switched on in settings. */
  wake: () => {
    armAudio();
    unlock();
  },
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
  /** Pitch climbs with the chain, so a big merge sounds like a big merge. */
  merge: (tier: number) => {
    const base = 240 * Math.pow(1.13, tier);
    tone({ from: base, to: base * 1.5, type: 'square', dur: 0.1, gain: 0.07 });
    tone({ from: base * 2, type: 'triangle', dur: 0.14, gain: 0.05, delay: 0.03 });
  },
  win: () => {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone({ from: freq, type: 'square', dur: 0.16, gain: 0.07, delay: i * 0.09 }),
    );
  },
};
