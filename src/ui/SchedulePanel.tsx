import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { HOURS_PER_WEEK, SCHEDULE, TIME_CATS } from '../data/content';
import {
  blameChance, isOverbooked, jobBlameChance, jobById, monthlyExpenseLines, monthlyExpenses, monthlyIncome, monthlyIncomeLines, scheduleEffects, weekBreakdown,
  type MoneyLine,
} from '../game/engine';
import type { GameState, ScheduleKey } from '../game/types';
import { formatNumber, formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { HoldButton } from './HoldButton';
import { WeekDonut } from './WeekDonut';

/** Durée à maintenir le bouton pour passer le mois (limite les clics accidentels). */
const HOLD_MS = 1000;

const SLIDERS: ScheduleKey[] = ['sleep', 'leisure', 'study', 'work', 'sport', 'search', 'housing'];
const FIXED = ['work', 'commute', 'essentials'] as const;
const cat = (id: string) => TIME_CATS.find((c) => c.id === id)!;

/** Infobulle au survol d'une pastille : une ligne par poste. */
function MoneyTip({ lines, label, money, sign, empty }: {
  lines: MoneyLine[]; label: (l: MoneyLine) => string; money: (n: number) => string; sign: 1 | -1; empty: string;
}) {
  return (
    <div className={`money-tip ${sign > 0 ? 'good' : 'bad'}`} role="tooltip">
      {lines.length === 0 && <span className="muted">{empty}</span>}
      {lines.map((l, i) => (
        <div className="money-tip-row" key={`${l.kind}-${l.id ?? ''}`} style={{ animationDelay: `${60 + i * 55}ms` }}>
          <span>{label(l)}</span><b>{money(sign * l.amount)}</b>
        </div>
      ))}
    </div>
  );
}

export function SchedulePanel({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setSchedule, endTurn } = useStore();
  const week = weekBreakdown(game);
  const over = isOverbooked(game);
  const fx = scheduleEffects(game.schedule);
  const lng = i18n.language;
  const studyRisk = blameChance(game);
  const workRisk = jobBlameChance(game);
  const job = jobById(game.job);
  // Les curseurs « Études » et « Travail » n'existent que pendant une formation ou avec un poste, qui en réservent les heures.
  const sliders = SLIDERS.filter((key) => (key !== 'study' || (game.training && !game.training.sponsored)) && (key !== 'work' || job));
  const maxOf = (key: ScheduleKey) => (key === 'work' ? job?.hours ?? 0 : SCHEDULE[key].max);

  const income = monthlyIncome(game);
  const expenses = monthlyExpenses(game);
  const balance = income - expenses;
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
  const money = (n: number) => `${sign(n)}${formatNumber(Math.abs(n), lng)} €`;

  const blameEffect = (risk: number): { text: string; tone: 'good' | 'bad' } => risk > 0
    ? { text: t('schedule.effect.blame', { pct: Math.round(risk * 100) }), tone: 'bad' }
    : { text: t('schedule.effect.noBlame'), tone: 'good' };

  /** Effet mensuel du curseur, affiché en pastille sur la tuile. */
  const effect = (key: ScheduleKey): { text: string; tone: 'good' | 'bad' | '' } => {
    const tone = (n: number) => (n > 0 ? 'good' : n < 0 ? 'bad' : '');
    switch (key) {
      case 'sleep': return { text: t('schedule.effect.health', { delta: formatSigned(fx.sleepHealth, lng) }), tone: tone(fx.sleepHealth) };
      case 'leisure': return { text: t('schedule.effect.happiness', { delta: formatSigned(fx.leisureHappiness, lng) }), tone: tone(fx.leisureHappiness) };
      case 'sport': return { text: t('schedule.effect.health', { delta: formatSigned(fx.sportHealth, lng) }), tone: tone(fx.sportHealth) };
      case 'study': return blameEffect(studyRisk);
      case 'work': return blameEffect(workRisk);
      case 'search': return { text: t('schedule.effect.search', { count: fx.searchOffers }), tone: tone(fx.searchOffers) };
      case 'housing': return { text: t('schedule.effect.housing', { count: fx.searchListings }), tone: tone(fx.searchListings) };
    }
  };

  const lineLabel = (l: MoneyLine): string => {
    switch (l.kind) {
      case 'job': return t(`jobs.${l.id}`, { context: game.gender });
      case 'gig': return t(`gigs.${l.id}.name`);
      case 'housing': return t(`housing.${l.id}`);
      case 'loan': return t('estate.lines.loan');
      case 'charges': return t('estate.lines.charges');
      case 'rentals': return t('estate.lines.rentals');
      case 'propLoan': return t('estate.lines.propLoan');
      case 'propCharges': return t('estate.lines.propCharges');
      case 'car': return t(`cars.${l.id}`);
      case 'training': return t(`trainings.${l.id}.name`);
      case 'food': return t('schedule.lines.food');
      case 'leisure': return t('schedule.lines.leisure');
    }
  };

  return (
    <div className="sched">
      <div className="sched-top">
        <WeekDonut week={week} />
        <div className="sched-side">
          <p className="muted small">{t('schedule.subtitle', { total: HOURS_PER_WEEK })}</p>
          <div className="chips">
            {FIXED.map((key) => (
              <div className="chip" key={key} style={{ '--c': cat(key).color } as CSSProperties} title={t(`schedule.cats.${key}.hint`)}>
                <span>{cat(key).icon} {t(`schedule.cats.${key}.label`)}</span>
                <b>{t('schedule.perWeek', { hours: week[key] })}</b>
              </div>
            ))}
          </div>
          {over && <p className="over-hint">{t('schedule.overHint')}</p>}
        </div>
      </div>

      <div className="tiles">
        {sliders.map((key, i) => {
          const def = { ...SCHEDULE[key], max: maxOf(key) };
          const value = game.schedule[key];
          const eff = effect(key);
          return (
            <div
              className="tile"
              key={key}
              title={t(`schedule.cats.${key}.hint`)}
              style={{
                '--c': cat(key).color,
                '--fill': `${((value - def.min) / (def.max - def.min)) * 100}%`,
                animationDelay: `${i * 45}ms`,
              } as CSSProperties}
            >
              <div className="tile-head">
                <span className="tile-label">{cat(key).icon} {t(`schedule.cats.${key}.label`)}</span>
                <span className="tile-value" key={value}>
                  {t(def.perDay ? 'schedule.perDay' : 'schedule.perWeek', { hours: value })}
                </span>
              </div>
              <input
                className="tile-slider"
                type="range"
                min={def.min}
                max={def.max}
                step={1}
                value={value}
                onChange={(e) => setSchedule(key, Number(e.target.value))}
                aria-label={t(`schedule.cats.${key}.label`)}
              />
              <div className="tile-foot">
                <span className="muted">{def.perDay ? t('schedule.perWeek', { hours: week[key] }) : ''}</span>
                <span className={`badge ${eff.tone}`}>{eff.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pills">
        <div className="pill has-tip" tabIndex={0}>
          <small>{t('schedule.income')}</small><strong className="good">{money(income)}</strong>
          <MoneyTip lines={monthlyIncomeLines(game)} label={lineLabel} money={money} sign={1} empty={t('schedule.noIncome')} />
        </div>
        <div className="pill has-tip" tabIndex={0}>
          <small>{t('schedule.expenses')}</small><strong className="bad">{money(-expenses)}</strong>
          <MoneyTip lines={monthlyExpenseLines(game)} label={lineLabel} money={money} sign={-1} empty="" />
        </div>
        <div className="pill"><small>{t('schedule.balance')}</small><strong className={balance < 0 ? 'bad' : 'good'}>{money(balance)}</strong></div>
      </div>

      <HoldButton
        className="next-turn"
        disabled={over}
        duration={HOLD_MS}
        label={over ? t('schedule.blocked') : t('schedule.hold')}
        holdLabel={t('schedule.holding')}
        onComplete={endTurn}
      />
    </div>
  );
}
