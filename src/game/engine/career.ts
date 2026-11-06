// Candidatures : conditions d'accès, chance d'être embauché, postuler.
import { EXPERIENCE_BONUS_MAX, EXPERIENCE_BONUS_PER_YEAR, FIRED_HIRE_PENALTY, FIRED_MEMORY_MONTHS, HIGHER_RANK_HIRE_BONUS, HIRE_CHANCE, HIRE_CHANCE_MAX, HIRE_CHANCE_MIN, MAX_APPLICATIONS, REVIEW_MONTHS, JOBS, TRAININGS } from '../../data/content';
import type { GameState, Job, SkillId } from '../types';
import { jobById } from './lookup';
import { clamp } from './shared';

export const experienceMonths = (state: GameState, field: string): number => state.experience[field] ?? 0;

export interface Eligibility {
  skills: boolean;
  qualified: boolean;
  ok: boolean;
}

/** Remplit-on les conditions du poste ? Compétences suffisantes ET, si le poste l'exige, au moins une qualification. */
export function jobEligibility(state: GameState, job: Job): Eligibility {
  const skills = Object.entries(job.minSkills ?? {}).every(([id, min]) => state.skills[id as SkillId] >= min);
  const qualified = !job.anyOf || job.anyOf.some((q) => (
    q.type === 'experience' ? experienceMonths(state, q.field) >= q.months : state.diplomas.includes(q.id)
  ));
  return { skills, qualified, ok: skills && qualified };
}

export type HireBonus =
  | { type: 'training'; id: string; value: number }
  | { type: 'experience'; field: string; months: number; value: number }
  /** Poste de grade supérieur déjà occupé dans le même domaine. */
  | { type: 'rank'; jobId: string; value: number }
  /** Malus (valeur négative) d'un renvoi récent. */
  | { type: 'fired'; months: number; value: number };

/** Mois écoulés depuis le dernier renvoi s'il est assez récent pour peser sur les candidatures, sinon null. */
export const recentFiring = (state: GameState): number | null => {
  const ago = state.firedMonth === null ? null : state.month - state.firedMonth;
  return ago !== null && ago < FIRED_MEMORY_MONTHS ? ago : null;
};

export interface HireBreakdown {
  /** Chance de base, selon le grade du poste. */
  base: number;
  bonuses: HireBonus[];
  /** Base + bonus, plafonnée. */
  total: number;
}

/**
 * Chance d'être embauché chaque mois sur ce poste, détaillée : base du grade, bonus des formations suivies
 * dans le même domaine, bonus d'expérience dans le domaine, et bonus d'un poste plus élevé déjà occupé.
 */
export function hireBreakdown(state: GameState, job: Job): HireBreakdown {
  const bonuses: HireBonus[] = [];
  for (const id of state.diplomas) {
    const b = TRAININGS[id]?.hireBonus;
    if (b && b.field === job.field) bonuses.push({ type: 'training', id, value: b.bonus });
  }
  const months = experienceMonths(state, job.field);
  const value = Math.min(EXPERIENCE_BONUS_MAX, Math.floor(months / 12) * EXPERIENCE_BONUS_PER_YEAR);
  if (value > 0) bonuses.push({ type: 'experience', field: job.field, months, value });
  const higher = JOBS.filter((j) => j.field === job.field && j.grade > job.grade && (state.history[j.id] ?? 0) > 0).sort((a, b) => b.grade - a.grade)[0];
  if (higher) bonuses.push({ type: 'rank', jobId: higher.id, value: HIGHER_RANK_HIRE_BONUS });
  const firedAgo = recentFiring(state);
  if (firedAgo !== null) bonuses.push({ type: 'fired', months: firedAgo, value: -FIRED_HIRE_PENALTY });
  const base = HIRE_CHANCE[job.grade];
  const total = base + bonuses.reduce((sum, b) => sum + b.value, 0);
  return { base, bonuses, total: clamp(total, HIRE_CHANCE_MIN, HIRE_CHANCE_MAX) };
}

export const hireChance = (state: GameState, job: Job): number => hireBreakdown(state, job).total;

export const isApplied = (state: GameState, jobId: string): boolean => state.applications.some((a) => a.jobId === jobId);

/** Mois avant la réponse à une candidature : plus long pour les postes prestigieux. */
export const reviewMonths = (job: Job): number => REVIEW_MONTHS[job.grade];

/**
 * Postule à une offre visible, ou retire la candidature si elle existe déjà. Seules les offres accessibles
 * peuvent être visées, et pas plus de MAX_APPLICATIONS à la fois.
 */
export function toggleApplication(state: GameState, id: string): GameState {
  const s = structuredClone(state);
  if (isApplied(s, id)) {
    s.applications = s.applications.filter((a) => a.jobId !== id);
    return s;
  }
  const job = jobById(id);
  if (!job || job.id === s.job || !s.offers.some((o) => o.jobId === id) || !jobEligibility(s, job).ok) return state;
  if (s.applications.length >= MAX_APPLICATIONS) return state;
  s.applications.push({ jobId: id, monthsLeft: reviewMonths(job) });
  return s;
}
