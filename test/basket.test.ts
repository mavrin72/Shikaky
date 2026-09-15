import { describe, expect, it } from 'vitest';
import { Basket, CHAIN, FINAL_TIER } from '../src/core/basket';

const run = (game: Basket, seconds: number): void => {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) game.step(dt);
};

describe('basket merge', () => {
  it('fuses two equal items into the next one and pays its price', () => {
    const game = new Basket(1);
    const r = game.radiusOf(0);
    game.bodies.push(
      { id: 1, tier: 0, x: 100, y: 400, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 },
      { id: 2, tier: 0, x: 100 + r, y: 400, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 },
    );
    game.step(1 / 60);
    expect(game.bodies.length).toBe(1);
    expect(game.bodies[0].tier).toBe(1);
    expect(game.score).toBe(CHAIN[1].price);
    expect(game.drain().some((e) => e.type === 'merge')).toBe(true);
  });

  it('leaves the final item alone — nothing merges past the basket', () => {
    const game = new Basket(2);
    const r = game.radiusOf(FINAL_TIER);
    game.bodies.push(
      { id: 1, tier: FINAL_TIER, x: 120, y: 400, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 },
      { id: 2, tier: FINAL_TIER, x: 120 + r, y: 400, vx: 0, vy: 0, angle: 0, spin: 0, r, over: 0, age: 9 },
    );
    run(game, 1);
    expect(game.bodies.length).toBe(2);
  });

  it('keeps every body inside the container', () => {
    const game = new Basket(3);
    for (let i = 0; i < 14; i++) {
      game.drop(20 + ((i * 53) % 320));
      run(game, 0.4);
    }
    run(game, 3);
    for (const body of game.bodies) {
      expect(body.x - body.r).toBeGreaterThan(-1);
      expect(body.x + body.r).toBeLessThan(game.width + 1);
      expect(body.y + body.r).toBeLessThan(game.height + 1);
    }
  });

  it('settles without bodies sinking into each other', () => {
    const game = new Basket(4);
    for (let i = 0; i < 10; i++) {
      game.drop(60 + ((i * 91) % 240));
      run(game, 0.5);
    }
    run(game, 4);
    for (let i = 0; i < game.bodies.length; i++) {
      for (let j = i + 1; j < game.bodies.length; j++) {
        const a = game.bodies[i];
        const b = game.bodies[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        // A few percent of squash is normal for an impulse solver; sinking is not.
        expect(dist).toBeGreaterThan((a.r + b.r) * 0.9);
      }
    }
  });

  it('ends the run when the stack reaches above the line', () => {
    const game = new Basket(5);
    const r = game.radiusOf(9);
    for (let i = 0; i < 10; i++) {
      game.bodies.push({
        id: 100 + i,
        tier: 9,
        x: game.width / 2,
        y: game.height - r - i * r * 2,
        vx: 0,
        vy: 0,
        angle: 0,
        spin: 0,
        r,
        over: 0,
        age: 9,
      });
    }
    run(game, 6);
    expect(game.over).toBe(true);
  });

  it('is the same run for the same seed', () => {
    const a = new Basket(77);
    const b = new Basket(77);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 8; i++) {
      seqA.push(a.next);
      a.drop(100);
      run(a, 0.4);
      seqB.push(b.next);
      b.drop(100);
      run(b, 0.4);
    }
    expect(seqA).toEqual(seqB);
    expect(a.score).toBe(b.score);
  });
});

describe('basket fairness', () => {
  it('ends the run even when pieces are dropped as fast as allowed', () => {
    const game = new Basket(11);
    for (let i = 0; i < 300 && !game.over; i++) {
      game.drop(40 + ((i * 37) % 280));
      run(game, 0.34);
    }
    expect(game.over).toBe(true);
  });

  it('does not let a stack balance in a perfect column', () => {
    const game = new Basket(12);
    for (let i = 0; i < 10; i++) {
      game.drop(180);
      run(game, 0.6);
    }
    run(game, 3);
    const xs = game.bodies.map((body) => body.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(12);
  });
});

describe('basket physics settles', () => {
  it('comes to a stop instead of shivering and spinning forever', () => {
    const game = new Basket(31);
    for (let i = 0; i < 26; i++) {
      game.drop(40 + ((i * 37) % 280));
      run(game, 0.4);
    }
    run(game, 3);
    const moving = game.bodies.filter((body) => Math.hypot(body.vx, body.vy) > 1).length;
    const spinning = game.bodies.filter((body) => Math.abs(body.spin) > 0.05).length;
    expect(moving).toBeLessThanOrEqual(Math.ceil(game.bodies.length * 0.25));
    expect(spinning).toBeLessThanOrEqual(Math.ceil(game.bodies.length * 0.25));
  });

  it('rolls rather than spins: a resting body has no spin left', () => {
    const game = new Basket(32);
    game.drop(180);
    run(game, 4);
    const [body] = game.bodies;
    expect(Math.abs(body.spin)).toBeLessThan(0.05);
    expect(Math.abs(body.vx)).toBeLessThan(2);
  });
});
