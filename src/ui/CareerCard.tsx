import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOG_REFRESH_MONTHS, GIGS, HIRE_CHANCE_MAX, JOBS, OFFERS_MAX, TRAININGS } from '../data/content';
import type { Company, Gig, TrainingConfig } from '../data/content';
import {
  companyById, currentSalary, experienceMonths, gigPay, hireBreakdown, hireChance, jobById, jobDrawback, jobEligibility,
  scheduleEffects, trainingPrice,
} from '../game/engine';
import type { Drawback, GameState, Job, Qualification, SkillId } from '../game/types';
import { formatMoney, formatSigned } from '../i18n/format';
import { useStore } from '../store';

type Tab = 'gigs' | 'offers' | 'quick' | 'training';
const TABS: Tab[] = ['gigs', 'offers', 'quick', 'training'];

/** Rareté de 1 (commun) à 4 (très rare) : le grade pour un poste, la fréquence de retour au catalogue pour le reste. */
type Rarity = 1 | 2 | 3 | 4;
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

/** Losanges de rareté : plus il y en a d'allumés, plus l'élément est rare. */
function Pips({ rarity }: { rarity: Rarity }) {
  const { t } = useTranslation();
  return (
    <span className="pips" title={t(`career.rarity.${rarity}`)} aria-label={t(`career.rarity.${rarity}`)}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= rarity ? 'on' : ''} />)}
    </span>
  );
}

/** Teinte de la barre : rouge pour les petites chances, vert pour les grandes. */
const chanceHue = (chance: number) => Math.round(Math.min(1, chance / HIRE_CHANCE_MAX) * 120);

function ChanceBar({ chance, big = false }: { chance: number; big?: boolean }) {
  const { t } = useTranslation();
  const pct = Math.round(chance * 100);
  return (
    <div
      className={`cbar${big ? ' big' : ''}`}
      style={{ '--h': chanceHue(chance) } as CSSProperties}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={t('career.chanceLabel')}
      title={`${t('career.chanceLabel')} : ${pct} %`}
    >
      <i style={{ width: `${chance * 100}%` }} />
    </div>
  );
}

interface TileProps {
  rarity: Rarity;
  selected: boolean;
  index: number;
  state?: 'current' | 'target' | 'locked' | 'done';
  onSelect: () => void;
  children: ReactNode;
}

/** Carte sélectionnable de la liste de gauche. La couleur et l'éclat dépendent de la rareté. */
function Tile({ rarity, selected, index, state, onSelect, children }: TileProps) {
  return (
    <div
      className={`ctile${selected ? ' selected' : ''}${state ? ` ${state}` : ''}`}
      data-rarity={rarity}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Pips rarity={rarity} />
      {children}
    </div>
  );
}

/** Liste de cartes à gauche (2 par ligne), détail fixe à droite, ou consigne tant que rien n'est sélectionné. */
function Split({ tab, list, detail }: { tab: Tab; list: ReactNode; detail: ReactNode | null }) {
  const { t } = useTranslation();
  return (
    <div className="career-split">
      <div className="career-main">{list}</div>
      <aside className="career-aside">
        {detail ?? (
          <div className="aside-empty">
            <span className="aside-empty-icon" aria-hidden>☝️</span>
            <strong>{t(`career.select.${tab}`)}</strong>
            <span className="muted small">{t('career.selectHint')}</span>
          </div>
        )}
      </aside>
    </div>
  );
}

/** En-tête du détail : l'entreprise en haut à gauche, la rareté en haut à droite, l'intitulé centré en dessous. */
function DetailHead({ rarity, title, source, subtitle }: { rarity: Rarity; title: string; source?: string; subtitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="detail-head" data-rarity={rarity}>
      <div className="detail-top">
        <span className="detail-source">{source}</span>
        <span className="rarity-label"><Pips rarity={rarity} /> {t(`career.rarity.${rarity}`)}</span>
      </div>
      <h3>{title}</h3>
      {subtitle && <p className="muted small">{subtitle}</p>}
    </div>
  );
}

interface OfferView {
  job: Job;
  monthsLeft: number;
  salary: number;
  company: Company | null;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

// ---------- Carte ----------

/** Contenu de la carte « Carrière » : poste actuel, puis boulots rapides, offres, formations rapides et études. */
export function CareerCard({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('offers');
  const [selection, setSelection] = useState<Record<Tab, string | null>>({ gigs: null, offers: null, quick: null, training: null });
  const current = jobById(game.job);
  const jobName = (id: string) => t(`jobs.${id}`, { context: game.gender });

  const select = (id: string) => setSelection((s) => ({ ...s, [tab]: s[tab] === id ? null : id }));
  const props = { game, selected: selection[tab], onSelect: select };

  return (
    <div className="career">
      <section className="cur-job">
        <small>{t('career.current')}</small>
        {current ? (
          <>
            <strong>{jobName(current.id)}</strong>
            {companyById(game.jobCompany) && <span className="muted small">🏢 {companyById(game.jobCompany)!.name}</span>}
            <span className="muted small">{t('career.perMonth', { amount: formatMoney(currentSalary(game), i18n.language) })}</span>
            <div className="reqs"><Drawbacks fx={jobDrawback(current, companyById(game.jobCompany))} /></div>
          </>
        ) : (
          <span className="muted">{t('game.noJob')}</span>
        )}
      </section>

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

  const detail = (g: Gig) => {
    const active = game.gig === g.id;
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
        </div>
        {active ? (
          <button className="big-btn secondary" onClick={() => setGig(null)}>{t('career.gigStop')}</button>
        ) : (
          <button className="big-btn" onClick={() => setGig(g.id)}>{t('career.gigStart')}</button>
        )}
      </div>
    );
  };

  return (
    <section>
      <p className="muted small">{t('career.gigsHint')}</p>
      <RefreshNote game={game} />
      <Split
        tab="gigs"
        detail={gig ? detail(gig) : null}
        list={
          <div className="card-grid">
            {list.map((g, i) => (
              <Tile key={g.id} rarity={rarityOfWeight(g.weight)} index={i} selected={selected === g.id} state={game.gig === g.id ? 'current' : undefined} onSelect={() => onSelect(g.id)}>
                <span className="ctile-name">{g.icon} {t(`gigs.${g.id}.name`)}</span>
                <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(gigPay(game, g), lng) })}</span>
                <span className="ctile-meta">{t('schedule.perWeek', { hours: g.hours })}</span>
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

function Offers({ game, selected, onSelect, jobName }: PaneProps & { jobName: (id: string) => string }) {
  const { t, i18n } = useTranslation();
  const { setJobTarget } = useStore();
  const lng = i18n.language;
  const perMonth = scheduleEffects(game.schedule).searchOffers;
  const offers = game.offers.flatMap((o) => {
    const job = JOBS.find((j) => j.id === o.jobId);
    return job ? [{ job, monthsLeft: o.monthsLeft, salary: o.salary, company: companyById(o.companyId) }] : [];
  });
  const picked = offers.find((o) => o.job.id === selected);
  const pct = (n: number) => `${Math.round(n * 100)} %`;

  const qualText = (q: Qualification) =>
    q.type === 'experience'
      ? `${t('career.req.experience', { months: q.months, field: t(`fields.${q.field}`) })} (${Math.min(experienceMonths(game, q.field), q.months)}/${q.months})`
      : t(`trainings.${q.id}.name`);

  const detail = ({ job, monthsLeft, salary, company }: OfferView) => {
    const elig = jobEligibility(game, job);
    const isTarget = job.id === game.jobTarget;
    const breakdown = hireBreakdown(game, job);
    const skillReqs = Object.entries(job.minSkills ?? {}) as [SkillId, number][];
    return (
      <div className="detail" key={job.id} data-rarity={rarityOfJob(job)}>
        <DetailHead rarity={rarityOfJob(job)} title={jobName(job.id)} source={company ? `🏢 ${company.name}` : undefined} />
        <Facts rows={[
          [t('career.fact.salary'), t('career.perMonth', { amount: formatMoney(salary, lng) })],
          [t('career.fact.hours'), t('schedule.perWeek', { hours: job.hours })],
          [t('career.fact.commute'), t('schedule.perWeek', { hours: job.commute })],
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
            <ChanceBar chance={breakdown.total} big />
          </div>
        )}

        {isTarget ? (
          <>
            <span className="job-meta target-note">{t('career.applyNote')}</span>
            <button className="big-btn secondary" onClick={() => setJobTarget(null)}>{t('career.cancel')}</button>
          </>
        ) : elig.ok ? (
          <button className="big-btn" onClick={() => setJobTarget(job.id)}>{t('career.apply')}</button>
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
        <span className={perMonth > 0 ? 'good' : 'muted'}>{t('career.searchRate', { count: perMonth })}</span>
      </div>
      {offers.length === 0 && <p className="muted small">{t('career.noOffers')}</p>}
      <Split
        tab="offers"
        detail={picked ? detail(picked) : null}
        list={
          <div className="card-grid">
            {offers.map((offer, i) => {
              const { job, monthsLeft, salary, company } = offer;
              const elig = jobEligibility(game, job);
              const isTarget = job.id === game.jobTarget;
              return (
                <Tile key={job.id} rarity={rarityOfJob(job)} index={i} selected={selected === job.id} state={isTarget ? 'target' : elig.ok ? undefined : 'locked'} onSelect={() => onSelect(job.id)}>
                  {company && <span className="ctile-company">🏢 {company.name}</span>}
                  <span className="ctile-name">{jobName(job.id)}</span>
                  <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(salary, lng) })}</span>
                  <span className={`ctile-meta${monthsLeft <= 1 ? ' warn' : ''}`}>{t('career.expiresIn', { count: monthsLeft })}</span>
                  {elig.ok ? <ChanceBar chance={hireChance(game, job)} /> : <span className="ctile-meta">🔒 {t('career.status.locked')}</span>}
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
  const list = Object.entries(TRAININGS).filter(([id, cfg]) => !!cfg.quick === quick && visible.includes(id));
  const picked = list.find(([id]) => id === selected);

  const detail = (id: string, cfg: TrainingConfig) => {
    const done = game.diplomas.includes(id);
    const active = game.training?.id === id ? game.training : null;
    const lowStudy = active && game.schedule.study < cfg.minStudyHours;
    const missing = (cfg.requires ?? []).filter((r) => !game.diplomas.includes(r));
    const unlocks = JOBS.filter((j) => j.anyOf?.some((q) => q.type === 'diploma' && q.id === id));
    const gains = Object.entries(cfg.skills ?? {}) as [SkillId, number][];
    return (
      <div className="detail" key={id} data-rarity={rarityOfWeight(cfg.weight)}>
        <DetailHead rarity={rarityOfWeight(cfg.weight)} title={`${done ? '🎓 ' : ''}${t(`trainings.${id}.name`)}`} subtitle={t(`trainings.${id}.desc`)} />
        <Facts rows={[
          [t('career.fact.duration'), t('profile.months', { count: cfg.months })],
          [t('career.fact.tuition'), t('career.perMonth', { amount: formatMoney(trainingPrice(game, id), lng) })],
          [t('career.fact.study'), t('schedule.perWeek', { hours: cfg.minStudyHours })],
        ]} />
        <div className="reqs">
          <Drawbacks fx={cfg.drawback} />
          {gains.map(([skill, v]) => <span className="req ok" key={skill}>+{v} {t(`skills.${skill}.name`)}</span>)}
          {cfg.hireBonus && (
            <span className="req ok">
              {t('career.hireBonus', { pct: Math.round(cfg.hireBonus.bonus * 100), field: t(`fields.${cfg.hireBonus.field}`) })}
            </span>
          )}
          {unlocks.map((j) => (
            <span className="req ok" key={j.id}>{t('career.unlocks', { job: t(`jobs.${j.id}`, { context: game.gender }) })}</span>
          ))}
        </div>

        {active && (
          <div className="progress-box">
            <div className="xp-head">
              <span>{t('career.progress')}</span>
              <span className="muted">{t('career.monthsOf', { done: active.monthsDone, total: cfg.months })}</span>
            </div>
            <div className="meter"><div style={{ width: `${(active.monthsDone / cfg.months) * 100}%` }} /></div>
            {lowStudy && (
              <span className="job-meta warn">{t('career.lowStudy', { hours: cfg.minStudyHours, current: game.schedule.study })}</span>
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
        tab={tab}
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
