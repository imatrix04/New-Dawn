// Passage au mois suivant, évènements aléatoires et leurs choix.
import { CATALOG_REFRESH_MONTHS, EFFICIENCY, EVENT_CHANCE, EVENTS_ENABLED, SKILL_MAX, SKILLS } from '../../data/content';
import { eventById, EVENTS } from '../../data/events';
import type { GameState } from '../types';
import { drawCatalog } from './catalog';
import { rollEconomy } from './economy';
import { monthlyExpenses, projectNextStats, skillGains } from './effects';
import { progressHome, refreshListings, resolveHousingApplication } from './housing';
import { blameJob, fireForSlacking, gainExperience, jobBlameChance, workedHours } from './job';
import { currentSalary, gigById, gigPay, jobById } from './lookup';
import { payEmployeeBonus, payProfitShare } from './bonus';
import { progressTeam } from './management';
import { refreshOffers, resolveApplications } from './offers';
import { rollPromotion } from './promotion';
import { announceRaise } from './raise';
import { efficiencyDelta, endSickMonth, isStrained, startSickLeave, workActive } from './work';
import { lettingIncome, progressProperties } from './property';
import { accrueSavings, closeExpiredSavings } from './savings';
import { isOverbooked } from './schedule';
import { addLog, applyFx, checkOver, clamp } from './shared';
import { progressTraining } from './training';
import { progressVehicle, refreshVehicleListings } from './vehicle';

function rollEvent(s: GameState) {
  s.pendingEvent = null;
  if (!EVENTS_ENABLED || Math.random() > EVENT_CHANCE) return;
  const pool = EVENTS.filter((e) => e.id !== s.lastEvent && (!e.when || e.when(s)));
  if (!pool.length) return;
  const event = pool[Math.floor(Math.random() * pool.length)];
  s.pendingEvent = event.id;
  s.lastEvent = event.id;
}

/** Passe au mois suivant en appliquant le planning actuel. */
export function endTurn(state: GameState): GameState {
  if (isOverbooked(state)) return state; // garde-fou : l'interface bloque déjà le bouton
  if (state.jobDecision || state.promotion) return state; // il faut d'abord répondre aux alertes (candidatures, promotion)
  const s = structuredClone(state);

  // Les jauges sont calculées avant de toucher à l'argent, comme dans l'aperçu affiché au joueur.
  const next = projectNextStats(s);
  const gains = skillGains(s);
  // L'efficacité et l'épuisement du mois se calculent sur l'état de début de mois, comme l'aperçu affiché.
  const effDelta = efficiencyDelta(s);
  const strained = isStrained(s);
  const sick = s.sickLeave > 0;
  s.stats = next;
  for (const { id } of SKILLS) s.skills[id] = clamp(s.skills[id] + gains[id], 0, SKILL_MAX);

  s.efficiency = clamp(s.efficiency + effDelta);
  if (strained) addLog(s, 'log.strain', {}, 'bad');

  const job = jobById(s.job);
  if (job && sick) {
    // Arrêt maladie : une part du salaire seulement, pas de travail, donc ni blâme ni expérience.
    const salary = Math.round(currentSalary(s) * EFFICIENCY.sickPay);
    s.money += salary;
    addLog(s, 'log.paySick', { jobId: job.id, gender: s.gender, amount: salary }, 'good');
    progressTeam(s); // l'équipe tourne sans son manager
  } else if (job) {
    // Heures sautées : si le patron s'en aperçoit, elles ne sont pas payées et le joueur reçoit un blâme.
    const caught = Math.random() < jobBlameChance(s);
    const full = currentSalary(s);
    const salary = caught ? Math.round(full * (workedHours(s) / job.hours)) : full;
    s.money += salary;
    addLog(s, 'log.pay', { jobId: job.id, gender: s.gender, amount: salary }, 'good');
    gainExperience(s, job);
    if (caught) blameJob(s, job, full - salary);
    progressTeam(s); // humeur, production et bilan de l'équipe (rien si le blâme vient de renvoyer le joueur)
    // Primes : celle du manager pour un employé, l'intéressement si l'entreprise en a un (rien si le joueur vient d'être renvoyé).
    const kept = jobById(s.job);
    if (kept) {
      payEmployeeBonus(s, kept);
      payProfitShare(s);
    }
  }
  const gig = gigById(s.gig);
  if (gig) {
    const pay = gigPay(s, gig);
    s.money += pay;
    addLog(s, 'log.gigPay', { gigId: gig.id, amount: pay }, 'good');
  }
  const rentals = lettingIncome(s);
  if (rentals > 0) {
    s.money += rentals;
    addLog(s, 'log.rentals', { amount: rentals }, 'good');
  }
  const expenses = monthlyExpenses(s);
  s.money -= expenses;
  addLog(s, 'log.expenses', { amount: expenses });
  progressHome(s);
  progressProperties(s);
  progressVehicle(s);
  accrueSavings(s);

  progressTraining(s);

  // Efficacité nulle : un avertissement le premier mois, le renvoi le suivant.
  if (workActive(s) && !sick && s.efficiency < 1) {
    s.zeroMonths += 1;
    if (s.zeroMonths >= EFFICIENCY.zeroMonths) fireForSlacking(s);
    else addLog(s, 'log.zeroWarning', {}, 'bad');
  } else {
    s.zeroMonths = 0;
  }

  // Épuisement : à fond avec une santé trop basse, c'est l'arrêt maladie forcé.
  if (sick) endSickMonth(s);
  else if (workActive(s) && s.workStyle === 'hard' && s.stats.health < EFFICIENCY.burnoutHealth) startSickLeave(s);

  resolveApplications(s);
  rollPromotion(s);
  resolveHousingApplication(s);
  refreshOffers(s);
  refreshListings(s);
  refreshVehicleListings(s);

  if (s.stats.happiness < 20) addLog(s, 'log.lowMood', {}, 'bad');
  if (s.money < 0) addLog(s, 'log.overdraft', {}, 'bad');

  s.month += 1;
  if (s.month % CATALOG_REFRESH_MONTHS === 0) {
    s.catalog = drawCatalog(s);
    addLog(s, 'log.catalogRefreshed');
  }
  addLog(s, 'log.monthMark', { month: s.month }, 'month');
  if (s.month % 12 === 0) rollEconomy(s); // chaque janvier : prix de l'immobilier, taux et SMIC
  closeExpiredSavings(s);
  announceRaise(s);

  checkOver(s);
  if (!s.over) rollEvent(s);
  return s;
}

export function resolveChoice(state: GameState, index: number): GameState {
  const event = eventById(state.pendingEvent);
  if (!event) return state;
  const s = structuredClone(state);
  const result = event.choices[index].run(s);
  applyFx(s, result.fx);
  addLog(s, `events.${event.id}.outcomes.${result.outcome}`, {}, result.good ? 'good' : '', {
    titleKey: `events.${event.id}.title`,
    fx: result.fx,
  });
  s.pendingEvent = null;
  checkOver(s);
  return s;
}
