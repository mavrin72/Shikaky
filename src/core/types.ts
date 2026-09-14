/** A rectangle on the board. Top-left is (r, c); spans h rows and w columns. */
export interface Rect {
  r: number;
  c: number;
  w: number;
  h: number;
}

/** A given number: at cell (r, c), the rectangle covering it must have area v. */
export interface Clue {
  r: number;
  c: number;
  v: number;
}

export interface Puzzle {
  rows: number;
  cols: number;
  clues: Clue[];
  /** The unique solution, as produced by the generator and confirmed by the solver. */
  solution: Rect[];
  /** Branch points the solver needed. 0 means it falls out by pure deduction. */
  guesses: number;
  seed: number;
}

export const area = (rect: Rect): number => rect.w * rect.h;

export const contains = (rect: Rect, r: number, c: number): boolean =>
  r >= rect.r && r < rect.r + rect.h && c >= rect.c && c < rect.c + rect.w;

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h;

export const sameRect = (a: Rect, b: Rect): boolean =>
  a.r === b.r && a.c === b.c && a.w === b.w && a.h === b.h;
