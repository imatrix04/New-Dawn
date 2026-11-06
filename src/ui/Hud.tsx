import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { STATS } from '../data/content';
import { projectNextStats } from '../game/engine';
import type { GameState } from '../game/types';
import { formatAge, formatDate, formatSigned } from '../i18n/format';
import { Money } from './Money';

/** HUD du haut : santé, bonheur, argent et âge en pilules de verre, et le bouton pause. */
export function Hud({ game, onPause }: { game: GameState; onPause: () => void }) {
  const { t, i18n } = useTranslation();
  const next = projectNextStats(game);

  return (
    <div className="hud">
      <div className="hud-group">
        {STATS.map((stat) => {
          const value = game.stats[stat.key];
          const diff = next[stat.key] - value;
          return (
            <div
              key={stat.key}
              className={`hud-pill${value < 25 ? ' low' : ''}`}
              style={{ '--hc': stat.color } as CSSProperties}
              title={`${t(`stats.${stat.key}`)} · ${t('gauge.next', { value: Math.round(next[stat.key]) })}`}
            >
              <span className="hud-ico" aria-hidden>{stat.icon}</span>
              <span>{Math.round(value)}</span>
              <span className="hud-bar" aria-hidden><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>
              {Math.abs(diff) > 0.05 && <span className={`hud-trend ${diff > 0 ? 'good' : 'bad'}`}>{formatSigned(diff, i18n.language)}</span>}
            </div>
          );
        })}
      </div>

      <div className="hud-group">
        <div className="hud-pill hud-date" title={formatAge(t, game.month)}><span className="hud-ico" aria-hidden>📆</span>{formatDate(game.month, i18n.language)}</div>
        <div className="hud-pill money"><span className="hud-ico" aria-hidden>🪙</span><Money value={game.money} /></div>
        <button className="hud-icon-btn" title={t('board.pause')} aria-label={t('board.pause')} onClick={onPause}>⏸</button>
      </div>
    </div>
  );
}
