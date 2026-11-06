// Augmentations : demande au supérieur, contre-proposition, refus.
import { BOSSES, RAISE } from '../../data/content';
import type { GameState } from '../types';
import { blameJob, probationMonths } from './job';
import { currentSalary, jobById } from './lookup';
import { addLog, clamp } from './shared';

export interface RaiseStatus {
  /** Mois avant de pouvoir demander (0 = possible maintenant). */
  wait: number;
  canAsk: boolean;
}

export function raiseStatus(state: GameState): RaiseStatus {
  const job = jobById(state.job);
  if (!job || !state.boss || state.raiseOffer !== null) return { wait: 0, canAsk: false };
  const earliest = Math.max(state.raiseSince + RAISE.minMonths, state.raiseWaitUntil, state.jobStart + probationMonths(job));
  const wait = Math.max(0, earliest - state.month);
  return { wait, canAsk: wait === 0 };
}

/** Un an après l'embauche ou la dernière augmentation, on prévient le joueur qu'il peut en demander une. */
export function announceRaise(s: GameState) {
  if (s.job && s.boss && s.month - s.raiseSince === RAISE.minMonths && raiseStatus(s).canAsk) addLog(s, 'log.raiseEligible', {}, 'good');
}

function grant(s: GameState, pct: number) {
  const job = jobById(s.job)!;
  s.jobSalary = Math.round(currentSalary(s) * (1 + pct));
  s.raiseSince = s.month;
  s.raiseWaitUntil = 0;
  s.raiseOffer = null;
  s.raiseReply = { kind: 'approved', pct, month: s.month };
  addLog(s, `raise.reply.approved.${s.boss!.type}`, { pct: Math.round(pct * 1000) / 10, salary: s.jobSalary, jobId: job.id }, 'good');
}

/**
 * Le joueur demande `pct` d'augmentation. Le supérieur accorde ce qu'il juge raisonnable (selon son type, l'ancienneté et
 * les blâmes, avec un peu de hasard) : en dessous, c'est oui ; un peu au-dessus, une contre-proposition (ou un refus s'il
 * est têtu) ; bien au-dessus, un refus, qui peut coûter un blâme avec un supérieur méchant.
 */
export function requestRaise(state: GameState, pct: number): GameState {
  if (!raiseStatus(state).canAsk) return state;
  const job = jobById(state.job);
  if (!job || !state.boss || !(pct > 0)) return state;
  const s = structuredClone(state);
  const ask = clamp(pct, RAISE.minAsk, RAISE.maxAsk);
  const boss = s.boss!;
  const cfg = BOSSES[boss.type];
  const years = (s.history[job.id] ?? 0) / 12;
  const merit = clamp(Math.min(RAISE.maxSeniority, years * RAISE.perYear) - s.jobBlames * RAISE.perBlame, -0.03, RAISE.maxSeniority);
  const cap = Math.max(0.005, (cfg.cap + merit) * (0.85 + Math.random() * 0.3));

  if (ask <= cap) {
    grant(s, ask);
  } else if (ask <= cap * RAISE.counterRange && Math.random() >= cfg.stubborn) {
    const counter = Math.max(0.005, Math.floor(cap * 200) / 200);
    s.raiseOffer = counter;
    s.raiseReply = { kind: 'counter', pct: counter, month: s.month };
    addLog(s, `raise.reply.counter.${boss.type}`, { pct: Math.round(counter * 1000) / 10 });
  } else {
    s.raiseWaitUntil = s.month + RAISE.refusedWait;
    s.raiseReply = { kind: 'refused', pct: ask, month: s.month };
    addLog(s, `raise.reply.refused.${boss.type}`, { pct: Math.round(ask * 1000) / 10 }, 'bad');
    if (Math.random() < cfg.blameOnRefusal) blameJob(s, job, 0);
  }
  return s;
}

/** Réponse à la contre-proposition : l'accepter, ou la décliner (on ne peut pas redemander tout de suite). */
export function answerRaiseOffer(state: GameState, accept: boolean): GameState {
  if (state.raiseOffer === null || !state.boss || !jobById(state.job)) return state;
  const s = structuredClone(state);
  const pct = s.raiseOffer!;
  if (accept) {
    grant(s, pct);
  } else {
    s.raiseOffer = null;
    s.raiseWaitUntil = s.month + RAISE.declinedWait;
    s.raiseReply = { kind: 'declined', pct, month: s.month };
    addLog(s, `raise.reply.declined.${s.boss!.type}`);
  }
  return s;
}
