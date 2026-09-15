import { CHAIN } from '../core/pond';

const TAU = Math.PI * 2;
export const INK = '#1A1410';
/** Textures are rendered this many pixels per world unit, then scaled down. */
export const TEX_SCALE = 2.6;

const hexToRgb = (hex: string): [number, number, number] => {
  const v = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
};
const mixTo = (hex: string, target: [number, number, number], amount: number): string => {
  const rgb = hexToRgb(hex);
  const out = rgb.map((c, i) => Math.round(c + (target[i] - c) * amount));
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
};
export const lighten = (hex: string, amount: number): string => mixTo(hex, [255, 250, 235], amount);
export const darken = (hex: string, amount: number): string => mixTo(hex, [26, 20, 16], amount);
export const isLight = (hex: string): boolean => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
};

type Marking = (ctx: CanvasRenderingContext2D, r: number, tone: (a: number) => string) => void;

const blobs = (ctx: CanvasRenderingContext2D, r: number, color: string, list: [number, number, number][]): void => {
  ctx.fillStyle = color;
  for (const [x, y, rad] of list) {
    ctx.beginPath();
    ctx.ellipse(x * r, y * r, rad * r, rad * r * 0.82, 0.35, 0, TAU);
    ctx.fill();
  }
};

/** A crown sitting above the eyes. */
function crown(ctx: CanvasRenderingContext2D, r: number, size: number, gold: string): void {
  const w = r * 0.52 * size;
  const y = -r * 0.72;
  ctx.fillStyle = gold;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.6, r * 0.05);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.lineTo(-w * 0.58, y - r * 0.3 * size);
  ctx.lineTo(-w * 0.2, y - r * 0.04 * size);
  ctx.lineTo(0, y - r * 0.4 * size);
  ctx.lineTo(w * 0.2, y - r * 0.04 * size);
  ctx.lineTo(w * 0.58, y - r * 0.3 * size);
  ctx.lineTo(w, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#E8453C';
  ctx.beginPath();
  ctx.arc(0, y - r * 0.12 * size, r * 0.07 * size, 0, TAU);
  ctx.fill();
}

/** Markings per frog: spots, warts, stripes, crowns. */
const MARKINGS: Marking[] = [
  // Ікринка: jelly with dark eggs suspended inside.
  (ctx, r) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.2, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2E3A44';
    for (const [x, y, rad] of [[-0.24, 0.06, 0.2], [0.26, -0.14, 0.16], [0.1, 0.38, 0.14]] as const) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, rad * r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x * r - rad * r * 0.3, y * r - rad * r * 0.3, rad * r * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2E3A44';
    }
  },
  // Пуголовок: a tail trailing behind.
  (ctx, r, tone) => {
    ctx.fillStyle = tone(0.12);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.34);
    ctx.quadraticCurveTo(-r * 1.28, -r * 0.5, -r * 1.42, r * 0.34);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.12, -r * 0.3, r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  (ctx, r, tone) => blobs(ctx, r, tone(0.3), [[-0.46, 0.3, 0.18], [0.5, 0.36, 0.14]]),
  (ctx, r, tone) => {
    ctx.fillStyle = tone(0.24);
    for (const side of [-1, 1]) {
      for (const off of [0.44, 0.68]) {
        ctx.beginPath();
        ctx.arc(side * r * off, r * 0.6, r * 0.1, 0, TAU);
        ctx.fill();
      }
    }
  },
  (ctx, r, tone) => {
    ctx.fillStyle = tone(0.28);
    for (const [x, y] of [[-0.5, 0.2], [-0.2, 0.46], [0.24, 0.42], [0.54, 0.18], [0.02, 0.62]] as const) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.075, 0, TAU);
      ctx.fill();
    }
  },
  (ctx, r, tone) => {
    ctx.strokeStyle = tone(0.32);
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * 0.72, side > 0 ? -0.35 : Math.PI + 0.35, side > 0 ? 0.85 : Math.PI - 0.85, side < 0);
      ctx.stroke();
    }
  },
  (ctx, r) => blobs(ctx, r, 'rgba(26,20,16,0.8)', [[-0.5, 0.3, 0.19], [0.44, 0.44, 0.15], [0.08, 0.66, 0.11]]),
  (ctx, r) => {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.48, r * 0.42, r * 0.26, 0, 0, TAU);
    ctx.fill();
  },
  (ctx, r) => {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [x, y, rad] of [[-0.44, 0.26, 0.07], [-0.08, 0.54, 0.05], [0.42, 0.34, 0.06], [0.18, 0.18, 0.04]] as const) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, rad * r, 0, TAU);
      ctx.fill();
    }
  },
  (ctx, r, tone) => {
    ctx.strokeStyle = tone(0.34);
    ctx.lineWidth = Math.max(2, r * 0.13);
    for (const y of [0.42, 0.78]) {
      ctx.beginPath();
      ctx.arc(0, r * 0.05, r * y, 0.55, Math.PI - 0.55);
      ctx.stroke();
    }
  },
  (ctx, r) => {
    crown(ctx, r, 0.62, '#FFD93B');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(r * 0.5, r * 0.4, r * 0.07, 0, TAU);
    ctx.fill();
  },
  (ctx, r) => {
    crown(ctx, r, 1, '#FFE066');
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = Math.max(3, r * 0.11);
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.76, 0.6, Math.PI - 0.6);
    ctx.stroke();
  },
];

/**
 * Renders one frog body — everything except the face, which stays live so it
 * can blink, look around and change mood.
 */
export function frogCanvas(tier: number, worldRadius: number): HTMLCanvasElement {
  const item = CHAIN[tier];
  const r = Math.max(24, worldRadius * TEX_SCALE);
  const pad = r * 0.55;
  const size = Math.ceil((r + pad) * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.translate(size / 2, size / 2);
  const tone = (a: number): string => darken(item.fill, a);

  // Back legs peeking out behind the body.
  if (tier >= 2) {
    ctx.fillStyle = darken(item.fill, 0.18);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.06);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * r * 0.82, r * 0.52);
      ctx.rotate(side * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.34, r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Body: a lit sphere.
  const skin = ctx.createRadialGradient(-r * 0.34, -r * 0.42, r * 0.05, 0, 0, r * 1.15);
  skin.addColorStop(0, lighten(item.fill, 0.45));
  skin.addColorStop(0.45, item.fill);
  skin.addColorStop(1, darken(item.fill, 0.32));
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(26,20,16,0.18)';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 1.05, r * 1.05, r * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  MARKINGS[tier]?.(ctx, r, tone);

  ctx.lineWidth = Math.max(2.4, r * 0.075);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();

  // Gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.46)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.44, r * 0.28, r * 0.15, -0.7, 0, TAU);
  ctx.fill();

  return canvas;
}

/** The soft contact shadow every frog drags along the floor. */
export function shadowCanvas(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const grad = ctx.createRadialGradient(size / 2, size / 4, 1, size / 2, size / 4, size / 2);
  grad.addColorStop(0, 'rgba(26,20,16,0.42)');
  grad.addColorStop(1, 'rgba(26,20,16,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 4, size / 2, size / 4, 0, 0, TAU);
  ctx.fill();
  return canvas;
}
