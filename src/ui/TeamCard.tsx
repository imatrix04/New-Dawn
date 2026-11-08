import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_BLAMES, TEAM, TEAM_EVENT_CHOICES, TEAM_EXTRA, TEAM_PACE_IDS, TEAM_PACES } from '../data/content';
import {
  bonusCheck, bonusCost, bonusGainFor, canFire, canRecruit, companyById, currentSalary, eventChoiceOk, jobById, moodLevel, outingCost, outingWait, teamHeadcount, teamMood,
  teamOutput, teamProgress, teamPromotionBonus, teamRaiseMerit, teamWage, traitKnown,
} from '../game/engine';
import type { MoodLevel } from '../game/engine';
import type { GameState } from '../game/types';
import { formatMoney, formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { Facts, Seg } from './cardKit';

const MOOD_FACE: Record<MoodLevel, string> = { great: '😄', good: '🙂', ok: '😐', low: '😟', bad: '😡' };

/** Teinte de la jauge d'humeur : rouge à zéro, vert à cent. */
const moodHue = (mood: number) => Math.round((Math.min(100, Math.max(0, mood)) / 100) * 120);

function MoodBar({ mood }: { mood: number }) {
  return (
    <div className="meter team-mood-bar" style={{ '--h': moodHue(mood) } as CSSProperties}>
      <div style={{ width: `${Math.max(3, mood)}%` }} />
    </div>
  );
}

/** Contenu de la carte « Équipe » : humeur, rythme demandé, objectif du trimestre, primes et finances. */
export function TeamCard({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setTeamPace, giveTeamBonus, teamOuting, recruitMember, fireMember, resolveTeamEvent } = useStore();
  const [confirmFire, setConfirmFire] = useState<string | null>(null);
  const [pick, setPick] = useState('all');
  const [perHead, setPerHead] = useState(100);

  const team = game.team;
  const job = jobById(game.job);
  const cfg = job?.management;
  if (!team || !job || !cfg) return null;

  const lng = i18n.language;
  const money = (n: number) => formatMoney(n, lng);
  const pct = (n: number) => `${Math.round(n * 100)} %`;
  const company = companyById(game.jobCompany);
  const director = team.level === 'director';
  const heads = teamHeadcount(team);
  const mood = teamMood(team);
  const level = moodLevel(mood);
  const progress = teamProgress(game);
  const output = teamOutput(game);
  const presence = Math.min(1, game.schedule.work / job.hours);
  const salary = currentSalary(game);
  const sick = game.sickLeave > 0;

  // Cible de la prime : toute l'équipe ou un membre (si celui qui était choisi est parti, retour à tout le monde).
  const target = team.members.some((m) => m.id === pick) ? pick : 'all';
  const targetMembers = target === 'all' ? team.members : team.members.filter((m) => m.id === target);
  const unitCost = bonusCost(team, target, 1);
  const affordable = Math.min(TEAM.bonusMax, Math.floor(team.budget / unitCost / TEAM.bonusStep) * TEAM.bonusStep);
  const amount = Math.min(Math.max(perHead, TEAM.bonusMin), Math.max(TEAM.bonusMin, affordable));
  const cost = bonusCost(team, target, amount);
  const wage = teamWage(game);
  const effective = targetMembers.reduce((sum, m) => sum + bonusGainFor(m, amount, wage, game.month), 0) / Math.max(1, targetMembers.length);
  const stale = targetMembers.some((m) => m.lastBonus !== null && game.month - m.lastBonus < TEAM.cycle);
  const check = bonusCheck(game, target, amount);
  const outWait = outingWait(game);
  const outCost = outingCost(team);
  const outBlocked = outWait > 0 || (!director && game.money < outCost);
  const goalFill = Math.min(1, progress.projected / (team.objective * 1.25));
  const goalTone = progress.ratio >= 1 ? 'ok' : progress.ratio >= TEAM.partialAt ? 'near' : 'low';
  const primeFull = Math.round(salary * TEAM.prime[team.level]);
  const review = team.review;
  const event = team.event;
  const evA = team.members.find((m) => m.id === event?.a)?.name ?? '';
  const evB = team.members.find((m) => m.id === event?.b)?.name ?? '';
  const reply = team.reply && team.reply.month === game.month ? team.reply : null;
  const waiting = !director && team.askWaitUntil > game.month;

  return (
    <div className="team">
      <header className="team-head">
        <div className="team-role">
          <strong>{t(`team.role.${team.level}`)}</strong>
          <span className="muted small">{company ? `🏢 ${company.name} · ` : ''}{t('team.people', { count: heads })}</span>
        </div>
        <div className="team-mood" title={t('team.moodTitle')}>
          <span className="team-face" aria-hidden>{MOOD_FACE[level]}</span>
          <div className="team-mood-text">
            <span className="pick-label">{t('team.moodTitle')}</span>
            <strong>{t(`team.moodLevel.${level}`)} <span className="muted">{Math.round(mood)}</span></strong>
            <MoodBar mood={mood} />
          </div>
        </div>
      </header>

      {sick && <p className="job-meta">{t('team.sickNote')}</p>}
      {!sick && presence < 1 && <p className="job-meta warn">{t('team.presenceWarn', { pct: Math.round((1 - (TEAM.presenceFloor + (1 - TEAM.presenceFloor) * presence)) * 100) })}</p>}

      {event && (
        <section className="team-event" role="alert">
          <h4>{t(`team.events.${event.id}.title`)}</h4>
          <p>{t(`team.events.${event.id}.text`, { a: evA, b: evB })}</p>
          <div className="team-event-choices">
            {Array.from({ length: TEAM_EVENT_CHOICES[event.id] }, (_, i) => (
              <button key={i} className="big-btn secondary" disabled={!eventChoiceOk(game, i)} onClick={() => resolveTeamEvent(i)}>
                {t(`team.events.${event.id}.choices.${i}`, { a: evA, b: evB })}
              </button>
            ))}
          </div>
          <p className="muted small">{t('team.events.hint')}</p>
        </section>
      )}

      <section className="chance-box">
        <h4>{t('team.pace.title')}</h4>
        <Seg
          label={t('team.pace.ask')}
          value={team.pace}
          options={TEAM_PACE_IDS.map((id) => ({ value: id, label: t(`team.pace.${id}`) }))}
          onChange={setTeamPace}
        />
        <p className="muted small">{t(`team.pace.hint.${team.pace}`)}</p>
        <Facts rows={[
          [t('team.pace.output'), pct(output)],
          [t('team.pace.trend'), t('team.pace.perMonth', { delta: formatSigned(TEAM_PACES[sick ? 'normal' : team.pace].mood, lng) })],
        ]} />
      </section>

      <section className="chance-box">
        <h4>{t('team.goal.title')}</h4>
        <div className="xp-head">
          <span>{t('team.goal.month', { n: Math.min(TEAM.cycle, progress.done + 1), total: TEAM.cycle })}</span>
          <span className="muted">{t('team.goal.projected', { pct: Math.round(progress.projected * 100), target: Math.round(team.objective * 100) })}</span>
        </div>
        <div className={`team-goal ${goalTone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)} aria-label={t('team.goal.title')}>
          <i style={{ width: `${goalFill * 100}%` }} />
          <b style={{ left: `${(1 / 1.25) * 100}%` }} title={t('team.goal.mark')} />
        </div>
        <p className="muted small">{t(`team.goal.${goalTone}`)}</p>
        <Facts rows={[
          [t('team.goal.primeFull'), money(primeFull)],
          [t('team.goal.primePartial'), money(Math.round(primeFull * TEAM.partialPrime))],
        ]} />
        <div className="reqs">
          <span className={team.streak > 0 ? 'req ok' : 'req'}>🔥 {t('team.goal.streak', { count: team.streak })}</span>
          <span className={game.jobBlames > 0 ? 'req no' : 'req ok'}>{t('career.blames')} {Math.min(game.jobBlames, MAX_BLAMES)} / {MAX_BLAMES}</span>
        </div>
        <p className="muted small">
          {team.streak > 0
            ? t('team.goal.streakHint', { raise: Math.round(teamRaiseMerit(game) * 1000) / 10, promo: Math.round(teamPromotionBonus(game) * 100) })
            : t('team.goal.noStreak')}
        </p>
        {team.audit && (
          <p className={`job-meta${team.audit.verdict === 'clean' ? '' : ' warn'}`}>{t(`team.audit.${team.audit.verdict}`)}</p>
        )}
        {review && (
          <div className={`team-review ${review.blame ? 'bad' : review.outcome === 'miss' ? 'bad' : 'good'}`}>
            <b>{t('team.review.title')}</b>
            <span>{t(`team.review.${review.outcome}`, { pct: Math.round(review.ratio * 100) })}{review.prime > 0 ? ` ${t('team.review.prime', { amount: money(review.prime) })}` : ''}</span>
            {review.primeBlocked && <span>{t('team.review.primeBlocked')}</span>}
            {review.blame && <span>{t(`team.review.blame.${review.blame}`)}</span>}
          </div>
        )}
      </section>

      <section className="chance-box">
        <h4>{t('team.bonus.title')}</h4>
        <Facts rows={[[t(director ? 'team.bonus.pool' : 'team.bonus.envelope'), `${money(team.budget)} / ${money(team.budgetTotal)}`]]} />
        <p className="muted small">{director ? t('team.bonus.fundHint') : t('team.bonus.envelopeHint')}</p>
        <div className="team-target">
          <button className={target === 'all' ? 'on' : ''} aria-pressed={target === 'all'} onClick={() => setPick('all')}>{t('team.bonus.toAll')}</button>
          <span className="muted small">{target === 'all' ? t('team.bonus.pickHint') : t('team.bonus.toOne', { name: targetMembers[0]?.name })}</span>
        </div>
        {affordable >= TEAM.bonusMin ? (
          <>
            <div className="pick-wrap">
              <span className="pick-label">{t('team.bonus.perHead')}</span>
              <div className="pct-pick">
                <input
                  className="tile-slider"
                  style={{ '--c': 'var(--accent)', '--fill': `${((amount - TEAM.bonusMin) / Math.max(1, affordable - TEAM.bonusMin)) * 100}%` } as CSSProperties}
                  type="range"
                  min={TEAM.bonusMin}
                  max={Math.max(TEAM.bonusMin + TEAM.bonusStep, affordable)}
                  step={TEAM.bonusStep}
                  value={amount}
                  onChange={(e) => setPerHead(Number(e.target.value))}
                  aria-label={t('team.bonus.perHead')}
                />
                <strong className="team-amount">{money(amount)}</strong>
              </div>
            </div>
            <Facts rows={[
              [t('team.bonus.cost'), money(cost)],
              [t('team.bonus.gain'), formatSigned(Math.round(effective * 10) / 10, lng)],
            ]} />
            {stale && <p className="job-meta">{t('team.bonus.stale')}</p>}
            {director && team.periodNet - cost < 0 && <p className="job-meta warn">{t('team.bonus.warnRed')}</p>}
            {waiting && <p className="job-meta warn">{t('team.bonus.waiting')}</p>}
            <button className="big-btn" disabled={check !== 'ok'} onClick={() => giveTeamBonus(target, amount)}>{t(director ? 'team.bonus.give' : 'team.bonus.submit', { amount: money(cost) })}</button>
            {!director && <p className="muted small">{t('team.bonus.submitHint')}</p>}
          </>
        ) : (
          <p className="job-meta warn">{t('team.bonus.empty')}</p>
        )}
        {reply && <p className={`job-meta${reply.result === 'refused' ? ' warn' : ''}`}>{t(`team.reply.${reply.kind}.${reply.result}`, { amount: money(reply.amount) })}</p>}
        <p className="muted small">{t('team.bonus.expire')}</p>
      </section>

      <section className="chance-box">
        <h4>{t('team.outing.title')}</h4>
        <p className="muted small">{t('team.outing.hint', { mood: TEAM.outing.mood, count: TEAM.outing.every })}</p>
        <button className="big-btn secondary" disabled={outBlocked} onClick={teamOuting}>
          {t(director ? 'team.outing.fund' : 'team.outing.own', { amount: money(outCost) })}
        </button>
        {outWait > 0 && <span className="job-meta">{t('team.outing.wait', { count: outWait })}</span>}
        {outWait === 0 && !director && game.money < outCost && <span className="job-meta warn">{t('team.outing.poor')}</span>}
      </section>

      {director && (
        <section className="chance-box">
          <h4>{t('team.finance.title')}</h4>
          <Facts rows={[
            [t('team.finance.net'), <span className={team.periodNet < 0 ? 'bad' : 'good'} key="n">{formatSigned(team.periodNet, lng)} €</span>],
            [t('team.finance.spent'), money(team.periodSpent)],
            [t('team.bonus.fund'), <span className={team.fund < 0 ? 'bad' : ''} key="f">{money(team.fund)}</span>],
          ]} />
          <p className={`job-meta${team.periodNet < 0 ? ' warn' : ''}`}>{team.periodNet < 0 ? t('team.finance.red') : t('team.finance.hint', { pct: Math.round(TEAM.dividend * 100) })}</p>
        </section>
      )}

      <section className="team-members">
        <div className="team-members-head">
          <h4 className="pick-label">{t('team.members.title')}</h4>
          <button className="mini-btn" disabled={!canRecruit(game)} onClick={recruitMember}>{t('team.members.recruit')}{director ? ` (${money(Math.round(wage * TEAM_EXTRA.recruitCost))})` : ''}</button>
        </div>
        {reply === null && waiting && <p className="job-meta warn">{t('team.members.waiting')}</p>}
        <ul>
          {team.members.map((m) => {
            const lv = moodLevel(m.mood);
            return (
              <li key={m.id} className="team-row">
                <button className={`team-member${target === m.id ? ' selected' : ''}`} aria-pressed={target === m.id} onClick={() => setPick(target === m.id ? 'all' : m.id)}>
                  <span className="team-face small" aria-hidden>{MOOD_FACE[lv]}</span>
                  <span className="team-member-name">
                    <strong>{m.name} <span className={`trait ${traitKnown(m) ? m.trait ?? 'none' : 'unknown'}`}>{!traitKnown(m) ? t('team.trait.unknown') : m.trait ? t(`team.trait.${m.trait}`) : ''}</span></strong>
                    {m.age < TEAM_EXTRA.trainMonths && <span className="muted small">{t('team.members.training')}</span>}
                    {m.staff > 0 &&<span className="muted small">{t('team.members.staff', { count: m.staff })}</span>}
                  </span>
                  <span className="team-member-mood">
                    <MoodBar mood={m.mood} />
                    <span className="muted small">{t(`team.moodLevel.${lv}`)}</span>
                  </span>
                </button>
                {confirmFire === m.id ? (
                  <button className="mini-btn danger" onClick={() => { fireMember(m.id); setConfirmFire(null); }}>{t('team.members.confirmFire')}</button>
                ) : (
                  <button className="mini-btn secondary" disabled={!canFire(game, m.id)} title={t('team.members.fire')} aria-label={t('team.members.fire')} onClick={() => setConfirmFire(m.id)}>✕</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
