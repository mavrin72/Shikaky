import { beforeEach, describe, expect, it } from 'vitest';
import { TOTAL_LEVELS } from '../src/core/levels';
import {
  exportCode,
  importCode,
  isSolved,
  isUnlocked,
  lastPlayed,
  markSolvedUpTo,
  mergeSaves,
  NO_TIME,
  normalize,
  recordOf,
  recordWin,
  resetProgress,
  snapshot,
  solvedCount,
} from '../src/core/storage';

describe('restoring progress', () => {
  beforeEach(() => resetProgress());

  it('marks every level up to the one a player reached', () => {
    const { added } = markSolvedUpTo(42);
    expect(added).toBe(42);
    expect(solvedCount()).toBe(42);
    expect(isSolved(42)).toBe(true);
    expect(isSolved(43)).toBe(false);
    // Level 43 is the one to play next, so it has to be reachable.
    expect(isUnlocked(43)).toBe(true);
    expect(lastPlayed()).toBe(43);
  });

  it('restored levels carry no time, and a real run overwrites them', () => {
    markSolvedUpTo(5);
    expect(recordOf(3)?.time).toBe(NO_TIME);
    const { best } = recordWin(3, 12_345, 1);
    expect(best).toBe(true);
    expect(recordOf(3)?.time).toBe(12_345);
  });

  it('never restores past the end of the catalogue, and ignores nonsense', () => {
    expect(markSolvedUpTo(10_000).added).toBe(TOTAL_LEVELS);
    resetProgress();
    expect(markSolvedUpTo(-4).added).toBe(0);
  });

  it('adds nothing the second time around', () => {
    markSolvedUpTo(10);
    expect(markSolvedUpTo(10).added).toBe(0);
  });
});

describe('transfer codes', () => {
  beforeEach(() => resetProgress());

  it('carries a save out and back in', () => {
    recordWin(1, 9_000, 0);
    markSolvedUpTo(7);
    const code = exportCode();

    resetProgress();
    expect(solvedCount()).toBe(0);

    const { added } = importCode(code);
    expect(added).toBe(7);
    expect(recordOf(1)?.time).toBe(9_000);
  });

  it('survives being copied with stray whitespace and no prefix', () => {
    markSolvedUpTo(3);
    const code = exportCode();
    resetProgress();
    expect(importCode(` ${code.replace('SHKY1.', '')}\n `).added).toBe(3);
  });

  it('refuses a code that is not one', () => {
    expect(() => importCode('не код')).toThrow();
    expect(() => importCode('   ')).toThrow();
  });
});

describe('merging two saves', () => {
  const base = () => normalize({ v: 2 });

  it('keeps every level either side has', () => {
    const a = { ...base(), solved: { 't1.1': { time: 500, hints: 0 } } };
    const b = { ...base(), solved: { 't1.2': { time: 700, hints: 1 } } };
    expect(Object.keys(mergeSaves(a, b).solved).sort()).toEqual(['t1.1', 't1.2']);
  });

  it('keeps the faster time for a level both sides solved', () => {
    const a = { ...base(), solved: { 't1.1': { time: 900, hints: 0 } } };
    const b = { ...base(), solved: { 't1.1': { time: 400, hints: 2 } } };
    expect(mergeSaves(a, b).solved['t1.1']).toEqual({ time: 400, hints: 2 });
    expect(mergeSaves(b, a).solved['t1.1']).toEqual({ time: 400, hints: 2 });
  });

  it('prefers a real run over a restored level with no time', () => {
    const restored = { ...base(), solved: { 't1.1': { time: NO_TIME, hints: 0 } } };
    const played = { ...base(), solved: { 't1.1': { time: 3_000, hints: 0 } } };
    expect(mergeSaves(restored, played).solved['t1.1']?.time).toBe(3_000);
    expect(mergeSaves(played, restored).solved['t1.1']?.time).toBe(3_000);
  });

  it('takes the best of the daily times and of the frog scores', () => {
    const a = { ...base(), daily: { '2026-01-01': 800 }, basket: { best: 12, top: 3 } };
    const b = { ...base(), daily: { '2026-01-01': 600, '2026-01-02': 100 }, basket: { best: 9, top: 7 } };
    const merged = mergeSaves(a, b);
    expect(merged.daily).toEqual({ '2026-01-01': 600, '2026-01-02': 100 });
    expect(merged.basket).toEqual({ best: 12, top: 7 });
  });

  it('leaves the settings of the device in hand alone', () => {
    const local = { ...base(), settings: { sound: false, theme: 'dark' as const, fx: false } };
    expect(mergeSaves(local, base()).settings).toEqual(local.settings);
  });

  it('upgrades an old v1 save on the way in', () => {
    const merged = mergeSaves(base(), normalize({ v: 1, solved: { '31': { time: 100, hints: 0 } } }));
    // Level 31 in v1 sat in the second tier, at its first puzzle.
    expect(merged.solved['t2.1']).toEqual({ time: 100, hints: 0 });
  });

  it('refuses something that is not a save at all', () => {
    expect(() => normalize('nope')).toThrow();
    expect(() => normalize(null)).toThrow();
  });
});

describe('a save survives a round trip through storage', () => {
  it('snapshots what the player actually has', () => {
    resetProgress();
    markSolvedUpTo(2);
    const shot = snapshot();
    expect(Object.keys(shot.solved)).toHaveLength(2);
    // The snapshot is a copy: editing it must not touch the live save.
    shot.solved = {};
    expect(solvedCount()).toBe(2);
  });
});
