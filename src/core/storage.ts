import { firstLevelOfTier, LEGACY_V1_COUNTS, levelRef, TIERS, TOTAL_LEVELS } from './levels';

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

export interface Save {
  v: 2;
  solved: Record<string, LevelRecord>;
  last: number;
  daily: Record<string, number>;
  /** Best score in the Кошик merge game, and the best chain step ever reached. */
  basket: { best: number; top: number };
  settings: Settings;
}

/** The save of a player who has not signed in. Signed-in players get `KEY:<id>`,
 *  so switching accounts on a shared device never overwrites anybody. */
const KEY = 'shikaky.v1';
/** Which account this browser was last playing as. */
const ACCOUNT_KEY = 'shikaky.account';

/** A level restored from a code or by hand has no honest time; 0 means "solved,
 *  time unknown" and always loses to a real record when two saves merge. */
export const NO_TIME = 0;

const fresh = (): Save => ({
  v: 2,
  solved: {},
  last: 1,
  daily: {},
  basket: { best: 0, top: -1 },
  settings: { sound: true, theme: 'system', fx: true },
});

const readRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode or a full quota — the game still plays, it just forgets. */
  }
};

let accountId: string | null = readRaw(ACCOUNT_KEY);

const activeKey = (): string => (accountId ? `${KEY}:${accountId}` : KEY);

let state: Save = loadFrom(activeKey());

const listeners = new Set<(save: Save) => void>();

/** Cloud sync and the UI both need to know when the save moved. */
export function onSaveChange(listener: (save: Save) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable key for a level: its tier and its number inside that tier. */
const keyFor = (level: number): string => {
  const { tier, nth } = levelRef(level);
  return `t${tier.id}.${nth}`;
};

/** v1 stored plain global level numbers, which shift whenever a tier grows. */
export function migrateV1(solved: Record<string, LevelRecord>): Record<string, LevelRecord> {
  const out: Record<string, LevelRecord> = {};
  for (const [key, record] of Object.entries(solved)) {
    const level = Number(key);
    if (!Number.isFinite(level)) {
      out[key] = record;
      continue;
    }
    let remaining = level;
    let tier = 1;
    for (const count of LEGACY_V1_COUNTS) {
      if (remaining <= count) break;
      remaining -= count;
      tier++;
    }
    out[`t${tier}.${remaining}`] = record;
  }
  return out;
}

/** Anything that claims to be a save — from storage, a code, or the cloud —
 *  becomes a complete v2 save here, or throws if it is not one at all. */
export function normalize(input: unknown): Save {
  if (!input || typeof input !== 'object') throw new Error('Це не збереження');
  const parsed = input as Partial<Save> & { v?: number };
  const base = fresh();
  const solved = parsed.solved && typeof parsed.solved === 'object' ? parsed.solved : {};
  return {
    ...base,
    ...parsed,
    v: 2,
    solved: parsed.v === 2 ? { ...solved } : migrateV1(solved),
    last: Number.isFinite(parsed.last) ? Number(parsed.last) : 1,
    daily: parsed.daily && typeof parsed.daily === 'object' ? { ...parsed.daily } : {},
    basket: { ...base.basket, ...(parsed.basket ?? {}) },
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
  };
}

function loadFrom(key: string): Save {
  const raw = readRaw(key);
  if (!raw) return fresh();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return fresh();
  }
}

function persist(): void {
  writeRaw(activeKey(), JSON.stringify(state));
  for (const listener of listeners) listener(state);
}

/** Of two records for the same level, the faster honest one wins. */
const betterRecord = (a?: LevelRecord, b?: LevelRecord): LevelRecord | undefined => {
  if (!a) return b;
  if (!b) return a;
  const at = a.time > NO_TIME ? a.time : Number.POSITIVE_INFINITY;
  const bt = b.time > NO_TIME ? b.time : Number.POSITIVE_INFINITY;
  return bt < at ? b : a;
};

/** Saves never overwrite each other — they add up. Two devices, two halves of the
 *  catalogue, one merged result; settings stay the ones of the device in hand. */
export function mergeSaves(local: Save, incoming: Save): Save {
  const solved = { ...local.solved };
  for (const [key, record] of Object.entries(incoming.solved)) {
    const best = betterRecord(solved[key], record);
    if (best) solved[key] = best;
  }

  const daily = { ...local.daily };
  for (const [key, time] of Object.entries(incoming.daily)) {
    const previous = daily[key];
    if (previous === undefined || time < previous) daily[key] = time;
  }

  return {
    v: 2,
    solved,
    daily,
    last: Math.min(Math.max(local.last || 1, incoming.last || 1), TOTAL_LEVELS),
    basket: {
      best: Math.max(local.basket.best, incoming.basket.best),
      top: Math.max(local.basket.top, incoming.basket.top),
    },
    settings: local.settings,
  };
}

export const snapshot = (): Save => JSON.parse(JSON.stringify(state)) as Save;

/** Folds another save into this one and reports how many levels that added. */
export function mergeSave(incoming: unknown): { added: number } {
  const before = Object.keys(state.solved).length;
  state = mergeSaves(state, normalize(incoming));
  persist();
  return { added: Object.keys(state.solved).length - before };
}

export const settings = (): Settings => state.settings;

export function updateSettings(patch: Partial<Settings>): Settings {
  state.settings = { ...state.settings, ...patch };
  persist();
  return state.settings;
}

export const recordOf = (level: number): LevelRecord | undefined => state.solved[keyFor(level)];

export const isSolved = (level: number): boolean => Boolean(recordOf(level));

export const solvedCount = (): number => Object.keys(state.solved).length;

export function recordWin(level: number, time: number, hints: number): { best: boolean } {
  const key = keyFor(level);
  const previous = state.solved[key];
  const best = !previous || previous.time <= NO_TIME || time < previous.time;
  state.solved[key] = best ? { time, hints } : previous;
  state.last = Math.min(level + 1, TOTAL_LEVELS);
  persist();
  return { best };
}

/** Hand-restores progress: every level up to `level` counts as solved, with no
 *  time attached, so a player who lost their save picks up where they were. */
export function markSolvedUpTo(level: number): { added: number } {
  const top = Math.min(Math.max(Math.trunc(level), 0), TOTAL_LEVELS);
  let added = 0;
  for (let current = 1; current <= top; current++) {
    const key = keyFor(current);
    if (state.solved[key]) continue;
    state.solved[key] = { time: NO_TIME, hints: 0 };
    added++;
  }
  state.last = Math.min(top + 1, TOTAL_LEVELS);
  persist();
  return { added };
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

export const basketBest = (): number => state.basket.best;
export const basketTop = (): number => state.basket.top;

export function recordBasket(score: number, top = -1): { best: number } {
  if (score > state.basket.best) state.basket.best = score;
  if (top > state.basket.top) state.basket.top = top;
  persist();
  return { best: state.basket.best };
}

export function resetProgress(): void {
  const keep = state.settings;
  state = { ...fresh(), settings: keep };
  persist();
}

// ------------------------------------------------------------------ profiles
export const activeAccount = (): string | null => accountId;

/** Switches which save this browser is playing. Passing null goes back to the
 *  guest save — the one every player had before accounts existed. */
export function useAccount(id: string | null): Save {
  accountId = id;
  writeRaw(ACCOUNT_KEY, id);
  state = loadFrom(activeKey());
  for (const listener of listeners) listener(state);
  return state;
}

// ------------------------------------------------------- transfer codes
const PREFIX = 'SHKY1.';

const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (code: string): string => {
  const binary = atob(code);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** A whole save as one line of text: copy it out of one browser, paste it into
 *  another. No server needed, and nothing in it but this game's progress. */
export const exportCode = (): string => PREFIX + toBase64(JSON.stringify(snapshot()));

export function importCode(code: string): { added: number } {
  const cleaned = code.trim().replace(/\s+/g, '');
  const body = cleaned.startsWith(PREFIX) ? cleaned.slice(PREFIX.length) : cleaned;
  if (!body) throw new Error('Порожній код');
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64(body));
  } catch {
    throw new Error('Код пошкоджений — скопіюй його повністю');
  }
  return mergeSave(parsed);
}
