import './styles/base.css';
import './styles/board.css';
import './styles/screens.css';

import { TOTAL_LEVELS } from './core/levels';
import { levelsScreen, menuScreen, playScreen } from './ui/screens';
import { applyTheme } from './ui/modals';

applyTheme();

function route(): void {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('play/')) {
    const level = Number.parseInt(hash.slice('play/'.length), 10);
    if (Number.isFinite(level) && level >= 1 && level <= TOTAL_LEVELS) {
      playScreen(level);
      return;
    }
  }
  if (hash === 'daily') return playScreen('daily');
  if (hash === 'levels') return levelsScreen();
  return menuScreen();
}

window.addEventListener('hashchange', route);
route();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline play is a bonus, not a requirement */
    });
  });
}
