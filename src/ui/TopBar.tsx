import { useTranslation } from 'react-i18next';
import { useLayout, WINDOW_IDS, type WindowId } from './board/layout';

/** Icône de chaque fenêtre dans le dock. */
const ICONS: Record<WindowId, string> = {
  schedule: '📅', status: '💗', profile: '👤', wallet: '💰', career: '💼', housing: '🏠', market: '🛒', journal: '📖',
};

/** Dock du bas : une icône ronde par fenêtre, le nom s'affiche au survol. */
export function TopBar() {
  const { t } = useTranslation();
  const windows = useLayout((s) => s.windows);
  const toggle = useLayout((s) => s.toggle);
  const reset = useLayout((s) => s.reset);

  return (
    <header className="topbar">
      <nav className="dock">
        {WINDOW_IDS.map((id) => (
          <button
            key={id}
            className={`dock-btn${windows[id].open ? ' active' : ''}`}
            data-label={t(`windows.${id}`)}
            aria-label={t(`windows.${id}`)}
            aria-pressed={windows[id].open}
            onClick={() => toggle(id)}
          >
            {ICONS[id]}
          </button>
        ))}
        <span className="dock-sep" aria-hidden />
        <button className="dock-btn" data-label={t('board.reset')} aria-label={t('board.reset')} onClick={() => reset()}>
          ↺
        </button>
      </nav>
    </header>
  );
}
