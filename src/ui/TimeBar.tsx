import { useTranslation } from 'react-i18next';
import { TIME_CATS } from '../data/content';
import type { WeekBreakdown } from '../game/engine';

/** Barre empilée des 168 h de la semaine, une couleur par catégorie. */
export function TimeBar({ week }: { week: WeekBreakdown }) {
  const { t } = useTranslation();
  return (
    <div className="timebar">
      {TIME_CATS.map((c) => {
        const hours = Math.max(0, week[c.id]);
        if (hours === 0) return null;
        return (
          <div
            key={c.id}
            style={{ flexGrow: hours, background: c.color }}
            title={`${t(`schedule.cats.${c.id}.label`)} : ${hours} h`}
          />
        );
      })}
    </div>
  );
}
