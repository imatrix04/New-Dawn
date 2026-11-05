import type { Drawback, SkillId } from '../../game/types';

/** Blâmes après lesquels le joueur est renvoyé de sa formation. */
export const MAX_BLAMES = 3;

/**
 * Formations. Elles coûtent de l'argent chaque mois. L'inscription réserve `minStudyHours` heures par semaine
 * dans le curseur « Études » du planning ; en faire moins expose à un blâme (d'autant plus probable que l'écart est grand).
 *
 * Les formations rapides (`quick`) sont de courts certificats hors diplôme : à la fin elles donnent des compétences
 * (`skills`), comptent comme qualification pour certains postes et augmentent la chance d'être embauché
 * dans un domaine (`hireBonus`). Les montants sont des estimations de jeu.
 *
 * École hôtelière : école privée, 9 100 € par an (Ferrandi Paris, année de mise à niveau, tarif 2026 selon l'Onisep),
 * soit 758 € par mois sur 24 mois (≈ 18 200 € au total). Les lycées hôteliers publics sont gratuits, mais ils ne
 * sont pas modélisés pour l'instant.
 */
export interface TrainingConfig {
  months: number;
  tuition: number;
  minStudyHours: number;
  quick?: boolean;
  /** Compétences gagnées à la fin de la formation. */
  skills?: Partial<Record<SkillId, number>>;
  /** Compétences gagnées chaque mois de formation (au prorata des heures faites) ; remplace le gain des heures d'étude. */
  monthlySkills?: Partial<Record<SkillId, number>>;
  /** Bonus de chance d'embauche pour les postes de ce domaine. */
  hireBonus?: { field: string; bonus: number };
  /** Formations à avoir déjà obtenues pour s'inscrire (ex : le permis poids lourd suppose le permis B). */
  requires?: string[];
  /** Plus il est grand, plus la formation revient souvent au catalogue. */
  weight: number;
  /** Effet mensuel sur les jauges tant qu'on est inscrit (fatigue, stress). */
  drawback: Drawback;
}

export const TRAININGS: Record<string, TrainingConfig> = {
  hotelSchool: { months: 24, tuition: 758, minStudyHours: 20, monthlySkills: { digital: 5, intelligence: 5, charisma: 20 }, weight: 1, drawback: { health: -1.5, happiness: -2.5 } },
  caces: { months: 1, tuition: 350, minStudyHours: 5, quick: true, skills: { logistics: 60 }, hireBonus: { field: 'transport', bonus: 0.15 }, weight: 2, drawback: { health: -1 } },
  permisB: { months: 3, tuition: 600, minStudyHours: 4, quick: true, skills: { logistics: 30 }, hireBonus: { field: 'transport', bonus: 0.1 }, weight: 4, drawback: { happiness: -1.5 } },
  permisA: { months: 2, tuition: 500, minStudyHours: 3, quick: true, skills: { logistics: 20, strength: 10 }, hireBonus: { field: 'transport', bonus: 0.05 }, weight: 2, drawback: { health: -0.5, happiness: -1 } },
  permisC: { months: 3, tuition: 1000, minStudyHours: 6, quick: true, skills: { logistics: 50 }, hireBonus: { field: 'transport', bonus: 0.15 }, requires: ['permisB'], weight: 1, drawback: { health: -1, happiness: -2 } },
  barista: { months: 1, tuition: 250, minStudyHours: 4, quick: true, skills: { charisma: 40 }, hireBonus: { field: 'restaurant', bonus: 0.15 }, weight: 4, drawback: { happiness: -1 } },
  // Formations de manager, une par niveau de restauration (diplômes réels, en alternance de 24 mois ; coûts mensuels estimés).
  tpMum: { months: 24, tuition: 300, minStudyHours: 8, skills: { charisma: 40, intelligence: 30 }, weight: 3, drawback: { health: -0.5, happiness: -1.5 } },
  bpService: { months: 24, tuition: 350, minStudyHours: 8, skills: { charisma: 50, intelligence: 30 }, weight: 3, drawback: { health: -0.5, happiness: -1.5 } },
  btsMhr: { months: 24, tuition: 450, minStudyHours: 12, skills: { charisma: 60, intelligence: 60 }, weight: 2, drawback: { health: -1, happiness: -2 } },
  officeSuite: { months: 2, tuition: 400, minStudyHours: 6, quick: true, skills: { digital: 80 }, hireBonus: { field: 'office', bonus: 0.15 }, weight: 3, drawback: { happiness: -1.5 } },
};
