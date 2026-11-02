import type { ActionDef, Job, StartPath, StatDef } from '../game/types';

export const EVENT_CHANCE = 0.55;
export const DEBT_LIMIT = -2000;

/** Dépenses mensuelles = nourriture + loyer du logement + entretien de la voiture. */
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
  { key: 'health',    icon: '❤️', color: '#e5645f' },
  { key: 'happiness', icon: '😊', color: '#f5c85b' },
  { key: 'energy',    icon: '⚡', color: '#5bb4f5' },
  { key: 'knowledge', icon: '📚', color: '#a77bf5' },
];

/** Triés par exigence croissante : le dernier éligible est le meilleur. */
export const JOBS: Job[] = [
  { id: 'waiter',     salary: 1100, knowledge: 0 },
  { id: 'cashier',    salary: 1250, knowledge: 10 },
  { id: 'driver',     salary: 1400, knowledge: 18 },
  { id: 'office',     salary: 1800, knowledge: 30 },
  { id: 'accountant', salary: 2400, knowledge: 50 },
  { id: 'engineer',   salary: 3200, knowledge: 70 },
];

export const ACTIONS: ActionDef[] = [
  { id: 'work' },
  { id: 'study' },
  { id: 'rest' },
  { id: 'social' },
  { id: 'sport' },
  { id: 'search' },
];
