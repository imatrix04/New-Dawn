import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { HOURS_PER_WEEK, SCHEDULE, TIME_CATS } from '../data/content';
import {
  isOverbooked, monthlyExpenses, monthlyIncome, scheduleEffects, weekBreakdown,
} from '../game/engine';
import type { GameState, ScheduleKey } from '../game/types';
import { formatNumber, formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { HoldButton } from './HoldButton';
import { WeekDonut } from './WeekDonut';

/** Durée à maintenir le bouton pour passer le mois (limite les clics accidentels). */
const HOLD_MS = 1000;

const SLIDERS: ScheduleKey[] = ['sleep', 'leisure', 'study', 'sport', 'search'];
const FIXED = ['work', 'commute', 'essentials'] as const;
const cat = (id: string) => TIME_CATS.find((c) => c.id === id)!;

export function SchedulePanel({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setSchedule, endTurn } = useStore();
  const week = weekBreakdown(game);
  const over = isOverbooked(game);
  const fx = scheduleEffects(game.schedule);
  const lng = i18n.language;

  const income = monthlyIncome(game);
  const expenses = monthlyExpenses(game);
  const balance = income - expenses;
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
  const money = (n: number) => `${sign(n)}${formatNumber(Math.abs(n), lng)} €`;

  /** Effet mensuel du curseur, affiché en pastille sur la tuile. */
  const effect = (key: ScheduleKey): { text: string; tone: 'good' | 'bad' | '' } => {
    const tone = (n: number) => (n > 0 ? 'good' : n < 0 ? 'bad' : '');
    switch (key) {
      case 'sleep': return { text: t('schedule.effect.health', { delta: formatSigned(fx.sleepHealth, lng) }), tone: tone(fx.sleepHealth) };
      case 'leisure': return { text: t('schedule.effect.happiness', { delta: formatSigned(fx.leisureHappiness, lng) }), tone: tone(fx.leisureHappiness) };
      case 'sport': return { text: t('schedule.effect.health', { delta: formatSigned(fx.sportHealth, lng) }), tone: tone(fx.sportHealth) };
      case 'study': return { text: t('schedule.effect.skill', { delta: formatSigned(fx.studyIntelligence, lng) }), tone: tone(fx.studyIntelligence) };
      case 'search': return { text: t('schedule.effect.search', { count: fx.searchOffers }), tone: tone(fx.searchOffers) };
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
        {SLIDERS.map((key, i) => {
          const def = SCHEDULE[key];
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
        <div className="pill"><small>{t('schedule.income')}</small><strong className="good">{money(income)}</strong></div>
        <div className="pill"><small>{t('schedule.expenses')}</small><strong className="bad">{money(-expenses)}</strong></div>
        <div className="pill"><small>{t('schedule.balance')}</small><strong className={balance < 0 ? 'bad' : 'good'}>{money(balance)}</strong></div>
      </div>

      <HoldButton
        className="next-turn"
        disabled={over}
        duration={HOLD_MS}
        label={over ? t('schedule.blocked') : t('schedule.hold', { seconds: HOLD_MS / 1000 })}
        holdLabel={t('schedule.holding')}
        onComplete={endTurn}
      />
    </div>
  );
}
