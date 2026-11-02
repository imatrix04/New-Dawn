import { useTranslation } from 'react-i18next';
import { HOURS_PER_WEEK, SCHEDULE, TIME_CATS } from '../data/content';
import { canSearch, monthlyExpenses, monthlyIncome, weekBreakdown } from '../game/engine';
import type { GameState, ScheduleKey } from '../game/types';
import { formatNumber } from '../i18n/format';
import { useStore } from '../store';
import { TimeBar } from './TimeBar';

const SLIDERS: ScheduleKey[] = ['sleep', 'leisure', 'study', 'sport', 'search'];
const FIXED = ['work', 'commute', 'essentials'] as const;

export function SchedulePanel({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setSchedule, endTurn } = useStore();
  const week = weekBreakdown(game);
  const color = (id: string) => TIME_CATS.find((c) => c.id === id)!.color;

  const income = monthlyIncome(game);
  const expenses = monthlyExpenses(game);
  const balance = income - expenses;
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
  const money = (n: number) => `${sign(n)}${formatNumber(Math.abs(n), i18n.language)} €`;

  return (
    <div className="sched">
      <p className="muted small">{t('schedule.subtitle', { total: HOURS_PER_WEEK })}</p>

      <TimeBar week={week} />

      <div className="sched-rows">
        {SLIDERS.filter((k) => k !== 'search' || canSearch(game)).map((key) => {
          const def = SCHEDULE[key];
          const value = game.schedule[key];
          return (
            <div className="sched-row" key={key}>
              <div className="sched-label">
                <span className="dot" style={{ background: color(key) }} />
                <div>
                  {t(`schedule.cats.${key}.label`)}
                  <small>{t(`schedule.cats.${key}.hint`)}</small>
                </div>
              </div>
              <input
                type="range"
                min={def.min}
                max={def.max}
                step={1}
                value={value}
                onChange={(e) => setSchedule(key, Number(e.target.value))}
                aria-label={t(`schedule.cats.${key}.label`)}
              />
              <div className="sched-value">
                {t(def.perDay ? 'schedule.perDay' : 'schedule.perWeek', { hours: value })}
                {def.perDay && <small>{t('schedule.perWeek', { hours: week[key] })}</small>}
              </div>
            </div>
          );
        })}

        {FIXED.map((key) => (
          <div className="sched-row fixed" key={key}>
            <div className="sched-label">
              <span className="dot" style={{ background: color(key) }} />
              <div>
                {t(`schedule.cats.${key}.label`)}
                <small>{t(`schedule.cats.${key}.hint`)}</small>
              </div>
            </div>
            <div />
            <div className="sched-value">{t('schedule.perWeek', { hours: week[key] })}</div>
          </div>
        ))}

        <div className="sched-row fixed">
          <div className="sched-label">
            <span className="dot" style={{ background: color('free') }} />
            <div>{t('schedule.cats.free.label')}</div>
          </div>
          <div />
          <div className="sched-value">{t('schedule.perWeek', { hours: week.free })}</div>
        </div>
      </div>

      <div className="finance">
        <span>{t('schedule.income')} : <strong className="good">{money(income)}</strong></span>
        <span>{t('schedule.expenses')} : <strong className="bad">{money(-expenses)}</strong></span>
        <span>{t('schedule.balance')} : <strong className={balance < 0 ? 'bad' : 'good'}>{money(balance)}</strong></span>
      </div>

      <button className="next-turn" onClick={endTurn}>{t('schedule.nextMonth')}</button>
    </div>
  );
}
