import type { Job, Schedule, ScheduleKey, StartPath, StatDef } from '../game/types';

export const EVENT_CHANCE = 0.55;
export const DEBT_LIMIT = -2000;

// ---------- Temps ----------

export const HOURS_PER_WEEK = 24 * 7; // 168
// Un tour = un mois ; la semaine type du planning s'applique à toutes les semaines du mois.
/** Repas, hygiène, courses : incompressible (2 h/jour). */
export const ESSENTIALS_PER_WEEK = 14;

/** Réglages du planning : bornes et unité (par jour ou par semaine). */
export const SCHEDULE: Record<ScheduleKey, { min: number; max: number; perDay: boolean }> = {
  sleep:   { min: 3, max: 9,  perDay: true },
  leisure: { min: 0, max: 7,  perDay: true },
  study:   { min: 0, max: 20, perDay: false },
  sport:   { min: 0, max: 14, perDay: false },
  search:  { min: 0, max: 10, perDay: false },
};

export const DEFAULT_SCHEDULE: Schedule = { sleep: 7, leisure: 5, study: 0, sport: 2, search: 0 };

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
  { id: 'free',       color: '#2e3450', icon: '⏳' },
] as const;
export type TimeCat = (typeof TIME_CATS)[number]['id'];

// ---------- Effets du planning sur les jauges (par mois) ----------

/** Part de l'écart à la cible comblée chaque mois (inertie de l'énergie). */
export const INERTIA = 0.5;

/** Santé : ±1 point par mois pour chaque heure de sommeil par jour au-dessus / en dessous de ce seuil. */
export const SLEEP_NEUTRAL = 7;
/** Bonheur : ±1 point par mois pour chaque heure de loisirs par jour au-dessus / en dessous de ce seuil. */
export const LEISURE_NEUTRAL = 5;
/** Santé gagnée par heure de sport hebdomadaire et par mois. */
export const SPORT_HEALTH_PER_HOUR = 0.5;
/** Sous ce seuil d'énergie, la santé baisse en plus chaque mois. */
export const EXHAUSTION_ENERGY = 20;
export const EXHAUSTION_HEALTH_LOSS = 2;
/** Bonheur perdu chaque mois passé à découvert. */
export const DEBT_HAPPINESS_LOSS = 3;
/** Savoir gagné par heure d'étude hebdomadaire et par mois. */
export const KNOWLEDGE_PER_STUDY_HOUR = 0.3;
/** Chance de trouver un meilleur emploi par heure de recherche hebdomadaire (plafonnée). */
export const SEARCH_CHANCE_PER_HOUR = 0.15;
export const SEARCH_CHANCE_MAX = 0.9;
/** Coût mensuel des loisirs, par heure hebdomadaire de loisirs. */
export const LEISURE_COST_PER_WEEKLY_HOUR = 3;

// ---------- Dépenses et départ ----------

/** Dépenses mensuelles = nourriture + loyer du logement + entretien de la voiture + loisirs. */
export const FOOD_COST = 250;

export const HOUSING: Record<string, { rent: number }> = {
  studio: { rent: 450 },
  shared: { rent: 300 },
};

export const CARS: Record<string, { upkeep: number }> = {
  small: { upkeep: 60 },
};

/** Ce que chaque parcours de départ donne au personnage. */
export const START: Record<StartPath, { money: number; housing: string; car: string | null }> = {
  comfort: { money: 3000, housing: 'studio', car: 'small' },
  tight: { money: 300, housing: 'shared', car: null },
};

/** Petits boulots proposés au départ confortable (aucune exigence de savoir). */
export const STARTER_JOBS = ['waiter', 'cashier', 'driver'];

export const START_STATS = { health: 80, happiness: 60, energy: 80, knowledge: 10 };

export const STATS: StatDef[] = [
  { key: 'health',    icon: '❤️', color: '#ff7a95' },
  { key: 'happiness', icon: '😊', color: '#f5c85b' },
  { key: 'energy',    icon: '⚡', color: '#5bb4f5' },
  { key: 'knowledge', icon: '📚', color: '#a77bf5' },
];

/** Triés par exigence croissante : le dernier éligible est le meilleur. */
export const JOBS: Job[] = [
  { id: 'waiter',     salary: 1100, knowledge: 0,  hours: 35, commute: 3 },
  { id: 'cashier',    salary: 1250, knowledge: 10, hours: 35, commute: 4 },
  { id: 'driver',     salary: 1400, knowledge: 18, hours: 40, commute: 2 },
  { id: 'office',     salary: 1800, knowledge: 30, hours: 35, commute: 7 },
  { id: 'accountant', salary: 2400, knowledge: 50, hours: 39, commute: 9 },
  { id: 'engineer',   salary: 3200, knowledge: 70, hours: 42, commute: 12 },
];
