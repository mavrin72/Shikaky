import { canSync, googleConfigured, pull, push, resume, signIn, signOut, type GoogleUser } from './google';
import {
  activeAccount,
  mergeSave,
  onSaveChange,
  snapshot,
  updateSettings,
  useAccount,
  type Save,
} from './storage';

export type SyncState =
  /** No client id was built in — the game runs perfectly well without accounts. */
  | 'off'
  /** Signed in, nothing pending. */
  | 'idle'
  | 'syncing'
  /** Signed in, but Google withheld the Drive folder: progress stays on this device. */
  | 'unavailable'
  | 'error';

export interface AccountState {
  email: string | null;
  name: string | null;
  picture: string | null;
  busy: boolean;
  sync: SyncState;
  syncedAt: number | null;
  error: string | null;
}

let state: AccountState = {
  email: activeAccount(),
  name: null,
  picture: null,
  busy: false,
  sync: googleConfigured() ? 'idle' : 'off',
  syncedAt: null,
  error: null,
};

const listeners = new Set<(state: AccountState) => void>();

export const accountState = (): AccountState => state;

export function onAccountChange(listener: (state: AccountState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<AccountState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : 'Щось пішло не так';

/** Signed in, and Google actually granted the Drive folder. */
export const cloudReady = (): boolean => Boolean(state.email) && canSync();

// --------------------------------------------------------------- syncing
let pushing = false;
let dirty = false;
let timer: number | undefined;

async function flush(): Promise<void> {
  if (!cloudReady()) return;
  if (pushing) {
    dirty = true;
    return;
  }
  pushing = true;
  set({ sync: 'syncing' });
  try {
    await push(snapshot());
    set({ sync: 'idle', syncedAt: Date.now(), error: null });
  } catch (error) {
    set({ sync: 'error', error: reason(error) });
  } finally {
    pushing = false;
    if (dirty) {
      dirty = false;
      void flush();
    }
  }
}

/** Every win writes the save; the cloud copy follows a moment later, so a burst
 *  of moves is one upload and not twenty. */
function schedulePush(): void {
  if (!cloudReady()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), 2000);
}

/** Merges whatever is stored under this email, then puts the result back. */
export async function syncNow(): Promise<void> {
  if (!state.email) return;
  if (!canSync()) {
    set({ sync: 'unavailable' });
    return;
  }
  set({ sync: 'syncing', error: null });
  try {
    const remote = await pull();
    if (remote) mergeSave(remote);
    await push(snapshot());
    set({ sync: 'idle', syncedAt: Date.now(), error: null });
  } catch (error) {
    set({ sync: 'error', error: reason(error) });
  }
}

// ------------------------------------------------------- signing in and out
async function adopt(user: GoogleUser): Promise<void> {
  const carried: Save = snapshot();
  const account = useAccount(user.email);
  const hadProgress = Object.keys(account.solved).length > 0;

  // Whatever was played on this device before signing in joins the account
  // rather than being left behind under the guest save.
  if (Object.keys(carried.solved).length > 0) mergeSave(carried);
  if (!hadProgress) updateSettings(carried.settings);

  set({
    email: user.email,
    name: user.name,
    picture: user.picture ?? null,
    sync: canSync() ? 'idle' : 'unavailable',
    error: null,
  });
  await syncNow();
}

export async function signInWithGoogle(): Promise<void> {
  if (state.busy) return;
  set({ busy: true, error: null });
  try {
    await adopt(await signIn());
  } catch (error) {
    set({ error: reason(error) });
  } finally {
    set({ busy: false });
  }
}

/** Leaves the account's progress where it is — under its email — and goes back
 *  to the guest save. Signing in again brings everything back. */
export function signOutOfGoogle(): void {
  window.clearTimeout(timer);
  signOut();
  useAccount(null);
  set({
    email: null,
    name: null,
    picture: null,
    sync: googleConfigured() ? 'idle' : 'off',
    syncedAt: null,
    error: null,
  });
}

/** On load: if Google still remembers this browser, pick the email back up with
 *  no window and no click. If it does not, the email's save is still on this
 *  device — it just will not sync until the next sign-in. */
export async function initAccount(): Promise<void> {
  onSaveChange(schedulePush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cloudReady()) void flush();
  });

  if (!googleConfigured()) {
    set({ sync: 'off' });
    return;
  }

  const user = await resume();
  if (!user) return;
  if (user.email === activeAccount()) {
    set({
      email: user.email,
      name: user.name,
      picture: user.picture ?? null,
      sync: canSync() ? 'idle' : 'unavailable',
    });
    await syncNow();
    return;
  }
  await adopt(user);
}
