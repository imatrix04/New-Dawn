// Poste actuel : heures travaillées, blâmes, période d'essai, démission, réponse aux candidatures, boulot rapide.
import { BOSSES, EFFICIENCY, JOBS, MAX_BLAMES, PROBATION_MONTHS } from '../../data/content';
import type { GameState, Job } from '../types';
import { rollBoss } from './boss';
import { experienceMonths } from './career';
import { companyById, gigById, gigUnlocked, jobById } from './lookup';
import { addLog, clamp, NO_PROBATION } from './shared';
import { newTeam, teamHeadcount } from './team';

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
  if (!job || state.sickLeave > 0) return 0;
  // Une efficacité très basse attire aussi l'attention du supérieur.
  const slack = Math.max(0, EFFICIENCY.lowBelow - state.efficiency) * EFFICIENCY.lowBlameRate;
  return clamp((1 - workedHours(state) / job.hours + slack) * strictness, 0, 1);
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
  // L'efficacité repart bas pour faire ses preuves, plus haut si l'on reste dans le même domaine.
  s.efficiency = s.lastField === job.field ? EFFICIENCY.sameField : EFFICIENCY.newJob;
  s.lastField = job.field;
  // Un poste de manager ou de directeur vient avec une équipe à prendre en main.
  s.team = newTeam(job, companyById(companyId), s.month, s.boss?.type);
  if (s.team) addLog(s, 'log.teamNew', { count: teamHeadcount(s.team), level: s.team.level }, 'good');
}

function leaveJob(s: GameState) {
  s.job = null;
  s.jobSalary = null;
  s.jobCompany = null;
  s.jobBlames = 0;
  s.jobStart = NO_PROBATION;
  s.schedule.work = 0;
  s.boss = null;
  s.team = null;
  s.raiseOffer = null;
  s.raiseReply = null;
}

/**
 * Efficacité nulle depuis trop longtemps : renvoi du poste et exclusion de la formation. Le renvoi pèse sur les
 * candidatures des mois suivants, comme un renvoi pour blâmes.
 */
export function fireForSlacking(s: GameState) {
  const job = jobById(s.job);
  if (job) {
    addLog(s, 'log.firedSlacking', { jobId: job.id, gender: s.gender }, 'bad');
    leaveJob(s);
    s.firedMonth = s.month;
  }
  if (s.training && !s.training.sponsored) {
    addLog(s, 'log.expelledSlacking', { trainingId: s.training.id }, 'bad');
    s.training = null;
    s.schedule.study = 0;
  }
  s.zeroMonths = 0;
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

/** Raison d'un blâme : heures sautées (par défaut), comptes de l'entreprise dans le rouge ou équipe en échec. */
export type BlameCause = 'hours' | 'finance' | 'team';

/**
 * Un blâme au poste (double pendant la période d'essai) ; au troisième, le joueur est renvoyé, et ce renvoi
 * pèse sur ses candidatures des mois suivants.
 */
export function blameJob(s: GameState, job: Job, lost: number, cause: BlameCause = 'hours') {
  s.jobBlames += probationLeft(s) > 0 ? 2 : 1;
  const results = cause !== 'hours';
  if (s.jobBlames >= MAX_BLAMES) {
    addLog(s, results ? 'log.firedResults' : 'log.jobFired', { jobId: job.id, gender: s.gender, lost }, 'bad');
    leaveJob(s);
    s.firedMonth = s.month;
  } else {
    addLog(s, results ? `log.blamed.${cause}` : 'log.jobBlamed', { jobId: job.id, gender: s.gender, n: s.jobBlames, max: MAX_BLAMES, lost }, 'bad');
  }
}
