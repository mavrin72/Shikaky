import { Basket, CHAIN, type Body } from '../core/basket';
import { basketBest, recordBasket } from '../core/storage';
import { clamp, h } from './dom';
import { buzz, confetti, toast } from './fx';
import { sfx } from './sound';

const TAU = Math.PI * 2;
/** The field keeps its own warm ground in both themes: the product colours are
 *  picked to sit on paper, and black outlines need something light behind them. */
const GROUND_LIGHT = '#FDF4DC';
const GROUND_DARK = '#EFE4C6';
const INK = '#111111';

type Detail = (ctx: CanvasRenderingContext2D, r: number) => void;

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
  (ctx, r) => dots(ctx, [[-0.2, -0.1], [0.25, 0.2]], r, '#CFCABF'),
  (ctx, r) => {
    ctx.strokeStyle = '#3E2260';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    for (const off of [-0.35, 0.1]) {
      ctx.beginPath();
      ctx.arc(off * r, 0, r * 0.55, -0.9, 0.9);
      ctx.stroke();
    }
  },
  (ctx, r) => dots(ctx, [[-0.3, -0.2], [0.05, 0.15], [0.35, -0.25]], r, '#A9763B'),
  (ctx, r) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, r * 0.13);
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, 0);
    ctx.lineTo(r * 0.78, 0);
    ctx.stroke();
  },
  (ctx, r) => {
    dots(ctx, [[-0.25, 0.1], [0.2, -0.05], [0, 0.35]], r, '#C77BD8');
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
  (ctx, r) => dots(ctx, [[-0.28, -0.12], [0.28, -0.12], [0, 0.26]], r, INK),
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
  },
  (ctx, r) => {
    // The basket: weave, rim and handle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, 0, TAU);
    ctx.clip();
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
    ctx.save();
    ctx.translate(body.x, body.y);
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
    ctx.restore();
  }

  function draw(): void {
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = dark ? GROUND_DARK : GROUND_LIGHT;
    ctx.fillRect(0, 0, game.width, game.height);

    ctx.strokeStyle = '#FF2E2E';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(0, game.lineY);
    ctx.lineTo(game.width, game.lineY);
    ctx.stroke();
    ctx.setLineDash([]);

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
      drawBody({ id: -1, tier: game.next, x, y: game.lineY - r - 6, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 });
    }

    for (const body of game.bodies) drawBody(body);

    if (game.over) {
      ctx.fillStyle = 'rgba(17,17,17,0.55)';
      ctx.fillRect(0, 0, game.width, game.height);
    }
  }

  function handleEvents(): void {
    for (const event of game.drain()) {
      if (event.type === 'drop') {
        sfx.tap();
      } else if (event.type === 'merge') {
        sfx.merge(event.tier);
        buzz(event.tier > 6 ? 18 : 8);
      } else if (event.type === 'final') {
        sfx.win();
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

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    aimX = worldX(event.clientX);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pressure > 0 || event.pointerType === 'mouse') aimX = worldX(event.clientX);
  });
  canvas.addEventListener('pointerup', (event) => {
    aimX = worldX(event.clientX);
    game.drop(aimX);
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
