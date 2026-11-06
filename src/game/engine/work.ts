// Efficacité : style de travail, gain mensuel, épuisement et arrêt maladie.
import { EFFICIENCY, WORK_STYLE_IDS, WORK_STYLES } from '../../data/content';
import type { WorkStyle } from '../../data/content';
import { TRAININGS } from '../../data/content';
import type { GameState } from '../types';
import { workedHours } from './job';
import { jobById } from './lookup';
import { addLog, clamp } from './shared';

/** Le joueur travaille ou étudie : l'efficacité et le style de travail comptent. */
export const workActive = (state: GameState): boolean => !!state.job || !!state.training;

/** Sous la santé d'épuisement, le style « à fond » rapporte moins : le joueur tire sur la corde. */
export const isStrained = (state: GameState): boolean =>
  workActive(state) && state.sickLeave === 0 && state.workStyle === 'hard' && state.stats.health < EFFICIENCY.strainHealth;

/** D'où vient le gain d'efficacité du mois (somme = variation). */
export interface EfficiencyLine {
  kind: 'style' | 'hours' | 'fatigue' | 'strain' | 'slack';
  amount: number;
}

/** Part des heures prévues réellement faites (poste et études) : 1 si tout est fait. */
function hoursDone(state: GameState): number {
  const parts: number[] = [];
  const job = jobById(state.job);
  if (job) parts.push(Math.min(1, workedHours(state) / job.hours));
  if (state.training && !state.training.sponsored) parts.push(Math.min(1, state.schedule.study / TRAININGS[state.training.id].minStudyHours));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 1;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Variation d'efficacité du mois, ligne par ligne. Le style donne le gain de base ; sauter des heures, être fatigué
 * (santé et bonheur bas) et tirer sur la corde le réduisent. Un style tranquille perd des points, et d'autant plus
 * qu'on saute des heures. Rien ne bouge sans emploi ni études, ni pendant un arrêt maladie.
 */
export function efficiencyLines(state: GameState): EfficiencyLine[] {
  if (!workActive(state) || state.sickLeave > 0) return [];
  const base = WORK_STYLES[state.workStyle].gain;
  const lines: EfficiencyLine[] = [{ kind: 'style', amount: base }];
  const hours = hoursDone(state);
  if (base > 0) {
    const afterHours = base * hours;
    const mood = (state.stats.health + state.stats.happiness) / 2;
    const afterFatigue = afterHours * Math.min(1, 0.5 + mood / 140);
    const afterStrain = isStrained(state) ? afterFatigue * EFFICIENCY.strainFactor : afterFatigue;
    lines.push(
      { kind: 'hours', amount: afterHours - base },
      { kind: 'fatigue', amount: afterFatigue - afterHours },
      { kind: 'strain', amount: afterStrain - afterFatigue },
    );
  } else if (hours < 1) {
    lines.push({ kind: 'slack', amount: -(1 - hours) * EFFICIENCY.slackPenalty });
  }
  return lines.map((l) => ({ ...l, amount: round2(l.amount) })).filter((l) => l.amount !== 0);
}

export const efficiencyDelta = (state: GameState): number => efficiencyLines(state).reduce((sum, l) => sum + l.amount, 0);

/** Choisit le style de travail (et d'étude). */
export function setWorkStyle(state: GameState, style: WorkStyle): GameState {
  if (!WORK_STYLE_IDS.includes(style) || style === state.workStyle) return state;
  return { ...state, workStyle: style };
}

/** Épuisement : arrêt maladie forcé, l'efficacité en pâtit. */
export function startSickLeave(s: GameState) {
  s.sickLeave = EFFICIENCY.sickMonths;
  s.efficiency = clamp(s.efficiency - EFFICIENCY.burnoutPenalty);
  addLog(s, 'log.burnout', { count: EFFICIENCY.sickMonths }, 'bad');
}

/** Fin d'un mois d'arrêt maladie : au bout du dernier, on reprend, en style normal. */
export function endSickMonth(s: GameState) {
  if (s.sickLeave <= 0) return;
  s.sickLeave -= 1;
  if (s.sickLeave === 0) {
    s.workStyle = 'normal';
    addLog(s, 'log.sickBack', {}, 'good');
  }
}
