import { generatePuzzle } from './generator';
import { hashSeed } from './rng';
import type { Puzzle } from './types';

export interface Tier {
  id: number;
  name: string;
  hint: string;
  rows: number;
  cols: number;
  maxArea: number;
  count: number;
  guessBand: [number, number];
  /** CSS custom-property name from the palette, used for the tier's chip colour. */
  ink: string;
}

export const TIERS: Tier[] = [
  { id: 1, name: 'Розминка', hint: 'Вчимося різати', rows: 5, cols: 5, maxArea: 6, count: 40, guessBand: [0, 0], ink: '--green' },
  { id: 2, name: 'Ритм', hint: 'Без здогадок', rows: 7, cols: 7, maxArea: 8, count: 50, guessBand: [0, 1], ink: '--blue' },
  { id: 3, name: 'Тиск', hint: 'Треба думати', rows: 9, cols: 9, maxArea: 9, count: 50, guessBand: [1, 4], ink: '--pink' },
  { id: 4, name: 'Вузол', hint: 'Тримайся', rows: 10, cols: 10, maxArea: 12, count: 50, guessBand: [2, 8], ink: '--orange' },
  { id: 5, name: 'Хаос', hint: 'Без жалю', rows: 12, cols: 12, maxArea: 14, count: 50, guessBand: [3, 24], ink: '--violet' },
  { id: 6, name: 'Лабіринт', hint: 'Довга гра', rows: 13, cols: 13, maxArea: 16, count: 40, guessBand: [4, 30], ink: '--cyan' },
  { id: 7, name: 'Безодня', hint: 'Для впертих', rows: 15, cols: 15, maxArea: 18, count: 40, guessBand: [6, 50], ink: '--red' },
];

/** Tier sizes as they shipped in v1 — kept so saved progress can be moved onto the
 *  stable tier/number keys instead of silently pointing at different puzzles. */
export const LEGACY_V1_COUNTS = [30, 35, 35, 30, 30];

export const TOTAL_LEVELS = TIERS.reduce((sum, tier) => sum + tier.count, 0);

export interface LevelRef {
  level: number;
  tier: Tier;
  /** 1-based position inside its tier. */
  nth: number;
}

export function levelRef(level: number): LevelRef {
  let remaining = Math.min(Math.max(level, 1), TOTAL_LEVELS);
  for (const tier of TIERS) {
    if (remaining <= tier.count) return { level, tier, nth: remaining };
    remaining -= tier.count;
  }
  const last = TIERS[TIERS.length - 1];
  return { level, tier: last, nth: last.count };
}

export const firstLevelOfTier = (tierId: number): number =>
  TIERS.filter((tier) => tier.id < tierId).reduce((sum, tier) => sum + tier.count, 0) + 1;

const cache = new Map<string, Puzzle>();

function build(key: string, make: () => Puzzle): Puzzle {
  const hit = cache.get(key);
  if (hit) return hit;
  const puzzle = make();
  cache.set(key, puzzle);
  return puzzle;
}

export function puzzleForLevel(level: number): Puzzle {
  const { tier, nth } = levelRef(level);
  return build(`L${level}`, () =>
    generatePuzzle({
      rows: tier.rows,
      cols: tier.cols,
      maxArea: tier.maxArea,
      seed: hashSeed(`shikaky-v1-${tier.id}-${nth}`),
      guessBand: tier.guessBand,
    }),
  );
}

export const dailyKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** One shared board per calendar day, same for every player. */
export function dailyPuzzle(date = new Date()): Puzzle {
  const key = dailyKey(date);
  return build(`D${key}`, () =>
    generatePuzzle({
      rows: 9,
      cols: 9,
      maxArea: 10,
      seed: hashSeed(`shikaky-daily-${key}`),
      guessBand: [1, 6],
    }),
  );
}
