// Offres d'emploi visibles : tirage, expiration, réponses aux candidatures.
import { COMPANIES, JOBS, OFFER_MONTHS, OFFER_WEIGHT, OFFERS_MAX, STARTER_JOBS } from '../../data/content';
import type { Application, GameState, Job, JobDecision, JobOffer } from '../types';
import { hireChance, isApplied, jobEligibility } from './career';
import { scheduleEffects } from './effects';
import { jobById, salaryAt } from './lookup';
import { addLog, drawWeighted } from './shared';

/** Nouvelle offre pour un poste : une entreprise qui recrute est tirée au hasard, et fixe le salaire. */
export function makeOffer(job: Job): JobOffer {
  const pool = COMPANIES.filter((c) => c.jobs.includes(job.id));
  const company = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  return { jobId: job.id, monthsLeft: OFFER_MONTHS[job.grade], companyId: company?.id ?? '', salary: salaryAt(job, company) };
}

/** Premières offres visibles : les postes de départ, qui durent longtemps. */
export const starterOffers = (): JobOffer[] => STARTER_JOBS.map((id) => makeOffer(jobById(id)!));

/**
 * Chaque candidature avance d'un mois ; quand son délai est écoulé, la réponse est tirée. Les offres acceptées
 * sont retirées de la liste et réunies dans une alerte (à prendre tout de suite ou à laisser), les refus aussi.
 */
export function resolveApplications(s: GameState) {
  const decision: JobDecision = { accepted: [], refused: [] };
  const pending: Application[] = [];
  for (const app of s.applications) {
    const job = jobById(app.jobId);
    const offer = s.offers.find((o) => o.jobId === app.jobId);
    if (!job || !offer || !jobEligibility(s, job).ok) continue; // l'offre ou les conditions ont disparu
    if (app.monthsLeft > 1) {
      pending.push({ ...app, monthsLeft: app.monthsLeft - 1 });
    } else if (Math.random() < hireChance(s, job)) {
      decision.accepted.push({ jobId: job.id, companyId: offer.companyId, salary: offer.salary });
      s.offers = s.offers.filter((o) => o !== offer);
    } else {
      decision.refused.push(job.id);
      addLog(s, 'log.jobNone', { jobId: job.id, gender: s.gender });
    }
  }
  s.applications = pending;
  if (decision.accepted.length || decision.refused.length) s.jobDecision = decision;
}

/** Tire `count` postes distincts, les plus prestigieux étant les plus rares (poids par grade). */
const drawJobs = (candidates: Job[], count: number): Job[] => drawWeighted(candidates, (j) => OFFER_WEIGHT[j.grade], count);

/**
 * Fin de mois côté offres : les offres vieillissent et expirent, puis chaque heure de recherche hebdomadaire
 * amène une nouvelle offre qui remplace les plus anciennes quand la liste est pleine. Sans recherche, rien de neuf.
 */
export function refreshOffers(s: GameState) {
  const before = s.offers.length;
  // Une offre à laquelle on a postulé est gelée jusqu'à la réponse.
  s.offers = s.offers.map((o) => (isApplied(s, o.jobId) ? o : { ...o, monthsLeft: o.monthsLeft - 1 })).filter((o) => o.monthsLeft > 0);
  const expired = before - s.offers.length;
  if (expired > 0 && !s.offers.length) addLog(s, 'log.noOffers');

  const wanted = scheduleEffects(s.schedule).searchOffers;
  if (wanted <= 0) return;
  const shown = new Set(s.offers.map((o) => o.jobId));
  const fresh = drawJobs(JOBS.filter((j) => j.id !== s.job && !shown.has(j.id)), wanted);
  if (!fresh.length) return;

  // Place : on retire d'abord les offres les plus proches de l'expiration (jamais celle à laquelle on postule).
  const overflow = s.offers.length + fresh.length - OFFERS_MAX;
  if (overflow > 0) {
    const drop = s.offers
      .filter((o) => !isApplied(s, o.jobId))
      .sort((a, b) => a.monthsLeft - b.monthsLeft)
      .slice(0, overflow);
    s.offers = s.offers.filter((o) => !drop.includes(o));
  }
  s.offers.push(...fresh.map(makeOffer));
  addLog(s, 'log.newOffers', { count: fresh.length }, 'good');
}
