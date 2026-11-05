// Recherches simples dans les données du jeu : poste, entreprise, boulot rapide, salaire, prix.
import { COMPANIES, GIGS, JOBS, SMIC_NET, TRAININGS } from '../../data/content';
import type { Company, Gig } from '../../data/content';
import type { Drawback, GameState, Job } from '../types';
import { withFactor } from './shared';

export const jobById = (id: string | null): Job | null => JOBS.find((j) => j.id === id) ?? null;

/** Le joueur remplit-il l'une des conditions du boulot rapide (ou n'en a-t-il aucune) ? */
export const gigUnlocked = (state: GameState, gig: Gig): boolean =>
  !gig.anyOf || gig.anyOf.some((r) => ('skill' in r ? state.skills[r.skill] >= r.min : state.diplomas.includes(r.diploma)));

export const gigById =(id: string | null): Gig | null => GIGS.find((g) => g.id === id) ?? null;

export const companyById = (id: string | null): Company | null => COMPANIES.find((c) => c.id === id) ?? null;

/** Salaire proposé : le prix de base ajusté par l'entreprise (±10 % au plus), jamais sous le SMIC. */
export const salaryAt = (job: Job, company: Company | null): number =>
  Math.max(Math.round(SMIC_NET * Math.min(1, job.hours / 35)), Math.round(job.salary * (1 + (company?.pay ?? 0))));

/** Trajet hebdomadaire d'un poste chez une entreprise : celui du poste plus l'ajustement de l'entreprise, jamais sous 0. */
export const jobCommute = (job: Job, company: Company | null): number => Math.max(0, job.commute + (company?.commute ?? 0));

/** Pénibilité d'un poste chez une entreprise : celle du poste plus l'ajustement de l'entreprise, sans jamais devenir un bonus. */
export function jobDrawback(job: Job, company: Company | null): Drawback {
  const out: Drawback = {};
  for (const k of ['health', 'happiness'] as const) {
    const v = Math.min(0, (job.drawback[k] ?? 0) + (company?.drawback[k] ?? 0));
    if (v) out[k] = v;
  }
  return out;
}

/** Salaire mensuel actuel : celui de l'offre acceptée (le prix de base pour une ancienne sauvegarde). */
export const currentSalary = (state: GameState): number => {
  const job = jobById(state.job);
  return job ? state.jobSalary ?? job.salary : 0;
};

/** Prix d'un boulot rapide ce semestre : paie de base ajustée par l'écart tiré au catalogue. */
export const gigPay = (state: GameState, gig: Gig): number => withFactor(gig.pay, state.catalog.factors[gig.id] ?? 0);

/** Coût mensuel d'une formation ou d'une étude : celui fixé à l'inscription si elle est en cours. */
export const trainingPrice = (state: GameState, id: string): number =>
  state.training?.id === id ? state.training.tuition : withFactor(TRAININGS[id].tuition, state.catalog.factors[id] ?? 0);
