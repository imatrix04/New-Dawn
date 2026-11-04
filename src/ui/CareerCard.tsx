import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOG_REFRESH_MONTHS, GIGS, JOBS, OFFERS_MAX, TRAININGS } from '../data/content';
import { experienceMonths, hireBreakdown, hireChance, jobById, jobEligibility, scheduleEffects } from '../game/engine';
import type { Drawback, GameState, Job, Qualification, SkillId } from '../game/types';
import { formatMoney, formatSigned } from '../i18n/format';
import { useStore } from '../store';

type Tab = 'gigs' | 'offers' | 'quick' | 'training';
const TABS: Tab[] = ['gigs', 'offers', 'quick', 'training'];

/** Désavantages mensuels sur la santé et le bonheur, en pastilles rouges. */
function Drawbacks({ fx }: { fx: Drawback }) {
  const { t, i18n } = useTranslation();
  const entries = (['health', 'happiness'] as const).filter((k) => fx[k]);
  if (!entries.length) return null;
  return (
    <>
      {entries.map((k) => (
        <span className="req no" key={k}>{t(`schedule.effect.${k}`, { delta: formatSigned(fx[k]!, i18n.language) })}</span>
      ))}
    </>
  );
}

/** Rappel que le catalogue se renouvelle tous les 6 mois. */
function RefreshNote({ game }: { game: GameState }) {
  const { t } = useTranslation();
  return <p className="muted small">{t('career.refreshIn', { count: CATALOG_REFRESH_MONTHS - (game.month % CATALOG_REFRESH_MONTHS) })}</p>;
}

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
              <div className="reqs"><Drawbacks fx={current.drawback} /></div>
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
      <RefreshNote game={game} />
      <div className="card-grid">
        {GIGS.filter((g) => game.catalog.gigs.includes(g.id)).map((gig, i) => {
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
              <div className="reqs"><Drawbacks fx={gig.drawback} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Offres visibles : limitées, aléatoires, et renouvelées par les heures de recherche d'emploi. */
function Offers({ game, jobName, jobInfo }: { game: GameState; jobName: (id: string) => string; jobInfo: (id: string) => string }) {
  const { t, i18n } = useTranslation();
  const { setJobTarget } = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const perMonth = scheduleEffects(game.schedule).searchOffers;
  const lng = i18n.language;
  const detail = game.offers.some((o) => o.jobId === selected) ? JOBS.find((j) => j.id === selected) ?? null : null;

  const qualText = (q: Qualification) =>
    q.type === 'experience'
      ? `${t('career.req.experience', { months: q.months, field: t(`fields.${q.field}`) })} (${Math.min(experienceMonths(game, q.field), q.months)}/${q.months})`
      : t(`trainings.${q.id}.name`);

  /** Conditions du poste (compétences, qualification), en pastilles vertes ou rouges. */
  const requirements = (job: Job) => {
    const elig = jobEligibility(game, job);
    const skillReqs = Object.entries(job.minSkills ?? {}) as [SkillId, number][];
    return (
      <>
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
      </>
    );
  };

  const pct = (n: number) => `${Math.round(n * 100)} %`;

  return (
    <section className="csec">
      <p className="muted small">{t('career.offersHint')}</p>
      <div className="offers-meta">
        <span>{t('career.offersCount', { count: game.offers.length, max: OFFERS_MAX })}</span>
        <span className={perMonth > 0 ? 'good' : 'muted'}>{t('career.searchRate', { count: perMonth })}</span>
      </div>
      {game.offers.length === 0 && <p className="muted small">{t('career.noOffers')}</p>}

      {detail ? (
        <JobDetail
          key={detail.id}
          game={game}
          job={detail}
          name={jobName(detail.id)}
          info={jobInfo(detail.id)}
          requirements={requirements(detail)}
          pct={pct}
          onApply={() => setJobTarget(detail.id)}
          onCancel={() => setJobTarget(null)}
          onClose={() => setSelected(null)}
        />
      ) : (
        game.offers.length > 0 && <p className="muted small">{t('career.pickOffer')}</p>
      )}

      <div className="card-grid">
        {game.offers.map((offer, i) => {
          const job = JOBS.find((j) => j.id === offer.jobId);
          if (!job) return null;
          const elig = jobEligibility(game, job);
          const isTarget = job.id === game.jobTarget;
          const chance = hireChance(game, job);
          const state = isTarget ? 'target' : elig.ok ? 'open' : 'locked';
          const toggle = () => setSelected(selected === job.id ? null : job.id);
          return (
            <div
              className={`job-row job-card ${state}${selected === job.id ? ' selected' : ''}`}
              key={job.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected === job.id}
              style={{ animationDelay: `${i * 35}ms` }}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              <span className="job-name">{jobName(job.id)}</span>
              <span className="job-meta">{t('career.salaryShort', { salary: formatMoney(job.salary, lng) })}</span>
              <span className={`job-meta${offer.monthsLeft <= 1 ? ' warn' : ''}`}>{t('career.expiresIn', { count: offer.monthsLeft })}</span>
              {elig.ok ? (
                <div
                  className="meter chance"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(chance * 100)}
                  aria-label={t('career.chanceLabel')}
                  title={`${t('career.chanceLabel')} : ${pct(chance)}`}
                >
                  <div style={{ width: `${chance * 100}%` }} />
                </div>
              ) : (
                <span className="status-badge locked">{t('career.status.locked')}</span>
              )}
              {isTarget && <span className="status-badge current">{t('career.applied')}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface JobDetailProps {
  game: GameState;
  job: Job;
  name: string;
  info: string;
  requirements: ReactNode;
  pct: (n: number) => string;
  onApply: () => void;
  onCancel: () => void;
  onClose: () => void;
}

/** Carte qui s'ouvre quand on sélectionne une offre : conditions, détail de la chance d'embauche et bouton Postuler. */
function JobDetail({ game, job, name, info, requirements, pct, onApply, onCancel, onClose }: JobDetailProps) {
  const { t } = useTranslation();
  const elig = jobEligibility(game, job);
  const isTarget = job.id === game.jobTarget;
  const breakdown = hireBreakdown(game, job);

  return (
    <div className="job-detail">
      <div className="job-top">
        <strong>{name}</strong>
        <button className="icon-close" onClick={onClose} aria-label={t('career.close')}>×</button>
      </div>
      <span className="job-meta">{info}</span>
      <div className="reqs">
        <Drawbacks fx={job.drawback} />
        {requirements}
      </div>

      {elig.ok && (
        <div className="chance-box">
          <h4>{t('career.detail.title')}</h4>
          <ul className="chance-list">
            <li><span>{t('career.detail.base', { grade: job.grade })}</span><b>{pct(breakdown.base)}</b></li>
            {breakdown.bonuses.map((b) => (
              <li className="plus" key={b.type === 'training' ? b.id : 'experience'}>
                <span>
                  {b.type === 'training'
                    ? t('career.detail.training', { name: t(`trainings.${b.id}.name`) })
                    : t('career.detail.experience', { months: b.months, field: t(`fields.${b.field}`) })}
                </span>
                <b>+{pct(b.value)}</b>
              </li>
            ))}
            <li className="total"><span>{t('career.chanceLabel')}</span><b>{pct(breakdown.total)}</b></li>
          </ul>
          <div className="meter chance big"><div style={{ width: `${breakdown.total * 100}%` }} /></div>
        </div>
      )}

      {isTarget ? (
        <>
          <span className="job-meta target-note">{t('career.applyNote')}</span>
          <button className="mini-btn secondary" onClick={onCancel}>{t('career.cancel')}</button>
        </>
      ) : elig.ok ? (
        <button className="mini-btn" onClick={onApply}>{t('career.apply')}</button>
      ) : (
        <span className="job-meta warn">{t('career.lockedNote')}</span>
      )}
    </div>
  );
}

/** Formations : rapides (certificats) ou longues (diplômes). Une seule formation à la fois. */
function Trainings({ game, quick }: { game: GameState; quick: boolean }) {
  const { t, i18n } = useTranslation();
  const { enrollTraining, dropTraining } = useStore();
  const lng = i18n.language;
  const visible = quick ? game.catalog.quick : game.catalog.training;
  // Les diplômes déjà obtenus restent affichés jusqu'au prochain renouvellement du catalogue.
  const list = Object.entries(TRAININGS).filter(([id, cfg]) => !!cfg.quick === quick && visible.includes(id));

  return (
    <section className="csec">
      <p className="muted small">{t(quick ? 'career.quickHint' : 'career.trainingHint')}</p>
      <RefreshNote game={game} />
      {list.length === 0 && <p className="muted small">{t('career.noneLeft')}</p>}
      <div className="card-grid">
      {list.map(([id, cfg]) => {
        const done = game.diplomas.includes(id);
        const active = game.training?.id === id ? game.training : null;
        const lowStudy = active && game.schedule.study < cfg.minStudyHours;
        const unlocks = JOBS.filter((j) => j.anyOf?.some((q) => q.type === 'diploma' && q.id === id));
        const missing = (cfg.requires ?? []).filter((r) => !game.diplomas.includes(r));
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
            <div className="reqs"><Drawbacks fx={cfg.drawback} /></div>
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
            {missing.length > 0 && !done && (
              <span className="job-meta warn">
                {t('career.requires', { names: missing.map((r) => t(`trainings.${r}.name`)).join(', ') })}
              </span>
            )}
            {!done && !active && (
              <button className="mini-btn" disabled={game.training !== null || missing.length > 0} onClick={() => enrollTraining(id)}>
                {t('career.enroll')}
              </button>
            )}
          </div>
        );
      })}
      </div>
    </section>
  );
}
