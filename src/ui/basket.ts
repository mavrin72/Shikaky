import { Basket, CHAIN, type Body } from '../core/basket';
import { basketBest, recordBasket } from '../core/storage';
import { clamp, h } from './dom';
import { buzz, confetti, motionOff, toast } from './fx';
import { sfx } from './sound';

const TAU = Math.PI * 2;
const INK = '#1A1410';
/** The field keeps its own warm ground in both themes: the product colours are
 *  picked to sit on paper, and dark outlines need something light behind them. */
const GROUND = ['#FFF7E2', '#F1DFB6'];
const GROUND_DARK = ['#F0E2C0', '#DCC79A'];
const WOOD = '#C9A063';
const WOOD_DARK = '#A9814A';

// ---------------------------------------------------------------- colour help
const hexToRgb = (hex: string): [number, number, number] => {
  const v = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
};
const mix = (hex: string, target: [number, number, number], amount: number): string => {
  const rgb = hexToRgb(hex);
  const out = rgb.map((c, i) => Math.round(c + (target[i] - c) * amount));
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
};
const lighten = (hex: string, amount: number): string => mix(hex, [255, 250, 235], amount);
const darken = (hex: string, amount: number): string => mix(hex, [26, 20, 16], amount);
const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

type Detail = (ctx: CanvasRenderingContext2D, r: number, tone: (a: number) => string) => void;

const dots = (ctx: CanvasRenderingContext2D, points: [number, number][], r: number, color: string): void => {
  ctx.fillStyle = color;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, r * 0.1, 0, TAU);
    ctx.fill();
  }
};

/** A stalk with a leaf — drawn with an outline so it reads at any size. */
const stalk = (ctx: CanvasRenderingContext2D, r: number, color: string, leaf?: string): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.78);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.0, r * 0.2, -r * 1.06);
  ctx.stroke();
  if (!leaf) return;
  ctx.fillStyle = leaf;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.94, r * 0.3, r * 0.14, -0.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
};

/** One drawing per chain step — this is what makes a coconut read as a coconut. */
const DETAILS: Detail[] = [
  (ctx, r, tone) => dots(ctx, [[-0.5, 0.52], [0.52, 0.5]], r, tone(0.45)),
  (ctx, r, tone) => {
    ctx.strokeStyle = tone(0.35);
    ctx.lineWidth = Math.max(1.5, r * 0.11);
    for (const off of [-0.58, 0.58]) {
      ctx.beginPath();
      ctx.arc(off * r, r * 0.12, r * 0.46, -1.1, 1.1);
      ctx.stroke();
    }
  },
  (ctx, r, tone) => dots(ctx, [[-0.6, 0.48], [0.08, 0.7], [0.62, 0.44]], r, tone(0.4)),
  (ctx, r, tone) => {
    // Shell seam that follows the sphere, instead of a scratch across it.
    ctx.strokeStyle = tone(0.45);
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, Math.PI * 0.72, Math.PI * 1.28);
    ctx.stroke();
  },
  (ctx, r, tone) => {
    dots(ctx, [[-0.62, 0.44], [0.62, 0.42], [0, 0.72]], r, tone(0.3));
    stalk(ctx, r, '#4B1C58');
  },
  (ctx, r) => stalk(ctx, r, '#2F7D3A', '#3FA04C'),
  (ctx, r) => stalk(ctx, r, '#7A5228', '#8FBF3A'),
  (ctx, r, tone) => {
    ctx.strokeStyle = tone(0.35);
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(r * 0.05, r * 0.08, r * 0.62, -2.5, -1.7);
    ctx.stroke();
  },
  (ctx, r, tone) => dots(ctx, [[-0.62, 0.44], [0.62, 0.44], [0, 0.74]], r, tone(0.62)),
  (ctx, r, tone) => {
    ctx.strokeStyle = tone(0.35);
    ctx.lineWidth = Math.max(2, r * 0.09);
    for (const off of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(off * r * 0.92, 0, r * 0.2, r * 0.93, 0, 0, TAU);
      ctx.stroke();
    }
    stalk(ctx, r, '#4E7A2A', '#6FA83A');
  },
  (ctx, r, tone) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.arc(0, r * 0.05, r * 0.6, 0, TAU);
    ctx.clip('evenodd');
    ctx.strokeStyle = tone(0.3);
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.42, 0, r * 0.92, -1.2, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, i * r * 0.42, r * 0.92, 0.37, 2.77);
      ctx.stroke();
    }
    ctx.restore();
  },
  (ctx, r) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.99, 0, TAU);
    ctx.arc(0, r * 0.06, r * 0.58, 0, TAU);
    ctx.clip('evenodd');
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = Math.max(2, r * 0.085);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.3, -r);
      ctx.lineTo(i * r * 0.3, r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r, i * r * 0.3);
      ctx.lineTo(r, i * r * 0.3);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.64, Math.PI, TAU);
    ctx.stroke();
  },
];

export interface BasketViewHandles {
  el: HTMLElement;
  game: Basket;
  restart: () => void;
  shake: () => void;
  destroy: () => void;
}

export interface BasketCallbacks {
  onScore: (score: number, best: number) => void;
  onNext: (tier: number, after: number) => void;
  onReach: (tier: number) => void;
  onCombo: (combo: number, left: number) => void;
  onShakes: (left: number) => void;
  onOver: (score: number, best: number) => void;
}

interface Burst { x: number; y: number; r: number; color: string; t: number }
interface Popup { x: number; y: number; text: string; combo: number; t: number }
interface Dust { x: number; y: number; vx: number; vy: number; r: number; t: number }

export function createBasketView(cb: BasketCallbacks): BasketViewHandles {
  const game = new Basket();
  const canvas = h('canvas', {
    class: 'basket__canvas',
    'aria-label': 'Кошик: тягни, щоб прицілитись, відпусти — продукт падає',
  }) as HTMLCanvasElement;
  canvas.tabIndex = 0;
  const wrap = h('div', { class: 'basket' }, canvas);
  const ctx = canvas.getContext('2d');

  let aimX = game.width / 2;
  let running = true;
  let raf = 0;
  let last = performance.now();
  let accumulator = 0;
  let scale = 1;
  let dark = false;
  let themeCheck = 0;
  let shownScore = -1;
  let shownNext = -1;
  let shownTop = -1;
  let shownShakes = -1;

  const bursts: Burst[] = [];
  const popups: Popup[] = [];
  const dust: Dust[] = [];
  const pops = new Map<number, number>();
  const squash = new Map<number, number>();
  const impactSpeed = new Map<number, number>();
  type Mood = 'idle' | 'scared' | 'happy' | 'hit' | 'dizzy' | 'worried';
  interface Face {
    nextBlink: number;
    blinkUntil: number;
    wink: boolean;
    mouth: number;
    mood: Mood;
    moodUntil: number;
    /** Where the pupils are pointing, in world space, smoothed. */
    px: number;
    py: number;
  }
  const faces = new Map<number, Face>();
  const newFace = (): Face => ({
    nextBlink: clock + 0.8 + Math.random() * 3,
    blinkUntil: 0,
    wink: false,
    mouth: 0,
    mood: 'idle',
    moodUntil: 0,
    px: 0,
    py: 0,
  });
  const faceOf = (id: number): Face => {
    let face = faces.get(id);
    if (!face) {
      face = newFace();
      faces.set(id, face);
    }
    return face;
  };
  const setMood = (id: number, mood: Mood, seconds: number): void => {
    const face = faceOf(id);
    face.mood = mood;
    face.moodUntil = clock + seconds;
  };
  const skins = new Map<number, CanvasGradient>();
  let shakeAmount = 0;
  let flash = 0;
  let clock = 0;

  function resize(): void {
    const cssWidth = wrap.clientWidth || 340;
    const cssHeight = cssWidth * (game.height / game.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    scale = (cssWidth * dpr) / game.width;
    skins.clear();
  }

  const worldX = (clientX: number): number => {
    const box = canvas.getBoundingClientRect();
    return clamp(((clientX - box.left) / box.width) * game.width, 0, game.width);
  };

  /** Cached per tier: a sun-lit sphere gradient, not a flat disc. */
  function skinOf(tier: number, r: number): CanvasGradient | string {
    if (!ctx) return CHAIN[tier].fill;
    const cached = skins.get(tier);
    if (cached) return cached;
    const fill = CHAIN[tier].fill;
    const grad = ctx.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.06, 0, 0, r * 1.18);
    grad.addColorStop(0, lighten(fill, 0.42));
    grad.addColorStop(0.42, fill);
    grad.addColorStop(1, darken(fill, 0.3));
    skins.set(tier, grad);
    return grad;
  }

  /** Eyes with real pupils that point somewhere, plus a mood on top. */
  function drawFace(r: number, fill: string, face: Face, angle: number): void {
    if (!ctx) return;
    const blinking = clock < face.blinkUntil;
    const light = luminance(fill) > 0.5;
    const ink = light ? INK : '#2A1F2E';
    const sclera = '#FFFDF6';
    const eyeY = -r * 0.1;
    const eyeX = r * 0.32;
    const eyeR = r * 0.2;
    const tiny = r < 15;
    const mood = face.mood;

    // Pupils are aimed in world space, so they keep looking the right way even
    // when the product itself has rolled.
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const lookX = face.px * cos - face.py * sin;
    const lookY = face.px * sin + face.py * cos;

    ctx.fillStyle = light ? 'rgba(255,90,120,0.3)' : 'rgba(255,150,170,0.3)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.56, r * 0.21, r * 0.17, r * 0.11, 0, 0, TAU);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const side of [-1, 1]) {
      const cx = side * eyeX;
      const shut = (blinking && (!face.wink || side < 0)) || mood === 'happy';

      if (mood === 'dizzy') {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx - eyeR * 0.6 * d, eyeY - eyeR * 0.6);
          ctx.lineTo(cx + eyeR * 0.6 * d, eyeY + eyeR * 0.6);
          ctx.stroke();
        }
        continue;
      }

      if (shut) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1.8, r * 0.095);
        ctx.beginPath();
        ctx.arc(cx, eyeY + eyeR * 0.35, eyeR * 0.85, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        continue;
      }

      if (mood === 'hit') {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1.8, r * 0.095);
        ctx.beginPath();
        ctx.arc(cx, eyeY - eyeR * 0.3, eyeR * 0.85, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
        continue;
      }

      const wide = mood === 'scared' ? 1.22 : 1;
      if (tiny) {
        ctx.fillStyle = light ? ink : sclera;
        ctx.beginPath();
        ctx.ellipse(cx + lookX * eyeR * 0.3, eyeY + lookY * eyeR * 0.3, eyeR * 0.6, eyeR * 0.68, 0, 0, TAU);
        ctx.fill();
        continue;
      }

      ctx.fillStyle = sclera;
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.4, r * 0.045);
      ctx.beginPath();
      ctx.ellipse(cx, eyeY, eyeR * 0.82 * wide, eyeR * wide, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      const pupilR = eyeR * (mood === 'scared' ? 0.36 : 0.52);
      const reach = eyeR * 0.36;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx + lookX * reach, eyeY + lookY * reach, pupilR, 0, TAU);
      ctx.fill();
      ctx.fillStyle = sclera;
      ctx.beginPath();
      ctx.arc(cx + lookX * reach + pupilR * 0.35, eyeY + lookY * reach - pupilR * 0.4, pupilR * 0.34, 0, TAU);
      ctx.fill();

      if (mood === 'scared' || mood === 'worried') {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1.6, r * 0.07);
        ctx.beginPath();
        const brow = mood === 'scared' ? -eyeR * 1.5 : -eyeR * 1.35;
        ctx.moveTo(cx - eyeR * 0.7, eyeY + brow + (mood === 'worried' ? eyeR * 0.3 * side : 0));
        ctx.lineTo(cx + eyeR * 0.7, eyeY + brow - (mood === 'worried' ? eyeR * 0.3 * side : 0));
        ctx.stroke();
      }
    }

    // Mouth
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1.8, r * 0.085);
    const mouthY = r * 0.34;
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.arc(0, mouthY - r * 0.14, r * 0.26, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.fill();
    } else if (mood === 'scared' || face.mouth > 0.06) {
      const open = Math.max(face.mouth, mood === 'scared' ? 0.45 : 0);
      ctx.beginPath();
      ctx.ellipse(0, mouthY, r * (0.11 + 0.08 * open), r * (0.08 + 0.2 * open), 0, 0, TAU);
      ctx.fill();
    } else if (mood === 'worried') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, mouthY);
      ctx.quadraticCurveTo(-r * 0.07, mouthY - r * 0.1, 0, mouthY);
      ctx.quadraticCurveTo(r * 0.07, mouthY + r * 0.1, r * 0.2, mouthY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, mouthY - r * 0.13, r * 0.22, 0.22 * Math.PI, 0.78 * Math.PI);
      ctx.stroke();
    }

    if (mood === 'worried' && !tiny) {
      ctx.fillStyle = '#7FD8FF';
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.2, r * 0.04);
      ctx.beginPath();
      ctx.moveTo(r * 0.62, -r * 0.34);
      ctx.quadraticCurveTo(r * 0.75, -r * 0.1, r * 0.62, -r * 0.02);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.1, r * 0.62, -r * 0.34);
      ctx.fill();
      ctx.stroke();
    }
  }

  /** Everyone watches whatever is falling — that is what makes the pile feel alive. */
  function updateFaces(dt: number): void {
    let faller: Body | null = null;
    for (const body of game.bodies) {
      if (body.vy > 240 && (!faller || body.vy > faller.vy)) faller = body;
    }
    const pendingR = game.radiusOf(game.next);
    const aim = { x: clamp(aimX, pendingR, game.width - pendingR), y: game.lineY - pendingR };

    for (const body of game.bodies) {
      const face = faceOf(body.id);

      if (clock > face.nextBlink) {
        face.blinkUntil = clock + 0.14;
        face.wink = Math.random() < 0.3;
        face.nextBlink = clock + 1.4 + Math.random() * 3.4;
      }
      face.mouth = Math.max(0, face.mouth - dt * 2.2);
      if (face.mood !== 'idle' && clock > face.moodUntil) face.mood = 'idle';

      const watching = faller && faller !== body && faller.y < body.y ? faller : null;
      const target = watching ?? (game.canDrop && !game.over ? aim : null);

      let tx = 0;
      let ty = 0;
      if (target) {
        const dx = target.x - body.x;
        const dy = target.y - body.y;
        const dist = Math.hypot(dx, dy) || 1;
        tx = dx / dist;
        ty = dy / dist;
      } else {
        // Nothing to watch: eyes drift instead of freezing.
        tx = Math.sin(clock * 0.7 + body.id) * 0.5;
        ty = Math.sin(clock * 0.45 + body.id * 2) * 0.3;
      }
      face.px += (tx - face.px) * Math.min(1, dt * 9);
      face.py += (ty - face.py) * Math.min(1, dt * 9);

      if (face.mood === 'idle' || face.mood === 'worried' || face.mood === 'scared') {
        const incoming =
          watching &&
          Math.abs(watching.x - body.x) < (watching.r + body.r) * 1.15 &&
          body.y - watching.y < body.r * 6;
        if (incoming) setMood(body.id, 'scared', 0.25);
        else if (body.age > 0.7 && body.y - body.r < game.lineY + body.r * 0.8) {
          setMood(body.id, 'worried', 0.3);
        } else if (face.mood !== 'idle' && clock > face.moodUntil) face.mood = 'idle';
      }
    }
  }
  function drawBody(body: Body, preview = false): void {
    if (!ctx) return;
    const item = CHAIN[body.tier];
    const pop = pops.get(body.id) ?? 0;
    const hit = squash.get(body.id) ?? 0;
    const grow = 1 + 0.42 * Math.sin(Math.PI * pop);
    const sx = grow * (1 + 0.2 * hit);
    const sy = grow * (1 - 0.2 * hit);
    const tone = (a: number): string => darken(item.fill, a);

    ctx.save();
    ctx.translate(body.x, body.y + body.r * 0.2 * hit);
    ctx.globalAlpha = preview ? 0.96 : 1;
    ctx.scale(sx, sy);

    // Body: lit sphere, dark rim, glossy highlight.
    ctx.fillStyle = skinOf(body.tier, body.r);
    ctx.beginPath();
    ctx.arc(0, 0, body.r, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(26,20,16,0.16)';
    ctx.beginPath();
    ctx.ellipse(body.r * 0.15, body.r * 1.02, body.r * 1.05, body.r * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = Math.max(2.2, body.r * 0.085);
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(0, 0, body.r, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.rotate(body.angle);
    DETAILS[body.tier]?.(ctx, body.r, tone);
    drawFace(body.r, item.fill, faceOf(body.id), body.angle);
    ctx.restore();

    // Gloss stays put: the light does not roll with the fruit.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-body.r * 0.36, -body.r * 0.44, body.r * 0.3, body.r * 0.17, -0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(-body.r * 0.15, -body.r * 0.62, body.r * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(): void {
    if (!ctx) return;
    const tones = dark ? GROUND_DARK : GROUND;
    const sky = ctx.createLinearGradient(0, 0, 0, game.height);
    sky.addColorStop(0, tones[0]);
    sky.addColorStop(1, tones[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, game.width, game.height);

    ctx.fillStyle = 'rgba(26,20,16,0.05)';
    for (let y = 14; y < game.height; y += 26) {
      for (let x = (y % 52 === 14 ? 14 : 27); x < game.width; x += 26) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, TAU);
        ctx.fill();
      }
    }

    // Crate walls left and right, woven floor below.
    const rail = 7;
    for (const x of [0, game.width - rail]) {
      ctx.fillStyle = WOOD;
      ctx.fillRect(x, 0, rail, game.height);
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 1.5;
      for (let y = 8; y < game.height; y += 17) {
        ctx.beginPath();
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + rail - 1, y + 6);
        ctx.stroke();
      }
    }

    const floor = 34;
    ctx.fillStyle = WOOD;
    ctx.fillRect(0, game.height - floor, game.width, floor);
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 3;
    for (let x = 8; x < game.width; x += 21) {
      ctx.beginPath();
      ctx.moveTo(x, game.height - floor + 2);
      ctx.lineTo(x, game.height);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,247,226,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, game.height - floor + 11);
    ctx.lineTo(game.width, game.height - floor + 11);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, game.height - floor);
    ctx.lineTo(game.width, game.height - floor);
    ctx.stroke();

    const vignette = ctx.createRadialGradient(
      game.width / 2, game.height * 0.45, game.width * 0.3,
      game.width / 2, game.height * 0.45, game.width * 0.95,
    );
    vignette.addColorStop(0, 'rgba(26,20,16,0)');
    vignette.addColorStop(1, 'rgba(26,20,16,0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, game.width, game.height);
  }

  function drawDangerLine(): void {
    if (!ctx) return;
    const danger = game.bodies.some((body) => body.age > 0.7 && body.y - body.r < game.lineY);
    const pulse = danger ? 0.5 + 0.5 * Math.sin(clock * 9) : 1;
    if (danger) {
      const grad = ctx.createLinearGradient(0, 0, 0, game.lineY + 46);
      grad.addColorStop(0, `rgba(255,46,46,${0.34 * pulse})`);
      grad.addColorStop(1, 'rgba(255,46,46,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, game.width, game.lineY + 46);
    }
    ctx.save();
    ctx.globalAlpha = danger ? 0.6 + 0.4 * pulse : 0.85;
    ctx.strokeStyle = '#FF2E2E';
    ctx.lineWidth = danger ? 4 : 2.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, game.lineY);
    ctx.lineTo(game.width, game.lineY);
    ctx.stroke();
    ctx.restore();
  }

  function drawEffects(): void {
    if (!ctx) return;
    for (const puff of dust) {
      const p = puff.t / 0.5;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.fillStyle = '#FFF3D6';
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, puff.r * (1 + p * 1.6), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    for (const burst of bursts) {
      const p = burst.t / 0.45;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#FFF7E4';
      ctx.lineWidth = 7 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.r * (1 + 1.2 * p), 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.r * (1 + 1.45 * p), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = burst.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + burst.r;
        const d = burst.r * (0.9 + 1.8 * p);
        const size = burst.r * 0.24 * (1 - p * 0.65);
        ctx.save();
        ctx.translate(burst.x + Math.cos(a) * d, burst.y + Math.sin(a) * d - p * 12);
        ctx.rotate(a + p * 3.4);
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    for (const popup of popups) {
      const p = popup.t / 0.95;
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      ctx.translate(popup.x, popup.y - 42 * p);
      if (popup.combo > 1) {
        ctx.fillStyle = '#FF3D7F';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-38, -40, 76, 26, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF7E4';
        ctx.font = '900 17px Rubik, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`КОМБО ×${popup.combo}`, 0, -21);
      }
      ctx.font = '900 22px Rubik, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FFF7E4';
      ctx.strokeText(popup.text, 0, 0);
      ctx.fillStyle = INK;
      ctx.fillText(popup.text, 0, 0);
      ctx.restore();
    }
  }

  function draw(): void {
    if (!ctx) return;
    const jolt = motionOff() ? 0 : shakeAmount;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawBackground();
    ctx.translate((Math.random() - 0.5) * jolt, (Math.random() - 0.5) * jolt);
    drawDangerLine();

    // Contact shadows in one pass, so the pile sits on the floor instead of floating.
    ctx.fillStyle = 'rgba(26,20,16,0.13)';
    for (const body of game.bodies) {
      ctx.beginPath();
      ctx.ellipse(body.x + body.r * 0.1, body.y + body.r * 0.86, body.r * 0.92, body.r * 0.3, 0, 0, TAU);
      ctx.fill();
    }

    if (!game.over && game.canDrop) {
      const r = game.radiusOf(game.next);
      const x = clamp(aimX, r + 2, game.width - r - 2);
      ctx.save();
      ctx.strokeStyle = 'rgba(26,20,16,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(x, game.lineY);
      ctx.lineTo(x, game.height - 34);
      ctx.stroke();
      ctx.restore();
      const bob = motionOff() ? 0 : Math.sin(clock * 3.2) * 3;
      drawBody({ id: -1, tier: game.next, x, y: game.lineY - r - 10 + bob, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 }, true);
    }

    for (const body of game.bodies) drawBody(body);
    drawEffects();

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,247,228,${flash * 0.6})`;
      ctx.fillRect(0, 0, game.width, game.height);
    }

    if (game.over) {
      ctx.fillStyle = 'rgba(26,20,16,0.58)';
      ctx.fillRect(0, 0, game.width, game.height);
      ctx.save();
      ctx.translate(game.width / 2, game.height / 2);
      ctx.rotate(-0.09);
      ctx.fillStyle = '#FF2E2E';
      ctx.strokeStyle = '#FFF7E4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-136, -30, 272, 60, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF7E4';
      ctx.font = '900 28px Rubik, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ПЕРЕПОВНЕНО', 0, 2);
      ctx.restore();
    }
  }

  function handleEvents(): void {
    for (const event of game.drain()) {
      if (event.type === 'drop') {
        sfx.tap();
      } else if (event.type === 'shake') {
        sfx.erase();
        buzz([14, 30, 14]);
        shakeAmount = 18;
        for (const body of game.bodies) setMood(body.id, 'dizzy', 1.1 + Math.random() * 0.5);
        cb.onShakes(game.shakesLeft);
      } else if (event.type === 'merge') {
        sfx.merge(event.tier);
        buzz(event.tier > 6 ? 18 : 8);
        pops.set(event.id, 1);
        faces.set(event.id, newFace());
        faceOf(event.id).mouth = 1;
        setMood(event.id, 'happy', 0.9);
        if (!motionOff()) {
          bursts.push({ x: event.x, y: event.y, r: game.radiusOf(event.tier), color: CHAIN[event.tier].fill, t: 0 });
          shakeAmount = Math.min(16, shakeAmount + 2 + event.tier);
        }
        popups.push({ x: event.x, y: event.y, text: `+${event.gain}`, combo: event.combo, t: 0 });
        cb.onCombo(game.combo, game.comboLeft);
      } else if (event.type === 'final') {
        sfx.win();
        flash = 1;
        const box = canvas.getBoundingClientRect();
        confetti({
          x: box.left + (event.x / game.width) * box.width,
          y: box.top + (event.y / game.height) * box.height,
        });
        toast('Кошик зібрано!');
      } else if (event.type === 'over') {
        sfx.wrong();
        const { best } = recordBasket(game.score);
        cb.onOver(game.score, best);
      }
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    accumulator += dt;
    const fixed = 1 / 120;
    let steps = 0;
    while (accumulator >= fixed && steps < 8) {
      game.step(fixed);
      accumulator -= fixed;
      steps++;
    }

    clock += dt;
    shakeAmount *= 0.86;
    flash *= 0.92;
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt;
      if (bursts[i].t > 0.45) bursts.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].t += dt;
      if (popups[i].t > 0.95) popups.splice(i, 1);
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      dust[i].t += dt;
      dust[i].x += dust[i].vx * dt;
      dust[i].y += dust[i].vy * dt;
      dust[i].vy += 120 * dt;
      if (dust[i].t > 0.5) dust.splice(i, 1);
    }
    for (const [id, value] of pops) {
      const left = value - dt * 4;
      if (left <= 0) pops.delete(id);
      else pops.set(id, left);
    }
    for (const [id, value] of squash) {
      const left = value - dt * 6;
      if (left <= 0) squash.delete(id);
      else squash.set(id, left);
    }
    updateFaces(dt);
    if (faces.size > 200) faces.clear();

    // A body that just lost a lot of downward speed has hit something.
    for (const body of game.bodies) {
      const before = impactSpeed.get(body.id) ?? 0;
      if (before > 260 && body.vy < before * 0.45) {
        const face = faceOf(body.id);
        face.mouth = Math.max(face.mouth, Math.min(0.7, before / 900));
        if (before > 520) setMood(body.id, 'hit', 0.3);
        if (!motionOff()) {
          squash.set(body.id, Math.min(1, before / 1100));
          for (let i = 0; i < 4; i++) {
            dust.push({
              x: body.x + (Math.random() - 0.5) * body.r,
              y: body.y + body.r * 0.8,
              vx: (Math.random() - 0.5) * 90,
              vy: -30 - Math.random() * 50,
              r: 3 + Math.random() * 4,
              t: 0,
            });
          }
        }
      }
      impactSpeed.set(body.id, body.vy);
    }
    if (impactSpeed.size > 200) impactSpeed.clear();

    handleEvents();
    if (now - themeCheck > 500) {
      themeCheck = now;
      dark = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().startsWith('#1');
      skins.clear();
    }
    draw();

    if (game.score !== shownScore) {
      shownScore = game.score;
      cb.onScore(game.score, Math.max(basketBest(), game.score));
    }
    if (game.next !== shownNext) {
      shownNext = game.next;
      cb.onNext(game.next, game.queued);
    }
    if (game.shakesLeft !== shownShakes) {
      shownShakes = game.shakesLeft;
      cb.onShakes(game.shakesLeft);
    }
    const top = game.bodies.reduce((max, body) => Math.max(max, body.tier), -1);
    if (top > shownTop) {
      shownTop = top;
      cb.onReach(top);
    }
    cb.onCombo(game.combo, game.comboLeft);
  }

  let dragging = false;
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    aimX = worldX(event.clientX);
  });
  // Touch reports pressure 0 on plenty of phones, so drag state is tracked here.
  canvas.addEventListener('pointermove', (event) => {
    if (dragging || event.pointerType === 'mouse') aimX = worldX(event.clientX);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    aimX = worldX(event.clientX);
    game.drop(aimX);
  });
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      aimX = clamp(aimX + (event.key === 'ArrowLeft' ? -14 : 14), 0, game.width);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      game.drop(aimX);
    }
  });

  const observer = new ResizeObserver(() => resize());
  observer.observe(wrap);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    el: wrap,
    game,
    restart: () => {
      game.reset();
      bursts.length = 0;
      popups.length = 0;
      dust.length = 0;
      pops.clear();
      squash.clear();
      impactSpeed.clear();
      faces.clear();
      shakeAmount = 0;
      flash = 0;
      shownScore = -1;
      shownNext = -1;
      shownTop = -1;
      shownShakes = -1;
      last = performance.now();
      accumulator = 0;
    },
    shake: () => {
      if (!game.shake()) toast('Струси закінчились');
    },
    destroy: () => {
      // Leaving mid-run still counts: the score is real, it just was not lost yet.
      if (game.score > 0) recordBasket(game.score);
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    },
  };
}
