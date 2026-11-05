import type { Drawback, SkillId } from '../../game/types';

// ---------- Boulots rapides ----------

/**
 * Petits boulots sans candidature : un seul à la fois, payés chaque mois, à condition d'être au catalogue.
 * Leurs heures et leurs trajets s'ajoutent à la semaine. Paye ≈ SMIC horaire net × heures × 4,3 semaines.
 * `weight` : plus il est grand, plus le boulot revient souvent au catalogue. `drawback` : effet mensuel sur les jauges.
 */
export interface Gig {
  id: string; // textes : gigs.<id>
  icon: string;
  hours: number;
  /** Heures de trajet par semaine (0 = à distance). */
  commute: number;
  pay: number;
  skills: Partial<Record<SkillId, number>>;
  /** Conditions pour exercer : une seule suffit (compétence atteinte ou certificat obtenu). Absent = ouvert à tous. */
  anyOf?: GigRequirement[];
  weight: number;
  drawback: Drawback;
}

export type GigRequirement = { skill: SkillId; min: number } | { diploma: string };

export const GIGS: Gig[] = [
  { id: 'delivery', icon: '🛵', hours: 8, commute: 1, pay: 380, skills: { logistics: 3, strength: 1 }, weight: 3, drawback: { health: -1.5, happiness: -0.5 } },
  { id: 'babysitting', icon: '🧸', hours: 6, commute: 1, pay: 260, skills: { charisma: 3 }, weight: 2, drawback: { health: -0.5, happiness: -1.5 } },
  { id: 'moving', icon: '📦', hours: 8, commute: 2, pay: 400, skills: { strength: 3 }, weight: 2, drawback: { health: -2, happiness: -0.5 } },
  // Boulots qualifiés : mieux payés, mais verrouillés tant qu'on n'a pas la compétence ou le certificat.
  { id: 'dataEntry', icon: '⌨️', hours: 8, commute: 0, pay: 450, skills: { digital: 3 }, anyOf: [{ skill: 'digital', min: 80 }], weight: 3, drawback: { happiness: -1 } },
  { id: 'tutoring', icon: '📚', hours: 5, commute: 1, pay: 330, skills: { intelligence: 2, charisma: 2 }, anyOf: [{ skill: 'intelligence', min: 150 }], weight: 2, drawback: { happiness: -0.5 } },
  { id: 'pcRepair', icon: '🛠️', hours: 6, commute: 1, pay: 440, skills: { digital: 4 }, anyOf: [{ skill: 'digital', min: 200 }], weight: 2, drawback: { happiness: -0.5 } },
  { id: 'freelanceWeb', icon: '🖥️', hours: 10, commute: 0, pay: 850, skills: { digital: 5 }, anyOf: [{ skill: 'digital', min: 350 }], weight: 1, drawback: { health: -0.5, happiness: -1 } },
  { id: 'translation', icon: '🌐', hours: 8, commute: 0, pay: 620, skills: { intelligence: 4 }, anyOf: [{ skill: 'intelligence', min: 250 }], weight: 1, drawback: { happiness: -1 } },
  { id: 'waiter', icon: '🍽️', hours: 8, commute: 1, pay: 430, skills: { charisma: 3, logistics: 1 }, anyOf: [{ diploma: 'barista' }, { skill: 'charisma', min: 100 }], weight: 3, drawback: { health: -1, happiness: -0.5 } },
  { id: 'baristaExtra', icon: '☕', hours: 6, commute: 1, pay: 360, skills: { charisma: 3 }, anyOf: [{ diploma: 'barista' }], weight: 3, drawback: { health: -0.5, happiness: -0.5 } },
  { id: 'rideshare', icon: '🚗', hours: 10, commute: 1, pay: 700, skills: { logistics: 4, charisma: 1 }, anyOf: [{ diploma: 'permisB' }], weight: 2, drawback: { health: -2, happiness: -1 } },
  { id: 'carDelivery', icon: '🚐', hours: 8, commute: 1, pay: 470, skills: { logistics: 4 }, anyOf: [{ diploma: 'permisB' }], weight: 2, drawback: { health: -1, happiness: -0.5 } },
  { id: 'forklift', icon: '🏗️', hours: 8, commute: 2, pay: 500, skills: { logistics: 5, strength: 1 }, anyOf: [{ diploma: 'caces' }], weight: 2, drawback: { health: -1.5 } },
  { id: 'fitnessCoach', icon: '🏋️', hours: 5, commute: 1, pay: 360, skills: { strength: 2, charisma: 1 }, anyOf: [{ skill: 'strength', min: 250 }], weight: 1, drawback: { health: 1, happiness: 0.5 } },
  { id: 'eventHost', icon: '🎪', hours: 6, commute: 2, pay: 380, skills: { charisma: 4 }, anyOf: [{ skill: 'charisma', min: 150 }], weight: 2, drawback: { health: -0.5 } },
];
