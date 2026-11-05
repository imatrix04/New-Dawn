// Promotions de manager proposées par l'employeur ou demandées par le joueur.
import { PROMOTION_CHANCE, PROMOTION_REQUEST_BASE, PROMOTION_REQUEST_BLAME_PENALTY, PROMOTION_REQUEST_COOLDOWN, PROMOTION_REQUEST_MAX_BONUS, PROMOTION_REQUEST_PER_YEAR, PROMOTIONS } from '../../data/content';
import type { GameState, Job } from '../types';
import { jobEligibility } from './career';
import { startJob } from './job';
import { companyById, jobById, salaryAt } from './lookup';
import { addLog, clamp } from './shared';

/** Promotion possible au poste actuel : assez d'ancienneté, ni formation en cours ni proposition en attente. */
export function promotionAvailable(state: GameState): { to: Job; training?: string } | null {
  const job = jobById(state.job);
  const rule = job && PROMOTIONS[job.id];
  const to = rule && jobById(rule.to);
  if (!job || !rule || !to || (rule.training && state.training) || state.promotion || state.jobDecision) return null;
  return (state.history[job.id] ?? 0) >= rule.months ? { to, training: rule.training } : null;
}

/** Chance que l'employeur accepte la demande de promotion : l'ancienneté aide, les blâmes pèsent. */
export function promotionRequestChance(state: GameState): number {
  const rule = PROMOTIONS[state.job ?? ''];
  if (!rule) return 0;
  const yearsOver = Math.floor(((state.history[state.job!] ?? 0) - rule.months) / 12);
  const bonus = Math.min(PROMOTION_REQUEST_MAX_BONUS, Math.max(0, yearsOver) * PROMOTION_REQUEST_PER_YEAR);
  return clamp(PROMOTION_REQUEST_BASE + bonus - state.jobBlames * PROMOTION_REQUEST_BLAME_PENALTY, 0.05, 0.95);
}

/** Mois à attendre avant de pouvoir redemander une promotion (0 = possible). */
export const promotionRequestWait = (state: GameState): number =>
  state.promotionRequested === null ? 0 : Math.max(0, PROMOTION_REQUEST_COOLDOWN - (state.month - state.promotionRequested));

/** Passe au poste de manager chez le même employeur : nouveau contrat, nouvelle période d'essai. */
export function promote(s: GameState, job: Job) {
  const salary = salaryAt(job, companyById(s.jobCompany));
  startJob(s, job, salary, s.jobCompany);
  addLog(s, 'log.promoted', { jobId: job.id, gender: s.gender, salary }, 'good');
}

function proposePromotion(s: GameState, to: Job) {
  s.promotion = to.id;
  s.promotionSeen = true;
  addLog(s, 'log.promotionOffer', { jobId: to.id, gender: s.gender }, 'good');
}

/**
 * Fin de mois : l'employeur fait sa première proposition dès le seuil atteint (ou au hasard dans la fenêtre
 * `months` à `latest` si le poste en a une), puis seulement rarement après un refus.
 */
export function rollPromotion(s: GameState) {
  const available = promotionAvailable(s);
  const rule = PROMOTIONS[s.job ?? ''];
  if (!available || !rule) return;
  const monthsLeft = (rule.latest ?? rule.months) - (s.history[s.job!] ?? 0);
  const chance = s.promotionSeen ? PROMOTION_CHANCE : 1 / Math.max(1, monthsLeft + 1);
  if (Math.random() >= chance) return;
  proposePromotion(s, available.to);
}

/** Le joueur demande lui-même une promotion : s'il l'obtient, la proposition arrive aussitôt. */
export function requestPromotion(state: GameState): GameState {
  const available = promotionAvailable(state);
  if (!available || promotionRequestWait(state) > 0) return state;
  const s = structuredClone(state);
  s.promotionRequested = s.month;
  if (Math.random() < promotionRequestChance(state)) {
    addLog(s, 'log.promotionGranted', {}, 'good');
    proposePromotion(s, available.to);
  } else {
    addLog(s, 'log.promotionDenied', {}, 'bad');
  }
  return s;
}

/**
 * Réponse à la proposition de l'employeur. Accepter donne le poste tout de suite si le joueur a déjà la formation ;
 * sinon l'employeur l'inscrit à la formation, payée et suivie pendant les heures de travail.
 */
export function resolvePromotion(state: GameState, accept: boolean): GameState {
  const job = jobById(state.job);
  const rule = job && PROMOTIONS[job.id];
  const to = rule && jobById(rule.to);
  if (!state.promotion || !rule || !to || state.promotion !== to.id) {
    return state.promotion ? { ...state, promotion: null } : state;
  }
  if (accept && rule.training && state.training && !jobEligibility(state, to).qualified) return state;
  const s = structuredClone(state);
  s.promotion = null;
  if (!accept) {
    addLog(s, 'log.promotionRefused', { jobId: to.id, gender: s.gender });
  } else if (!rule.training || jobEligibility(s, to).qualified) {
    promote(s, to);
  } else {
    s.training = { id: rule.training, monthsDone: 0, blames: 0, tuition: 0, sponsored: true };
    addLog(s, 'log.promotionTraining', { trainingId: rule.training }, 'good');
  }
  return s;
}
