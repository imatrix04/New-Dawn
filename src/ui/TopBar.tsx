import { useTranslation } from 'react-i18next';
import type { GameState } from '../game/types';
import { formatAge, formatNumber } from '../i18n/format';
import { useLayout, WINDOW_IDS } from './board/layout';

export function TopBar({ game, onPause }: { game: GameState; onPause: () => void }) {
  const { t, i18n } = useTranslation();
  const windows = useLayout((s) => s.windows);
  const toggle = useLayout((s) => s.toggle);
  const reset = useLayout((s) => s.reset);

  return (
    <header className="topbar">
      <div className="topbar-id">
        <strong>{game.firstName} {game.lastName}</strong>
        <span className="muted">{formatAge(t, game.month)}</span>
      </div>

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
        <div className="money" style={game.money < 0 ? { color: 'var(--bad)' } : undefined}>
          💰 {formatNumber(game.money, i18n.language)} €
        </div>
        <button className="dock-btn" title={t('board.pause')} aria-label={t('board.pause')} onClick={onPause}>
          ⏸
        </button>
      </div>
    </header>
  );
}
