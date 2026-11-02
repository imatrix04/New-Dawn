// Logique pure du jeu : aucune dépendance à React ni aux textes.
// Les messages sont des clés de traduction (voir src/i18n/locales).
import {
  ACTIONS, CARS, DEBT_LIMIT, EVENT_CHANCE, FOOD_COST, HOUSING, JOBS, START, START_STATS,
} from '../data/content';
import { EVENTS, eventById } from '../data/events';
import type {
  ActionDef, ActionId, Fx, GameState, Job, LogClass, LogEntry, Profile,
} from './types';

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

// ---------- Création / lecture ----------

export function createGame(profile: Profile): GameState {
  const start = START[profile.path];
  const state: GameState = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    month: 0,
    money: start.money,
    job: profile.job,
    housing: start.housing,
    car: start.car,
    lastEvent: null,
    pendingEvent: null,
    over: null,
    stats: { ...START_STATS },
    log: [],
  };
  addLog(state, profile.path === 'comfort' ? 'log.startComfort' : 'log.startTight', {}, 'month');
  return state;
}

export const jobById = (id: string | null): Job | null => JOBS.find((j) => j.id === id) ?? null;

function bestJob(state: GameState): Job {
  const eligible = JOBS.filter((j) => j.knowledge <= state.stats.knowledge);
  return eligible[eligible.length - 1];
}

const jobRank = (id: string | null) => JOBS.findIndex((j) => j.id === id);

/** Nourriture + loyer + entretien de la voiture. */
export function monthlyExpenses(state: GameState): number {
  return FOOD_COST + (HOUSING[state.housing]?.rent ?? 0) + (state.car ? CARS[state.car]?.upkeep ?? 0 : 0);
}

export function availableActions(state: GameState): ActionDef[] {
  return ACTIONS.filter((a) => {
    if (a.id === 'work') return state.job !== null;
    if (a.id === 'search') return jobRank(bestJob(state).id) > jobRank(state.job);
    return true;
  });
}

/** Clé de texte d'une action (la recherche d'emploi change de libellé si on a déjà un poste). */
export function actionTextId(state: GameState, a: ActionDef): string {
  return a.id === 'search' && state.job ? 'searchBetter' : a.id;
}

// ---------- Helpers internes (mutent un état déjà cloné) ----------

function addLog(
  s: GameState,
  key: string,
  params: LogEntry['params'] = {},
  cls: LogClass = '',
  extra: Pick<LogEntry, 'titleKey' | 'fx'> = {},
) {
  s.log.push({ key, params, cls, ...extra });
  if (s.log.length > 200) s.log.shift();
}

function applyFx(s: GameState, fx: Fx) {
  if (fx.money) s.money += fx.money;
  for (const k of ['health', 'happiness', 'energy', 'knowledge'] as const) {
    const v = fx[k];
    if (v) s.stats[k] = clamp(s.stats[k] + v);
  }
}

function checkOver(s: GameState) {
  if (s.stats.health <= 0) s.over = 'health';
  else if (s.money <= DEBT_LIMIT) s.over = 'debt';
}

function rollEvent(s: GameState) {
  s.pendingEvent = null;
  if (Math.random() > EVENT_CHANCE) return;
  const pool = EVENTS.filter((e) => e.id !== s.lastEvent && (!e.when || e.when(s)));
  if (!pool.length) return;
  const event = pool[Math.floor(Math.random() * pool.length)];
  s.pendingEvent = event.id;
  s.lastEvent = event.id;
}

function endMonth(s: GameState) {
  const expenses = monthlyExpenses(s);
  s.money -= expenses;
  addLog(s, 'log.expenses', { amount: expenses });

  s.stats.energy = clamp(s.stats.energy + 10);
  if (s.stats.energy < 20) { s.stats.health = clamp(s.stats.health - 5); addLog(s, 'log.exhausted', {}, 'bad'); }
  if (s.stats.happiness < 20) { s.stats.health = clamp(s.stats.health - 3); addLog(s, 'log.lowMood', {}, 'bad'); }
  if (s.money < 0) { s.stats.happiness = clamp(s.stats.happiness - 5); addLog(s, 'log.overdraft', {}, 'bad'); }

  s.month += 1;
  addLog(s, 'log.monthMark', { month: s.month }, 'month');

  checkOver(s);
  if (!s.over) rollEvent(s);
}

// ---------- Actions publiques ----------

export function performAction(state: GameState, id: ActionId): GameState {
  const s = structuredClone(state);
  switch (id) {
    case 'work': {
      const job = jobById(s.job)!;
      applyFx(s, { money: job.salary, energy: -20, happiness: -3 });
      addLog(s, 'log.work', { jobId: job.id, pay: job.salary }, 'good');
      break;
    }
    case 'study': {
      applyFx(s, { knowledge: 4, energy: -15, happiness: -2 });
      addLog(s, 'log.study', { gain: 4 });
      break;
    }
    case 'rest': {
      applyFx(s, { energy: 35, health: 3 });
      addLog(s, 'log.rest');
      break;
    }
    case 'social': {
      applyFx(s, { money: -40, happiness: 10, energy: -10 });
      addLog(s, 'log.social', { gain: 10 });
      break;
    }
    case 'sport': {
      applyFx(s, { health: 6, happiness: 3, energy: -15 });
      addLog(s, 'log.sport', { gain: 6 });
      break;
    }
    case 'search': {
      applyFx(s, { energy: -10 });
      const target = bestJob(s);
      if (jobRank(target.id) > jobRank(s.job)) {
        s.job = target.id;
        addLog(s, 'log.jobFound', { jobId: target.id, salary: target.salary }, 'good');
      } else {
        addLog(s, 'log.jobNone');
      }
      break;
    }
  }
  endMonth(s);
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
