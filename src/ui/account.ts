import {
  accountState,
  initAccount,
  onAccountChange,
  signInWithGoogle,
  signOutOfGoogle,
  syncNow,
  type AccountState,
} from '../core/account';
import { googleConfigured } from '../core/google';
import { TOTAL_LEVELS } from '../core/levels';
import { exportCode, importCode, lastPlayed, markSolvedUpTo, solvedCount } from '../core/storage';
import { h } from './dom';
import { toast } from './fx';
import { openSheet } from './modals';

export { initAccount };

const SYNC_TEXT: Record<AccountState['sync'], string> = {
  off: 'Прогрес зберігається лише в цьому браузері',
  idle: 'Синхронізовано з Google',
  syncing: 'Синхронізую…',
  unavailable: 'Google не дав доступу до сховища — прогрес лише на цьому пристрої',
  error: 'Синхронізація не вдалася',
};

/** Short label for the topbar button: the account's initial, or a plain figure. */
export const accountBadge = (): string => {
  const email = accountState().email;
  return email ? email[0].toUpperCase() : '👤';
};

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

function statusLine(state: AccountState): HTMLElement {
  let text: string;
  if (state.sync === 'syncing') text = SYNC_TEXT.syncing;
  else if (state.error) text = state.error;
  else if (!state.email) text = SYNC_TEXT.off;
  else if (state.sync === 'idle' && state.syncedAt) text = `Синхронізовано о ${clock(state.syncedAt)}`;
  else text = SYNC_TEXT[state.sync];
  return h('p', { class: 'acct__status' }, text);
}

function section(title: string, ...children: (Node | string | null)[]): HTMLElement {
  return h('div', { class: 'acct__block' }, h('h3', {}, title), ...children);
}

/** A whole save as one line of text, for moving progress by hand. */
function transferBlock(onChanged: () => void): HTMLElement {
  const out = h('textarea', {
    class: 'field field--code',
    readonly: 'readonly',
    rows: '3',
    'aria-label': 'Код твого прогресу',
  }) as HTMLTextAreaElement;
  out.value = exportCode();

  const input = h('textarea', {
    class: 'field field--code',
    rows: '3',
    placeholder: 'Встав сюди код зі старого браузера',
    'aria-label': 'Код для відновлення',
  }) as HTMLTextAreaElement;

  const copy = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: () => {
        out.select();
        navigator.clipboard
          ?.writeText(out.value)
          .then(() => toast('Код скопійовано'))
          .catch(() => toast('Скопіюй код вручну'));
      },
    },
    'Копіювати код',
  );

  const apply = h(
    'button',
    {
      class: 'btn btn--blue',
      type: 'button',
      onclick: () => {
        try {
          const { added } = importCode(input.value);
          input.value = '';
          out.value = exportCode();
          toast(added ? `Повернуто рівнів: ${added}` : 'Нових рівнів у коді не було');
          onChanged();
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Код не підійшов');
        }
      },
    },
    'Відновити з коду',
  );

  return section(
    'Перенести прогрес',
    h('p', {}, 'Відкрий стару адресу гри, скопіюй там цей код і встав його тут — рівні складуться разом, нічого не зникне.'),
    out,
    h('div', { class: 'sheet__row' }, copy),
    input,
    h('div', { class: 'sheet__row' }, apply),
  );
}

/** The manual fallback: no old save anywhere, but the player remembers how far
 *  they got. */
function restoreBlock(onChanged: () => void): HTMLElement {
  const input = h('input', {
    class: 'field',
    type: 'number',
    min: '1',
    max: String(TOTAL_LEVELS),
    inputmode: 'numeric',
    value: String(lastPlayed()),
    'aria-label': 'Останній пройдений рівень',
  }) as HTMLInputElement;

  const run = h(
    'button',
    {
      class: 'btn btn--green',
      type: 'button',
      onclick: () => {
        const level = Number.parseInt(input.value, 10);
        if (!Number.isFinite(level) || level < 1 || level > TOTAL_LEVELS) {
          toast(`Вкажи число від 1 до ${TOTAL_LEVELS}`);
          return;
        }
        if (!confirm(`Позначити рівні 1–${level} як пройдені?`)) return;
        const { added } = markSolvedUpTo(level);
        toast(added ? `Відкрито рівнів: ${added}` : 'Ці рівні вже були пройдені');
        onChanged();
      },
    },
    'Відновити',
  );

  return section(
    'Відновити рівні вручну',
    h('p', {}, `До якого рівня ти дійшла? Усі рівні до нього стануть пройденими, без часу в рекордах. Зараз пройдено ${solvedCount()} з ${TOTAL_LEVELS}.`),
    h('div', { class: 'sheet__row' }, input, run),
  );
}

function googleBlock(state: AccountState, refresh: () => void, onChanged: () => void): HTMLElement {
  if (!googleConfigured()) {
    return section(
      'Вхід через Google',
      h('p', {}, 'Вхід ще не налаштовано: у збірку не додано Google Client ID. Як це зробити — написано в README.'),
    );
  }

  if (!state.email) {
    return section(
      'Вхід через Google',
      h('p', {}, 'Увійди — і прогрес прив’яжеться до твого емейлу. Після оновлення гри чи на іншому телефоні він повернеться сам.'),
      h(
        'div',
        { class: 'sheet__row' },
        h(
          'button',
          {
            class: 'btn btn--primary',
            type: 'button',
            disabled: state.busy,
            onclick: () => {
              void signInWithGoogle().then(() => {
                refresh();
                onChanged();
                if (accountState().email) toast('Вітаємо вдома!');
              });
            },
          },
          state.busy ? 'Заходимо…' : 'Увійти через Google',
        ),
      ),
      statusLine(state),
    );
  }

  return section(
    'Акаунт',
    h(
      'div',
      { class: 'acct__who' },
      state.picture ? h('img', { class: 'acct__pic', src: state.picture, alt: '' }) : null,
      h(
        'div',
        {},
        h('b', { class: 'acct__mail' }, state.email),
        statusLine(state),
      ),
    ),
    h(
      'div',
      { class: 'sheet__row' },
      h(
        'button',
        {
          class: 'btn btn--blue',
          type: 'button',
          disabled: state.sync === 'syncing',
          onclick: () => {
            void syncNow().then(() => {
              refresh();
              onChanged();
            });
          },
        },
        'Синхронізувати',
      ),
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            signOutOfGoogle();
            refresh();
            onChanged();
            toast('Вийшли з акаунта');
          },
        },
        'Вийти',
      ),
    ),
  );
}

export function openAccount(onChanged: () => void = () => {}): void {
  openSheet((close) => {
    const sheet = h('div', { class: 'sheet sheet--tall' });

    let shown = false;
    const render = (): void => {
      // The sheet can be dismissed by Escape or a tap outside, so it drops its
      // subscription the first time it is asked to redraw while detached.
      if (shown && !sheet.isConnected) {
        unsubscribe();
        return;
      }
      shown = true;
      sheet.replaceChildren(
        h('h2', {}, 'Прогрес'),
        googleBlock(accountState(), render, onChanged),
        transferBlock(onChanged),
        restoreBlock(onChanged),
        h('div', { class: 'sheet__row' }, h('button', { class: 'btn', type: 'button', onclick: () => stop(close) }, 'Готово')),
      );
    };

    const unsubscribe = onAccountChange(render);
    const stop = (done: () => void): void => {
      unsubscribe();
      done();
    };

    render();
    return sheet;
  });
}
