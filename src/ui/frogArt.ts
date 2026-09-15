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

  // Hind legs: thigh folded up, webbed foot forward. Drawn behind the body so
  // only the silhouette shows, the way a sitting frog actually looks.
  if (tier >= 2) {
    const limb = darken(item.fill, 0.16);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.055);
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);

      ctx.fillStyle = limb;
      ctx.beginPath();
      ctx.ellipse(r * 0.82, r * 0.3, r * 0.3, r * 0.22, -0.5, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(r * 0.95, r * 0.66, r * 0.26, r * 0.15, 0.35, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Webbed foot: three toes fanned forward.
      for (const angle of [-0.42, 0, 0.42]) {
        ctx.save();
        ctx.translate(r * 1.12, r * 0.8);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(r * 0.16, 0, r * 0.18, r * 0.075, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Front hands resting on the ground.
    ctx.fillStyle = limb;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * r * 0.34, r * 0.93);
      for (const angle of [-0.5, 0, 0.5]) {
        ctx.save();
        ctx.rotate(angle * side);
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.07, r * 0.13, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
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

  // Rim light along the shaded edge: this is what lifts a frog off the water
  // instead of letting its dark outline sink into it.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.97, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = 'rgba(214, 255, 240, 0.55)';
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0.25, 1.55);
  ctx.stroke();
  ctx.restore();

  // Gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.44, r * 0.28, r * 0.15, -0.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.62, r * 0.06, 0, TAU);
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

/**
 * The pond backdrop, painted once: depth gradient, distant plants, caustics and
 * a silty floor. Blur is baked in here so the GPU never has to do it per frame.
 */
export function pondBackdropCanvas(width: number, height: number): HTMLCanvasElement {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);

  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, '#D8F6E8');
  water.addColorStop(0.2, '#88DCBE');
  water.addColorStop(0.5, '#43B190');
  water.addColorStop(0.78, '#2E9077');
  water.addColorStop(1, '#2A8870');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  // Distant weeds, out of focus.
  ctx.save();
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = 'rgba(8, 58, 52, 0.55)';
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * width + (i % 2 ? 12 : -8);
    const h = height * (0.28 + ((i * 37) % 22) / 100);
    ctx.beginPath();
    ctx.moveTo(x - 16, height);
    ctx.quadraticCurveTo(x + (i % 2 ? 18 : -18), height - h * 0.6, x, height - h);
    ctx.quadraticCurveTo(x + (i % 2 ? 26 : -26), height - h * 0.55, x + 18, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Light shafts and caustics near the surface.
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const x = width * (0.08 + i * 0.17);
    const grad = ctx.createLinearGradient(x, 0, x + 40, height * 0.75);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 14, 0);
    ctx.lineTo(x + 22, 0);
    ctx.lineTo(x + 62, height * 0.8);
    ctx.lineTo(x + 10, height * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.filter = 'blur(2.5px)';
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    const y = 20 + i * 16;
    ctx.beginPath();
    for (let x = -10; x <= width + 10; x += 12) {
      const yy = y + Math.sin((x + i * 30) / 26) * 4;
      if (x === -10) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // A soft stage light where the pile builds up — the action has to be the
  // brightest thing on screen, not the murkiest.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const stage = ctx.createRadialGradient(
    width / 2, height * 0.92, width * 0.05,
    width / 2, height * 0.92, width * 0.95,
  );
  stage.addColorStop(0, 'rgba(255,248,210,0.34)');
  stage.addColorStop(0.5, 'rgba(210,255,230,0.12)');
  stage.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = stage;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Silty floor with pebbles.
  const floorTop = height - 34;
  const floor = ctx.createLinearGradient(0, floorTop - 10, 0, height);
  floor.addColorStop(0, 'rgba(60, 120, 90, 0)');
  floor.addColorStop(0.35, '#5E7F5A');
  floor.addColorStop(1, '#8A6B45');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorTop - 10, width, 44 + 10);
  ctx.save();
  ctx.filter = 'blur(1.5px)';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 53) % width) + 6;
    const y = floorTop + 8 + ((i * 17) % 20);
    ctx.fillStyle = `rgba(255,255,255,${0.05 + ((i % 3) * 0.03)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + (i % 4) * 2.5, 3 + (i % 3), 0, 0, TAU_ART);
    ctx.fill();
  }
  ctx.restore();

  return canvas;
}

const TAU_ART = Math.PI * 2;

/** Soft round light used for bokeh motes and fireflies. */
export function bokehCanvas(color = '255,255,255'): HTMLCanvasElement {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${color},0.95)`);
  grad.addColorStop(0.35, `rgba(${color},0.4)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** An out-of-focus lily pad for the foreground. */
export function lilyCanvas(radius: number): HTMLCanvasElement {
  const pad = radius * 0.5;
  const size = Math.ceil((radius + pad) * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.translate(size / 2, size / 2);
  ctx.filter = 'blur(6px)';
  const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
  grad.addColorStop(0, '#2F7D52');
  grad.addColorStop(1, '#14452F');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0.35, Math.PI * 2 - 0.35);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

/** Glass sheen and vignette laid over everything. */
export function glassCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const sheen = ctx.createLinearGradient(0, 0, width * 0.8, height * 0.7);
  sheen.addColorStop(0, 'rgba(255,255,255,0.13)');
  sheen.addColorStop(0.3, 'rgba(255,255,255,0.04)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  // Biased upward so the corners darken but the pile at the bottom stays clear.
  const vignette = ctx.createRadialGradient(
    width / 2, height * 0.62, width * 0.42,
    width / 2, height * 0.52, width * 1.05,
  );
  vignette.addColorStop(0, 'rgba(6,34,30,0)');
  vignette.addColorStop(1, 'rgba(6,34,30,0.34)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}
