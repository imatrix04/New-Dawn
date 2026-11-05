// Planning de la semaine : répartition des heures et blocage quand la semaine déborde.
import { ESSENTIALS_PER_WEEK, HOURS_PER_WEEK, SCHEDULE } from '../../data/content';
import type { GameState, Schedule, ScheduleKey } from '../types';
import { housingCommute } from './housing';
import { workedHours } from './job';
import { gigById, jobById } from './lookup';
import { clamp } from './shared';

export const weeklyHours = (schedule: Schedule, key: ScheduleKey) =>
  schedule[key] * (SCHEDULE[key].perDay ? 7 : 1);

export interface WeekBreakdown {
  sleep: number;
  work: number;
  commute: number;
  essentials: number;
  leisure: number;
  study: number;
  sport: number;
  search: number;
  housing: number;
  /** Heures non planifiées sur les 168 h. */
  free: number;
}

export function weekBreakdown(state: GameState): WeekBreakdown {
  const job = jobById(state.job);
  const gig = gigById(state.gig);
  const planned = {
    sleep: weeklyHours(state.schedule, 'sleep'),
    work: workedHours(state) + (gig?.hours ?? 0),
    commute: (job?.commute ?? 0) + (gig?.commute ?? 0) + housingCommute(state),
    essentials: ESSENTIALS_PER_WEEK,
    leisure: weeklyHours(state.schedule, 'leisure'),
    study: weeklyHours(state.schedule, 'study'),
    sport: weeklyHours(state.schedule, 'sport'),
    search: weeklyHours(state.schedule, 'search'),
    housing: weeklyHours(state.schedule, 'housing'),
  };
  const used = Object.values(planned).reduce((a, h) => a + h, 0);
  return { ...planned, free: HOURS_PER_WEEK - used };
}

/** Trop d'heures planifiées : plus de 168 h dans la semaine. Le mois ne peut pas être passé. */
export const isOverbooked = (state: GameState): boolean => weekBreakdown(state).free < 0;

/**
 * Règle un curseur du planning, borné par son min/max. Rien n'empêche de dépasser les 168 h :
 * c'est au joueur de corriger (le dépassement est signalé et bloque le passage du mois).
 */
export function setSchedule(state: GameState, key: ScheduleKey, value: number): GameState {
  const def = SCHEDULE[key];
  // Les heures de travail ne dépassent jamais le contrat ; sans poste, il n'y en a pas.
  const max = key === 'work' ? jobById(state.job)?.hours ?? 0 : def.max;
  const next = clamp(Math.round(value), def.min, max);
  if (next === state.schedule[key]) return state;
  const s = structuredClone(state);
  s.schedule[key] = next;
  return s;
}
