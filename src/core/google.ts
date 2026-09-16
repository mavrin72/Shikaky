/** Google sign-in, client side only: the game is a static page, so there is no
 *  server of ours to hold accounts. The Google account's email is the identity,
 *  and the save is mirrored into that same account's private Drive folder — a
 *  folder only this app can see, which no Google Drive listing ever shows. */

const CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

/** Identity is free; the Drive folder is what makes progress follow an email
 *  onto another device. Google may hand back only part of this. */
const SCOPE_ID = 'openid email profile';
const SCOPE_SYNC = 'https://www.googleapis.com/auth/drive.appdata';

const FILE_NAME = 'shikaky-save.json';
const TOKEN_KEY = 'shikaky.token';

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; hint?: string }): void;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        prompt?: string;
        hint?: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

export const googleConfigured = (): boolean => CLIENT_ID.length > 0;

let script: Promise<GoogleGlobal> | null = null;

function gis(): Promise<GoogleGlobal> {
  script ??= new Promise<GoogleGlobal>((resolve, reject) => {
    const ready = (): void => {
      const google = (window as unknown as { google?: GoogleGlobal }).google;
      if (google?.accounts?.oauth2) resolve(google);
      else reject(new Error('Google не відповідає'));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis]');
    if (existing) {
      existing.addEventListener('load', ready);
      existing.addEventListener('error', () => reject(new Error('Не вдалося завантажити Google')));
      if ((window as unknown as { google?: GoogleGlobal }).google) ready();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://accounts.google.com/gsi/client';
    tag.async = true;
    tag.defer = true;
    tag.dataset.gis = '';
    tag.addEventListener('load', ready);
    tag.addEventListener('error', () => reject(new Error('Не вдалося завантажити Google — немає мережі?')));
    document.head.append(tag);
  });
  return script;
}

interface Token {
  value: string;
  expires: number;
  /** Whether Google granted the Drive folder on top of the identity scopes. */
  sync: boolean;
}

let token: Token | null = readToken();

function readToken(): Token | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Token;
    return parsed.expires > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function keepToken(next: Token | null): void {
  token = next;
  try {
    if (next) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* a token that lives only in memory still works for this visit */
  }
}

function ask(prompt: string): Promise<Token> {
  return gis().then(
    (google) =>
      new Promise<Token>((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: `${SCOPE_ID} ${SCOPE_SYNC}`,
          callback: (response) => {
            if (!response.access_token) {
              reject(new Error(response.error ? `Google: ${response.error}` : 'Вхід не завершено'));
              return;
            }
            const next: Token = {
              value: response.access_token,
              // A minute of slack, so a request never starts on a token that
              // expires while it is in flight.
              expires: Date.now() + (response.expires_in ?? 3600) * 1000 - 60_000,
              sync: (response.scope ?? '').includes(SCOPE_SYNC),
            };
            keepToken(next);
            resolve(next);
          },
          error_callback: (error) => {
            const closed = error?.type === 'popup_closed' || error?.type === 'popup_failed_to_open';
            reject(new Error(closed ? 'Вікно входу закрито' : 'Вхід не вдався'));
          },
        });
        client.requestAccessToken({ prompt });
      }),
  );
}

/** A live token, refreshed without any window when Google still remembers the
 *  consent. `interactive` is what a click on "Увійти" allows. */
async function accessToken(interactive: boolean): Promise<Token> {
  if (token && token.expires > Date.now()) return token;
  try {
    return await ask('');
  } catch (error) {
    if (!interactive) throw error;
    return ask('select_account');
  }
}

export const canSync = (): boolean => Boolean(token?.sync);

async function api(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const active = await accessToken(false);
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${active.value}` },
  });
  if (response.status === 401 && retry) {
    keepToken(null);
    return api(url, init, false);
  }
  return response;
}

async function profile(): Promise<GoogleUser> {
  const response = await api('https://www.googleapis.com/oauth2/v3/userinfo');
  if (!response.ok) throw new Error('Google не віддав профіль');
  const data = (await response.json()) as { email?: string; name?: string; picture?: string };
  if (!data.email) throw new Error('Google не дав емейл — перевір дозволи');
  return { email: data.email.toLowerCase(), name: data.name ?? data.email, picture: data.picture };
}

export async function signIn(): Promise<GoogleUser> {
  if (!googleConfigured()) throw new Error('Вхід через Google не налаштовано');
  await accessToken(true);
  return profile();
}

/** Picks the session back up on a reload without showing anything, or gives up. */
export async function resume(): Promise<GoogleUser | null> {
  if (!googleConfigured()) return null;
  try {
    await accessToken(false);
    return await profile();
  } catch {
    return null;
  }
}

export function signOut(): void {
  const active = token;
  keepToken(null);
  fileId = null;
  if (!active) return;
  void gis()
    .then((google) => google.accounts.oauth2.revoke(active.value))
    .catch(() => {
      /* the local session is gone either way */
    });
}

// ------------------------------------------------------- the Drive mirror
let fileId: string | null = null;

async function findFile(): Promise<string | null> {
  if (fileId) return fileId;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('spaces', 'appDataFolder');
  url.searchParams.set('q', `name = '${FILE_NAME}' and trashed = false`);
  url.searchParams.set('fields', 'files(id)');
  const response = await api(url.toString());
  if (!response.ok) throw new Error('Google Drive недоступний');
  const data = (await response.json()) as { files?: { id: string }[] };
  fileId = data.files?.[0]?.id ?? null;
  return fileId;
}

/** The save stored under this email, or null when there is none yet. */
export async function pull(): Promise<unknown | null> {
  if (!canSync()) return null;
  const id = await findFile();
  if (!id) return null;
  const response = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function push(save: unknown): Promise<void> {
  if (!canSync()) throw new Error('Google не дав доступу до синхронізації');
  const body = JSON.stringify(save);
  const id = await findFile();

  if (id) {
    const response = await api(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body },
    );
    if (response.ok) return;
    if (response.status === 404) fileId = null;
    else throw new Error('Не вдалося зберегти в Google');
  }

  const boundary = `shikaky-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n` +
    `--${boundary}--`;

  const created = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!created.ok) throw new Error('Не вдалося зберегти в Google');
  const data = (await created.json()) as { id?: string };
  fileId = data.id ?? null;
}
