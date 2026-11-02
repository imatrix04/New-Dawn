import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatDef } from '../game/types';
import { formatSigned } from '../i18n/format';
import { useAnimatedNumber } from './useAnimatedNumber';

interface GaugeProps {
  stat: StatDef;
  value: number;
  /** Valeur attendue le mois prochain avec le planning actuel. */
  next: number;
}

const RADIUS = 42;
const GHOST_RADIUS = 33;
const circumference = (r: number) => 2 * Math.PI * r;

/** Tendance affichée sous la jauge : flèche + variation prévue. */
function Trend({ diff, compact = false }: { diff: number; compact?: boolean }) {
  const { i18n } = useTranslation();
  const tone = diff > 0.05 ? 'good' : diff < -0.05 ? 'bad' : '';
  const arrow = diff > 0.05 ? '▲' : diff < -0.05 ? '▼' : '=';
  return <span className={`trend ${tone}`}>{compact ? arrow : `${arrow} ${formatSigned(diff, i18n.language)}`}</span>;
}

/** Anneau animé (santé, bonheur) : le chiffre est au centre, l'arc fin intérieur montre le mois prochain. */
export function RingGauge({ stat, value, next }: GaugeProps) {
  const { t } = useTranslation();
  const shown = useAnimatedNumber(value);
  const shownNext = useAnimatedNumber(next);
  const c = circumference(RADIUS);
  const cGhost = circumference(GHOST_RADIUS);

  return (
    <div
      className={`ring${value < 25 ? ' low' : ''}`}
      style={{ '--ring-color': stat.color } as CSSProperties}
      title={t('gauge.next', { value: Math.round(next) })}
    >
      <div className="ring-dial">
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle className="ring-track" cx="50" cy="50" r={RADIUS} />
          <circle
            className="ring-ghost" cx="50" cy="50" r={GHOST_RADIUS}
            strokeDasharray={cGhost} strokeDashoffset={cGhost * (1 - shownNext / 100)}
            transform="rotate(-90 50 50)"
          />
          <circle
            className="ring-arc" cx="50" cy="50" r={RADIUS}
            strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="ring-num">{Math.round(shown)}</span>
      </div>
      <div className="ring-label">{stat.icon} {t(`stats.${stat.key}`)}</div>
      <Trend diff={next - value} />
    </div>
  );
}
