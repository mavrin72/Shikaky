import type { Game, Piece } from '../core/game';
import { contains, type Rect } from '../core/types';
import { clamp, h } from './dom';
import { buzz, shake } from './fx';
import { sfx } from './sound';

/** Fills are tints of the palette so a black number stays readable on every piece. */
const FILLS = ['#FF8FB8', '#8FA9FF', '#5FE3BE', '#FFB07A', '#C79BFF', '#FFE14A', '#9BE8FF', '#FFD0E4'];
const fillFor = (value: number): string => FILLS[value % FILLS.length];

export interface BoardOptions {
  game: Game;
  interactive?: boolean;
  onChange?: () => void;
  onSolve?: () => void;
}

export class BoardView {
  readonly el: HTMLDivElement;
  private game: Game;
  private options: BoardOptions;
  private cellsLayer: HTMLDivElement;
  private piecesLayer: HTMLDivElement;
  private cluesLayer: HTMLDivElement;
  private overlay: HTMLDivElement;
  private preview: HTMLDivElement;
  private cursorEl: HTMLDivElement;
  private pieceNodes = new Map<number, HTMLElement>();
  private clueNodes: HTMLElement[] = [];
  private anchor: { r: number; c: number } | null = null;
  private cursor = { r: 0, c: 0 };
  private keyboardMode = false;
  private resizeObserver: ResizeObserver;

  constructor(options: BoardOptions) {
    this.options = options;
    this.game = options.game;
    const { rows, cols } = this.game.puzzle;

    this.cellsLayer = h('div', { class: 'board__layer board__layer--cells' });
    for (let i = 0; i < rows * cols; i++) this.cellsLayer.append(h('div', { class: 'cell' }));

    this.piecesLayer = h('div', { class: 'board__layer board__layer--pieces' });
    this.cluesLayer = h('div', { class: 'board__layer board__layer--clues' });
    for (const clue of this.game.puzzle.clues) {
      const node = h(
        'div',
        {
          class: 'clue',
          style: { gridColumn: String(clue.c + 1), gridRow: String(clue.r + 1) },
        },
        h('span', {}, String(clue.v)),
      );
      this.clueNodes.push(node);
      this.cluesLayer.append(node);
    }

    this.preview = h('div', { class: 'preview', hidden: 'hidden' });
    this.cursorEl = h('div', { class: 'kcursor', hidden: 'hidden' });
    this.overlay = h('div', { class: 'board__layer board__layer--overlay' }, this.preview, this.cursorEl);

    this.el = h('div', {
      class: 'board',
      tabindex: options.interactive === false ? '-1' : '0',
      role: 'application',
      'aria-label': `Поле ${rows} на ${cols}. Малюй прямокутники стрілками та Enter.`,
    }) as HTMLDivElement;
    this.el.style.setProperty('--cols', String(cols));
    this.el.style.setProperty('--rows', String(rows));
    this.el.style.setProperty('--ar', String(cols / rows));
    this.el.style.setProperty('--gap', cols >= 10 ? '3px' : '5px');
    const stage = h('div', { class: 'board__stage' }, this.cellsLayer, this.piecesLayer, this.cluesLayer, this.overlay);
    this.el.append(stage);

    if (options.interactive !== false) this.bind();

    this.resizeObserver = new ResizeObserver(() => this.syncCellSize());
    this.resizeObserver.observe(this.el);
    this.render();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  private syncCellSize(): void {
    const box = this.cellsLayer.getBoundingClientRect();
    if (box.width) {
      this.el.style.setProperty('--cell-size', `${box.width / this.game.puzzle.cols}px`);
    }
  }

  // ---- geometry -------------------------------------------------------
  private cellAt(clientX: number, clientY: number): { r: number; c: number } {
    const box = this.cellsLayer.getBoundingClientRect();
    const { rows, cols } = this.game.puzzle;
    const gap = parseFloat(getComputedStyle(this.cellsLayer).gap) || 0;
    const pitchX = (box.width + gap) / cols;
    const pitchY = (box.height + gap) / rows;
    return {
      c: clamp(Math.floor((clientX - box.left) / pitchX), 0, cols - 1),
      r: clamp(Math.floor((clientY - box.top) / pitchY), 0, rows - 1),
    };
  }

  private rectBetween(a: { r: number; c: number }, b: { r: number; c: number }): Rect {
    const r = Math.min(a.r, b.r);
    const c = Math.min(a.c, b.c);
    return { r, c, w: Math.abs(a.c - b.c) + 1, h: Math.abs(a.r - b.r) + 1 };
  }

  private placeOverlay(el: HTMLElement, rect: Rect): void {
    el.style.gridColumn = `${rect.c + 1} / span ${rect.w}`;
    el.style.gridRow = `${rect.r + 1} / span ${rect.h}`;
  }

  // ---- input ----------------------------------------------------------
  private bind(): void {
    this.el.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      this.el.setPointerCapture(event.pointerId);
      this.keyboardMode = false;
      this.cursorEl.hidden = true;
      this.anchor = this.cellAt(event.clientX, event.clientY);
      this.cursor = { ...this.anchor };
      this.showPreview(this.rectBetween(this.anchor, this.anchor));
      sfx.tap();
    });

    this.el.addEventListener('pointermove', (event) => {
      if (!this.anchor) return;
      const current = this.cellAt(event.clientX, event.clientY);
      if (current.r === this.cursor.r && current.c === this.cursor.c) return;
      this.cursor = current;
      buzz(6);
      this.showPreview(this.rectBetween(this.anchor, current));
    });

    const finish = (event: PointerEvent): void => {
      if (!this.anchor) return;
      const rect = this.rectBetween(this.anchor, this.cellAt(event.clientX, event.clientY));
      this.anchor = null;
      this.hidePreview();
      this.commit(rect);
    };
    this.el.addEventListener('pointerup', finish);
    this.el.addEventListener('pointercancel', () => {
      this.anchor = null;
      this.hidePreview();
    });

    this.el.addEventListener('keydown', (event) => this.onKey(event));
    this.el.addEventListener('blur', () => {
      this.cursorEl.hidden = true;
      this.anchor = null;
      this.hidePreview();
    });
  }

  private onKey(event: KeyboardEvent): void {
    const { rows, cols } = this.game.puzzle;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];

    if (move) {
      event.preventDefault();
      this.keyboardMode = true;
      this.cursor = {
        r: clamp(this.cursor.r + move[0], 0, rows - 1),
        c: clamp(this.cursor.c + move[1], 0, cols - 1),
      };
      this.cursorEl.hidden = false;
      this.placeOverlay(this.cursorEl, { ...this.cursor, w: 1, h: 1 });
      if (this.anchor) this.showPreview(this.rectBetween(this.anchor, this.cursor));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.keyboardMode = true;
      this.cursorEl.hidden = false;
      this.placeOverlay(this.cursorEl, { ...this.cursor, w: 1, h: 1 });
      if (!this.anchor) {
        this.anchor = { ...this.cursor };
        this.showPreview(this.rectBetween(this.anchor, this.cursor));
        sfx.tap();
      } else {
        const rect = this.rectBetween(this.anchor, this.cursor);
        this.anchor = null;
        this.hidePreview();
        this.commit(rect);
      }
      return;
    }

    if (event.key === 'Escape') {
      this.anchor = null;
      this.hidePreview();
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      if (this.game.erase(this.cursor.r, this.cursor.c)) {
        sfx.erase();
        this.afterChange();
      }
    }
  }

  private showPreview(rect: Rect): void {
    const clues = this.game.cluesIn(rect);
    const size = rect.w * rect.h;
    const bad = clues.length !== 1 || clues[0].v !== size;
    this.preview.hidden = false;
    this.preview.className = `preview${bad ? ' preview--bad' : ''}`;
    this.placeOverlay(this.preview, rect);
    this.preview.replaceChildren(
      h('span', { class: 'preview__size' }, `${rect.w}×${rect.h}=${size}`),
    );
  }

  private hidePreview(): void {
    this.preview.hidden = true;
    this.preview.replaceChildren();
  }

  private commit(rect: Rect): void {
    // A single tap on an existing piece takes it back off the board.
    if (rect.w === 1 && rect.h === 1) {
      const piece = this.game.pieceAt(rect.r, rect.c);
      if (piece) {
        this.game.erase(rect.r, rect.c);
        sfx.erase();
        buzz(8);
        this.afterChange();
        return;
      }
    }

    const result = this.game.place(rect);
    if (!result.added) {
      sfx.erase();
    } else if (result.ok) {
      sfx.place();
      buzz(14);
    } else {
      sfx.wrong();
      buzz([10, 40, 10]);
      shake(this.el);
    }
    this.afterChange();
  }

  private afterChange(): void {
    this.render();
    this.options.onChange?.();
    if (this.game.isSolved()) this.options.onSolve?.();
  }

  /** Called from the outside (hint, undo, clear) after the game state changed. */
  refresh(): void {
    this.afterChange();
  }

  // ---- render ---------------------------------------------------------
  render(): void {
    const seen = new Set<number>();
    for (const piece of this.game.pieces) {
      seen.add(piece.id);
      let node = this.pieceNodes.get(piece.id);
      if (!node) {
        node = h('div', { class: 'piece' });
        node.style.setProperty('--fill', fillFor(this.fillKey(piece)));
        this.placeOverlay(node, piece);
        this.piecesLayer.append(node);
        this.pieceNodes.set(piece.id, node);
      }
      const bad = this.game.statusOf(piece) === 'bad';
      node.classList.toggle('piece--bad', bad);
    }
    for (const [id, node] of [...this.pieceNodes]) {
      if (seen.has(id)) continue;
      this.pieceNodes.delete(id);
      node.classList.add('piece--leaving');
      window.setTimeout(() => node.remove(), 160);
    }

    this.game.puzzle.clues.forEach((clue, index) => {
      const node = this.clueNodes[index];
      const piece = this.game.pieceAt(clue.r, clue.c);
      const done = Boolean(piece && this.game.statusOf(piece) === 'ok');
      node.classList.toggle('clue--covered', Boolean(piece));
      node.classList.toggle('clue--done', done);
    });

    this.syncCellSize();
    if (this.keyboardMode) this.cursorEl.hidden = false;
  }

  private fillKey(piece: Piece): number {
    const clue = this.game.puzzle.clues.find((c) => contains(piece, c.r, c.c));
    return clue ? clue.v : piece.w * piece.h;
  }

  /** The finish: pieces roll a wave from the top-left corner. */
  celebrate(): void {
    this.el.classList.add('board--solved');
    [...this.pieceNodes.values()].forEach((node, index) => {
      node.style.setProperty('--d', `${index * 26}ms`);
    });
    window.setTimeout(() => this.el.classList.remove('board--solved'), 1400);
  }

  center(): { x: number; y: number } {
    const box = this.el.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
}
