import { useTranslation } from 'react-i18next';
import { useLayout, WINDOW_IDS } from './board/layout';

export function TopBar({ onPause }: { onPause: () => void }) {
  const { t } = useTranslation();
  const windows = useLayout((s) => s.windows);
  const toggle = useLayout((s) => s.toggle);
  const reset = useLayout((s) => s.reset);

  return (
    <header className="topbar">
      <div className="topbar-left" aria-hidden="true" />

      <nav className="dock">
        {WINDOW_IDS.map((id) => (
          <button
            key={id}
            className={`dock-btn${windows[id].open ? ' active' : ''}`}
            aria-pressed={windows[id].open}
            onClick={() => toggle(id)}
          >
            {t(`windows.${id}`)}
          </button>
        ))}
        <button className="dock-btn" title={t('board.reset')} aria-label={t('board.reset')} onClick={() => reset()}>
          ↺
        </button>
      </nav>

      <div className="topbar-right">
        <button className="dock-btn" title={t('board.pause')} aria-label={t('board.pause')} onClick={onPause}>
          ⏸
        </button>
      </div>
    </header>
  );
}
