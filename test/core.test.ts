import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/core/generator';
import { dailyPuzzle, puzzleForLevel, TIERS, TOTAL_LEVELS, levelRef } from '../src/core/levels';
import { candidatesFor, solve } from '../src/core/solver';
import { migrateV1 } from '../src/core/storage';
import { area, contains, overlaps } from '../src/core/types';
import type { Puzzle } from '../src/core/types';

function assertWellFormed(puzzle: Puzzle): void {
  const { rows, cols, clues, solution } = puzzle;
  expect(solution.length).toBe(clues.length);

  // The solution tiles the board exactly once.
  const cover = new Uint8Array(rows * cols);
  for (const rect of solution) {
    expect(rect.r).toBeGreaterThanOrEqual(0);
    expect(rect.c).toBeGreaterThanOrEqual(0);
    expect(rect.r + rect.h).toBeLessThanOrEqual(rows);
    expect(rect.c + rect.w).toBeLessThanOrEqual(cols);
    for (let r = rect.r; r < rect.r + rect.h; r++) {
      for (let c = rect.c; c < rect.c + rect.w; c++) {
        expect(cover[r * cols + c]).toBe(0);
        cover[r * cols + c] = 1;
      }
    }
  }
  expect([...cover].every((v) => v === 1)).toBe(true);

  // Every rectangle holds exactly one clue, and its area matches that clue.
  for (const rect of solution) {
    const inside = clues.filter((clue) => contains(rect, clue.r, clue.c));
    expect(inside.length).toBe(1);
    expect(area(rect)).toBe(inside[0].v);
  }

  // And the board really has only one answer.
  expect(solve(clues, rows, cols, 2).count).toBe(1);
}

describe('solver', () => {
  it('only offers rectangles that hold a single clue', () => {
    const clues = [
      { r: 0, c: 0, v: 2 },
      { r: 0, c: 1, v: 2 },
    ];
    const cands = candidatesFor(clues[0], clues, 2, 2);
    expect(cands.length).toBeGreaterThan(0);
    for (const rect of cands) expect(contains(rect, 0, 1)).toBe(false);
  });

  it('rejects boards whose clues do not add up to the grid', () => {
    expect(solve([{ r: 0, c: 0, v: 3 }], 2, 2, 2).count).toBe(0);
  });

  it('finds both answers of an ambiguous board', () => {
    // 2x2 with a single 4: the rectangle is forced, so that one is unique...
    expect(solve([{ r: 0, c: 0, v: 4 }], 2, 2, 2).count).toBe(1);
    // ...while two 2s in a symmetric spot can be cut two ways.
    const result = solve(
      [
        { r: 0, c: 0, v: 2 },
        { r: 1, c: 1, v: 2 },
      ],
      2,
      2,
      2,
    );
    expect(result.count).toBe(2);
  });
});

describe('generator', () => {
  it('honours the requested size and area cap', () => {
    const puzzle = generatePuzzle({ rows: 8, cols: 6, maxArea: 7, seed: 12345 });
    expect(puzzle.rows).toBe(8);
    expect(puzzle.cols).toBe(6);
    for (const rect of puzzle.solution) expect(area(rect)).toBeLessThanOrEqual(7);
    assertWellFormed(puzzle);
  });

  it('is deterministic for a seed', () => {
    const a = generatePuzzle({ rows: 7, cols: 7, maxArea: 8, seed: 777 });
    const b = generatePuzzle({ rows: 7, cols: 7, maxArea: 8, seed: 777 });
    expect(JSON.stringify(a.clues)).toBe(JSON.stringify(b.clues));
  });

  it('never returns overlapping rectangles', () => {
    const puzzle = generatePuzzle({ rows: 9, cols: 9, maxArea: 9, seed: 2024 });
    for (let i = 0; i < puzzle.solution.length; i++) {
      for (let j = i + 1; j < puzzle.solution.length; j++) {
        expect(overlaps(puzzle.solution[i], puzzle.solution[j])).toBe(false);
      }
    }
  });
});

describe('saved progress', () => {
  it('moves v1 global level numbers onto tier keys', () => {
    const migrated = migrateV1({
      '1': { time: 1000, hints: 0 },
      '31': { time: 2000, hints: 1 },
      '160': { time: 3000, hints: 3 },
    });
    // v1 tiers were 30 / 35 / 35 / 30 / 30 levels long.
    expect(Object.keys(migrated).sort()).toEqual(['t1.1', 't2.1', 't5.30']);
    expect(migrated['t5.30'].time).toBe(3000);
  });
});

describe('level catalogue', () => {
  it('maps level numbers onto tiers', () => {
    expect(TOTAL_LEVELS).toBe(TIERS.reduce((s, t) => s + t.count, 0));
    expect(levelRef(1).tier.id).toBe(1);
    expect(levelRef(1).nth).toBe(1);
    expect(levelRef(TIERS[0].count + 1).tier.id).toBe(2);
    expect(levelRef(TOTAL_LEVELS).tier.id).toBe(TIERS[TIERS.length - 1].id);
  });

  it('builds every single level with one solution', () => {
    const started = Date.now();
    let offBand = 0;
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
      const puzzle = puzzleForLevel(level);
      assertWellFormed(puzzle);
      const { tier } = levelRef(level);
      expect(puzzle.rows).toBe(tier.rows);
      if (puzzle.guesses < tier.guessBand[0] || puzzle.guesses > tier.guessBand[1]) offBand++;
    }
    // A few boards may land outside the wanted difficulty band; most must not.
    expect(offBand).toBeLessThan(TOTAL_LEVELS * 0.2);
    console.log(`generated ${TOTAL_LEVELS} levels in ${Date.now() - started}ms, ${offBand} off-band`);
  }, 240000);

  it('gives the same daily board for the same date', () => {
    const date = new Date('2026-03-08T10:00:00');
    assertWellFormed(dailyPuzzle(date));
    expect(dailyPuzzle(date).clues).toEqual(dailyPuzzle(date).clues);
  });
});
