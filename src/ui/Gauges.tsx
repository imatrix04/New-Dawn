import { useTranslation } from 'react-i18next';
import { STATS } from '../data/content';
import type { StatKey } from '../game/types';

export function Gauges({ stats }: { stats: Record<StatKey, number> }) {
  const { t } = useTranslation();
  return (
    <div className="gauges">
      {STATS.map((st) => (
        <div className="gauge" key={st.key}>
          <div className="label">
            <span>{st.icon} {t(`stats.${st.key}`)}</span>
            <span>{Math.round(stats[st.key])}</span>
          </div>
          <div className="bar">
            <div style={{ width: `${stats[st.key]}%`, background: st.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
