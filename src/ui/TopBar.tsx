import { useTranslation } from 'react-i18next';
import { useLayout, WINDOW_IDS } from './board/layout';
import { useStore } from '../store';
import { Icon, WINDOW_ICONS } from './Icon';

/** Dock du bas : une icône ronde par fenêtre, le nom s'affiche au survol. */
export function TopBar() {
  const { t } = useTranslation();
  const windows = useLayout((s) => s.windows);
  const toggle = useLayout((s) => s.toggle);
  const reset = useLayout((s) => s.reset);
  // L'icône Équipe n'apparaît que si le joueur encadre une équipe.
  const hasTeam = useStore((s) => !!s.game?.team);

  return (
    <header className="topbar">
      <nav className="dock">
        {WINDOW_IDS.filter((id) => id !== 'team' || hasTeam).map((id) => (
          <button
            key={id}
            className={`dock-btn${windows[id].open ? ' active' : ''}`}
            data-label={t(`windows.${id}`)}
            aria-label={t(`windows.${id}`)}
            aria-pressed={windows[id].open}
            onClick={() => toggle(id)}
          >
            <Icon name={WINDOW_ICONS[id]} />
          </button>
        ))}
        <span className="dock-sep" aria-hidden />
        <button className="dock-btn" data-label={t('board.reset')} aria-label={t('board.reset')} onClick={() => reset()}>
          <Icon name="reset" />
        </button>
      </nav>
    </header>
  );
}
