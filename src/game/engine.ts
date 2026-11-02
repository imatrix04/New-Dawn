// Logique pure du jeu : aucune dépendance à React ni aux textes.
// Les messages sont des clés de traduction (voir src/i18n/locales).
import {
  CARS, DEBT_LIMIT, DEFAULT_SCHEDULE, ESSENTIALS_PER_WEEK, EVENT_CHANCE, FOOD_COST, HOURS_PER_WEEK,
  HOUSING, INERTIA, JOBS, KNOWLEDGE_PER_STUDY_HOUR, LEISURE_COST_PER_WEEKLY_HOUR, SCHEDULE,
  SEARCH_CHANCE_MAX, SEARCH_CHANCE_PER_HOUR, START, START_STATS,
} from '../data/content';
import { EVENTS, eventById } from '../data/events';
import type {
  Fx, GameState, Job, LogClass, LogEntry, Profile, Schedule, ScheduleKey, StatKey,
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
    schedule: { ...DEFAULT_SCHEDULE },
    lastEvent: null,
    pendingEvent: null,
    over: null,
    stats: { ...START_STATS },
    log: [],
  };
  fitSchedule(state);
  addLog(state, profile.path === 'comfort' ? 'log.startComfort' : 'log.startTight', {}, 'month');
  return state;
}

export const jobById = (id: string | null): Job | null => JOBS.find((j) => j.id === id) ?? null;

function bestJob(state: GameState): Job {
  const eligible = JOBS.filter((j) => j.knowledge <= state.stats.knowledge);
  return eligible[eligible.length - 1];
}

const jobRank = (id: string | null) => JOBS.findIndex((j) => j.id === id);

/** Peut-on encore progresser professionnellement ? (sinon la recherche d'emploi est inutile) */
export function canSearch(state: GameState): boolean {
  return jobRank(bestJob(state).id) > jobRank(state.job);
}

// ---------- Planning de la semaine ----------

const weeklyHours = (schedule: Schedule, key: ScheduleKey) =>
  schedule[key] * (SCHEDULE[key].perDay ? 7 : 1);

export interface WeekBreakdown {
  sleep: number;
  work: number;
  commute: number;
  essentials: number;
  leisure: number;
  study: number;
  sport: number;
  search: number;
  /** Heures non planifiées sur les 168 h. */
  free: number;
}

export function weekBreakdown(state: GameState): WeekBreakdown {
  const job = jobById(state.job);
  const planned = {
    sleep: weeklyHours(state.schedule, 'sleep'),
    work: job?.hours ?? 0,
    commute: job?.commute ?? 0,
    essentials: ESSENTIALS_PER_WEEK,
    leisure: weeklyHours(state.schedule, 'leisure'),
    study: weeklyHours(state.schedule, 'study'),
    sport: weeklyHours(state.schedule, 'sport'),
    search: weeklyHours(state.schedule, 'search'),
  };
  const used = Object.values(planned).reduce((a, h) => a + h, 0);
  return { ...planned, free: HOURS_PER_WEEK - used };
}

/** Règle un curseur du planning, borné par son min/max et par le temps libre restant. */
export function setSchedule(state: GameState, key: ScheduleKey, value: number): GameState {
  if (key === 'search' && !canSearch(state)) return state;
  const def = SCHEDULE[key];
  const unit = def.perDay ? 7 : 1;
  const cap = Math.min(def.max, state.schedule[key] + Math.max(0, Math.floor(weekBreakdown(state).free / unit)));
  const next = clamp(Math.round(value), def.min, Math.max(def.min, cap));
  if (next === state.schedule[key]) return state;
  const s = structuredClone(state);
  s.schedule[key] = next;
  return s;
}

/**
 * Remet le planning dans les 168 h (après un changement d'emploi par exemple) en rognant
 * d'abord la recherche, les études, le sport, les loisirs, puis le sommeil en dernier recours.
 */
function fitSchedule(s: GameState) {
  if (!canSearch(s)) s.schedule.search = 0;
  for (const key of ['search', 'study', 'sport', 'leisure', 'sleep'] as const) {
    const free = weekBreakdown(s).free;
    if (free >= 0) return;
    const def = SCHEDULE[key];
    const unit = def.perDay ? 7 : 1;
    s.schedule[key] -= Math.min(s.schedule[key] - def.min, Math.ceil(-free / unit));
  }
}

// ---------- Effets du planning ----------

export const monthlyIncome = (state: GameState): number => jobById(state.job)?.salary ?? 0;

/** Nourriture + loyer + entretien de la voiture + coût des loisirs. */
export function monthlyExpenses(state: GameState): number {
  const leisureCost = Math.round(weeklyHours(state.schedule, 'leisure') * LEISURE_COST_PER_WEEKLY_HOUR);
  return FOOD_COST + (HOUSING[state.housing]?.rent ?? 0) + (state.car ? CARS[state.car]?.upkeep ?? 0 : 0) + leisureCost;
}

/**
 * Valeurs vers lesquelles tendent santé, bonheur et énergie avec le planning actuel.
 * La santé n'est pas bornée à 0 : une cible négative signifie que la partie finira mal.
 */
function statTargets(state: GameState): Record<'health' | 'happiness' | 'energy', number> {
  const { sleep, leisure, study, sport, search } = state.schedule;
  const job = jobById(state.job);
  const load = (job?.hours ?? 0) + (job?.commute ?? 0) * 0.5 + study * 0.6 + sport * 0.4 + search * 0.5;

  const energy = clamp(70 + 15 * (sleep - 7) - 0.7 * (load - 30));

  const happiness = clamp(
    35 + leisure * 7
    - Math.max(0, load - 40) * 0.4
    - (state.money < 0 ? 15 : 0)
    - Math.max(0, 6 - sleep) * 4
    - Math.max(0, 40 - energy) * 0.3,
  );

  const sleepHealth = sleep >= 7 ? 10 : sleep >= 5 ? 10 - (7 - sleep) * 9 : -8 - (5 - sleep) * 22;
  const health = 60
    + Math.min(sport, 6) * 3
    + sleepHealth
    - Math.max(0, 30 - energy) * 0.8
    - Math.max(0, 25 - happiness) * 0.4;

  return { health, happiness, energy };
}

/** Jauges attendues le mois prochain avec le planning actuel (hors événements). */
export function projectNextStats(state: GameState): Record<StatKey, number> {
  const target = statTargets(state);
  const toward = (key: 'health' | 'happiness' | 'energy') =>
    clamp(state.stats[key] + (target[key] - state.stats[key]) * INERTIA);
  return {
    health: toward('health'),
    happiness: toward('happiness'),
    energy: toward('energy'),
    knowledge: clamp(state.stats.knowledge + state.schedule.study * KNOWLEDGE_PER_STUDY_HOUR),
  };
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

// ---------- Actions publiques ----------

/** Passe au mois suivant en appliquant le planning actuel. */
export function endTurn(state: GameState): GameState {
  const s = structuredClone(state);

  // Les jauges sont calculées avant de toucher à l'argent, comme dans l'aperçu affiché au joueur.
  const next = projectNextStats(s);
  const studied = next.knowledge - s.stats.knowledge;
  s.stats = next;

  const job = jobById(s.job);
  if (job) {
    s.money += job.salary;
    addLog(s, 'log.pay', { jobId: job.id, amount: job.salary }, 'good');
  }
  const expenses = monthlyExpenses(s);
  s.money -= expenses;
  addLog(s, 'log.expenses', { amount: expenses });

  if (studied > 0) addLog(s, 'log.studied', { gain: Math.round(studied * 10) / 10 });

  if (s.schedule.search > 0 && canSearch(s)) {
    const chance = Math.min(SEARCH_CHANCE_MAX, s.schedule.search * SEARCH_CHANCE_PER_HOUR);
    if (Math.random() < chance) {
      const target = bestJob(s);
      s.job = target.id;
      addLog(s, 'log.jobFound', { jobId: target.id, salary: target.salary }, 'good');
    } else {
      addLog(s, 'log.jobNone');
    }
  }

  if (s.stats.energy < 20) addLog(s, 'log.exhausted', {}, 'bad');
  if (s.stats.happiness < 20) addLog(s, 'log.lowMood', {}, 'bad');
  if (s.money < 0) addLog(s, 'log.overdraft', {}, 'bad');

  s.month += 1;
  addLog(s, 'log.monthMark', { month: s.month }, 'month');

  fitSchedule(s);
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
