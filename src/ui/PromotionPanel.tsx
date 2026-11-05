import { useTranslation } from 'react-i18next';
import { PROMOTIONS, TRAININGS } from '../data/content';
import { companyById, jobById, jobEligibility, salaryAt } from '../game/engine';
import type { GameState } from '../game/types';
import { formatMoney } from '../i18n/format';
import { useStore } from '../store';

/** Alerte de promotion : l'employeur propose un poste de manager, que le joueur accepte ou refuse. */
export function PromotionPanel({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const resolvePromotion = useStore((s) => s.resolvePromotion);
  const to = jobById(game.promotion);
  const rule = PROMOTIONS[game.job ?? ''];
  if (!to || !rule) return null;

  const name = (id: string) => t(`jobs.${id}`, { context: game.gender });
  const company = companyById(game.jobCompany);
  const needsTraining = !!rule.training && !jobEligibility(game, to).qualified;
  const busy = needsTraining && game.training !== null;

  return (
    <div className="panel">
      <h2>{t('promotion.title')}</h2>
      <p>{t('promotion.text', { job: name(to.id), company: company?.name ?? t('promotion.yourEmployer') })}</p>
      <p>
        <strong>{name(to.id)}</strong> • {t('career.perMonth', { amount: formatMoney(salaryAt(to, company), i18n.language) })}
        {' • '}{t('schedule.perWeek', { hours: to.hours })}
      </p>
      <p className="muted small">
        {!rule.training
          ? t('promotion.noTraining')
          : needsTraining
            ? t('promotion.training', { training: t(`trainings.${rule.training}.name`), count: TRAININGS[rule.training].months })
            : t('promotion.trained')}
      </p>
      {busy && <p className="muted small">{t('promotion.busy')}</p>}
      <div className="choices">
        <button disabled={busy} onClick={() => resolvePromotion(true)}>{t('promotion.accept')}</button>
        <button onClick={() => resolvePromotion(false)}>{t('promotion.refuse')}</button>
      </div>
    </div>
  );
}
