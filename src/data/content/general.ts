import type { StartPath, StatDef } from '../../game/types';

export const EVENT_CHANCE = 0.55;
export const DEBT_LIMIT = -2000;

/** Savoir gagné par heure d'étude hebdomadaire et par mois. */
export const KNOWLEDGE_PER_STUDY_HOUR = 0.3;
/** Coût mensuel des loisirs, par heure hebdomadaire de loisirs. */
export const LEISURE_COST_PER_WEEKLY_HOUR = 3;

// ---------- Dépenses et départ ----------

/** Dépenses mensuelles = nourriture + loyer du logement + entretien de la voiture + loisirs. */
export const FOOD_COST = 250;

export const CARS: Record<string, { upkeep: number }> = {
  small: { upkeep: 60 },
};

/** Ce que chaque parcours de départ donne au personnage. */
export const START: Record<StartPath, { money: number; housing: string; car: string | null }> = {
  comfort: { money: 3000, housing: 'studio', car: 'small' },
  tight: { money: 300, housing: 'shared', car: null },
};

export const START_STATS ={ health: 80, happiness: 60 };

export const STATS: StatDef[] = [
  { key: 'health',    icon: '❤️', color: '#ff7a95' },
  { key: 'happiness', icon: '😊', color: '#f5c85b' },
];
