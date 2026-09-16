import { formatTime, Game } from '../core/game';
import {
  dailyKey,
  dailyPuzzle,
  firstLevelOfTier,
  levelRef,
  puzzleForLevel,
  TIERS,
  TOTAL_LEVELS,
  type Tier,
} from '../core/levels';
import {
  dailyRecord,
  isSolved,
  isUnlocked,
  nextLevel,
  recordDaily,
  recordOf,
  recordWin,
  resetProgress,
  solvedCount,
  NO_TIME,
  type LevelRecord,
} from '../core/storage';
import { CHAIN } from '../core/pond';
import { basketBest, basketTop, recordBasket } from '../core/storage';
import { createPondView } from './pond';
import { BoardView } from './board';
import { h } from './dom';
import { confetti, toast } from './fx';
import { openRules, openSettings, openSheet } from './modals';
import { openProgress } from './progress';
import { sfx } from './sound';

const ON_TIER: Record<string, string> = {
  '--green': '#00281C',
  '--blue': '#F2F5FF',
  '--pink': '#170008',
  '--orange': '#240F00',
  '--violet': '#F6EEFF',
  '--cyan': '#00252B',
  '--red': '#FFF0EE',
};

/** Restored progress carries no time, so a record can be "solved, but unraced". */
const bestLabel = (record: LevelRecord): string => (record.time > NO_TIME ? formatTime(record.time) : '—');

const go = (hash: string): void => {
  window.location.hash = hash;
};

/** Screens that show counts redraw themselves when progress arrives from an
 *  a restore or an imported code; main.ts hands us its router to do that. */
let rerender: () => void = () => {};

export const setRerender = (route: () => void): void => {
  rerender = route;
};

/** A puzzle in progress is never thrown away to refresh a counter behind it. */
let playing = false;

const refreshScreens = (): void => {
  if (!playing) rerender();
};

let cleanup: (() => void) | null = null;

export function mount(screen: HTMLElement, dispose?: () => void): void {
  cleanup?.();
  cleanup = dispose ?? null;
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren(screen);
  window.scrollTo(0, 0);
}

function topbar(title: string, subtitle?: string, back?: string, rules: () => void = openRules): HTMLElement {
  return h(
    'div',
    { class: 'topbar' },
    back
      ? h(
          'button',
          { class: 'btn btn--icon', type: 'button', 'aria-label': 'Назад', onclick: () => go(back) },
          '←',
        )
      : null,
    h(
      'div',
      { class: 'topbar__title' },
      title,
      subtitle ? h('span', { class: 'topbar__sub' }, ` ${subtitle}`) : null,
    ),
    h(
      'button',
      {
        class: 'btn btn--icon',
        type: 'button',
        'aria-label': 'Правила',
        onclick: () => rules(),
      },
      '?',
    ),
    h(
      'button',
      {
        class: 'btn btn--icon',
        type: 'button',
        'aria-label': 'Прогрес',
        onclick: () => openProgress(refreshScreens),
      },
      '💾',
    ),
    h(
      'button',
      {
        class: 'btn btn--icon',
        type: 'button',
        'aria-label': 'Налаштування',
        onclick: () =>
          openSettings(
            () => {
              resetProgress();
              toast('Прогрес стерто');
              go('#/');
            },
            () => openProgress(refreshScreens),
          ),
      },
      '⚙',
    ),
  );
}

// ------------------------------------------------------------------ menu
export function menuScreen(): void {
  playing = false;
  const done = solvedCount();
  const next = nextLevel();
  const { tier } = levelRef(next);

  mount(
    h(
      'div',
      { class: 'screen' },
      topbar('Shikaky'),
      h(
        'div',
        { class: 'hero' },
        h('span', { class: 'hero__jp' }, '四角に切れ'),
        h('h1', {}, 'Shikaky'),
        h('p', {}, `Розріж поле на прямокутники. У кожному — рівно одне число, і воно дорівнює площі. ${TOTAL_LEVELS} рівнів, жодного однакового.`),
      ),
      h(
        'div',
        { class: 'menu-grid' },
        h(
          'button',
          { class: 'btn btn--primary btn--big', type: 'button', onclick: () => go(`#/play/${next}`) },
          done ? `Далі: рівень ${next}` : 'Почати гру',
        ),
        h('button', { class: 'btn btn--blue btn--big', type: 'button', onclick: () => go('#/levels') }, 'Рівні'),
        h('button', { class: 'btn btn--green btn--big', type: 'button', onclick: () => go('#/daily') }, 'Щоденна'),
        h(
          'button',
          { class: 'btn btn--pink btn--big', type: 'button', onclick: () => go('#/basket') },
          basketBest() ? `Жабки · ${basketBest()} мух` : 'Жабки',
        ),
        h('button', { class: 'btn btn--big', type: 'button', onclick: () => openRules() }, 'Як грати'),
        h(
          'button',
          { class: 'btn btn--big', type: 'button', onclick: () => openProgress(() => menuScreen()) },
          'Відновити прогрес',
        ),
      ),
      h(
        'div',
        { class: 'stat-row' },
        h('div', { class: 'stat' }, h('b', {}, `${done}/${TOTAL_LEVELS}`), h('span', {}, 'пройдено')),
        h('div', { class: 'stat' }, h('b', {}, tier.name), h('span', {}, 'поточний блок')),
        h(
          'div',
          { class: 'stat' },
          h('b', {}, dailyRecord(dailyKey()) ? formatTime(dailyRecord(dailyKey()) as number) : '—'),
          h('span', {}, 'щоденна сьогодні'),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------ level select
function tierBlock(tier: Tier): HTMLElement {
  const start = firstLevelOfTier(tier.id);
  const levels = Array.from({ length: tier.count }, (_, i) => start + i);
  const done = levels.filter(isSolved).length;
  const next = nextLevel();

  const grid = h('div', { class: 'levels' });
  for (const level of levels) {
    const record = recordOf(level);
    const unlocked = isUnlocked(level);
    const classes = ['lvl'];
    if (record) classes.push('lvl--done');
    else if (!unlocked) classes.push('lvl--locked');
    if (level === next) classes.push('lvl--next');

    grid.append(
      h(
        'button',
        {
          class: classes.join(' '),
          type: 'button',
          disabled: !unlocked,
          'aria-label': `Рівень ${level}${record ? `, пройдено${record.time > NO_TIME ? ` за ${formatTime(record.time)}` : ''}` : ''}`,
          onclick: () => unlocked && go(`#/play/${level}`),
        },
        h('span', {}, String(level)),
        record ? h('small', {}, bestLabel(record)) : !unlocked ? h('small', {}, '🔒') : null,
      ),
    );
  }

  const block = h(
    'section',
    { class: 'tier' },
    h(
      'div',
      { class: 'tier__head' },
      h('span', { class: 'tier__name' }, tier.name),
      h('span', { class: 'tier__meta' }, `${tier.rows}×${tier.cols} · ${tier.hint} · ${done}/${tier.count}`),
    ),
    h('div', { class: 'tier__bar' }, h('i', { style: { width: `${(done / tier.count) * 100}%` } })),
    grid,
  );
  block.style.setProperty('--tier-ink', `var(${tier.ink})`);
  block.style.setProperty('--on-tier', ON_TIER[tier.ink] ?? '#111111');
  return block;
}

export function levelsScreen(): void {
  playing = false;
  mount(
    h(
      'div',
      { class: 'screen' },
      topbar('Рівні', `${solvedCount()}/${TOTAL_LEVELS}`, '#/'),
      ...TIERS.map(tierBlock),
    ),
  );
}

// ------------------------------------------------------------------ play
export function playScreen(target: number | 'daily'): void {
  playing = true;
  const isDaily = target === 'daily';
  const level = isDaily ? 0 : (target as number);
  const puzzle = isDaily ? dailyPuzzle() : puzzleForLevel(level);
  const ref = isDaily ? null : levelRef(level);
  const game = new Game(puzzle);
  const hintBudget = 3;

  const timerEl = h('div', { class: 'hud__timer' }, '00:00');
  const noteEl = h('p', { class: 'progress-note' });
  const undoBtn = h('button', { class: 'btn', type: 'button' }, '↶ Крок назад');
  const redoBtn = h('button', { class: 'btn', type: 'button' }, '↷ Вперед');
  const hintBtn = h('button', { class: 'btn btn--blue', type: 'button' }, `Підказка ${hintBudget}`);
  const clearBtn = h('button', { class: 'btn btn--pink', type: 'button' }, 'Очистити');

  let elapsed = 0;
  let lastTick = performance.now();
  let running = true;
  let finished = false;

  const board = new BoardView({
    game,
    onChange: () => syncHud(),
    onSolve: () => finish(),
  });

  function syncHud(): void {
    const cells = puzzle.rows * puzzle.cols;
    noteEl.textContent = `Закрито ${game.coveredCells()} з ${cells} клітинок · чисел готово ${game.solvedClues} з ${puzzle.clues.length}`;
    undoBtn.toggleAttribute('disabled', !game.canUndo);
    redoBtn.toggleAttribute('disabled', !game.canRedo);
    hintBtn.toggleAttribute('disabled', game.hintsUsed >= hintBudget);
    hintBtn.textContent = `Підказка ${Math.max(hintBudget - game.hintsUsed, 0)}`;
  }

  const tick = window.setInterval(() => {
    const now = performance.now();
    if (running && !document.hidden) elapsed += now - lastTick;
    lastTick = now;
    timerEl.textContent = formatTime(elapsed);
  }, 250);

  function finish(): void {
    if (finished) return;
    finished = true;
    running = false;
    board.celebrate();
    sfx.win();
    confetti(board.center());

    let headline = 'Розрізано!';
    let sub = '';
    if (isDaily) {
      const key = dailyKey();
      const previous = dailyRecord(key);
      recordDaily(key, elapsed);
      sub = previous ? `Твій попередній результат: ${formatTime(previous)}` : 'Перша щоденна сьогодні — закрита.';
    } else {
      const previous = recordOf(level);
      const { best } = recordWin(level, elapsed, game.hintsUsed);
      if (best && previous && previous.time > NO_TIME) headline = 'Новий рекорд!';
      sub =
        previous && previous.time > NO_TIME
          ? `Було: ${formatTime(previous.time)}`
          : `Блок «${ref?.tier.name}», рівень ${ref?.nth} з ${ref?.tier.count}`;
    }

    const following = isDaily ? null : Math.min(level + 1, TOTAL_LEVELS);
    window.setTimeout(() => {
      openSheet((close) =>
        h(
          'div',
          { class: 'sheet' },
          h('h2', {}, headline),
          h(
            'div',
            { class: 'result' },
            h('div', {}, h('b', {}, formatTime(elapsed)), h('span', {}, 'час')),
            h('div', {}, h('b', {}, String(game.moves)), h('span', {}, 'ходів')),
            h('div', {}, h('b', {}, String(game.hintsUsed)), h('span', {}, 'підказок')),
          ),
          h('p', {}, sub),
          h(
            'div',
            { class: 'sheet__row' },
            following && following !== level
              ? h(
                  'button',
                  {
                    class: 'btn btn--primary',
                    type: 'button',
                    onclick: () => {
                      close();
                      go(`#/play/${following}`);
                    },
                  },
                  'Далі →',
                )
              : null,
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: () => {
                  close();
                  playScreen(target);
                },
              },
              'Ще раз',
            ),
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: () => {
                  close();
                  go(isDaily ? '#/' : '#/levels');
                },
              },
              isDaily ? 'У меню' : 'До рівнів',
            ),
          ),
        ),
      );
    }, 700);
  }

  undoBtn.addEventListener('click', () => {
    if (game.undo()) {
      sfx.erase();
      board.refresh();
    }
  });
  redoBtn.addEventListener('click', () => {
    if (game.redo()) {
      sfx.tap();
      board.refresh();
    }
  });
  hintBtn.addEventListener('click', () => {
    const result = game.hint();
    if (!result) {
      toast('Усе вже на місці');
      return;
    }
    sfx.hint();
    board.refresh();
  });
  clearBtn.addEventListener('click', () => {
    game.clear();
    sfx.erase();
    board.refresh();
  });

  const title = isDaily ? 'Щоденна' : `Рівень ${level}`;
  const subtitle = isDaily ? dailyKey() : `${ref?.tier.name} · ${puzzle.rows}×${puzzle.cols}`;

  const screen = h(
    'div',
    { class: 'screen play' },
    topbar('Shikaky', undefined, isDaily ? '#/' : '#/levels'),
    h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud__level' }, title, h('span', { class: 'hud__tier' }, subtitle)),
      timerEl,
    ),
    board.el,
    h('div', { class: 'tools' }, undoBtn, redoBtn, hintBtn, clearBtn),
    noteEl,
  );

  mount(screen, () => {
    window.clearInterval(tick);
    board.destroy();
  });
  syncHud();
}


// ---------------------------------------------------------------- basket
function basketRules(): void {
  openSheet((close) =>
    h(
      'div',
      { class: 'sheet' },
      h('h2', {}, 'Жабки'),
      h('p', {}, 'Кидай жабок у ставок: дві однакові зливаються в наступну за розміром.'),
      h(
        'ol',
        { class: 'rules' },
        h('li', {}, h('b', {}, '1'), h('span', {}, 'Тягни пальцем угорі — цілишся. Відпустив — жабка падає.')),
        h('li', {}, h('b', {}, '2'), h('span', {}, 'Дві однакові жабки, що торкнулись, стають однією більшою.')),
        h('li', {}, h('b', {}, '3'), h('span', {}, 'Ланцюжок: ікринка → пуголовок → жабеня → … → царівна → Цар-Жаб.')),
        h('li', {}, h('b', {}, '4'), h('span', {}, 'Падають лише п\'ять найдрібніших — решту треба виростити.')),
        h('li', {}, h('b', {}, '5'), h('span', {}, 'Злиття поспіль дають комбо, а струс ставка розвалює невдалий стос.')),
      ),
      h('p', {}, 'Очки — це мухи: що більша жабка, то ситніша. Якщо хтось лишається над червоною лінією — кінець спроби.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: close }, 'Ква'),
    ),
  );
}

export function basketScreen(): void {
  playing = false;
  const scoreEl = h('div', { class: 'hud__level' }, '0 мух', h('span', { class: 'hud__tier' }, 'ставок'));
  const bestEl = h('div', { class: 'hud__timer' }, `рекорд ${basketBest()}`);
  const comboEl = h('div', { class: 'combo' }, h('b', {}, '×2'), h('i', {}));
  const nextEl = h('div', { class: 'nextup' });
  const chain = h('div', { class: 'chain' });

  const nodes = CHAIN.map((item, tier) => {
    const dot = h('i', {
      class: 'chain__dot',
      title: `${item.name}${item.price ? ` · ${item.price} мух` : ''}`,
    });
    dot.style.background = item.fill;
    dot.style.width = `${10 + tier * 2.2}px`;
    dot.style.height = `${10 + tier * 2.2}px`;
    if (tier <= basketTop()) dot.classList.add('chain__dot--got');
    chain.append(dot);
    return dot;
  });

  const bead = (tier: number, size: number): HTMLElement => {
    const dot = h('i', { class: 'nextup__dot' });
    dot.style.background = CHAIN[tier].fill;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    return dot;
  };

  function showNext(tier: number, after: number): void {
    nextEl.replaceChildren(
      h('span', { class: 'nextup__label' }, 'далі'),
      bead(tier, 20),
      h('span', { class: 'nextup__name' }, CHAIN[tier].short),
      h('span', { class: 'nextup__then' }, 'потім'),
      bead(after, 13),
    );
  }

  const shakeBtn = h('button', { class: 'btn btn--blue', type: 'button' }, 'Струсити 3');
  const again = h('button', { class: 'btn btn--pink', type: 'button' }, 'Заново');

  const view = createPondView({
    onScore: (score, best) => {
      scoreEl.firstChild!.textContent = `${score} мух`;
      bestEl.textContent = `рекорд ${best}`;
    },
    onNext: showNext,
    onReach: (tier) => {
      recordBasket(0, tier);
      nodes.forEach((dot, i) => dot.classList.toggle('chain__dot--got', i <= Math.max(tier, basketTop())));
      nodes[tier]?.classList.remove('chain__dot--new');
      void nodes[tier]?.offsetWidth;
      nodes[tier]?.classList.add('chain__dot--new');
    },
    onCombo: (combo, left) => {
      comboEl.classList.toggle('combo--on', combo > 1);
      if (combo > 1) {
        comboEl.firstChild!.textContent = `×${combo}`;
        (comboEl.lastChild as HTMLElement).style.width = `${Math.min(100, (left / 1.5) * 100)}%`;
      }
    },
    onShakes: (left) => {
      shakeBtn.textContent = `Струсити ${left}`;
      shakeBtn.toggleAttribute('disabled', left <= 0);
    },
    onOver: (score, best) => {
      openSheet((close) =>
        h(
          'div',
          { class: 'sheet' },
          h('h2', {}, score >= best ? 'Рекорд!' : 'Ставок переповнений'),
          h(
            'div',
            { class: 'result' },
            h('div', {}, h('b', {}, String(score)), h('span', {}, 'мух')),
            h('div', {}, h('b', {}, String(best)), h('span', {}, 'рекорд')),
            h('div', {}, h('b', {}, CHAIN[Math.max(basketTop(), 0)].short), h('span', {}, 'найбільше')),
          ),
          h('p', {}, 'Стос переріс червону лінію. Найбільша жабка лишається в колекції внизу.'),
          h(
            'div',
            { class: 'sheet__row' },
            h(
              'button',
              {
                class: 'btn btn--primary',
                type: 'button',
                onclick: () => {
                  close();
                  view.restart();
                },
              },
              'Ще раз',
            ),
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: () => {
                  close();
                  go('#/');
                },
              },
              'У меню',
            ),
          ),
        ),
      );
    },
  });

  shakeBtn.addEventListener('click', () => view.shake());
  again.addEventListener('click', () => {
    view.restart();
    toast('Нова спроба');
  });

  mount(
    h(
      'div',
      { class: 'screen play' },
      topbar('Shikaky', undefined, '#/', basketRules),
      h('div', { class: 'hud' }, scoreEl, comboEl, bestEl),
      view.el,
      h('div', { class: 'tools' }, nextEl),
      h('div', { class: 'tools' }, shakeBtn, again),
      h('div', { class: 'chain-wrap' }, chain),
      h('p', { class: 'progress-note' }, 'Тягни, щоб прицілитись, відпусти — впаде. Дві однакові жабки зливаються. Злиття поспіль дають комбо-множник.'),
    ),
    () => view.destroy(),
  );
  showNext(view.pond.next, view.pond.queued);
}
