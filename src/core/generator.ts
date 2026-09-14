import { makeRng, randInt, type Rng } from './rng';
import { solve } from './solver';
import type { Clue, Puzzle, Rect } from './types';

export interface GenOptions {
  rows: number;
  cols: number;
  /** Largest rectangle the generator may cut. Bigger = more open, harder boards. */
  maxArea: number;
  seed: number;
  /** Wanted amount of search: [min, max] branch points for the solver. */
  guessBand?: [number, number];
  attempts?: number;
}

/** Cuts the whole board into rectangles — the solution we will hand clues out from. */
function partition(rows: number, cols: number, maxArea: number, rng: Rng): Rect[] | null {
  const grid = new Uint8Array(rows * cols);
  const out: Rect[] = [];
  let budget = 20000;

  const firstFree = (): number => {
    for (let i = 0; i < grid.length; i++) if (!grid[i]) return i;
    return -1;
  };

  const isFree = (r: number, c: number, w: number, h: number): boolean => {
    for (let rr = r; rr < r + h; rr++) {
      const base = rr * cols;
      for (let cc = c; cc < c + w; cc++) if (grid[base + cc]) return false;
    }
    return true;
  };

  const paint = (rect: Rect, value: number): void => {
    for (let rr = rect.r; rr < rect.r + rect.h; rr++) {
      const base = rr * cols;
      for (let cc = rect.c; cc < rect.c + rect.w; cc++) grid[base + cc] = value;
    }
  };

  // Rectangles we would rather not see everywhere: singles make boards trivial,
  // full-width slabs make them monotonous.
  const weightOf = (w: number, h: number): number => {
    const a = w * h;
    if (a === 1) return 0.1;
    if (a === 2) return 0.7;
    if (w === cols || h === rows) return 0.5;
    return 1;
  };

  const step = (): boolean => {
    if (budget-- < 0) return false;
    const idx = firstFree();
    if (idx < 0) return true;
    const r = Math.floor(idx / cols);
    const c = idx % cols;

    const options: { rect: Rect; key: number }[] = [];
    for (let h = 1; h <= rows - r; h++) {
      if (grid[(r + h - 1) * cols + c]) break;
      for (let w = 1; w <= cols - c; w++) {
        if (w * h > maxArea) break;
        if (!isFree(r, c, w, h)) break;
        options.push({ rect: { r, c, w, h }, key: -Math.log(rng() + 1e-9) / weightOf(w, h) });
      }
    }
    options.sort((a, b) => a.key - b.key);

    for (const option of options) {
      paint(option.rect, 1);
      out.push(option.rect);
      if (step()) return true;
      out.pop();
      paint(option.rect, 0);
    }
    return false;
  };

  return step() ? out : null;
}

/** Drops one number into each rectangle, at a random cell inside it. */
function placeClues(rects: Rect[], rng: Rng): Clue[] {
  return rects.map((rect) => ({
    r: rect.r + randInt(rng, rect.h),
    c: rect.c + randInt(rng, rect.w),
    v: rect.w * rect.h,
  }));
}

const singlesShare = (rects: Rect[]): number =>
  rects.filter((rect) => rect.w * rect.h === 1).length / rects.length;

/**
 * Builds a puzzle with exactly one solution. The same seed always gives the same
 * board, so a level number is all we ever need to store.
 */
export function generatePuzzle(options: GenOptions): Puzzle {
  const { rows, cols, maxArea, seed } = options;
  const band = options.guessBand ?? [0, 99];
  const attempts = options.attempts ?? 240;
  const rng = makeRng(seed);

  let fallback: Puzzle | null = null;
  let fallbackMiss = Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const rects = partition(rows, cols, maxArea, rng);
    if (!rects || rects.length < 3 || singlesShare(rects) > 0.2) continue;

    for (let retry = 0; retry < 6; retry++) {
      const clues = placeClues(rects, rng);
      const result = solve(clues, rows, cols, 2);
      if (result.count !== 1 || !result.solution) continue;

      const puzzle: Puzzle = {
        rows,
        cols,
        clues,
        solution: result.solution,
        guesses: result.guesses,
        seed,
      };
      if (result.guesses >= band[0] && result.guesses <= band[1]) return puzzle;

      const miss =
        result.guesses < band[0] ? band[0] - result.guesses : result.guesses - band[1];
      if (miss < fallbackMiss) {
        fallbackMiss = miss;
        fallback = puzzle;
      }
    }
  }

  if (fallback) return fallback;
  // Last resort: a board nobody has to guess on beats no board at all.
  return generatePuzzle({ ...options, maxArea: Math.max(2, maxArea - 2), guessBand: [0, 99] });
}
