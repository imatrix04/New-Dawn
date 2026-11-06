import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { STATS } from '../data/content';
import { monthlyExpenses, monthlyIncome, projectNextStats } from '../game/engine';
import type { GameState } from '../game/types';
import { formatAge, formatDate, formatMoney, formatSigned } from '../i18n/format';
import { Icon, type IconName } from './Icon';
import { Money } from './Money';
import { MoneyBreakdown } from './MoneyBreakdown';
import { StatBreakdown } from './StatBreakdown';
import { SeasonIcon, useSeason } from './Season';

const STAT_ICONS: Record<string, IconName> = { health: 'heart', happiness: 'smile' };

/** Tendance à côté d'un chiffre : flèche et variation, verte ou rouge. */
function Trend({ diff, children }: { diff: number; children: string }) {
  if (Math.abs(diff) < 0.05) return <small className="hud-trend flat">= {children}</small>;
  return <small className={`hud-trend ${diff > 0 ? 'good' : 'bad'}`}>{diff > 0 ? '▲' : '▼'} {children}</small>;
}

/** Barre du haut : date et saison, argent, santé et bonheur (avec la tendance du mois), pause. */
export function Hud({ game, onPause }: { game: GameState; onPause: () => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const next = projectNextStats(game);
  const balance = monthlyIncome(game) - monthlyExpenses(game);
  const season = useSeason(game.month);

  return (
    <div className="hud">
      <div className="hud-strip">
        <button className="hud-icon-btn" title={t('board.pause')} aria-label={t('board.pause')} onClick={onPause}>
          <Icon name="pause" size={16} />
        </button>

        <div className={`hud-when season-${season.id}`}>
          <span className="hud-season"><SeasonIcon month={game.month} size={20} /></span>
          <div>
            <strong>{formatDate(game.month, lng)}</strong>
            <small>{season.label} · {formatAge(t, game.month)}</small>
          </div>
        </div>

        <span className="hud-sep" />

        <div className="hud-money has-pop" tabIndex={0}>
          <span className="hud-coin"><Icon name="coin" size={18} /></span>
          <div>
            <strong><Money value={game.money} /></strong>
            <Trend diff={balance}>{formatMoney(Math.abs(balance), lng)}</Trend>
          </div>
          <MoneyBreakdown game={game} />
        </div>

        {STATS.map((stat) => {
          const value = game.stats[stat.key];
          const diff = next[stat.key] - value;
          return (
            <div
              key={stat.key}
              className={`hud-meter has-pop${value < 25 ? ' low' : ''}`}
              tabIndex={0}
              style={{ '--hc': stat.color } as CSSProperties}
            >
              <div className="hud-meter-top">
                <Icon name={STAT_ICONS[stat.key] ?? 'heart'} size={14} />
                <span>{t(`stats.${stat.key}`)}</span>
                <b>{Math.round(value)}</b>
                <Trend diff={diff}>{formatSigned(Math.abs(diff), lng).replace(/^[+−]/, '')}</Trend>
              </div>
              <i className="hud-meter-bar"><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>
              <StatBreakdown game={game} stat={stat.key} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
