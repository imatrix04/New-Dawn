// Réputation de manager et références : elles suivent le joueur d'un poste à l'autre.
import { REPUTATION } from '../../data/content';
import type { GameState, Job, Reference } from '../types';
import { jobById } from './lookup';
import { clamp } from './shared';

/** Palier de réputation (0 = inconnu … 4 = légende). */
export const reputationLevel = (rep: number): number => REPUTATION.levels.filter((l) => rep >= l).length - 1;

/** Ajoute (ou retire) des points de réputation ; renvoie la variation réellement appliquée. */
export function addReputation(s: GameState, delta: number): number {
  const before = s.reputation ?? 0;
  s.reputation = clamp(before + delta);
  return s.reputation - before;
}

/** Note de la référence que laisse le poste de management quitté, d'après l'équipe et les blâmes. */
function ratingOf(s: GameState): Reference['rating'] {
  const streak = s.team?.streak ?? 0;
  if (s.jobBlames >= 2 || (streak === 0 && s.efficiency < 40)) return 'poor';
  if (streak >= 2 || (streak >= 1 && s.jobBlames === 0 && (s.reputation ?? 0) >= 40)) return 'excellent';
  return 'good';
}

/** Enregistre la référence du poste de management qu'on quitte (promotion, démission, renvoi), s'il a duré assez longtemps. */
export function recordReference(s: GameState) {
  const job = jobById(s.job);
  if (!job?.management || !s.team) return;
  const months = Math.min(s.month - s.jobStart, s.history[job.id] ?? 0);
  if (months < REPUTATION.minMonths) return;
  s.references = [...(s.references ?? []), { jobId: job.id, company: s.jobCompany, months, rating: ratingOf(s), month: s.month }].slice(-8);
}

/** Bonus d'embauche de la réputation pour un poste de management. */
export const reputationHireBonus = (state: GameState, job: Job): number =>
  job.management ? Math.min(REPUTATION.hireMax, (state.reputation ?? 0) * REPUTATION.hire) : 0;

/** Bonus (ou malus) d'embauche des références dans le même domaine que le poste visé. */
export function referenceHireBonus(state: GameState, job: Job): { value: number; count: number } {
  const same = (state.references ?? []).filter((r) => jobById(r.jobId)?.field === job.field);
  const sum = same.reduce((n, r) => n + REPUTATION.ref[r.rating], 0);
  return { value: clamp(sum, -REPUTATION.ref.max, REPUTATION.ref.max), count: same.length };
}
