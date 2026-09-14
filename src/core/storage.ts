import { firstLevelOfTier, TIERS, TOTAL_LEVELS } from './levels';

export interface LevelRecord {
  time: number;
  hints: number;
}

export interface Settings {
  sound: boolean;
  theme: 'system' | 'light' | 'dark';
  /** Extra motion: slams, waves, confetti. Off means functional transitions only. */
  fx: boolean;
}

interface Save {
  v: 1;
  solved: Record<string, LevelRecord>;
  last: number;
  daily: Record<string, number>;
  settings: Settings;
}

const KEY = 'shikaky.v1';

const fresh = (): Save => ({
  v: 1,
  solved: {},
  last: 1,
  daily: {},
  settings: { sound: true, theme: 'system', fx: true },
});

let state: Save = load();

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<Save>;
    const base = fresh();
    return {
      ...base,
      ...parsed,
      solved: parsed.solved ?? {},
      daily: parsed.daily ?? {},
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return fresh();
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or a full quota — the game still plays, it just forgets. */
  }
}

export const settings = (): Settings => state.settings;

export function updateSettings(patch: Partial<Settings>): Settings {
  state.settings = { ...state.settings, ...patch };
  persist();
  return state.settings;
}

export const recordOf = (level: number): LevelRecord | undefined => state.solved[String(level)];

export const isSolved = (level: number): boolean => Boolean(recordOf(level));

export const solvedCount = (): number => Object.keys(state.solved).length;

export function recordWin(level: number, time: number, hints: number): { best: boolean } {
  const key = String(level);
  const previous = state.solved[key];
  const best = !previous || time < previous.time;
  state.solved[key] = best ? { time, hints } : previous;
  state.last = Math.min(level + 1, TOTAL_LEVELS);
  persist();
  return { best };
}

export const lastPlayed = (): number => Math.min(state.last || 1, TOTAL_LEVELS);

const TIER_STARTS = new Set(TIERS.map((tier) => firstLevelOfTier(tier.id)));

/** Levels unlock one by one, but every block opens at its first level, so a player
 *  can taste the hard stuff without grinding to it. */
export const isUnlocked = (level: number): boolean =>
  TIER_STARTS.has(level) || isSolved(level) || isSolved(level - 1);

export const nextLevel = (): number => {
  for (let level = 1; level <= TOTAL_LEVELS; level++) if (!isSolved(level)) return level;
  return TOTAL_LEVELS;
};

export const dailyRecord = (key: string): number | undefined => state.daily[key];

export function recordDaily(key: string, time: number): void {
  const previous = state.daily[key];
  if (previous === undefined || time < previous) {
    state.daily[key] = time;
    persist();
  }
}

export function resetProgress(): void {
  const keep = state.settings;
  state = { ...fresh(), settings: keep };
  persist();
}
