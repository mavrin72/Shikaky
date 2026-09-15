import Matter from 'matter-js';
import { makeRng, randInt, type Rng } from './rng';

const { Bodies, Body, Composite, Engine, Events } = Matter;

/**
 * The merge chain, from frogspawn to the Frog King. `k` is the radius as a
 * fraction of the pond width, so everything scales together; `price` is the
 * flies a merge into that frog is worth.
 */
export interface FrogKind {
  name: string;
  short: string;
  k: number;
  fill: string;
  price: number;
}

export const CHAIN: FrogKind[] = [
  { name: 'Ікринка', short: 'ікринка', k: 0.050, fill: '#CFE4D6', price: 0 },
  { name: 'Пуголовок', short: 'пуголовок', k: 0.058, fill: '#6B5B45', price: 12 },
  { name: 'Жабеня', short: 'жабеня', k: 0.068, fill: '#8FD14F', price: 24 },
  { name: 'Квакша', short: 'квакша', k: 0.079, fill: '#2FB463', price: 40 },
  { name: 'Ропуха', short: 'ропуха', k: 0.091, fill: '#B2874F', price: 60 },
  { name: 'Блакитна жабка', short: 'блакитна', k: 0.106, fill: '#3FA9F5', price: 84 },
  { name: 'Отруйна жабка', short: 'отруйна', k: 0.123, fill: '#FF8C1A', price: 112 },
  { name: 'Рожева жабка', short: 'рожева', k: 0.143, fill: '#FF7BAC', price: 144 },
  { name: 'Фіолетова жабка', short: 'фіолетова', k: 0.166, fill: '#9B5DE5', price: 180 },
  { name: 'Червона жабка', short: 'червона', k: 0.193, fill: '#FF4D4D', price: 220 },
  { name: 'Жаба-царівна', short: 'царівна', k: 0.224, fill: '#2ED9A0', price: 264 },
  { name: 'Цар-Жаб', short: 'цар-жаб', k: 0.260, fill: '#F5C542', price: 312 },
];

export const FINAL_TIER = CHAIN.length - 1;
/** Only the small fry fall from the sky; everything bigger has to be earned. */
const DROPPABLE = 5;
const DROP_COOLDOWN = 0.32;
/** How long a frog may sit above the line before the run ends. */
const OVER_GRACE = 1.1;
const COMBO_WINDOW = 1.4;
const COMBO_CAP = 8;
const SHAKES_PER_RUN = 3;
const WALL = 60;

/** Matter tuning taken from the reference clones of the genre. */
const FROG_OPTIONS: Matter.IChamferableBodyDefinition = {
  restitution: 0.1,
  friction: 0.006,
  frictionStatic: 0.006,
  frictionAir: 0,
  density: 0.002,
  sleepThreshold: 45,
};

export interface FrogData {
  tier: number;
  /** Seconds since it entered the pond; a falling frog may cross the line. */
  age: number;
  /** Seconds it has spent above the line. */
  over: number;
  /** Born from a merge this step — it may not merge again immediately. */
  fresh: boolean;
}

export type PondEvent =
  | { type: 'merge'; tier: number; x: number; y: number; id: number; combo: number; gain: number }
  | { type: 'drop'; id: number }
  | { type: 'shake' }
  | { type: 'land'; id: number; force: number }
  | { type: 'final'; x: number; y: number }
  | { type: 'over' };

export const frogData = (body: Matter.Body): FrogData => body.plugin as FrogData;

export class Pond {
  readonly width = 360;
  readonly height: number;
  readonly lineY: number;
  readonly engine: Matter.Engine;

  events: PondEvent[] = [];
  score = 0;
  merges = 0;
  over = false;
  next = 0;
  queued = 0;
  combo = 0;
  comboLeft = 0;
  shakesLeft = SHAKES_PER_RUN;

  private rng: Rng;
  private cooldown = 0;
  private pending: [Matter.Body, Matter.Body][] = [];

  constructor(seed = Date.now(), height = 440) {
    this.height = height;
    this.lineY = Math.round(height * 0.15);
    this.rng = makeRng(seed >>> 0);
    this.next = this.pick();
    this.queued = this.pick();

    // Sleeping is the whole reason to use a real engine: a settled pile stops
    // dead instead of shivering, and sleeping bodies cost nothing to simulate.
    this.engine = Engine.create({ enableSleeping: true });
    this.engine.gravity.y = 0.9;
    this.buildWalls();

    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (a.isStatic || b.isStatic) {
          const frog = a.isStatic ? b : a;
          const data = frog.plugin as FrogData | undefined;
          if (data && frog.speed > 3.2) {
            this.events.push({ type: 'land', id: frog.id, force: frog.speed });
          }
          continue;
        }
        const da = frogData(a);
        const db = frogData(b);
        if (!da || !db) continue;
        if (da.tier !== db.tier || da.tier >= FINAL_TIER) {
          if (Math.abs(a.velocity.y - b.velocity.y) > 3.2) {
            this.events.push({ type: 'land', id: a.id, force: Math.abs(a.velocity.y - b.velocity.y) });
          }
          continue;
        }
        if (da.fresh || db.fresh) continue;
        da.fresh = true;
        db.fresh = true;
        this.pending.push([a, b]);
      }
    });
  }

  private buildWalls(): void {
    const options = { isStatic: true, friction: 0.02, restitution: 0.05 };
    Composite.add(this.engine.world, [
      Bodies.rectangle(this.width / 2, this.height + WALL / 2, this.width + WALL * 2, WALL, options),
      Bodies.rectangle(-WALL / 2, this.height / 2, WALL, this.height * 3, options),
      Bodies.rectangle(this.width + WALL / 2, this.height / 2, WALL, this.height * 3, options),
    ]);
  }

  get frogs(): Matter.Body[] {
    return Composite.allBodies(this.engine.world).filter((body) => !body.isStatic);
  }

  radiusOf(tier: number): number {
    return CHAIN[tier].k * this.width;
  }

  get canDrop(): boolean {
    return !this.over && this.cooldown <= 0;
  }

  private pick(): number {
    return randInt(this.rng, DROPPABLE);
  }

  private spawn(tier: number, x: number, y: number): Matter.Body {
    const body = Bodies.circle(x, y, this.radiusOf(tier), {
      ...FROG_OPTIONS,
      label: `frog-${tier}`,
    });
    body.plugin = { tier, age: 0, over: 0, fresh: false } satisfies FrogData;
    Composite.add(this.engine.world, body);
    return body;
  }

  drop(x: number): boolean {
    if (!this.canDrop) return false;
    const tier = this.next;
    const r = this.radiusOf(tier);
    const clamped = Math.min(Math.max(x, r + 2), this.width - r - 2);
    const body = this.spawn(tier, clamped, this.lineY - r - 8);
    Body.setAngularVelocity(body, (this.rng() - 0.5) * 0.06);
    this.next = this.queued;
    this.queued = this.pick();
    this.cooldown = DROP_COOLDOWN;
    this.events.push({ type: 'drop', id: body.id });
    return true;
  }

  /** Shakes the whole pond to unstick a bad pile — three per run. */
  shake(): boolean {
    if (this.over || this.shakesLeft <= 0) return false;
    this.shakesLeft--;
    for (const body of this.frogs) {
      Body.setStatic(body, false);
      Body.applyForce(body, body.position, {
        x: (this.rng() - 0.5) * body.mass * 0.09,
        y: -body.mass * (0.02 + this.rng() * 0.05),
      });
    }
    this.events.push({ type: 'shake' });
    return true;
  }

  step(dt: number): void {
    if (this.over) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.comboLeft = Math.max(0, this.comboLeft - dt);
    if (this.comboLeft === 0) this.combo = 0;

    Engine.update(this.engine, dt * 1000);

    for (const [a, b] of this.pending) this.fuse(a, b);
    this.pending.length = 0;

    for (const body of this.frogs) {
      const data = frogData(body);
      data.age += dt;
      data.fresh = false;
      // A fresh drop may cross the line on its way down; anything else that
      // lingers up there ends the run, moving or not.
      if (data.age > 0.7 && body.position.y - body.circleRadius! < this.lineY) {
        data.over += dt;
        if (data.over > OVER_GRACE) {
          this.over = true;
          this.events.push({ type: 'over' });
          return;
        }
      } else {
        data.over = 0;
      }
    }
  }

  private fuse(a: Matter.Body, b: Matter.Body): void {
    const world = this.engine.world;
    if (!Composite.get(world, a.id, 'body') || !Composite.get(world, b.id, 'body')) return;
    const tier = frogData(a).tier + 1;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    Composite.remove(world, a);
    Composite.remove(world, b);

    this.combo = this.comboLeft > 0 ? Math.min(this.combo + 1, COMBO_CAP) : 1;
    this.comboLeft = COMBO_WINDOW;
    const gain = CHAIN[tier].price * this.combo;
    this.score += gain;
    this.merges++;

    const born = this.spawn(tier, x, y);
    frogData(born).fresh = true;
    Body.setVelocity(born, {
      x: (a.velocity.x + b.velocity.x) / 2,
      y: (a.velocity.y + b.velocity.y) / 2 - 1.6,
    });
    this.events.push({ type: 'merge', tier, x, y, id: born.id, combo: this.combo, gain });
    if (tier === FINAL_TIER) this.events.push({ type: 'final', x, y });
  }

  reset(seed = Date.now()): void {
    for (const body of this.frogs) Composite.remove(this.engine.world, body);
    this.rng = makeRng(seed >>> 0);
    this.events = [];
    this.pending.length = 0;
    this.score = 0;
    this.merges = 0;
    this.over = false;
    this.cooldown = 0;
    this.combo = 0;
    this.comboLeft = 0;
    this.shakesLeft = SHAKES_PER_RUN;
    this.next = this.pick();
    this.queued = this.pick();
  }

  drain(): PondEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}
