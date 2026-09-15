import { Basket, CHAIN, type Body } from '../core/basket';
import { basketBest, recordBasket } from '../core/storage';
import { clamp, h } from './dom';
import { buzz, confetti, motionOff, toast } from './fx';
import { sfx } from './sound';

const TAU = Math.PI * 2;
/** The field keeps its own warm ground in both themes: the product colours are
 *  picked to sit on paper, and black outlines need something light behind them. */
const GROUND_LIGHT = '#FDF4DC';
const GROUND_DARK = '#EFE4C6';
const INK = '#111111';

type Detail = (ctx: CanvasRenderingContext2D, r: number) => void;

/** Dark products need a light face, light ones a dark face. */
function faceInk(fill: string): string {
  const hex = fill.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.55 ? INK : '#FFF7E4';
}

interface FaceState {
  blink: number;
  mouth: number;
}

/** Eyes, a mouth, and enough timing to make it feel alive rather than printed. */
function drawFace(ctx: CanvasRenderingContext2D, r: number, ink: string, state: FaceState): void {
  const eyeY = -r * 0.14;
  const eyeX = r * 0.33;
  const eyeR = r * 0.13;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.6, r * 0.09);
  ctx.lineCap = 'round';

  for (const side of [-1, 1]) {
    if (state.blink > 0.5) {
      ctx.beginPath();
      ctx.moveTo(side * eyeX - eyeR, eyeY);
      ctx.lineTo(side * eyeX + eyeR, eyeY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(side * eyeX, eyeY, eyeR * 0.78, eyeR, 0, 0, TAU);
      ctx.fill();
      if (r > 26) {
        ctx.fillStyle = ink === INK ? '#FFF7E4' : INK;
        ctx.beginPath();
        ctx.arc(side * eyeX + eyeR * 0.28, eyeY - eyeR * 0.3, eyeR * 0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = ink;
      }
    }
  }

  const mouthY = r * 0.3;
  if (state.mouth > 0.05) {
    // Open mouth: a filled arc, wider the more excited it is.
    ctx.beginPath();
    ctx.ellipse(0, mouthY, r * 0.2, r * (0.1 + 0.22 * state.mouth), 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, mouthY - r * 0.1, r * 0.22, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }
}

const dots = (ctx: CanvasRenderingContext2D, points: [number, number][], r: number, color: string): void => {
  ctx.fillStyle = color;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, r * 0.11, 0, TAU);
    ctx.fill();
  }
};

const stem = (ctx: CanvasRenderingContext2D, r: number, color: string): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.72);
  ctx.lineTo(r * 0.16, -r * 1.02);
  ctx.stroke();
};

/** One drawing per chain step — this is what makes a coconut read as a coconut. */
const DETAILS: Detail[] = [
  (ctx, r) => dots(ctx, [[-0.5, 0.5], [0.5, 0.52]], r, '#CFCABF'),
  (ctx, r) => {
    ctx.strokeStyle = '#3E2260';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    for (const off of [-0.55, 0.55]) {
      ctx.beginPath();
      ctx.arc(off * r, r * 0.1, r * 0.5, -1.2, 1.2);
      ctx.stroke();
    }
  },
  (ctx, r) => dots(ctx, [[-0.58, 0.5], [0.1, 0.68], [0.6, 0.45]], r, '#A9763B'),
  (ctx, r) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.13);
    // Shell seam down the side — under the face it read as a second mouth.
    ctx.beginPath();
    ctx.moveTo(-r * 0.74, -r * 0.18);
    ctx.lineTo(-r * 0.6, r * 0.42);
    ctx.stroke();
  },
  (ctx, r) => {
    dots(ctx, [[-0.6, 0.45], [0.6, 0.42], [0, 0.7]], r, '#C77BD8');
    stem(ctx, r, '#4B1C58');
  },
  (ctx, r) => {
    ctx.fillStyle = '#1F7A3A';
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.6);
      ctx.lineTo(Math.cos(a - 1.57) * r * 0.62, -r * 0.6 + Math.sin(a - 1.57) * r * 0.42);
      ctx.lineTo(Math.cos(a - 1.2) * r * 0.3, -r * 0.42);
      ctx.closePath();
      ctx.fill();
    }
    stem(ctx, r, '#1F7A3A');
  },
  (ctx, r) => {
    stem(ctx, r, '#6B4A2A');
    ctx.strokeStyle = '#9DBD33';
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.beginPath();
    ctx.arc(-r * 0.15, r * 0.15, r * 0.5, 0.4, 1.9);
    ctx.stroke();
  },
  (ctx, r) => {
    ctx.strokeStyle = '#E2661B';
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.05, r * 0.55, -2.4, -0.6);
    ctx.stroke();
  },
  (ctx, r) => dots(ctx, [[-0.62, 0.42], [0.62, 0.42], [0, 0.72]], r, INK),
  (ctx, r) => {
    ctx.strokeStyle = '#C4530E';
    ctx.lineWidth = Math.max(2, r * 0.1);
    for (const off of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.ellipse(off * r * 0.9, 0, r * 0.22, r * 0.94, 0, 0, TAU);
      ctx.stroke();
    }
    stem(ctx, r, '#4E7A2A');
  },
  (ctx, r) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.arc(0, r * 0.05, r * 0.62, 0, TAU);
    ctx.clip('evenodd');
    ctx.strokeStyle = '#B9A23F';
    ctx.lineWidth = Math.max(1.5, r * 0.07);
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
    // The basket: weave, rim and handle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, 0, TAU);
    ctx.arc(0, r * 0.05, r * 0.6, 0, TAU);
    ctx.clip('evenodd');
    ctx.strokeStyle = '#A9803F';
    ctx.lineWidth = Math.max(2, r * 0.09);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.32, -r);
      ctx.lineTo(i * r * 0.32, r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r, i * r * 0.32);
      ctx.lineTo(r, i * r * 0.32);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.66, Math.PI, TAU);
    ctx.stroke();
  },
];

export interface BasketViewHandles {
  el: HTMLElement;
  game: Basket;
  restart: () => void;
  destroy: () => void;
}

export interface BasketCallbacks {
  onScore: (score: number, best: number) => void;
  onNext: (tier: number) => void;
  onReach: (tier: number) => void;
  onOver: (score: number, best: number) => void;
}

export function createBasketView({ onScore, onNext, onReach, onOver }: BasketCallbacks): BasketViewHandles {
  const game = new Basket();
  const canvas = h('canvas', { class: 'basket__canvas', 'aria-label': 'Кошик: кидай продукти, однакові зливаються' }) as HTMLCanvasElement;
  canvas.tabIndex = 0;
  const wrap = h('div', { class: 'basket' }, canvas);

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

  // Purely visual state — the physics core knows nothing about any of this.
  interface Burst { x: number; y: number; r: number; color: string; t: number }
  interface Popup { x: number; y: number; text: string; t: number }
  const bursts: Burst[] = [];
  const popups: Popup[] = [];
  const pops = new Map<number, number>();
  const squash = new Map<number, number>();
  const impactSpeed = new Map<number, number>();
  const faces = new Map<number, { nextBlink: number; blinkUntil: number; mouth: number }>();
  let shake = 0;
  let flash = 0;
  let clock = 0;

  const ctx = canvas.getContext('2d');

  function resize(): void {
    const cssWidth = wrap.clientWidth || 340;
    const cssHeight = cssWidth * (game.height / game.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    scale = (cssWidth * dpr) / game.width;
  }

  function worldX(clientX: number): number {
    const box = canvas.getBoundingClientRect();
    return clamp(((clientX - box.left) / box.width) * game.width, 0, game.width);
  }

  function drawBody(body: Body): void {
    if (!ctx) return;
    const item = CHAIN[body.tier];
    const pop = pops.get(body.id) ?? 0;
    const hit = squash.get(body.id) ?? 0;
    // Born big and settling down; squashed flat for a moment on a hard landing.
    const grow = 1 + 0.4 * Math.sin(Math.PI * pop);
    const sx = grow * (1 + 0.22 * hit);
    const sy = grow * (1 - 0.22 * hit);

    ctx.save();
    ctx.translate(body.x, body.y + body.r * 0.22 * hit);
    ctx.scale(sx, sy);
    ctx.fillStyle = 'rgba(17,17,17,0.92)';
    ctx.beginPath();
    ctx.arc(body.r * 0.07 + 2, body.r * 0.09 + 2.5, body.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = item.fill;
    ctx.beginPath();
    ctx.arc(0, 0, body.r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(2, body.r * 0.1);
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.rotate(body.angle);
    DETAILS[body.tier]?.(ctx, body.r);

    let face = faces.get(body.id);
    if (!face) {
      face = { nextBlink: clock + 1 + Math.random() * 5, blinkUntil: 0, mouth: 0 };
      faces.set(body.id, face);
    }
    drawFace(ctx, body.r, faceInk(item.fill), {
      blink: clock < face.blinkUntil ? 1 : 0,
      mouth: face.mouth,
    });
    ctx.restore();
  }

  /** Hard-edged shards, never a soft glow — the style does not blur. */
  function drawBurst(burst: Burst): void {
    if (!ctx) return;
    const p = burst.t / 0.45;
    const ring = burst.r * (1 + 1.5 * p);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, ring, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = burst.color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + burst.r;
      const d = burst.r * (0.9 + 1.7 * p);
      const size = burst.r * 0.26 * (1 - p * 0.6);
      ctx.save();
      ctx.translate(burst.x + Math.cos(a) * d, burst.y + Math.sin(a) * d);
      ctx.rotate(a + p * 3);
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPopup(popup: Popup): void {
    if (!ctx) return;
    const p = popup.t / 0.9;
    ctx.save();
    ctx.globalAlpha = 1 - p * p;
    ctx.font = '900 20px Rubik, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#FFF7E4';
    ctx.strokeText(popup.text, popup.x, popup.y - 34 * p);
    ctx.fillStyle = INK;
    ctx.fillText(popup.text, popup.x, popup.y - 34 * p);
    ctx.restore();
  }

  function draw(): void {
    if (!ctx) return;
    const jolt = motionOff() ? 0 : shake;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = dark ? GROUND_DARK : GROUND_LIGHT;
    ctx.fillRect(0, 0, game.width, game.height);
    ctx.translate((Math.random() - 0.5) * jolt, (Math.random() - 0.5) * jolt);

    // The basket itself: a woven floor the goods sit in.
    const floor = 30;
    ctx.fillStyle = '#DCC08A';
    ctx.fillRect(0, game.height - floor, game.width, floor);
    ctx.strokeStyle = '#B8965F';
    ctx.lineWidth = 3;
    for (let x = 6; x < game.width; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, game.height - floor);
      ctx.lineTo(x, game.height);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, game.height - floor);
    ctx.lineTo(game.width, game.height - floor);
    ctx.stroke();

    // Danger line: quiet until something is actually up there, then it pulses.
    const danger = game.bodies.some((body) => body.age > 0.7 && body.y - body.r < game.lineY);
    const pulse = danger ? 0.55 + 0.45 * Math.sin(clock * 9) : 1;
    if (danger) {
      const grad = ctx.createLinearGradient(0, 0, 0, game.lineY + 40);
      grad.addColorStop(0, `rgba(255,46,46,${0.32 * pulse})`);
      grad.addColorStop(1, 'rgba(255,46,46,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, game.width, game.lineY + 40);
    }
    ctx.strokeStyle = '#FF2E2E';
    ctx.globalAlpha = danger ? pulse : 1;
    ctx.lineWidth = danger ? 4 : 2;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(0, game.lineY);
    ctx.lineTo(game.width, game.lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (!game.over && game.canDrop) {
      const r = game.radiusOf(game.next);
      const x = clamp(aimX, r + 2, game.width - r - 2);
      ctx.strokeStyle = 'rgba(17,17,17,0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(x, game.lineY);
      ctx.lineTo(x, game.height);
      ctx.stroke();
      ctx.setLineDash([]);
      const bob = motionOff() ? 0 : Math.sin(clock * 3.4) * 3;
      drawBody({ id: -1, tier: game.next, x, y: game.lineY - r - 8 + bob, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 });
    }

    for (const body of game.bodies) drawBody(body);
    for (const burst of bursts) drawBurst(burst);
    for (const popup of popups) drawPopup(popup);

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,247,228,${flash * 0.65})`;
      ctx.fillRect(0, 0, game.width, game.height);
    }

    if (game.over) {
      ctx.fillStyle = 'rgba(17,17,17,0.55)';
      ctx.fillRect(0, 0, game.width, game.height);
      ctx.save();
      ctx.translate(game.width / 2, game.height / 2);
      ctx.rotate(-0.1);
      ctx.fillStyle = '#FF2E2E';
      ctx.fillRect(-130, -26, 260, 52);
      ctx.strokeStyle = '#FFF7E4';
      ctx.lineWidth = 4;
      ctx.strokeRect(-130, -26, 260, 52);
      ctx.fillStyle = '#FFF7E4';
      ctx.font = '900 27px Rubik, system-ui, sans-serif';
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
      } else if (event.type === 'merge') {
        sfx.merge(event.tier);
        buzz(event.tier > 6 ? 18 : 8);
        pops.set(event.id, 1);
        // The new product gasps when it appears.
        faces.set(event.id, { nextBlink: clock + 1.5 + Math.random() * 4, blinkUntil: 0, mouth: 1 });
        if (!motionOff()) {
          bursts.push({ x: event.x, y: event.y, r: game.radiusOf(event.tier), color: CHAIN[event.tier].fill, t: 0 });
          shake = Math.min(14, shake + 2 + event.tier * 0.9);
        }
        popups.push({ x: event.x, y: event.y, text: `+${CHAIN[event.tier].price}`, t: 0 });
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
        onOver(game.score, best);
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
    shake *= 0.86;
    flash *= 0.92;
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt;
      if (bursts[i].t > 0.45) bursts.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].t += dt;
      if (popups[i].t > 0.9) popups.splice(i, 1);
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
    for (const face of faces.values()) {
      if (clock > face.nextBlink) {
        face.blinkUntil = clock + 0.12;
        face.nextBlink = clock + 2 + Math.random() * 5;
      }
      face.mouth = Math.max(0, face.mouth - dt * 2.2);
    }
    if (faces.size > 200) faces.clear();
    // A body that just lost a lot of downward speed has hit something.
    for (const body of game.bodies) {
      const before = impactSpeed.get(body.id) ?? 0;
      if (before > 260 && body.vy < before * 0.45) {
        if (!motionOff()) squash.set(body.id, Math.min(1, before / 1100));
        const face = faces.get(body.id);
        if (face) face.mouth = Math.max(face.mouth, Math.min(0.7, before / 900));
      }
      impactSpeed.set(body.id, body.vy);
    }
    if (impactSpeed.size > 200) impactSpeed.clear();

    handleEvents();
    if (now - themeCheck > 500) {
      themeCheck = now;
      dark = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().startsWith('#1');
    }
    draw();
    if (game.score !== shownScore) {
      shownScore = game.score;
      onScore(game.score, Math.max(basketBest(), game.score));
    }
    if (game.next !== shownNext) {
      shownNext = game.next;
      onNext(game.next);
    }
    const top = game.bodies.reduce((max, body) => Math.max(max, body.tier), -1);
    if (top > shownTop) {
      shownTop = top;
      onReach(top);
    }
  }

  let dragging = false;
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    aimX = worldX(event.clientX);
  });
  // Touch events report pressure 0 on plenty of phones, so the drag state has to
  // be tracked explicitly — otherwise the product simply ignores your finger.
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
      pops.clear();
      squash.clear();
      impactSpeed.clear();
      faces.clear();
      shake = 0;
      flash = 0;
      shownScore = -1;
      shownNext = -1;
      shownTop = -1;
      last = performance.now();
      accumulator = 0;
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
