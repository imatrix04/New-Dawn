// Logique pure du jeu : aucune dépendance à React ni aux textes.
// Les messages sont des clés de traduction (voir src/i18n/locales).
import {
  CARS, DEBT_HAPPINESS_LOSS, DEBT_LIMIT, DEFAULT_SCHEDULE, ESSENTIALS_PER_WEEK, EVENT_CHANCE,
  EXHAUSTION_ENERGY, EXHAUSTION_HEALTH_LOSS, FOOD_COST, HOURS_PER_WEEK, HOUSING, INERTIA, JOBS,
  KNOWLEDGE_PER_STUDY_HOUR, LEISURE_COST_PER_WEEKLY_HOUR, LEISURE_NEUTRAL, SCHEDULE,
  SAVINGS, SEARCH_CHANCE_MAX, SEARCH_CHANCE_PER_HOUR, SLEEP_NEUTRAL, SPORT_HEALTH_PER_HOUR, START, START_STATS,
} from '../data/content';
import { EVENTS, eventById } from '../data/events';
import type {
  Account, Fx, GameState, Job, LogClass, LogEntry, Profile, Savings, SavingsProduct, Schedule, ScheduleKey,
  StatKey,
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
    savings: emptySavings(),
    lastEvent: null,
    pendingEvent: null,
    over: null,
    stats: { ...START_STATS },
    log: [],
  };
  normalizeSchedule(state);
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

/** Trop d'heures planifiées : plus de 168 h dans la semaine. Le mois ne peut pas être passé. */
export const isOverbooked = (state: GameState): boolean => weekBreakdown(state).free < 0;

/**
 * Règle un curseur du planning, borné par son min/max. Rien n'empêche de dépasser les 168 h :
 * c'est au joueur de corriger (le dépassement est signalé et bloque le passage du mois).
 */
export function setSchedule(state: GameState, key: ScheduleKey, value: number): GameState {
  if (key === 'search' && !canSearch(state)) return state;
  const def = SCHEDULE[key];
  const next = clamp(Math.round(value), def.min, def.max);
  if (next === state.schedule[key]) return state;
  const s = structuredClone(state);
  s.schedule[key] = next;
  return s;
}

/** La recherche d'emploi n'a plus de sens (curseur masqué) : ses heures ne doivent plus compter. */
function normalizeSchedule(s: GameState) {
  if (!canSearch(s)) s.schedule.search = 0;
}

// ---------- Effets du planning ----------

export const monthlyIncome = (state: GameState): number => jobById(state.job)?.salary ?? 0;

/** Nourriture + loyer + entretien de la voiture + coût des loisirs. */
export function monthlyExpenses(state: GameState): number {
  const leisureCost = Math.round(weeklyHours(state.schedule, 'leisure') * LEISURE_COST_PER_WEEKLY_HOUR);
  return FOOD_COST + (HOUSING[state.housing]?.rent ?? 0) + (state.car ? CARS[state.car]?.upkeep ?? 0 : 0) + leisureCost;
}

/**
 * Effets mensuels du planning, tels qu'affichés au joueur et appliqués au passage du mois.
 * - Santé : ±1 par heure de sommeil/jour au-dessus ou en dessous de 7 h, plus un bonus de sport.
 * - Bonheur : ±1 par heure de loisirs/jour au-dessus ou en dessous de 5 h.
 */
export function scheduleEffects(schedule: Schedule) {
  return {
    sleepHealth: schedule.sleep - SLEEP_NEUTRAL,
    sportHealth: schedule.sport * SPORT_HEALTH_PER_HOUR,
    leisureHappiness: schedule.leisure - LEISURE_NEUTRAL,
    studyKnowledge: schedule.study * KNOWLEDGE_PER_STUDY_HOUR,
    searchChance: Math.min(SEARCH_CHANCE_MAX, schedule.search * SEARCH_CHANCE_PER_HOUR),
  };
}

/** Énergie visée par le planning : le sommeil la remonte, la charge (travail, trajets, études, sport) l'use. */
function energyTarget(state: GameState): number {
  const { sleep, study, sport, search } = state.schedule;
  const job = jobById(state.job);
  const load = (job?.hours ?? 0) + (job?.commute ?? 0) * 0.5 + study * 0.6 + sport * 0.4 + search * 0.5;
  return clamp(70 + 15 * (sleep - 7) - 0.7 * (load - 30));
}

/** Jauges attendues le mois prochain avec le planning actuel (hors événements). */
export function projectNextStats(state: GameState): Record<StatKey, number> {
  const fx = scheduleEffects(state.schedule);
  const energy = clamp(state.stats.energy + (energyTarget(state) - state.stats.energy) * INERTIA);
  const exhaustion = energy < EXHAUSTION_ENERGY ? EXHAUSTION_HEALTH_LOSS : 0;
  const debt = state.money < 0 ? DEBT_HAPPINESS_LOSS : 0;
  return {
    health: clamp(state.stats.health + fx.sleepHealth + fx.sportHealth - exhaustion),
    happiness: clamp(state.stats.happiness + fx.leisureHappiness - debt),
    energy,
    knowledge: clamp(state.stats.knowledge + fx.studyKnowledge),
  };
}

// ---------- Épargne ----------

export const SAVINGS_PRODUCTS: SavingsProduct[] = ['livretA', 'ldds', 'livretJeune', 'pel'];

const cents = (n: number) => Math.round(n * 100) / 100;

/** Au départ, aucun produit d'épargne n'est ouvert : le joueur n'a que son compte courant. */
export const emptySavings = (): Savings => ({ livretA: null, ldds: null, livretJeune: null, pel: null });

/**
 * Sauvegardes d'avant l'ouverture à la demande : le Livret A et le Livret Jeune existaient d'office.
 * On garde ceux qui contiennent de l'argent ; les autres redeviennent « à ouvrir ».
 */
export function migrateSavings(raw: Partial<Savings> | undefined): Savings {
  if (!raw) return emptySavings();
  if ('ldds' in raw) return { ...emptySavings(), ...raw }; // format actuel
  const keep = (a?: Account | null) => (a && (a.balance > 0 || a.interest > 0) ? a : null);
  return { ...emptySavings(), livretA: keep(raw.livretA), livretJeune: keep(raw.livretJeune), pel: raw.pel ?? null };
}

export const ageYears = (state: GameState) => 18 + Math.floor(state.month / 12);

/** Le Livret Jeune est réservé aux moins de 25 ans : il se ferme à l'anniversaire des 25 ans. */
export const livretJeuneEligible = (state: GameState) => ageYears(state) < SAVINGS.livretJeune.closesAtAge;

const accountOf = (state: GameState, p: SavingsProduct): Account | null => state.savings[p];

export const isOpen = (state: GameState, p: SavingsProduct): boolean => accountOf(state, p) !== null;

/** Peut-on ouvrir ce produit ? (Le PEL s'ouvre avec son premier versement, voir `depositSavings`.) */
export function canOpen(state: GameState, p: SavingsProduct): boolean {
  if (isOpen(state, p)) return false;
  return p === 'livretJeune' ? livretJeuneEligible(state) : true;
}

export const savingsBalance = (state: GameState, p: SavingsProduct): number => accountOf(state, p)?.balance ?? 0;

export const totalSavings = (state: GameState): number =>
  SAVINGS_PRODUCTS.reduce((sum, p) => sum + savingsBalance(state, p), 0);

/** Versements encore possibles avant le plafond : les intérêts capitalisés n'y comptent pas. */
export function savingsRoom(state: GameState, p: SavingsProduct): number {
  const a = accountOf(state, p);
  return Math.max(0, SAVINGS[p].ceiling - (a ? a.balance - a.interest : 0));
}

export type TransferCheck =
  | { ok: true }
  | {
    ok: false;
    reason: 'invalid' | 'unavailable' | 'notOpen' | 'min' | 'insufficient' | 'ceiling';
    min?: number;
    room?: number;
  };

export function checkDeposit(state: GameState, p: SavingsProduct, amount: number): TransferCheck {
  if (!(amount > 0)) return { ok: false, reason: 'invalid' };
  if (p === 'livretJeune' && !livretJeuneEligible(state)) return { ok: false, reason: 'unavailable' };
  if (p !== 'pel' && !isOpen(state, p)) return { ok: false, reason: 'notOpen' };
  const room = savingsRoom(state, p);
  const min = p === 'pel'
    ? (state.savings.pel ? SAVINGS.pel.minDeposit : SAVINGS.pel.minOpen)
    : SAVINGS[p].minDeposit;
  // Le minimum ne s'applique pas au dernier versement qui remplit exactement le plafond.
  if (amount < min && amount !== room) return { ok: false, reason: 'min', min };
  if (amount > state.money) return { ok: false, reason: 'insufficient' };
  if (amount > room) return { ok: false, reason: 'ceiling', room };
  return { ok: true };
}

/** Retrait d'un livret. Le PEL ne permet que la clôture complète (voir `closePel`). */
export function checkWithdraw(state: GameState, p: SavingsProduct, amount: number): TransferCheck {
  if (p === 'pel') return { ok: false, reason: 'unavailable' };
  if (!isOpen(state, p)) return { ok: false, reason: 'notOpen' };
  if (!(amount > 0)) return { ok: false, reason: 'invalid' };
  if (amount > savingsBalance(state, p)) return { ok: false, reason: 'insufficient' };
  return { ok: true };
}

/** Ouvre un livret (gratuit, solde nul). Le PEL, lui, s'ouvre avec un premier versement d'au moins 225 €. */
export function openSavings(state: GameState, p: SavingsProduct): GameState {
  if (p === 'pel' || !canOpen(state, p)) return state;
  const s = structuredClone(state);
  s.savings[p] = { balance: 0, interest: 0 };
  addLog(s, 'log.opened', { productId: p }, 'good');
  return s;
}

/** Verse de l'argent du compte courant sur un produit ouvert ; le premier versement sur le PEL l'ouvre. */
export function depositSavings(state: GameState, p: SavingsProduct, rawAmount: number): GameState {
  const amount = cents(rawAmount);
  if (!checkDeposit(state, p, amount).ok) return state;
  const s = structuredClone(state);
  s.money = cents(s.money - amount);
  if (p === 'pel') {
    const pel = s.savings.pel ?? { balance: 0, interest: 0, openedMonth: s.month, rate: SAVINGS.pel.rate };
    pel.balance = cents(pel.balance + amount);
    s.savings.pel = pel;
  } else {
    const acct = s.savings[p]!;
    acct.balance = cents(acct.balance + amount);
  }
  addLog(s, 'log.deposit', { productId: p, amount });
  return s;
}

export function withdrawSavings(state: GameState, p: SavingsProduct, rawAmount: number): GameState {
  const amount = cents(rawAmount);
  if (p === 'pel' || !checkWithdraw(state, p, amount).ok) return state;
  const s = structuredClone(state);
  const acct = s.savings[p]!;
  acct.balance = cents(acct.balance - amount);
  acct.interest = Math.min(acct.interest, acct.balance); // les retraits entament d'abord les versements
  s.money = cents(s.money + amount);
  addLog(s, 'log.withdraw', { productId: p, amount });
  return s;
}

export interface PelClosePreview {
  payout: number;
  /** Intérêts perdus en cas de clôture avant le blocage de 4 ans. */
  penalty: number;
  early: boolean;
  monthsOpen: number;
}

export function pelClosePreview(state: GameState): PelClosePreview | null {
  const pel = state.savings.pel;
  if (!pel) return null;
  const monthsOpen = state.month - pel.openedMonth;
  const early = monthsOpen < SAVINGS.pel.lockMonths;
  const penalty = early ? cents(pel.interest * SAVINGS.pel.earlyInterestLoss) : 0;
  return { payout: cents(pel.balance - penalty), penalty, early, monthsOpen };
}

export function closePel(state: GameState): GameState {
  const preview = pelClosePreview(state);
  if (!preview) return state;
  const s = structuredClone(state);
  s.money = cents(s.money + preview.payout);
  s.savings.pel = null;
  if (preview.early) addLog(s, 'log.pelClosedEarly', { amount: preview.payout, penalty: preview.penalty }, 'bad');
  else addLog(s, 'log.pelClosed', { amount: preview.payout });
  return s;
}

/** Intérêts du mois, crédités sur chaque produit ouvert (le PEL est net du prélèvement de 30 %). */
function accrueSavings(s: GameState) {
  let total = 0;
  const credit = (acct: Account, amount: number) => {
    const v = cents(amount);
    acct.balance = cents(acct.balance + v);
    acct.interest = cents(acct.interest + v);
    total += v;
  };
  const { livretA, ldds, livretJeune, pel } = s.savings;
  if (livretA) credit(livretA, (livretA.balance * SAVINGS.livretA.rate) / 12);
  if (ldds) credit(ldds, (ldds.balance * SAVINGS.ldds.rate) / 12);
  if (livretJeune && livretJeuneEligible(s)) credit(livretJeune, (livretJeune.balance * SAVINGS.livretJeune.rate) / 12);
  if (pel) credit(pel, ((pel.balance * pel.rate) / 12) * (1 - SAVINGS.pel.tax));
  if (total >= 0.01) addLog(s, 'log.interest', { amount: cents(total) }, 'good');
}

/** Clôtures automatiques : Livret Jeune à 25 ans, PEL au bout de 10 ans. Les fonds reviennent sur le compte courant. */
function closeExpiredSavings(s: GameState) {
  const jeune = s.savings.livretJeune;
  if (jeune && !livretJeuneEligible(s)) {
    if (jeune.balance > 0) {
      s.money = cents(s.money + jeune.balance);
      addLog(s, 'log.jeuneClosed', { amount: jeune.balance });
    }
    s.savings.livretJeune = null;
  }
  const pel = s.savings.pel;
  if (pel && s.month - pel.openedMonth >= SAVINGS.pel.maxMonths) {
    s.money = cents(s.money + pel.balance);
    addLog(s, 'log.pelMatured', { amount: pel.balance });
    s.savings.pel = null;
  }
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
  if (isOverbooked(state)) return state; // garde-fou : l'interface bloque déjà le bouton
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
  accrueSavings(s);

  if (studied > 0) addLog(s, 'log.studied', { gain: Math.round(studied * 10) / 10 });

  if (s.schedule.search > 0 && canSearch(s)) {
    if (Math.random() < scheduleEffects(s.schedule).searchChance) {
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
  closeExpiredSavings(s);

  normalizeSchedule(s);
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
