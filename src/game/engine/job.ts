// Poste actuel : heures travaillées, blâmes, période d'essai, démission, réponse aux candidatures, boulot rapide.
import { BOSSES, JOBS, MAX_BLAMES, PROBATION_MONTHS } from '../../data/content';
import type { GameState, Job } from '../types';
import { rollBoss } from './boss';
import { experienceMonths } from './career';
import { companyById, gigById, gigUnlocked, jobById } from './lookup';
import { addLog, clamp, NO_PROBATION } from './shared';

/** Heures réellement travaillées par semaine au poste : le curseur, sans dépasser le contrat. */
export const workedHours = (state: GameState): number => {
  const job = jobById(state.job);
  return job ? Math.min(state.schedule.work, job.hours) : 0;
};

/** Risque de blâme du mois : 0 si le joueur fait toutes ses heures, jusqu'à 1 s'il n'en fait aucune. */
export function jobBlameChance(state: GameState): number {
  const job = jobById(state.job);
  // Un supérieur strict ou méchant remarque plus souvent les heures sautées.
  const strictness = state.boss ? BOSSES[state.boss.type].blame : 1;
  return job ? clamp((1 - workedHours(state) / job.hours) * strictness, 0, 1) : 0;
}

export const probationMonths = (job: Job): number => job.probation ?? PROBATION_MONTHS[job.grade];

/** Mois de période d'essai restants au poste actuel (0 = confirmé). */
export function probationLeft(state: GameState): number {
  const job = jobById(state.job);
  return job ? Math.max(0, probationMonths(job) - (state.month - state.jobStart)) : 0;
}

/** Prend un nouveau poste : compteurs remis à zéro et heures du contrat réservées dans le planning. */
export function startJob(s: GameState, job: Job, salary: number, companyId: string | null) {
  s.job = job.id;
  s.jobSalary = salary;
  s.jobCompany = companyId || null;
  s.jobBlames = 0;
  s.jobStart = s.month;
  s.schedule.work = job.hours;
  // Les promotions se comptent poste par poste : la première proposition du nouveau poste redevient certaine.
  s.promotionSeen = false;
  s.promotionRequested = null;
  // Nouveau supérieur, et le compteur d'augmentation repart de zéro.
  s.boss = rollBoss(companyById(companyId));
  s.raiseSince = s.month;
  s.raiseWaitUntil = 0;
  s.raiseOffer = null;
  s.raiseReply = null;
}

function leaveJob(s: GameState) {
  s.job = null;
  s.jobSalary = null;
  s.jobCompany = null;
  s.jobBlames = 0;
  s.jobStart = NO_PROBATION;
  s.schedule.work = 0;
  s.boss = null;
  s.raiseOffer = null;
  s.raiseReply = null;
}

/** Démissionne : sans emploi, sans malus. */
export function quitJob(state: GameState): GameState {
  const job = jobById(state.job);
  if (!job) return state;
  const s = structuredClone(state);
  addLog(s, 'log.jobQuit', { jobId: job.id, gender: s.gender });
  leaveJob(s);
  return s;
}

/** Réponse à l'alerte de fin de mois : prendre l'une des offres acceptées (id), ou garder sa situation (null). */
export function resolveJobDecision(state: GameState, jobId: string | null): GameState {
  const decision = state.jobDecision;
  if (!decision) return state;
  const offer = jobId === null ? null : decision.accepted.find((o) => o.jobId === jobId);
  const job = offer ? jobById(offer.jobId) : null;
  if (jobId !== null && (!offer || !job)) return state;
  const s = structuredClone(state);
  s.jobDecision = null;
  if (offer && job) {
    startJob(s, job, offer.salary, offer.companyId);
    const company = companyById(offer.companyId);
    addLog(s, company ? 'log.jobFoundAt' : 'log.jobFound', { jobId: job.id, gender: s.gender, salary: offer.salary, company: company?.name ?? '' }, 'good');
  }
  return s;
}

/** Démarre un boulot rapide (ou l'arrête avec null) : un seul à la fois. */
export function setGig(state: GameState, id: string | null): GameState {
  if (id === state.gig) return state;
  const gig = gigById(id);
  if (id !== null && (!gig || !state.catalog.gigs.includes(id) || !gigUnlocked(state, gig))) return state;
  const s = structuredClone(state);
  s.gig = id;
  return s;
}

/** Un mois de travail = un mois d'expérience dans le domaine ; on prévient quand un palier utile est franchi. */
export function gainExperience(s: GameState, job: Job) {
  const before = experienceMonths(s, job.field);
  s.experience[job.field] = before + 1;
  s.history[job.id] = (s.history[job.id] ?? 0) + 1;
  for (const j of JOBS) {
    for (const q of j.anyOf ?? []) {
      if (q.type === 'experience' && q.field === job.field && before < q.months && before + 1 >= q.months) {
        addLog(s, 'log.experienceReached', { field: job.field, months: q.months }, 'good');
      }
    }
  }
}

/**
 * Un blâme au poste (double pendant la période d'essai) ; au troisième, le joueur est renvoyé, et ce renvoi
 * pèse sur ses candidatures des mois suivants.
 */
export function blameJob(s: GameState, job: Job, lost: number) {
  s.jobBlames += probationLeft(s) > 0 ? 2 : 1;
  if (s.jobBlames >= MAX_BLAMES) {
    addLog(s, 'log.jobFired', { jobId: job.id, gender: s.gender, lost }, 'bad');
    leaveJob(s);
    s.firedMonth = s.month;
  } else {
    addLog(s, 'log.jobBlamed', { jobId: job.id, gender: s.gender, n: s.jobBlames, max: MAX_BLAMES, lost }, 'bad');
  }
}
