import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { GIGS, JOBS, OFFERS_MAX, TRAININGS } from '../data/content';
import { experienceMonths, hireChance, jobById, jobEligibility, scheduleEffects } from '../game/engine';
import type { GameState, Qualification, SkillId } from '../game/types';
import { formatMoney } from '../i18n/format';
import { useStore } from '../store';

type Tab = 'gigs' | 'offers' | 'quick' | 'training';
const TABS: Tab[] = ['gigs', 'offers', 'quick', 'training'];

/** Contenu de la carte « Carrière » : poste actuel, puis boulots rapides, offres, formations rapides et formations. */
export function CareerCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('offers');
  const current = jobById(game.job);
  const jobName = (id: string) => t(`jobs.${id}`, { context: game.gender });
  const jobInfo = (id: string) => {
    const j = jobById(id)!;
    return t('create.jobInfo', { salary: j.salary, hours: j.hours, commute: j.commute });
  };

  return (
    <div className="career">
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

      <nav className="career-nav" aria-label={t('windows.career')}>
        {TABS.map((id) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(`career.tabs.${id}`)}
          </button>
        ))}
      </nav>

      {tab === 'gigs' && <Gigs game={game} />}
      {tab === 'offers' && <Offers game={game} jobName={jobName} jobInfo={jobInfo} />}
      {tab === 'quick' && <Trainings game={game} quick />}
      {tab === 'training' && <Trainings game={game} quick={false} />}
    </div>
  );
}

/** Petits boulots toujours disponibles : un seul à la fois, payés chaque mois. */
function Gigs({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setGig } = useStore();
  return (
    <section className="csec">
      <p className="muted small">{t('career.gigsHint')}</p>
      <div className="job-list">
        {GIGS.map((gig, i) => {
          const active = game.gig === gig.id;
          return (
            <div className={`job-row ${active ? 'current' : 'open'}`} key={gig.id} style={{ animationDelay: `${i * 35}ms` }}>
              <div className="job-top">
                <span className="job-name">{gig.icon} {t(`gigs.${gig.id}.name`)}</span>
                {active ? (
                  <button className="mini-btn secondary" onClick={() => setGig(null)}>{t('career.gigStop')}</button>
                ) : (
                  <button className="mini-btn" onClick={() => setGig(gig.id)}>{t('career.gigStart')}</button>
                )}
              </div>
              <span className="job-meta">{t(`gigs.${gig.id}.desc`)}</span>
              <span className="job-meta">
                {t('career.gigInfo', { pay: formatMoney(gig.pay, i18n.language), hours: gig.hours, commute: gig.commute })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Offres visibles : limitées, aléatoires, et renouvelées par les heures de recherche d'emploi. */
function Offers({ game, jobName, jobInfo }: { game: GameState; jobName: (id: string) => string; jobInfo: (id: string) => string }) {
  const { t } = useTranslation();
  const { setJobTarget } = useStore();
  const perMonth = scheduleEffects(game.schedule).searchOffers;

  const qualText = (q: Qualification) =>
    q.type === 'experience'
      ? `${t('career.req.experience', { months: q.months, field: t(`fields.${q.field}`) })} (${Math.min(experienceMonths(game, q.field), q.months)}/${q.months})`
      : t(`trainings.${q.id}.name`);

  return (
    <section className="csec">
      <p className="muted small">{t('career.offersHint')}</p>
      <div className="offers-meta">
        <span>{t('career.offersCount', { count: game.offers.length, max: OFFERS_MAX })}</span>
        <span className={perMonth > 0 ? 'good' : 'muted'}>{t('career.searchRate', { count: perMonth })}</span>
      </div>
      {game.offers.length === 0 && <p className="muted small">{t('career.noOffers')}</p>}
      <div className="job-list">
        {game.offers.map((offer, i) => {
          const job = JOBS.find((j) => j.id === offer.jobId);
          if (!job) return null;
          const elig = jobEligibility(game, job);
          const isTarget = job.id === game.jobTarget;
          const state = isTarget ? 'target' : elig.ok ? 'open' : 'locked';
          const skillReqs = Object.entries(job.minSkills ?? {}) as [SkillId, number][];
          return (
            <div className={`job-row ${state}`} key={job.id} style={{ animationDelay: `${i * 35}ms` }}>
              <div className="job-top">
                <span className="job-name">{jobName(job.id)}</span>
                {isTarget && (
                  <button className="mini-btn secondary" onClick={() => setJobTarget(null)}>{t('career.cancel')}</button>
                )}
                {state === 'open' && (
                  <button className="mini-btn" onClick={() => setJobTarget(job.id)}>{t('career.apply')}</button>
                )}
                {state === 'locked' && <span className="status-badge locked">{t('career.status.locked')}</span>}
              </div>
              <span className="job-meta">{jobInfo(job.id)}</span>
              <span className={`job-meta${offer.monthsLeft <= 1 ? ' warn' : ''}`}>
                {t('career.expiresIn', { count: offer.monthsLeft })}
                {elig.ok && ` • ${t('career.chance', { pct: Math.round(hireChance(game, job) * 100) })}`}
              </span>
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
              {isTarget && <span className="job-meta target-note">{t('career.applyNote')}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Formations : rapides (certificats) ou longues (diplômes). Une seule formation à la fois. */
function Trainings({ game, quick }: { game: GameState; quick: boolean }) {
  const { t, i18n } = useTranslation();
  const { enrollTraining, dropTraining } = useStore();
  const lng = i18n.language;

  return (
    <section className="csec">
      <p className="muted small">{t(quick ? 'career.quickHint' : 'career.trainingHint')}</p>
      {Object.entries(TRAININGS).filter(([, cfg]) => !!cfg.quick === quick).map(([id, cfg]) => {
        const done = game.diplomas.includes(id);
        const active = game.training?.id === id ? game.training : null;
        const lowStudy = active && game.schedule.study < cfg.minStudyHours;
        const unlocks = JOBS.filter((j) => j.anyOf?.some((q) => q.type === 'diploma' && q.id === id));
        const gains = Object.entries(cfg.skills ?? {}) as [SkillId, number][];
        return (
          <div className={`train${done ? ' done' : ''}`} key={id} style={{ '--c': 'var(--accent)' } as CSSProperties}>
            <div className="job-top">
              <strong>{done ? '🎓 ' : ''}{t(`trainings.${id}.name`)}</strong>
              {done && <span className="status-badge current">{t(quick ? 'career.certified' : 'career.diploma')}</span>}
            </div>
            <span className="job-meta">{t(`trainings.${id}.desc`)}</span>
            <span className="job-meta">
              {t('career.trainingInfo', { months: cfg.months, tuition: formatMoney(cfg.tuition, lng), hours: cfg.minStudyHours })}
            </span>
            {quick && (
              <div className="reqs">
                {gains.map(([skill, v]) => (
                  <span className="req ok" key={skill}>+{v} {t(`skills.${skill}.name`)}</span>
                ))}
                {cfg.hireBonus && (
                  <span className="req ok">
                    {t('career.hireBonus', { pct: Math.round(cfg.hireBonus.bonus * 100), field: t(`fields.${cfg.hireBonus.field}`) })}
                  </span>
                )}
                {unlocks.map((j) => (
                  <span className="req ok" key={j.id}>{t('career.unlocks', { job: t(`jobs.${j.id}`, { context: game.gender }) })}</span>
                ))}
              </div>
            )}
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
            {!done && !active && (
              <button className="mini-btn" disabled={game.training !== null} onClick={() => enrollTraining(id)}>
                {t('career.enroll')}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
