import { useTranslation } from 'react-i18next';
import { companyById, jobById } from '../game/engine';
import type { GameState } from '../game/types';
import { formatMoney } from '../i18n/format';
import { useStore } from '../store';

/** Alerte de début de mois : réponses aux candidatures. Les offres acceptées sont à prendre tout de suite ou à laisser. */
export function JobDecisionPanel({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const resolveJobDecision = useStore((s) => s.resolveJobDecision);
  const decision = game.jobDecision;
  if (!decision) return null;

  const name = (id: string) => t(`jobs.${id}`, { context: game.gender });
  const current = jobById(game.job);

  return (
    <div className="panel">
      <h2>{t('jobDecision.title')}</h2>
      <p>{t(decision.accepted.length ? 'jobDecision.textAccepted' : 'jobDecision.textRefused')}</p>

      {decision.refused.length > 0 && (
        <>
          <h3>{t('jobDecision.refused')}</h3>
          <ul>
            {decision.refused.map((id) => <li key={id}>❌ {name(id)}</li>)}
          </ul>
        </>
      )}

      {decision.accepted.length > 0 && (
        <>
          <h3>{t('jobDecision.accepted')}</h3>
          <div className="choices">
            {decision.accepted.map((o) => {
              const company = companyById(o.companyId);
              return (
                <button key={o.jobId} onClick={() => resolveJobDecision(o.jobId)}>
                  ✅ {name(o.jobId)}{company ? ` — ${company.name}` : ''}
                  <small>{t('career.perMonth', { amount: formatMoney(o.salary, i18n.language) })}</small>
                </button>
              );
            })}
          </div>
          <p className="muted small">{t('jobDecision.nowOrNever')}</p>
        </>
      )}

      <div className="choices">
        <button onClick={() => resolveJobDecision(null)}>
          {decision.accepted.length === 0
            ? t('jobDecision.ok')
            : current ? t('jobDecision.stay', { job: name(current.id) }) : t('jobDecision.stayJobless')}
        </button>
      </div>
    </div>
  );
}
