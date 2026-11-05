import type { Schedule, ScheduleKey } from '../../game/types';

// ---------- Temps ----------

export const HOURS_PER_WEEK = 24 * 7; // 168
// Un tour = un mois ; la semaine type du planning s'applique à toutes les semaines du mois.
/** Repas, hygiène, courses : incompressible (2 h/jour). */
export const ESSENTIALS_PER_WEEK = 14;

/** Réglages du planning : bornes et unité (par jour ou par semaine). */
export const SCHEDULE: Record<ScheduleKey, { min: number; max: number; perDay: boolean }> = {
  sleep:   { min: 3, max: 9,  perDay: true },
  work:    { min: 0, max: 60, perDay: false }, // le maximum réel est le contrat du poste
  leisure: { min: 0, max: 7,  perDay: true },
  study:   { min: 0, max: 20, perDay: false },
  sport:   { min: 0, max: 14, perDay: false },
  search:  { min: 0, max: 10, perDay: false },
  housing: { min: 0, max: 10, perDay: false },
};

export const DEFAULT_SCHEDULE: Schedule = { sleep: 7, work: 0, leisure: 5, study: 0, sport: 2, search: 0, housing: 0 };

/** Catégories affichées dans l'anneau de la semaine (ordre = ordre d'affichage). */
export const TIME_CATS = [
  { id: 'sleep',      color: '#5b6cf5', icon: '😴' },
  { id: 'work',       color: '#f5a65b', icon: '💼' },
  { id: 'commute',    color: '#c98b4a', icon: '🚌' },
  { id: 'essentials', color: '#7b8299', icon: '🍽️' },
  { id: 'leisure',    color: '#f5c85b', icon: '🎉' },
  { id: 'study',      color: '#a77bf5', icon: '📚' },
  { id: 'sport',      color: '#5bd48a', icon: '🏃' },
  { id: 'search',     color: '#5bb4f5', icon: '🔎' },
  { id: 'housing',    color: '#e58bd4', icon: '🏠' },
  { id: 'free',       color: '#2e3450', icon: '⏳' },
] as const;
export type TimeCat = (typeof TIME_CATS)[number]['id'];

// ---------- Effets du planning sur les jauges (par mois) ----------

/** Santé : ±1 point par mois pour chaque heure de sommeil par jour au-dessus / en dessous de ce seuil. */
export const SLEEP_NEUTRAL = 7;
/** Bonheur : ±1 point par mois pour chaque heure de loisirs par jour au-dessus / en dessous de ce seuil. */
export const LEISURE_NEUTRAL = 5;
/** Santé gagnée par heure de sport hebdomadaire et par mois. */
export const SPORT_HEALTH_PER_HOUR = 0.5;
/** Bonheur perdu chaque mois passé à découvert. */
export const DEBT_HAPPINESS_LOSS = 3;
