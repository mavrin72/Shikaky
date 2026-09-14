import { settings } from '../core/storage';
import { h } from './dom';

const reduced = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || !settings().fx;

const CONFETTI = ['#FF4D8D', '#2D5BFF', '#00D18F', '#FF7A2F', '#9B5DE5', '#FFE14A'];

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  color: string;
}

/** Hard-edged paper squares, no fade-out gradients — the style does not blur. */
export function confetti(origin: { x: number; y: number }, count = 90): void {
  if (reduced()) return;
  const canvas = document.getElementById('fx') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bits: Bit[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 5 + Math.random() * 11;
    return {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: 7 + Math.random() * 9,
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    };
  });

  let frames = 0;
  const step = (): void => {
    frames++;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const bit of bits) {
      bit.vy += 0.42;
      bit.vx *= 0.99;
      bit.x += bit.vx;
      bit.y += bit.vy;
      bit.angle += bit.spin;
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.rotate(bit.angle);
      ctx.fillStyle = bit.color;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.fillRect(-bit.size / 2, -bit.size / 2, bit.size, bit.size);
      ctx.strokeRect(-bit.size / 2, -bit.size / 2, bit.size, bit.size);
      ctx.restore();
    }
    if (frames < 150) requestAnimationFrame(step);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };
  requestAnimationFrame(step);
}

export function shake(el: HTMLElement): void {
  if (reduced()) return;
  el.classList.remove('board--shake');
  void el.offsetWidth;
  el.classList.add('board--shake');
  window.setTimeout(() => el.classList.remove('board--shake'), 300);
}

export function buzz(pattern: number | number[] = 12): void {
  if (!settings().fx) return;
  navigator.vibrate?.(pattern);
}

let toastTimer = 0;
export function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  const node = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(node);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.remove(), 2200);
}
