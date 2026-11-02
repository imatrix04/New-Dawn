import { useTranslation } from 'react-i18next';
import { HOURS_PER_WEEK, TIME_CATS } from '../data/content';
import type { WeekBreakdown } from '../game/engine';
import { useAnimatedNumber } from './useAnimatedNumber';

const RADIUS = 44;
const C = 2 * Math.PI * RADIUS;

/**
 * Anneau des 168 h de la semaine : un arc par catégorie, qui glisse quand on règle un curseur.
 * Au centre, les heures restantes (vert) ou en trop (rouge, l'anneau pulse).
 */
export function WeekDonut({ week }: { week: WeekBreakdown }) {
  const { t } = useTranslation();
  const over = week.free < 0;
  const used = HOURS_PER_WEEK - week.free;
  const total = Math.max(HOURS_PER_WEEK, used); // en cas de dépassement, l'anneau est rempli à 100 %
  const hours = useAnimatedNumber(Math.abs(week.free), 500);

  let cumulated = 0;
  const arcs = TIME_CATS.map((cat) => {
    const h = Math.max(0, week[cat.id]);
    const len = (h / total) * C;
    const offset = -cumulated;
    cumulated += len;
    return { cat, h, len, offset };
  });

  return (
    <div className={`donut ${over ? 'over' : 'ok'}`} role="img" aria-label={`${Math.abs(week.free)} h`}>
      <svg viewBox="0 0 100 100">
        <circle className="donut-track" cx="50" cy="50" r={RADIUS} />
        {arcs.map(({ cat, h, len, offset }) => (
          <circle
            key={cat.id}
            className="donut-seg"
            cx="50" cy="50" r={RADIUS}
            stroke={cat.id === 'free' && over ? 'transparent' : cat.color}
            strokeDasharray={`${Math.max(0, len - 0.6)} ${C}`}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          >
            <title>{`${t(`schedule.cats.${cat.id}.label`)} : ${h} h`}</title>
          </circle>
        ))}
      </svg>
      <div className="donut-center">
        <span className="donut-num">{over ? '−' : ''}{Math.round(hours)}<small>h</small></span>
        <span className="donut-sub">{t(over ? 'schedule.overLabel' : 'schedule.remainingLabel')}</span>
      </div>
    </div>
  );
}
