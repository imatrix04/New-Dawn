import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { HOURS_PER_WEEK, SCHEDULE, TIME_CATS, WORK_STYLE_IDS, WORK_STYLES } from '../data/content';
import {
  blameChance, isOverbooked, jobBlameChance, jobById, scheduleEffects, weekBreakdown, workActive,
} from '../game/engine';
import type { GameState, ScheduleKey } from '../game/types';
import { formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { Seg } from './cardKit';
import { CatIcon } from './Icon';
import { HoldButton } from './HoldButton';
import { WeekDonut } from './WeekDonut';

/** Durée à maintenir le bouton pour passer le mois (limite les clics accidentels). */
const HOLD_MS = 1000;

const SLIDERS: ScheduleKey[] = ['sleep', 'leisure', 'study', 'work', 'sport', 'search', 'housing'];
const FIXED = ['work', 'commute', 'essentials', 'repair'] as const;
const cat = (id: string) => TIME_CATS.find((c) => c.id === id)!;

export function SchedulePanel({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { setSchedule, endTurn, setWorkStyle } = useStore();
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

  return (
    <div className="sched">
      <div className="sched-top">
        <WeekDonut week={week} />
        <div className="sched-side">
          <p className="muted small">{t('schedule.subtitle', { total: HOURS_PER_WEEK })}</p>
          <div className="chips">
            {FIXED.filter((key) => key !== 'repair' || week.repair > 0).map((key) => (
              <div className="chip" key={key} style={{ '--c': cat(key).color } as CSSProperties} title={t(`schedule.cats.${key}.hint`)}>
                <span className="cat-label"><CatIcon id={key} /> {t(`schedule.cats.${key}.label`)}</span>
                <b>{t('schedule.perWeek', { hours: week[key] })}</b>
              </div>
            ))}
          </div>
          {over && <p className="over-hint">{t('schedule.overHint')}</p>}
        </div>
      </div>

      {workActive(game) && (
        <div className="style-box">
          {game.sickLeave > 0 ? (
            <p className="over-hint">{t('work.sick', { count: game.sickLeave })}</p>
          ) : (
            <>
              <Seg
                label={t('work.styleLabel')}
                value={game.workStyle}
                options={WORK_STYLE_IDS.map((id) => ({ value: id, label: t(`work.styles.${id}.name`) }))}
                onChange={setWorkStyle}
              />
              <p className="muted small">{t(`work.styles.${game.workStyle}.desc`)}</p>
              <div className="reqs">
                {([['efficiency', 'gain'], ['health', 'health'], ['happiness', 'happiness']] as const).map(([stat, field]) => {
                  const v = WORK_STYLES[game.workStyle][field];
                  return <span key={stat} className={`req ${v > 0 ? 'ok' : v < 0 ? 'no' : ''}`}>{t(`work.chip.${stat}`, { delta: formatSigned(v, lng) })}</span>;
                })}
              </div>
            </>
          )}
        </div>
      )}

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
                <span className="tile-label cat-label"><CatIcon id={key} /> {t(`schedule.cats.${key}.label`)}</span>
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
