import { contains, overlaps, sameRect, type Clue, type Puzzle, type Rect } from './types';

export interface Piece extends Rect {
  id: number;
}

export interface PlaceResult {
  added: Piece | null;
  removed: Piece[];
  /** Whether the new piece satisfies exactly one clue. */
  ok: boolean;
}

/** One playthrough of one board: pieces on the grid, plus undo history. */
export class Game {
  readonly puzzle: Puzzle;
  pieces: Piece[] = [];
  hintsUsed = 0;
  moves = 0;

  private nextId = 1;
  private past: Piece[][] = [];
  private future: Piece[][] = [];

  constructor(puzzle: Puzzle) {
    this.puzzle = puzzle;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  cluesIn(rect: Rect): Clue[] {
    return this.puzzle.clues.filter((clue) => contains(rect, clue.r, clue.c));
  }

  statusOf(rect: Rect): 'ok' | 'bad' {
    const inside = this.cluesIn(rect);
    return inside.length === 1 && inside[0].v === rect.w * rect.h ? 'ok' : 'bad';
  }

  pieceAt(r: number, c: number): Piece | undefined {
    return this.pieces.find((piece) => contains(piece, r, c));
  }

  private snapshot(): void {
    this.past.push(this.pieces.map((piece) => ({ ...piece })));
    if (this.past.length > 120) this.past.shift();
    this.future.length = 0;
  }

  /** Drops a rectangle in, evicting whatever it overlaps. */
  place(rect: Rect): PlaceResult {
    const removed = this.pieces.filter((piece) => overlaps(piece, rect));
    const duplicate = removed.length === 1 && sameRect(removed[0], rect);
    this.snapshot();
    this.pieces = this.pieces.filter((piece) => !overlaps(piece, rect));
    if (duplicate) {
      this.moves++;
      return { added: null, removed, ok: false };
    }
    const piece: Piece = { ...rect, id: this.nextId++ };
    this.pieces.push(piece);
    this.moves++;
    return { added: piece, removed, ok: this.statusOf(piece) === 'ok' };
  }

  erase(r: number, c: number): Piece | null {
    const piece = this.pieceAt(r, c);
    if (!piece) return null;
    this.snapshot();
    this.pieces = this.pieces.filter((other) => other.id !== piece.id);
    this.moves++;
    return piece;
  }

  clear(): void {
    if (this.pieces.length === 0) return;
    this.snapshot();
    this.pieces = [];
  }

  undo(): boolean {
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(this.pieces.map((piece) => ({ ...piece })));
    this.pieces = previous;
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.pieces.map((piece) => ({ ...piece })));
    this.pieces = next;
    return true;
  }

  coveredCells(): number {
    return this.pieces.reduce((sum, piece) => sum + piece.w * piece.h, 0);
  }

  get solvedClues(): number {
    return this.pieces.filter((piece) => this.statusOf(piece) === 'ok').length;
  }

  isSolved(): boolean {
    const { rows, cols } = this.puzzle;
    return (
      this.coveredCells() === rows * cols &&
      this.pieces.every((piece) => this.statusOf(piece) === 'ok')
    );
  }

  /** Reveals one true rectangle — the first that is not already on the board. */
  hint(): PlaceResult | null {
    const missing = this.puzzle.solution.find(
      (rect) => !this.pieces.some((piece) => sameRect(piece, rect)),
    );
    if (!missing) return null;
    this.hintsUsed++;
    return this.place(missing);
  }
}

export const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
