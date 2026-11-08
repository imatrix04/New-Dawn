import { useTranslation } from 'react-i18next';
import { REPUTATION } from '../data/content';
import { companyById, reputationLevel } from '../game/engine';
import type { GameState } from '../game/types';

/** Réputation de manager (0 à 100) et références laissées par les postes de management quittés. */
export function ReputationBox({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const rep = game.reputation ?? 0;
  const level = reputationLevel(rep);
  const next = REPUTATION.levels[level + 1];
  const refs = game.references ?? [];
  return (
    <section className="chance-box reputation-box">
      <h4>{t('reputation.title')}</h4>
      <div className="xp-head">
        <strong>⭐ {t(`reputation.level.${level}`)}</strong>
        <span className="muted">{next === undefined ? t('reputation.max') : t('reputation.next', { pts: Math.round(rep), next })}</span>
      </div>
      <div className="meter"><div style={{ width: `${Math.max(2, rep)}%` }} /></div>
      <p className="muted small">{t('reputation.hint')}</p>
      <h4>{t('reputation.refs')}</h4>
      {refs.length === 0 ? (
        <p className="muted small">{t('reputation.noRefs', { count: REPUTATION.minMonths })}</p>
      ) : (
        <ul className="ref-list">
          {[...refs].reverse().map((r, i) => (
            <li key={i}>
              <span>{t(`jobs.${r.jobId}`, { context: game.gender })}{companyById(r.company) ? ` · ${companyById(r.company)!.name}` : ''} <span className="muted">({t('profile.months', { count: r.months })})</span></span>
              <span className={`req ${r.rating === 'poor' ? 'no' : r.rating === 'excellent' ? 'ok' : ''}`}>{t(`reputation.rating.${r.rating}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
