import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { JOBS, TRAININGS } from '../data/content';
import { experienceMonths, jobById, jobEligibility } from '../game/engine';
import type { GameState, Qualification, SkillId } from '../game/types';
import { formatMoney } from '../i18n/format';
import { useStore } from '../store';

/** Contenu de la carte « Carrière » : poste actuel, postes visés et formation. L'expérience est dans le Profil. */
export function CareerCard({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setJobTarget, enrollTraining, dropTraining } = useStore();
  const lng = i18n.language;
  const current = jobById(game.job);
  const jobName = (id: string) => t(`jobs.${id}`, { context: game.gender });
  const jobInfo = (id: string) => {
    const j = jobById(id)!;
    return t('create.jobInfo', { salary: j.salary, hours: j.hours, commute: j.commute });
  };

  const qualText = (q: Qualification) =>
    q.type === 'experience'
      ? `${t('career.req.experience', { months: q.months, field: t(`fields.${q.field}`) })} (${Math.min(experienceMonths(game, q.field), q.months)}/${q.months})`
      : t(`trainings.${q.id}.name`);

  return (
    <div className="career">
      <p className="muted small">{t('career.hint')}</p>

      <section className="csec">
        <h3>{t('career.current')}</h3>
        <div className="cur-job">
          {current ? (
            <>
              <strong>{jobName(current.id)}</strong>
              <span className="muted">{jobInfo(current.id)}</span>
            </>
          ) : (
            <span className="muted">{t('game.noJob')}</span>
          )}
        </div>
      </section>

      <section className="csec">
        <h3>{t('career.jobs')}</h3>
        <div className="job-list">
          {JOBS.map((job, i) => {
            const elig = jobEligibility(game, job);
            const isCurrent = job.id === game.job;
            const isTarget = job.id === game.jobTarget;
            const state = isCurrent ? 'current' : isTarget ? 'target' : elig.ok ? 'open' : 'locked';
            const skillReqs = Object.entries(job.minSkills ?? {}) as [SkillId, number][];
            return (
              <div className={`job-row ${state}`} key={job.id} style={{ animationDelay: `${i * 35}ms` }}>
                <div className="job-top">
                  <span className="job-name">{jobName(job.id)}</span>
                  {isCurrent && <span className="status-badge current">{t('career.status.current')}</span>}
                  {isTarget && (
                    <button className="mini-btn secondary" onClick={() => setJobTarget(null)}>
                      {t('career.cancel')}
                    </button>
                  )}
                  {state === 'open' && (
                    <button className="mini-btn" onClick={() => setJobTarget(job.id)}>{t('career.aim')}</button>
                  )}
                  {state === 'locked' && <span className="status-badge locked">{t('career.status.locked')}</span>}
                </div>
                <span className="job-meta">{jobInfo(job.id)}</span>
                {(skillReqs.length > 0 || job.anyOf) && (
                  <div className="reqs">
                    {skillReqs.map(([skill, min]) => {
                      const have = game.skills[skill];
                      const ok = have >= min;
                      return (
                        <span className={`req ${ok ? 'ok' : 'no'}`} key={skill}>
                          {ok ? '✓' : '✗'} {t(`skills.${skill}.name`)} {min}
                          {!ok && ` (${Math.floor(have)}/${min})`}
                        </span>
                      );
                    })}
                    {job.anyOf && (
                      <span className={`req ${elig.qualified ? 'ok' : 'no'}`}>
                        {elig.qualified ? '✓' : '✗'} {job.anyOf.map(qualText).join(t('career.req.or'))}
                      </span>
                    )}
                  </div>
                )}
                {isTarget && <span className="job-meta target-note">{t('career.targetNote')}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="csec">
        <h3>{t('career.training')}</h3>
        {Object.entries(TRAININGS).map(([id, cfg]) => {
          const diploma = game.diplomas.includes(id);
          const active = game.training?.id === id ? game.training : null;
          const lowStudy = active && game.schedule.study < cfg.minStudyHours;
          return (
            <div className={`train${diploma ? ' done' : ''}`} key={id} style={{ '--c': 'var(--accent)' } as CSSProperties}>
              <div className="job-top">
                <strong>{diploma ? '🎓 ' : ''}{t(`trainings.${id}.name`)}</strong>
                {diploma && <span className="status-badge current">{t('career.diploma')}</span>}
              </div>
              <span className="job-meta">{t(`trainings.${id}.desc`)}</span>
              <span className="job-meta">
                {t('career.trainingInfo', { months: cfg.months, tuition: formatMoney(cfg.tuition, lng), hours: cfg.minStudyHours })}
              </span>
              {active && (
                <>
                  <div className="xp-head">
                    <span>{t('career.progress')}</span>
                    <span className="muted">{t('career.monthsOf', { done: active.monthsDone, total: cfg.months })}</span>
                  </div>
                  <div className="meter"><div style={{ width: `${(active.monthsDone / cfg.months) * 100}%` }} /></div>
                  {lowStudy && (
                    <span className="job-meta warn">
                      {t('career.lowStudy', { hours: cfg.minStudyHours, current: game.schedule.study })}
                    </span>
                  )}
                  <button className="mini-btn secondary" onClick={dropTraining}>{t('career.drop')}</button>
                </>
              )}
              {!diploma && !active && (
                <button className="mini-btn" disabled={game.training !== null} onClick={() => enrollTraining(id)}>
                  {t('career.enroll')}
                </button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
