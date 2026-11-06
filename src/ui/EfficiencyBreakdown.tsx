import { useTranslation } from 'react-i18next';
import { EFFICIENCY, PROMOTIONS } from '../data/content';
import { efficiencyLines, type EfficiencyLine } from '../game/engine';
import type { GameState } from '../game/types';
import { formatSigned } from '../i18n/format';

/** Détail du gain d'efficacité du mois : style, heures sautées, fatigue, épuisement ; avec l'objectif de promotion. */
export function EfficiencyBreakdown({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const lines = efficiencyLines(game);
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const next = Math.min(100, Math.max(0, game.efficiency + total));
  const label = (l: EfficiencyLine): string =>
    l.kind === 'style' ? t('work.lines.style', { style: t(`work.styles.${game.workStyle}.name`).toLowerCase() }) : t(`work.lines.${l.kind}`);
  const tone = (n: number) => (n > 0 ? 'good' : 'bad');
  const promotion = game.job ? PROMOTIONS[game.job] : undefined;

  return (
    <div className="money-pop stat-pop" role="tooltip">
      <section>
        <h5>{t('work.efficiency')} <b>{Math.round(game.efficiency)} → {Math.round(next)}</b></h5>
        {game.sickLeave > 0 && <p className="warn-note">{t('work.sick', { count: game.sickLeave })}</p>}
        {game.zeroMonths > 0 && <p className="warn-note">{t('work.zeroWarning')}</p>}
        {game.sickLeave === 0 && lines.map((l) => (
          <div className={`money-pop-row${l.kind === 'strain' ? ' strain-row' : ''}`} key={l.kind}>
            <span>{label(l)}</span><b className={tone(l.amount)}>{formatSigned(l.amount, lng)}</b>
          </div>
        ))}
      </section>
      {game.sickLeave === 0 && (
        <footer>
          <span>{t('statLines.total')}</span>
          <b className={total === 0 ? '' : tone(total)}>{formatSigned(total, lng)}</b>
        </footer>
      )}
      {promotion && <p className="muted pop-note">{t('work.promotionAt', { n: EFFICIENCY.promoteAt })}</p>}
    </div>
  );
}
