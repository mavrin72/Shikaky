import { describe, expect, it } from 'vitest';
import { CHAIN, FINAL_TIER, frogData, Pond } from '../src/core/pond';

const run = (pond: Pond, seconds: number): void => {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) pond.step(dt);
};

const dropRun = (pond: Pond, x: number, settle = 0.34): void => {
  pond.drop(x);
  run(pond, settle);
};

describe('pond merging', () => {
  it('fuses two equal frogs into the next one and pays its flies', () => {
    const pond = new Pond(1);
    dropRun(pond, 180, 1.2);
    while (pond.next !== frogData(pond.frogs[0]).tier) pond.next = (pond.next + 1) % 5;
    dropRun(pond, 182, 1.6);
    expect(pond.frogs.length).toBe(1);
    const tier = frogData(pond.frogs[0]).tier;
    expect(pond.score).toBe(CHAIN[tier].price);
    expect(pond.merges).toBe(1);
  });

  it('never merges past the Frog King', () => {
    const pond = new Pond(2);
    const r = pond.radiusOf(FINAL_TIER);
    pond.next = FINAL_TIER;
    pond.drop(120);
    pond.next = FINAL_TIER;
    run(pond, 0.4);
    pond.drop(240);
    run(pond, 3);
    expect(pond.frogs.length).toBe(2);
    expect(r).toBeGreaterThan(0);
  });

  it('keeps every frog inside the pond', () => {
    const pond = new Pond(3);
    for (let i = 0; i < 16; i++) dropRun(pond, 20 + ((i * 53) % 320));
    run(pond, 3);
    for (const body of pond.frogs) {
      const r = body.circleRadius ?? 0;
      expect(body.position.x - r).toBeGreaterThan(-2);
      expect(body.position.x + r).toBeLessThan(pond.width + 2);
      expect(body.position.y + r).toBeLessThan(pond.height + 2);
    }
  });

  it('lets the pile fall asleep instead of shivering', () => {
    const pond = new Pond(4);
    for (let i = 0; i < 14; i++) dropRun(pond, 60 + ((i * 91) % 240), 0.5);
    run(pond, 5);
    const awake = pond.frogs.filter((body) => !body.isSleeping && body.speed > 0.4);
    expect(awake.length).toBeLessThanOrEqual(Math.ceil(pond.frogs.length * 0.2));
  });

  it('ends the run even when frogs are dropped as fast as allowed', () => {
    const pond = new Pond(5);
    for (let i = 0; i < 400 && !pond.over; i++) dropRun(pond, 40 + ((i * 37) % 280));
    expect(pond.over).toBe(true);
  });

  it('is the same run for the same seed', () => {
    const a = new Pond(77);
    const b = new Pond(77);
    for (let i = 0; i < 10; i++) {
      expect(a.next).toBe(b.next);
      dropRun(a, 100 + i * 7);
      dropRun(b, 100 + i * 7);
    }
    expect(a.score).toBe(b.score);
  });
});

describe('combo and shake', () => {
  it('pays more for merges chained back to back', () => {
    const pond = new Pond(41);
    // Four identical frogs in a row: the second pair merges while the combo
    // from the first pair is still running.
    for (let i = 0; i < 6; i++) {
      pond.next = 0;
      pond.drop(150 + (i % 2) * 14);
      run(pond, 0.34);
    }
    run(pond, 1);
    expect(pond.merges).toBeGreaterThanOrEqual(2);
    expect(pond.combo).toBeGreaterThanOrEqual(2);
    // First merge pays face value, the second pays double.
    expect(pond.score).toBeGreaterThan(CHAIN[1].price * 2);
  });

  it('lets the combo lapse after the window', () => {
    const pond = new Pond(42);
    pond.next = 0;
    pond.drop(90);
    pond.next = 0;
    run(pond, 0.4);
    pond.drop(92);
    run(pond, 3);
    expect(pond.combo).toBe(0);
  });

  it('shakes the pond three times per run and no more', () => {
    const pond = new Pond(43);
    for (let i = 0; i < 6; i++) dropRun(pond, 60 + i * 40, 0.5);
    run(pond, 4);
    expect(pond.shake()).toBe(true);
    run(pond, 0.1);
    expect(pond.frogs.some((body) => body.speed > 0.5)).toBe(true);
    expect(pond.shake()).toBe(true);
    expect(pond.shake()).toBe(true);
    expect(pond.shake()).toBe(false);
    expect(pond.shakesLeft).toBe(0);
  });
});
