import { levelRef, TOTAL_LEVELS } from '../core/levels';
import { exportCode, importCode, lastPlayed, markSolvedUpTo, solvedCount } from '../core/storage';
import { h } from './dom';
import { toast } from './fx';
import { openSheet } from './modals';

function section(title: string, ...children: (Node | string | null)[]): HTMLElement {
  return h('div', { class: 'prog__block' }, h('h3', {}, title), ...children);
}

/** A whole save as one line of text, for moving progress between browsers. */
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

/** No old save anywhere, but the player remembers how far they got. */
function restoreBlock(onChanged: () => void): HTMLElement {
  const note = h('p', { class: 'prog__status' });

  const input = h('input', {
    class: 'field',
    type: 'number',
    min: '1',
    max: String(TOTAL_LEVELS),
    inputmode: 'numeric',
    value: String(lastPlayed()),
    'aria-label': 'Останній пройдений рівень',
  }) as HTMLInputElement;

  const describe = (): void => {
    const level = Number.parseInt(input.value, 10);
    if (!Number.isFinite(level) || level < 1 || level > TOTAL_LEVELS) {
      note.textContent = `Вкажи число від 1 до ${TOTAL_LEVELS}`;
      return;
    }
    const { tier, nth } = levelRef(level);
    note.textContent = `Рівень ${level} — це «${tier.name}», ${nth} з ${tier.count}, поле ${tier.rows}×${tier.cols}`;
  };
  input.addEventListener('input', describe);
  describe();

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
    'Відновити рівні',
    h('p', {}, `До якого рівня ти дійшла? Усі рівні до нього стануть пройденими, без часу в рекордах. Зараз пройдено ${solvedCount()} з ${TOTAL_LEVELS}.`),
    h('div', { class: 'sheet__row' }, input, run),
    note,
  );
}

export function openProgress(onChanged: () => void = () => {}): void {
  openSheet((close) => {
    const sheet = h('div', { class: 'sheet sheet--tall' });

    // Restoring levels changes the transfer code, and an imported code changes
    // the counts, so the whole sheet is redrawn after either of them.
    const render = (): void => {
      sheet.replaceChildren(
        h('h2', {}, 'Прогрес'),
        restoreBlock(changed),
        transferBlock(changed),
        h('div', { class: 'sheet__row' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Готово')),
      );
    };

    const changed = (): void => {
      onChanged();
      render();
    };

    render();
    return sheet;
  });
}
