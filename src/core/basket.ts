import { makeRng, randInt, type Rng } from './rng';

/**
 * The merge chain. Names and prices come from the Silpo catalogue; `k` is the
 * radius as a fraction of the container width, so everything scales together.
 */
export interface ChainItem {
  name: string;
  short: string;
  k: number;
  fill: string;
  /** Points awarded for merging two of the previous item into this one. */
  price: number;
}

export const CHAIN: ChainItem[] = [
  { name: 'Насіння чіа', short: 'чіа', k: 0.050, fill: '#3B3A36', price: 0 },
  { name: 'Родзинки', short: 'родзинка', k: 0.058, fill: '#6B3FA0', price: 12 },
  { name: 'Арахіс смажений', short: 'арахіс', k: 0.068, fill: '#E0B06A', price: 24 },
  { name: 'Горіх макадамія', short: 'макадамія', k: 0.079, fill: '#F0E2C4', price: 40 },
  { name: 'Інжир фіолетовий', short: 'інжир', k: 0.091, fill: '#7B2D8E', price: 60 },
  { name: 'Томат на гілці', short: 'томат', k: 0.106, fill: '#FF3B2F', price: 84 },
  { name: 'Груша Санта Марія', short: 'груша', k: 0.123, fill: '#C8E05A', price: 112 },
  { name: 'Манго еліт', short: 'манго', k: 0.143, fill: '#FF9F1C', price: 144 },
  { name: 'Кокос свіжий', short: 'кокос', k: 0.166, fill: '#8B5E3C', price: 180 },
  { name: 'Гарбуз мускатний', short: 'гарбуз', k: 0.193, fill: '#FF7A2F', price: 220 },
  { name: 'Диня Валенсія', short: 'диня', k: 0.224, fill: '#EFDC76', price: 264 },
  { name: 'Кошик', short: 'кошик', k: 0.260, fill: '#E3CFA4', price: 312 },
];

export const FINAL_TIER = CHAIN.length - 1;
/** Only the small stuff falls from the sky; everything bigger has to be earned. */
const DROPPABLE = 5;

export interface Body {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  r: number;
  /** Seconds this body has spent resting above the line. */
  over: number;
  /** Seconds since it was dropped — a falling piece may cross the line freely. */
  age: number;
  /** Just born from a merge: it has to settle before it can merge again. */
  fresh?: boolean;
}

export type BasketEvent =
  | { type: 'merge'; tier: number; x: number; y: number }
  | { type: 'drop' }
  | { type: 'final'; x: number; y: number }
  | { type: 'over' };

const GRAVITY = 2100;
/** Without damping the pile never stops shivering — and a shivering pile
 *  merges by itself, which quietly removes the whole challenge. */
const DAMPING = 0.995;
const SLEEP_SPEED = 6;
const RESTITUTION = 0.18;
/** Coulomb-ish contact friction. Without it a pile slides itself into perfect
 *  packing and the basket can never overflow. */
const FRICTION = 0.42;
const SUBSTEPS = 4;
const DROP_COOLDOWN = 0.32;
/** How long a body may sit above the line before the run ends. */
const OVER_GRACE = 1.1;

export class Basket {
  readonly width = 360;
  readonly height: number;
  /** Everything above this line is the danger zone. */
  readonly lineY: number;

  bodies: Body[] = [];
  events: BasketEvent[] = [];
  score = 0;
  merges = 0;
  over = false;
  next = 0;
  queued = 0;

  private rng: Rng;
  private nextId = 1;
  private cooldown = 0;

  constructor(seed = Date.now(), height = 440) {
    this.height = height;
    this.lineY = Math.round(height * 0.15);
    this.rng = makeRng(seed >>> 0);
    this.next = this.pick();
    this.queued = this.pick();
  }

  reset(seed = Date.now()): void {
    this.rng = makeRng(seed >>> 0);
    this.bodies = [];
    this.events = [];
    this.score = 0;
    this.merges = 0;
    this.over = false;
    this.cooldown = 0;
    this.next = this.pick();
    this.queued = this.pick();
  }

  private pick(): number {
    return randInt(this.rng, DROPPABLE);
  }

  radiusOf(tier: number): number {
    return CHAIN[tier].k * this.width;
  }

  get canDrop(): boolean {
    return !this.over && this.cooldown <= 0;
  }

  /** Drops the pending item at x (clamped so it always starts inside the basket). */
  drop(x: number): boolean {
    if (!this.canDrop) return false;
    const tier = this.next;
    const r = this.radiusOf(tier);
    // A hair of jitter: two pieces dropped at the same spot must not balance
    // forever in a perfect column.
    const jitter = (this.rng() - 0.5) * 3;
    this.bodies.push({
      id: this.nextId++,
      tier,
      x: Math.min(Math.max(x + jitter, r + 2), this.width - r - 2),
      y: this.lineY - r - 6,
      vx: 0,
      vy: 0,
      angle: 0,
      spin: (this.rng() - 0.5) * 2,
      r,
      over: 0,
      age: 0,
    });
    this.next = this.queued;
    this.queued = this.pick();
    this.cooldown = DROP_COOLDOWN;
    this.events.push({ type: 'drop' });
    return true;
  }

  step(dt: number): void {
    if (this.over) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const body of this.bodies) {
      body.age += dt;
      body.fresh = false;
    }

    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) this.substep(h);

    this.checkOver(dt);
  }

  private substep(h: number): void {
    const { bodies, width, height } = this;

    for (const body of bodies) {
      body.vy += GRAVITY * h;
      body.vx *= DAMPING;
      body.vy *= DAMPING;
      body.spin *= 0.985;
      if (Math.abs(body.vx) < SLEEP_SPEED) body.vx = 0;
      body.x += body.vx * h;
      body.y += body.vy * h;
      body.angle += body.spin * h;

      if (body.x - body.r < 0) {
        body.x = body.r;
        body.vx = Math.abs(body.vx) * RESTITUTION;
        body.spin += body.vy * 0.002;
      } else if (body.x + body.r > width) {
        body.x = width - body.r;
        body.vx = -Math.abs(body.vx) * RESTITUTION;
        body.spin -= body.vy * 0.002;
      }
      if (body.y + body.r > height) {
        body.y = height - body.r;
        body.vy = -Math.abs(body.vy) * RESTITUTION;
        body.vx *= 0.86;
        body.spin = body.spin * 0.86 - body.vx * 0.004;
      }
    }

    // Keyed by object, not id: a fused body must never be mistaken for one of
    // the bodies it replaced.
    const merged = new Set<Body>();
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (merged.has(a) || merged.has(b)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const distSq = dx * dx + dy * dy;
        if (distSq >= min * min) continue;
        const dist = Math.sqrt(distSq) || 0.0001;

        // A product born this frame does not chain-react instantly; without this
        // the pile dissolves itself and the basket can never fill up.
        if (a.tier === b.tier && a.tier < FINAL_TIER && !a.fresh && !b.fresh) {
          merged.add(a);
          merged.add(b);
          this.fuse(a, b);
          continue;
        }

        // Push apart, split by area so a melon barely notices a raisin.
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = min - dist;
        const wa = b.r * b.r;
        const wb = a.r * a.r;
        const total = wa + wb;
        a.x -= nx * overlap * (wa / total);
        a.y -= ny * overlap * (wa / total);
        b.x += nx * overlap * (wb / total);
        b.y += ny * overlap * (wb / total);

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const along = rvx * nx + rvy * ny;
        if (along < 0) {
          const impulse = (-(1 + RESTITUTION) * along) / 2;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;

          // Friction along the contact, capped by the normal impulse.
          const tx = -ny;
          const ty = nx;
          const tangentSpeed = rvx * tx + rvy * ty;
          const friction = Math.max(-impulse * FRICTION, Math.min(impulse * FRICTION, tangentSpeed / 2));
          a.vx += friction * tx;
          a.vy += friction * ty;
          b.vx -= friction * tx;
          b.vy -= friction * ty;
          a.spin += tangentSpeed * 0.012;
          b.spin -= tangentSpeed * 0.012;
        }

        // A ball balanced exactly on another is unstable in the real world, and
        // our solver is too tidy to notice. Nudge it off the peak.
        if (Math.abs(nx) < 0.3 && Math.abs(along) < 25) {
          const dir = Math.abs(dx) < 0.4 ? (this.rng() < 0.5 ? -1 : 1) : Math.sign(dx);
          const push = Math.min(overlap, 2) * 1.1;
          a.vx -= dir * push;
          b.vx += dir * push;
        }
      }
    }

    if (merged.size) this.bodies = bodies.filter((body) => !merged.has(body));
  }

  private fuse(a: Body, b: Body): void {
    const tier = a.tier + 1;
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    this.score += CHAIN[tier].price;
    this.merges++;
    this.bodies.push({
      id: this.nextId++,
      tier,
      x,
      y,
      vx: (a.vx + b.vx) / 2,
      vy: (a.vy + b.vy) / 2 - 40,
      angle: (a.angle + b.angle) / 2,
      spin: (a.spin + b.spin) / 2,
      r: this.radiusOf(tier),
      over: 0,
      age: 0,
      fresh: true,
    });
    this.events.push({ type: 'merge', tier, x, y });
    if (tier === FINAL_TIER) this.events.push({ type: 'final', x, y });
  }

  private checkOver(dt: number): void {
    for (const body of this.bodies) {
      // A fresh piece is allowed to cross the line on its way down; dropping
      // fast must never buy immunity. Motion does not excuse it either — a pile
      // poked by every new drop would otherwise be immortal.
      if (body.age < 0.7) continue;
      if (body.y - body.r < this.lineY) {
        body.over += dt;
        if (body.over > OVER_GRACE) {
          this.over = true;
          this.events.push({ type: 'over' });
          return;
        }
      } else {
        body.over = 0;
      }
    }
  }

  drain(): BasketEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}
