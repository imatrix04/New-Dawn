import { useTranslation } from 'react-i18next';
import { projectNextStats, statEffectLines, type StatLine } from '../game/engine';
import type { GameState, StatKey } from '../game/types';
import { formatSigned } from '../i18n/format';

/** Détail de la variation du mois d'une jauge : une ligne par cause, puis le total. */
export function StatBreakdown({ game, stat }: { game: GameState; stat: StatKey }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const lines = statEffectLines(game, stat);
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const next = projectNextStats(game)[stat];
  const label = (l: StatLine): string => {
    switch (l.kind) {
      case 'job': return t('profile.sources.job', { name: t(`jobs.${l.id}`, { context: game.gender }) });
      case 'gig': return t('profile.sources.gig', { name: t(`gigs.${l.id}.name`) });
      case 'training': return t('profile.sources.training', { name: t(`trainings.${l.id}.name`) });
      default: return t(`statLines.${l.kind}`);
    }
  };
  const tone = (n: number) => (n > 0 ? 'good' : 'bad');

  return (
    <div className="money-pop stat-pop" role="tooltip">
      <section>
        <h5>{t(`stats.${stat}`)} <b>{Math.round(game.stats[stat])} → {Math.round(next)}</b></h5>
        {lines.length === 0 && <p className="muted">{t('statLines.none')}</p>}
        {lines.map((l) => (
          <div className="money-pop-row" key={`${l.kind}-${l.id ?? ''}`}>
            <span>{label(l)}</span><b className={tone(l.amount)}>{formatSigned(l.amount, lng)}</b>
          </div>
        ))}
      </section>
      <footer>
        <span>{t('statLines.total')}</span>
        <b className={total === 0 ? '' : tone(total)}>{formatSigned(total, lng)}</b>
      </footer>
    </div>
  );
}
