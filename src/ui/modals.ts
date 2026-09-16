import { settings, updateSettings, type Settings } from '../core/storage';
import { h } from './dom';
import { sfx } from './sound';

export function applyTheme(theme: Settings['theme'] = settings().theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function openSheet(build: (close: () => void) => HTMLElement): void {
  const overlay = h('div', { class: 'overlay' });
  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close();
  };
  overlay.append(build(close));
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.querySelector<HTMLElement>('button')?.focus();
}

function segmented(
  label: string,
  options: { value: string; text: string }[],
  current: string,
  onPick: (value: string) => void,
): HTMLElement {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  for (const option of options) {
    const button = h(
      'button',
      {
        type: 'button',
        'aria-pressed': String(option.value === current),
        onclick: () => {
          onPick(option.value);
          for (const other of seg.querySelectorAll('button')) {
            other.setAttribute('aria-pressed', String(other === button));
          }
        },
      },
      option.text,
    );
    seg.append(button);
  }
  return seg;
}

function toggleRow(label: string, value: boolean, onChange: (next: boolean) => void): HTMLElement {
  return h(
    'div',
    { class: 'toggle' },
    h('span', {}, label),
    segmented(
      label,
      [
        { value: 'on', text: 'Увімк.' },
        { value: 'off', text: 'Вимк.' },
      ],
      value ? 'on' : 'off',
      (next) => onChange(next === 'on'),
    ),
  );
}

export function openSettings(onReset: () => void, onProgress: () => void): void {
  openSheet((close) =>
    h(
      'div',
      { class: 'sheet' },
      h('h2', {}, 'Налаштування'),
      toggleRow('Звук', settings().sound, (next) => {
        updateSettings({ sound: next });
        // This click is a user gesture, so it is the right moment to start audio.
        if (next) {
          sfx.wake();
          sfx.tap();
        }
      }),
      toggleRow('Ефекти й тряска', settings().fx, (next) => updateSettings({ fx: next })),
      h(
        'div',
        { class: 'toggle' },
        h('span', {}, 'Тема'),
        segmented(
          'Тема',
          [
            { value: 'system', text: 'Авто' },
            { value: 'light', text: 'День' },
            { value: 'dark', text: 'Ніч' },
          ],
          settings().theme,
          (value) => {
            updateSettings({ theme: value as Settings['theme'] });
            applyTheme(value as Settings['theme']);
          },
        ),
      ),
      h('p', {}, 'Прогрес зберігається лише у цьому браузері.'),
      h(
        'div',
        { class: 'sheet__row' },
        h(
          'button',
          {
            class: 'btn btn--blue',
            type: 'button',
            onclick: () => {
              close();
              onProgress();
            },
          },
          'Перенести або відновити прогрес',
        ),
      ),
      h(
        'div',
        { class: 'sheet__row' },
        h(
          'button',
          {
            class: 'btn btn--pink',
            type: 'button',
            onclick: () => {
              if (confirm('Стерти весь прогрес? Це не відкотиш.')) {
                onReset();
                close();
              }
            },
          },
          'Стерти прогрес',
        ),
        h('button', { class: 'btn', type: 'button', onclick: close }, 'Готово'),
      ),
    ),
  );
}

export function openRules(): void {
  openSheet((close) =>
    h(
      'div',
      { class: 'sheet' },
      h('h2', {}, 'Як грати'),
      h('p', {}, 'Shikaku — 四角に切れ, «розріж на прямокутники». Нікольська класика 1989 року.'),
      h(
        'ol',
        { class: 'rules' },
        h('li', {}, h('b', {}, '1'), h('span', {}, 'Протягни пальцем або мишею — намалюєш прямокутник.')),
        h('li', {}, h('b', {}, '2'), h('span', {}, 'У кожному прямокутнику має бути рівно одне число.')),
        h('li', {}, h('b', {}, '3'), h('span', {}, 'Площа прямокутника = це число. 12 — це 3×4, 2×6 або 1×12.')),
        h('li', {}, h('b', {}, '4'), h('span', {}, 'Поле має бути закрите повністю, без перетинів і дірок.')),
        h('li', {}, h('b', {}, '5'), h('span', {}, 'Тап по фігурі прибирає її. Смугастий червоний — площа не збігається.')),
      ),
      h('p', {}, 'З клавіатури: стрілки — курсор, Enter — почати й завершити прямокутник, Backspace — прибрати.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: close }, 'Зрозуміло'),
    ),
  );
}
