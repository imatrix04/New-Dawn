import type { SkillId } from '../../game/types';

// ---------- Compétences ----------

export const SKILLS: { id: SkillId; icon: string; color: string }[] = [
  { id: 'digital', icon: '💻', color: '#5bb4f5' },
  { id: 'charisma', icon: '✨', color: '#ff9f6b' },
  { id: 'strength', icon: '💪', color: '#ff7a95' },
  { id: 'intelligence', icon: '🧠', color: '#a77bf5' },
  { id: 'logistics', icon: '📦', color: '#5bd48a' },
];

/** Valeur maximale d'une compétence (échelle de 0 à 1000). */
export const SKILL_MAX = 1000;

export const START_SKILLS: Record<SkillId, number> = {
  digital: 10, charisma: 10, strength: 10, intelligence: 10, logistics: 10,
};

/** Gains de compétences par mois (une valeur par heure de planning, ou par mois travaillé dans le domaine). */
export const SKILL_RULES = {
  /** Par heure d'études hebdomadaire. */
  perStudyHour: { intelligence: 2, digital: 1 } as Partial<Record<SkillId, number>>,
  /** Par heure de sport hebdomadaire. */
  perSportHour: { strength: 2 } as Partial<Record<SkillId, number>>,
  /** Par heure de loisirs quotidienne. */
  perLeisureHour: { charisma: 1 } as Partial<Record<SkillId, number>>,
  /** Chaque mois travaillé dans un domaine (job.field). */
  perJobMonth: {
    restaurant: { charisma: 5, logistics: 3 },
    retail: { charisma: 4, logistics: 6 },
    transport: { logistics: 8, strength: 3 },
    office: { digital: 6 },
    finance: { digital: 5, intelligence: 3 },
    engineering: { digital: 5, intelligence: 5 },
  } as Record<string, Partial<Record<SkillId, number>>>,
};
