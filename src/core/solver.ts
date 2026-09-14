import type { Clue, Rect } from './types';

export interface SolveResult {
  /** Number of solutions found, capped at the requested limit. */
  count: number;
  solution: Rect[] | null;
  /** Nodes where the solver had to pick between several rectangles. 0 = pure deduction. */
  guesses: number;
}

/**
 * Every rectangle of area `clue.v` that covers the clue's cell, fits the board,
 * and swallows no other clue. These are the only rectangles a clue can ever own.
 */
export function candidatesFor(
  clue: Clue,
  clues: Clue[],
  rows: number,
  cols: number,
): Rect[] {
  const out: Rect[] = [];
  for (let h = 1; h <= rows; h++) {
    if (clue.v % h !== 0) continue;
    const w = clue.v / h;
    if (w > cols) continue;
    const rLo = Math.max(0, clue.r - h + 1);
    const rHi = Math.min(clue.r, rows - h);
    const cLo = Math.max(0, clue.c - w + 1);
    const cHi = Math.min(clue.c, cols - w);
    for (let r = rLo; r <= rHi; r++) {
      for (let c = cLo; c <= cHi; c++) {
        let clean = true;
        for (const other of clues) {
          if (other === clue) continue;
          if (other.r >= r && other.r < r + h && other.c >= c && other.c < c + w) {
            clean = false;
            break;
          }
        }
        if (clean) out.push({ r, c, w, h });
      }
    }
  }
  return out;
}

/**
 * Exact-cover backtracking with MRV ordering and a reachability prune:
 * every still-empty cell must be reachable by some rectangle that is still viable.
 * Stops as soon as `limit` solutions are found — limit 2 is enough to prove uniqueness.
 */
export function solve(
  clues: Clue[],
  rows: number,
  cols: number,
  limit = 2,
): SolveResult {
  const cells = rows * cols;
  const total = clues.reduce((sum, clue) => sum + clue.v, 0);
  if (total !== cells) return { count: 0, solution: null, guesses: 0 };

  const candidates = clues.map((clue) => candidatesFor(clue, clues, rows, cols));
  if (candidates.some((list) => list.length === 0)) {
    return { count: 0, solution: null, guesses: 0 };
  }

  const covered = new Uint8Array(cells);
  const used = new Uint8Array(clues.length);
  const chosen: Rect[] = new Array(clues.length);
  const reachable = new Uint8Array(cells);

  let count = 0;
  let guesses = 0;
  let solution: Rect[] | null = null;
  let remaining = clues.length;

  const fits = (rect: Rect): boolean => {
    for (let r = rect.r; r < rect.r + rect.h; r++) {
      const base = r * cols;
      for (let c = rect.c; c < rect.c + rect.w; c++) {
        if (covered[base + c]) return false;
      }
    }
    return true;
  };

  const paint = (rect: Rect, value: number): void => {
    for (let r = rect.r; r < rect.r + rect.h; r++) {
      const base = r * cols;
      for (let c = rect.c; c < rect.c + rect.w; c++) covered[base + c] = value;
    }
  };

  const recurse = (): void => {
    if (count >= limit) return;
    if (remaining === 0) {
      count++;
      if (!solution) solution = chosen.slice();
      return;
    }

    let bestClue = -1;
    let bestViable: Rect[] | null = null;
    reachable.fill(0);

    for (let i = 0; i < clues.length; i++) {
      if (used[i]) continue;
      const viable: Rect[] = [];
      for (const rect of candidates[i]) {
        if (!fits(rect)) continue;
        viable.push(rect);
        for (let r = rect.r; r < rect.r + rect.h; r++) {
          const base = r * cols;
          for (let c = rect.c; c < rect.c + rect.w; c++) reachable[base + c] = 1;
        }
      }
      if (viable.length === 0) return;
      if (!bestViable || viable.length < bestViable.length) {
        bestViable = viable;
        bestClue = i;
      }
    }

    for (let i = 0; i < cells; i++) {
      if (!covered[i] && !reachable[i]) return; // an empty cell nobody can reach
    }

    const viable = bestViable as Rect[];
    if (viable.length > 1) guesses++;

    used[bestClue] = 1;
    remaining--;
    for (const rect of viable) {
      if (!fits(rect)) continue;
      chosen[bestClue] = rect;
      paint(rect, 1);
      recurse();
      paint(rect, 0);
      if (count >= limit) break;
    }
    used[bestClue] = 0;
    remaining++;
  };

  recurse();
  return { count, solution, guesses };
}

export const hasUniqueSolution = (clues: Clue[], rows: number, cols: number): boolean =>
  solve(clues, rows, cols, 2).count === 1;
