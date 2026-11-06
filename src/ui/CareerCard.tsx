import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOG_REFRESH_MONTHS, GIGS, JOBS, MAX_APPLICATIONS, MAX_BLAMES, OFFERS_MAX, RAISE, TRAININGS } from '../data/content';
import type { Company, Gig, GigRequirement, TrainingConfig } from '../data/content';
import {
  blameChance, careerPath, companyById, currentSalary, experienceMonths, gigPay, gigUnlocked, hireBreakdown, hireChance, jobById, jobCommute, jobDrawback, jobEligibility,
  isApplied, probationLeft, raiseStatus, promotionAvailable, promotionRequestChance, promotionRequestWait, reviewMonths, scheduleEffects, trainingPrice,
} from '../game/engine';
import type { Drawback, GameState, Job, Qualification, SkillId } from '../game/types';
import { formatMoney, formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { ChanceBar, DetailHead, Facts, PercentPick, Split, Tile } from './cardKit';
import type { Rarity } from './cardKit';

type Tab = 'gigs' | 'offers' | 'quick' | 'training';
const TABS: Tab[] = ['gigs', 'offers', 'quick', 'training'];

/** Rareté : le grade pour un poste, la fréquence de retour au catalogue pour le reste. */
const rarityOfWeight = (weight: number): Rarity => (weight >= 4 ? 1 : weight === 3 ? 2 : weight === 2 ? 3 : 4);
const rarityOfJob = (job: Job): Rarity => Math.min(4, Math.max(1, job.grade)) as Rarity;

// ---------- Petits composants communs ----------

/** Désavantages mensuels sur la santé et le bonheur, en pastilles rouges. */
function Drawbacks({ fx }: { fx: Drawback }) {
  const { t, i18n } = useTranslation();
  const entries = (['health', 'happiness'] as const).filter((k) => fx[k]);
  return (
    <>
      {entries.map((k) => (
        <span className={`req ${fx[k]! > 0 ? 'ok' : 'no'}`} key={k}>{t(`schedule.effect.${k}`, { delta: formatSigned(fx[k]!, i18n.language) })}</span>
      ))}
    </>
  );
}

/** Rappel que le catalogue se renouvelle tous les 6 mois. */
function RefreshNote({ game }: { game: GameState }) {
  const { t } = useTranslation();
  return <p className="muted small">{t('career.refreshIn', { count: CATALOG_REFRESH_MONTHS - (game.month % CATALOG_REFRESH_MONTHS) })}</p>;
}

interface OfferView {
  job: Job;
  monthsLeft: number;
  salary: number;
  company: Company | null;
}

// ---------- Carte ----------

/** Contenu de la carte « Carrière » : boulots rapides, offres (le poste actuel en tête), formations rapides et études. */
export function CareerCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('offers');
  const [selection, setSelection] = useState<Record<Tab, string | null>>({ gigs: null, offers: null, quick: null, training: null });
  const jobName = (id: string) => t(`jobs.${id}`, { context: game.gender });

  const select = (id: string) => setSelection((s) => ({ ...s, [tab]: s[tab] === id ? null : id }));
  const props = { game, selected: selection[tab], onSelect: select };

  return (
    <div className="career">
      <nav className="career-nav" aria-label={t('windows.career')}>
        {TABS.map((id) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(`career.tabs.${id}`)}
          </button>
        ))}
      </nav>

      <div className="career-pane" key={tab}>
        {tab === 'gigs' && <Gigs {...props} />}
        {tab === 'offers' && <Offers {...props} jobName={jobName} />}
        {tab === 'quick' && <Trainings {...props} quick />}
        {tab === 'training' && <Trainings {...props} quick={false} />}
      </div>
    </div>
  );
}

interface PaneProps {
  game: GameState;
  selected: string | null;
  onSelect: (id: string) => void;
}

// ---------- Boulots rapides ----------

function Gigs({ game, selected, onSelect }: PaneProps) {
  const { t, i18n } = useTranslation();
  const { setGig } = useStore();
  const lng = i18n.language;
  const list = GIGS.filter((g) => game.catalog.gigs.includes(g.id));
  const gig = list.find((g) => g.id === selected);

  const gigReqText = (r: GigRequirement) =>
    'skill' in r
      ? `${t(`skills.${r.skill}.name`)} ${r.min} (${Math.min(Math.floor(game.skills[r.skill]), r.min)}/${r.min})`
      : t(`trainings.${r.diploma}.name`);

  const detail = (g: Gig) => {
    const active = game.gig === g.id;
    const unlocked = gigUnlocked(game, g);
    const gains = Object.entries(g.skills) as [SkillId, number][];
    return (
      <div className="detail" key={g.id} data-rarity={rarityOfWeight(g.weight)}>
        <DetailHead rarity={rarityOfWeight(g.weight)} title={`${g.icon} ${t(`gigs.${g.id}.name`)}`} subtitle={t(`gigs.${g.id}.desc`)} />
        <Facts rows={[
          [t('career.fact.pay'), t('career.perMonth', { amount: formatMoney(gigPay(game, g), lng) })],
          [t('career.fact.hours'), t('schedule.perWeek', { hours: g.hours })],
          [t('career.fact.commute'), t('schedule.perWeek', { hours: g.commute })],
        ]} />
        <div className="reqs">
          <Drawbacks fx={g.drawback} />
          {gains.map(([skill, v]) => (
            <span className="req ok" key={skill}>{t('career.gainPerMonth', { delta: formatSigned(v, lng), skill: t(`skills.${skill}.name`) })}</span>
          ))}
          {g.anyOf && (
            <span className={`req ${unlocked ? 'ok' : 'no'}`}>
              {unlocked ? '✓' : '✗'} {g.anyOf.map((r) => gigReqText(r)).join(t('career.req.or'))}
            </span>
          )}
        </div>
        {active ? (
          <button className="big-btn secondary" onClick={() => setGig(null)}>{t('career.gigStop')}</button>
        ) : unlocked ? (
          <button className="big-btn" onClick={() => setGig(g.id)}>{t('career.gigStart')}</button>
        ) : (
          <span className="job-meta warn">{t('career.gigLocked')}</span>
        )}
      </div>
    );
  };

  return (
    <section>
      <p className="muted small">{t('career.gigsHint')}</p>
      <RefreshNote game={game} />
      <Split
        title={t('career.select.gigs')}
        detail={gig ? detail(gig) : null}
        list={
          <div className="card-grid">
            {list.map((g, i) => (
              <Tile key={g.id} rarity={rarityOfWeight(g.weight)} index={i} selected={selected === g.id} state={game.gig === g.id ? 'current' : gigUnlocked(game, g) ? undefined : 'locked'} onSelect={() => onSelect(g.id)}>
                <span className="ctile-name">{g.icon} {t(`gigs.${g.id}.name`)}</span>
                <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(gigPay(game, g), lng) })}</span>
                <span className="ctile-meta">⏱ {t('schedule.perWeek', { hours: g.hours })}</span>
                {g.commute > 0 && <span className="ctile-meta">🚌 {t('career.commuteTile', { hours: g.commute })}</span>}
                {!gigUnlocked(game, g) && <span className="ctile-meta">🔒 {t('career.status.locked')}</span>}
                {game.gig === g.id && <span className="status-badge current">{t('career.status.active')}</span>}
              </Tile>
            ))}
          </div>
        }
      />
    </section>
  );
}

// ---------- Offres d'emploi ----------

/** Perspectives d'un poste : promotions possibles et délai, sans chiffres de salaire (au joueur de juger). */
function Prospects({ job, jobName }: { job: Job; jobName: (id: string) => string }) {
  const { t } = useTranslation();
  const steps = careerPath(job);
  if (steps.length === 0) return <p className="muted small">{t('career.prospects.none')}</p>;
  return (
    <div className="chance-box">
      <h4>{t('career.prospects.title')}</h4>
      <ol className="path-list">
        {steps.map((s) => (
          <li key={s.job.id}>
            <strong>{jobName(s.job.id)}</strong>
            <span className="path-meta">
              <span>⏳ {s.latest ? t('career.prospects.between', { from: s.months, to: s.latest }) : t('career.prospects.after', { count: s.months })}</span>
              {s.training && <span>🎓 {t(`trainings.${s.training}.name`)}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Poste actuel ----------

/** Supérieur et augmentation : on demande un pourcentage, le supérieur accepte, négocie ou refuse (son caractère se devine). */
function RaiseBox({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { requestRaise, answerRaiseOffer } = useStore();
  const [ask, setAsk] = useState(0.05);
  const boss = game.boss;
  if (!boss) return null;
  const lng = i18n.language;
  const status = raiseStatus(game);
  const salary = currentSalary(game);
  const money = (n: number) => formatMoney(n, lng);
  const pct = (n: number) => Math.round(n * 1000) / 10;
  const reply = game.raiseReply;

  return (
    <div className="chance-box raise-box">
      <h4>{t('raise.title')}</h4>
      <span className="job-meta">{t('raise.boss', { title: t(`raise.titles.${boss.title}`), name: boss.surname })}</span>
      {reply && <p className={`raise-reply ${reply.kind === 'approved' ? 'good' : reply.kind === 'refused' ? 'bad' : ''}`}>
        {t(`raise.reply.${reply.kind}.${boss.type}`, { pct: pct(reply.pct) })}
      </p>}

      {game.raiseOffer !== null ? (
        <>
          <span className="job-meta">{t('raise.offer', { pct: pct(game.raiseOffer), from: money(salary), to: money(Math.round(salary * (1 + game.raiseOffer))) })}</span>
          <div className="reqs">
            <button className="big-btn" onClick={() => answerRaiseOffer(true)}>{t('raise.accept')}</button>
            <button className="big-btn secondary" onClick={() => answerRaiseOffer(false)}>{t('raise.decline')}</button>
          </div>
        </>
      ) : status.canAsk ? (
        <>
          <PercentPick label={t('raise.ask')} value={ask} min={RAISE.minAsk} max={RAISE.maxAsk} onChange={setAsk} />
          <Facts rows={[[t('raise.newSalary'), t('career.perMonth', { amount: money(Math.round(salary * (1 + ask))) })]]} />
          <button className="big-btn" onClick={() => requestRaise(ask)}>{t('raise.request')}</button>
        </>
      ) : (
        <span className="job-meta warn">{t('raise.wait', { count: status.wait })}</span>
      )}
    </div>
  );
}


const CURRENT_JOB = '__current';

/** Détail du poste occupé : toujours en tête des offres, sans expiration. */
function CurrentJobDetail({ game, jobName }: { game: GameState; jobName: (id: string) => string }) {
  const { t, i18n } = useTranslation();
  const { quitJob, requestPromotion } = useStore();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const job = jobById(game.job);
  if (!job) return null;
  const company = companyById(game.jobCompany);
  const promotion = promotionAvailable(game);
  const promotionWait = promotionRequestWait(game);
  const probation = probationLeft(game);
  const next = careerPath(job)[0];
  const served = game.history[job.id] ?? 0;
  return (
    <div className="detail" data-rarity={rarityOfJob(job)}>
      <DetailHead rarity={rarityOfJob(job)} title={jobName(job.id)} source={company ? `🏢 ${company.name}` : undefined} />
      <Facts rows={[
        [t('career.fact.salary'), t('career.perMonth', { amount: formatMoney(currentSalary(game), i18n.language) })],
        [t('career.fact.hours'), t('schedule.perWeek', { hours: job.hours })],
        [t('career.fact.commute'), t('schedule.perWeek', { hours: jobCommute(job, company) })],
      ]} />
      <div className="reqs">
        <Drawbacks fx={jobDrawback(job, company)} />
        {probation > 0 && <span className="req no">{t('career.probation', { count: probation })}</span>}
        <span className={game.jobBlames > 0 ? 'req no' : 'req ok'}>{t('career.blames')} {Math.min(game.jobBlames, MAX_BLAMES)} / {MAX_BLAMES}</span>
      </div>
      {next && (
        <div className="progress-box">
          <div className="xp-head">
            <span>{t('career.prospects.progress', { job: jobName(next.job.id) })}</span>
            <span className="muted">{t('career.monthsOf', { done: Math.min(served, next.months), total: next.months })}</span>
          </div>
          <div className="meter"><div style={{ width: `${Math.min(1, served / next.months) * 100}%` }} /></div>
        </div>
      )}
      <Prospects job={job} jobName={jobName} />
      <RaiseBox game={game} />
      {promotion && (
        <>
          <span className="job-meta">{t('career.promotion.chance', { job: jobName(promotion.to.id), pct: Math.round(promotionRequestChance(game) * 100) })}</span>
          {promotionWait > 0 && <span className="job-meta warn">{t('career.promotion.wait', { count: promotionWait })}</span>}
          <button className="big-btn" disabled={promotionWait > 0} onClick={requestPromotion}>{t('career.promotion.ask')}</button>
        </>
      )}
      {confirmQuit ? (
        <div className="reqs">
          <button className="big-btn secondary" onClick={() => { quitJob(); setConfirmQuit(false); }}>{t('career.quitConfirm')}</button>
          <button className="big-btn secondary" onClick={() => setConfirmQuit(false)}>{t('career.cancel')}</button>
        </div>
      ) : (
        <button className="big-btn secondary" onClick={() => setConfirmQuit(true)}>{t('career.quit')}</button>
      )}
    </div>
  );
}

function Offers({ game, selected, onSelect, jobName }: PaneProps & { jobName: (id: string) => string }) {
  const { t, i18n } = useTranslation();
  const { toggleApplication } = useStore();
  const lng = i18n.language;
  const full = game.applications.length >= MAX_APPLICATIONS;
  const perMonth = scheduleEffects(game.schedule).searchOffers;
  const offers = game.offers.flatMap((o) => {
    const job = JOBS.find((j) => j.id === o.jobId);
    return job ? [{ job, monthsLeft: o.monthsLeft, salary: o.salary, company: companyById(o.companyId) }] : [];
  });
  const currentJob = jobById(game.job);
  const picked = offers.find((o) => o.job.id === selected);
  const pct = (n: number) => `${Math.round(n * 100)} %`;

  const qualText = (q: Qualification) =>
    q.type === 'experience'
      ? `${t('career.req.experience', { months: q.months, field: t(`fields.${q.field}`) })} (${Math.min(experienceMonths(game, q.field), q.months)}/${q.months})`
      : t(`trainings.${q.id}.name`);

  const detail = ({ job, monthsLeft, salary, company }: OfferView) => {
    const elig = jobEligibility(game, job);
    const application = game.applications.find((a) => a.jobId === job.id);
    const breakdown = hireBreakdown(game, job);
    const skillReqs = Object.entries(job.minSkills ?? {}) as [SkillId, number][];
    return (
      <div className="detail" key={job.id} data-rarity={rarityOfJob(job)}>
        <DetailHead rarity={rarityOfJob(job)} title={jobName(job.id)} source={company ? `🏢 ${company.name}` : undefined} />
        <Facts rows={[
          [t('career.fact.salary'), t('career.perMonth', { amount: formatMoney(salary, lng) })],
          [t('career.fact.hours'), t('schedule.perWeek', { hours: job.hours })],
          [t('career.fact.commute'), t('schedule.perWeek', { hours: jobCommute(job, company) })],
          [t('career.fact.expires'), t('career.expiresIn', { count: monthsLeft })],
        ]} />
        <div className="reqs">
          <Drawbacks fx={jobDrawback(job, company)} />
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

        <Prospects job={job} jobName={jobName} />

        {elig.ok && (
          <div className="chance-box">
            <h4>{t('career.detail.title')}</h4>
            <ul className="chance-list">
              <li><span>{t('career.detail.base', { grade: job.grade })}</span><b>{pct(breakdown.base)}</b></li>
              {breakdown.bonuses.map((b) => (
                <li className={b.value < 0 ? 'minus' : 'plus'} key={b.type === 'training' ? b.id : b.type === 'rank' ? b.jobId : b.type}>
                  <span>
                    {b.type === 'training'
                      ? t('career.detail.training', { name: t(`trainings.${b.id}.name`) })
                      : b.type === 'fired'
                        ? t('career.detail.fired', { count: b.months })
                        : b.type === 'rank'
                          ? t('career.detail.rank', { job: jobName(b.jobId) })
                          : t('career.detail.experience', { months: b.months, field: t(`fields.${b.field}`) })}
                  </span>
                  <b>{b.value < 0 ? '−' : '+'}{pct(Math.abs(b.value))}</b>
                </li>
              ))}
              <li className="total"><span>{t('career.chanceLabel')}</span><b>{pct(breakdown.total)}</b></li>
            </ul>
            <ChanceBar chance={breakdown.total} label={t('career.chanceLabel')} big />
          </div>
        )}

        {application ? (
          <>
            <span className="job-meta target-note">{t('career.applyNote', { count: application.monthsLeft })}</span>
            <button className="big-btn secondary" onClick={() => toggleApplication(job.id)}>{t('career.cancel')}</button>
          </>
        ) : elig.ok ? (
          <>
            {reviewMonths(job) > 1 && <span className="job-meta warn">{t('career.slowReview', { count: reviewMonths(job) })}</span>}
            {full && <span className="job-meta warn">{t('career.applicationsFull', { max: MAX_APPLICATIONS })}</span>}
            <button className="big-btn" disabled={full} onClick={() => toggleApplication(job.id)}>{t('career.apply')}</button>
          </>
        ) : (
          <span className="job-meta warn">{t('career.lockedNote')}</span>
        )}
      </div>
    );
  };

  return (
    <section>
      <p className="muted small">{t('career.offersHint')}</p>
      <div className="offers-meta">
        <span>{t('career.offersCount', { count: game.offers.length, max: OFFERS_MAX })}</span>
        <span className={full ? 'warn' : 'muted'}>{t('career.applicationsCount', { count: game.applications.length, max: MAX_APPLICATIONS })}</span>
        <span className={perMonth > 0 ? 'good' : 'muted'}>{t('career.searchRate', { count: perMonth })}</span>
      </div>
      {offers.length === 0 && <p className="muted small">{t('career.noOffers')}</p>}
      <Split
        title={t('career.select.offers')}
        detail={selected === CURRENT_JOB && currentJob ? <CurrentJobDetail game={game} jobName={jobName} /> : picked ? detail(picked) : null}
        list={
          <div className="card-grid">
            {currentJob && (
              <Tile key={CURRENT_JOB} rarity={rarityOfJob(currentJob)} index={0} selected={selected === CURRENT_JOB} state="current" onSelect={() => onSelect(CURRENT_JOB)}>
                {companyById(game.jobCompany) && <span className="ctile-company">🏢 {companyById(game.jobCompany)!.name}</span>}
                <span className="ctile-name">{jobName(currentJob.id)}</span>
                <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(currentSalary(game), lng) })}</span>
                <span className="status-badge current">{t('career.status.current')}</span>
              </Tile>
            )}
            {offers.map((offer, i) => {
              const { job, monthsLeft, salary, company } = offer;
              const elig = jobEligibility(game, job);
              const isTarget = isApplied(game, job.id);
              return (
                <Tile key={job.id} rarity={rarityOfJob(job)} index={i + (currentJob ? 1 : 0)} selected={selected === job.id} state={isTarget ? 'target' : elig.ok ? undefined : 'locked'} onSelect={() => onSelect(job.id)}>
                  {company && <span className="ctile-company">🏢 {company.name}</span>}
                  <span className="ctile-name">{jobName(job.id)}</span>
                  <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(salary, lng) })}</span>
                  <span className={`ctile-meta${monthsLeft <= 1 ? ' warn' : ''}`}>{t('career.expiresIn', { count: monthsLeft })}</span>
                  {elig.ok ? <ChanceBar chance={hireChance(game, job)} label={t('career.chanceLabel')} /> : <span className="ctile-meta">🔒 {t('career.status.locked')}</span>}
                  {isTarget && <span className="status-badge current">{t('career.applied')}</span>}
                </Tile>
              );
            })}
          </div>
        }
      />
    </section>
  );
}

// ---------- Formations rapides et études ----------

function Trainings({ game, selected, onSelect, quick }: PaneProps & { quick: boolean }) {
  const { t, i18n } = useTranslation();
  const { enrollTraining, dropTraining } = useStore();
  const lng = i18n.language;
  const tab: Tab = quick ? 'quick' : 'training';
  const visible = quick ? game.catalog.quick : game.catalog.training;
  // Les diplômes déjà obtenus restent affichés jusqu'au prochain renouvellement du catalogue.
  const list = Object.entries(TRAININGS).filter(([id, cfg]) => !!cfg.quick === quick && (visible.includes(id) || game.training?.id === id));
  const picked = list.find(([id]) => id === selected);

  const detail = (id: string, cfg: TrainingConfig) => {
    const done = game.diplomas.includes(id);
    const active = game.training?.id === id ? game.training : null;
    const sponsored = !!active?.sponsored;
    const lowStudy = active && !sponsored && game.schedule.study < cfg.minStudyHours;
    const missing = (cfg.requires ?? []).filter((r) => !game.diplomas.includes(r));
    const gains = Object.entries(cfg.skills ?? {}) as [SkillId, number][];
    return (
      <div className="detail" key={id} data-rarity={rarityOfWeight(cfg.weight)}>
        <DetailHead rarity={rarityOfWeight(cfg.weight)} title={`${done ? '🎓 ' : ''}${t(`trainings.${id}.name`)}`} subtitle={t(`trainings.${id}.desc`)} />
        <Facts rows={[
          [t('career.fact.duration'), t('profile.months', { count: cfg.months })],
          [t('career.fact.tuition'), t('career.perMonth', { amount: formatMoney(trainingPrice(game, id), lng) })],
          [t('career.fact.study'), sponsored ? t('career.sponsoredHours') : t('schedule.perWeek', { hours: cfg.minStudyHours })],
        ]} />
        <div className="reqs">
          <Drawbacks fx={cfg.drawback} />
          {gains.map(([skill, v]) => <span className="req ok" key={skill}>+{v} {t(`skills.${skill}.name`)}</span>)}
          {cfg.hireBonus && (
            <span className="req ok">
              {t('career.hireBonus', { pct: Math.round(cfg.hireBonus.bonus * 100), field: t(`fields.${cfg.hireBonus.field}`) })}
            </span>
          )}
        </div>

        {active && (
          <div className="progress-box">
            <div className="xp-head">
              <span>{t('career.progress')}</span>
              <span className="muted">{t('career.monthsOf', { done: active.monthsDone, total: cfg.months })}</span>
            </div>
            <div className="meter"><div style={{ width: `${(active.monthsDone / cfg.months) * 100}%` }} /></div>
            {sponsored ? (
              <span className="job-meta">{t('career.sponsored')}</span>
            ) : (
              <div className="xp-head">
                <span>{t('career.blames')}</span>
                <span className={active.blames > 0 ? 'warn' : 'muted'}>{active.blames} / {MAX_BLAMES}</span>
              </div>
            )}
            {lowStudy && (
              <span className="job-meta warn">
                {t('career.lowStudy', { hours: cfg.minStudyHours, current: game.schedule.study, risk: Math.round(blameChance(game) * 100) })}
              </span>
            )}
          </div>
        )}

        {missing.length > 0 && !done && (
          <span className="job-meta warn">{t('career.requires', { names: missing.map((r) => t(`trainings.${r}.name`)).join(', ') })}</span>
        )}
        {done ? (
          <span className="status-badge current">{t(quick ? 'career.certified' : 'career.diploma')}</span>
        ) : active ? (
          <button className="big-btn secondary" onClick={dropTraining}>{t('career.drop')}</button>
        ) : (
          <button className="big-btn" disabled={game.training !== null || missing.length > 0} onClick={() => enrollTraining(id)}>
            {t('career.enroll')}
          </button>
        )}
      </div>
    );
  };

  return (
    <section>
      <p className="muted small">{t(quick ? 'career.quickHint' : 'career.trainingHint')}</p>
      <RefreshNote game={game} />
      {list.length === 0 && <p className="muted small">{t('career.noneLeft')}</p>}
      <Split
        title={t(`career.select.${tab}`)}
        detail={picked ? detail(picked[0], picked[1]) : null}
        list={
          <div className="card-grid">
            {list.map(([id, cfg], i) => {
              const done = game.diplomas.includes(id);
              const active = game.training?.id === id;
              return (
                <Tile key={id} rarity={rarityOfWeight(cfg.weight)} index={i} selected={selected === id} state={done ? 'done' : active ? 'current' : undefined} onSelect={() => onSelect(id)}>
                  <span className="ctile-name">{done ? '🎓 ' : ''}{t(`trainings.${id}.name`)}</span>
                  <span className="ctile-meta">{t('profile.months', { count: cfg.months })}</span>
                  <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(trainingPrice(game, id), lng) })}</span>
                  {done && <span className="status-badge current">{t(quick ? 'career.certified' : 'career.diploma')}</span>}
                  {active && <span className="status-badge current">{t('career.status.active')}</span>}
                </Tile>
              );
            })}
          </div>
        }
      />
    </section>
  );
}
