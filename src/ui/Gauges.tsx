import { useTranslation } from 'react-i18next';
import { STATS } from '../data/content';
import type { StatKey } from '../game/types';

type Stats = Record<StatKey, number>;

/** `next` = valeurs attendues le mois prochain avec le planning actuel (repère + flèche). */
export function Gauges({ stats, next }: { stats: Stats; next: Stats }) {
  const { t } = useTranslation();
  return (
    <div className="gauges">
      {STATS.map((st) => {
        const diff = next[st.key] - stats[st.key];
        const arrow = diff > 1 ? '▲' : diff < -1 ? '▼' : '=';
        return (
          <div className="gauge" key={st.key} title={t('gauge.next', { value: Math.round(next[st.key]) })}>
            <div className="label">
              <span>{st.icon} {t(`stats.${st.key}`)}</span>
              <span>
                {Math.round(stats[st.key])}{' '}
                <span className={diff > 1 ? 'good' : diff < -1 ? 'bad' : ''}>{arrow}</span>
              </span>
            </div>
            <div className="bar">
              <div style={{ width: `${stats[st.key]}%`, background: st.color }} />
              <i className="next-tick" style={{ left: `${next[st.key]}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
