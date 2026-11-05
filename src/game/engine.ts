// Logique pure du jeu : aucune dépendance à React ni aux textes.
// Les messages sont des clés de traduction (voir src/i18n/locales).
import {
  AREA_IDS, AREAS, CARS, CATALOG_MAX, COMPANIES, CATALOG_REFRESH_MONTHS, DEBT_HAPPINESS_LOSS, DEBT_LIMIT, DEFAULT_SCHEDULE, ESSENTIALS_PER_WEEK,
  EVENT_CHANCE, EXPERIENCE_BONUS_MAX, EXPERIENCE_BONUS_PER_YEAR, FOOD_COST, GIGS, HIRE_CHANCE, HIRE_CHANCE_MAX, HOURS_PER_WEEK, HOUSING_TYPES, JOBS,
  LEISURE_COST_PER_WEEKLY_HOUR, LEISURE_NEUTRAL, LETTING, LISTING_MONTHS, LISTING_WEIGHT, LISTINGS_MAX, MOVING_COST, OFFER_MONTHS, OFFER_WEIGHT,
  OFFERS_MAX, OWNING, PRICE_VARIATION, RENT, RENT_CHANCE, RENT_CHANCE_MAX, RENT_CHANCE_MIN, SAVINGS, SCHEDULE, SELLING, SMIC_NET,
  SKILL_MAX, SKILL_RULES, SKILLS, SLEEP_NEUTRAL, SPORT_HEALTH_PER_HOUR, START, START_LISTINGS, START_SKILLS, START_STATS, STARTER_JOBS,
  TRAININGS,
} from '../data/content';
import type { Company, Gig, HousingType } from '../data/content';
import { EVENTS, eventById } from '../data/events';
import type {
  Account, Area, Catalog, Drawback, Fx, GameState, Home, HousingListing, Job, JobOffer, LeaveAction, LogClass, LogEntry, Profile,
  Property, Savings, SavingsProduct, Schedule, ScheduleKey, SkillId, StatKey,
} from './types';

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

// ---------- Création / lecture ----------

export function createGame(profile: Profile): GameState {
  const start = START[profile.path];
  const hired = profile.job ? makeOffer(jobById(profile.job)!) : null;
  const state: GameState = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    gender: profile.gender,
    experience: {},
    diplomas: [],
    training: null,
    jobTarget: null,
    offers: starterOffers().filter((o) => o.jobId !== profile.job),
    gig: null,
    catalog: { gigs: [], quick: [], training: [], factors: {} },
    skills: { ...START_SKILLS },
    skillMax: SKILL_MAX,
    history: {},
    month: 0,
    money: start.money,
    job: profile.job,
    jobSalary: hired?.salary ?? null,
    jobCompany: hired?.companyId ?? null,
    home: starterHome(start.housing),
    listings: drawListings(START_LISTINGS),
    housingTarget: null,
    housingLeave: 'sell',
    properties: [],
    car: start.car,
    schedule: { ...DEFAULT_SCHEDULE },
    savings: emptySavings(),
    lastEvent: null,
    pendingEvent: null,
    over: null,
    stats: { ...START_STATS },
    log: [],
  };
  state.catalog = drawCatalog(state);
  addLog(state, profile.path === 'comfort' ? 'log.startComfort' : 'log.startTight', {}, 'month');
  return state;
}

export const jobById = (id: string | null): Job | null => JOBS.find((j) => j.id === id) ?? null;
export const gigById = (id: string | null): Gig | null => GIGS.find((g) => g.id === id) ?? null;

export const companyById = (id: string | null): Company | null => COMPANIES.find((c) => c.id === id) ?? null;

/** Salaire proposé : le prix de base ajusté par l'entreprise (±10 % au plus), jamais sous le SMIC. */
export const salaryAt = (job: Job, company: Company | null): number =>
  Math.max(SMIC_NET, Math.round(job.salary * (1 + (company?.pay ?? 0))));

/** Pénibilité d'un poste chez une entreprise : celle du poste plus l'ajustement de l'entreprise, sans jamais devenir un bonus. */
export function jobDrawback(job: Job, company: Company | null): Drawback {
  const out: Drawback = {};
  for (const k of ['health', 'happiness'] as const) {
    const v = Math.min(0, (job.drawback[k] ?? 0) + (company?.drawback[k] ?? 0));
    if (v) out[k] = v;
  }
  return out;
}

/** Écart de prix aléatoire, de -10 % à +10 %. */
const rollFactor = (): number => Math.round((Math.random() * 2 - 1) * PRICE_VARIATION * 100) / 100;
const withFactor = (base: number, factor: number): number => Math.round(base * (1 + factor));

/** Nouvelle offre pour un poste : une entreprise qui recrute est tirée au hasard, et fixe le salaire. */
function makeOffer(job: Job): JobOffer {
  const pool = COMPANIES.filter((c) => c.jobs.includes(job.id));
  const company = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  return { jobId: job.id, monthsLeft: OFFER_MONTHS[job.grade], companyId: company?.id ?? '', salary: salaryAt(job, company) };
}

/** Premières offres visibles : les postes de départ, qui durent longtemps. */
const starterOffers = (): JobOffer[] => STARTER_JOBS.map((id) => makeOffer(jobById(id)!));

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

/** Complète une sauvegarde d'une version antérieure avec les champs ajoutés depuis. */
export function migrateGame(raw: GameState): GameState {
  const g = raw;
  g.gender ??= 'male';
  g.experience ??= {};
  g.diplomas ??= [];
  g.training ??= null;
  g.jobTarget ??= null;
  g.gig ??= null;
  g.offers ??= starterOffers();
  g.offers = g.offers.map((o) => (o.companyId ? o : { ...makeOffer(jobById(o.jobId) ?? JOBS[0]), jobId: o.jobId, monthsLeft: o.monthsLeft }));
  g.history ??= {};
  g.catalog ??= drawCatalog(g);
  g.catalog.factors ??= {};
  if (g.training) g.training.tuition ??= TRAININGS[g.training.id].tuition;
  g.jobCompany ??= null;
  g.jobSalary ??= null;
  // Avant la carte Logement, le logement n'était qu'un identifiant (studio ou colocation) à loyer fixe.
  const legacyHome = g as unknown as { housing?: string };
  g.home ??= starterHome(legacyHome.housing ?? 'studio');
  delete legacyHome.housing;
  g.listings ??= drawListings(START_LISTINGS);
  g.housingTarget ??= null;
  g.housingLeave ??= 'sell';
  g.properties ??= [];
  if (g.housingTarget && !g.listings.some((l) => l.id === g.housingTarget)) g.housingTarget = null;
  g.schedule.housing ??= 0;
  // Avant les compétences, un seul « savoir » existait : il devient l'intelligence. L'énergie a disparu.
  const legacy = g.stats as unknown as Record<string, number | undefined>;
  if (!g.skills) {
    g.skills = { ...START_SKILLS, intelligence: legacy.knowledge === undefined ? START_SKILLS.intelligence : legacy.knowledge * (SKILL_MAX / 100) };
    g.skillMax = SKILL_MAX;
  }
  delete legacy.knowledge;
  delete legacy.energy;
  // Les compétences allaient de 0 à 100 ; elles vont maintenant de 0 à 1000.
  if (g.skillMax !== SKILL_MAX) {
    for (const id of Object.keys(g.skills) as SkillId[]) g.skills[id] *= SKILL_MAX / (g.skillMax ?? 100);
    g.skillMax = SKILL_MAX;
  }
  if (g.job === 'waiter') g.job = 'fastFood'; // l'ancien « serveur » devient serveur en restauration rapide
  if (g.jobTarget === 'waiter') g.jobTarget = 'fastFood';
  if (g.jobTarget && !g.offers.some((o) => o.jobId === g.jobTarget)) g.jobTarget = null;
  g.savings = migrateSavings(g.savings);
  return g;
}

// ---------- Carrière ----------

export const experienceMonths = (state: GameState, field: string): number => state.experience[field] ?? 0;

export interface Eligibility {
  skills: boolean;
  qualified: boolean;
  ok: boolean;
}

/** Remplit-on les conditions du poste ? Compétences suffisantes ET, si le poste l'exige, au moins une qualification. */
export function jobEligibility(state: GameState, job: Job): Eligibility {
  const skills = Object.entries(job.minSkills ?? {}).every(([id, min]) => state.skills[id as SkillId] >= min);
  const qualified = !job.anyOf || job.anyOf.some((q) => (
    q.type === 'experience' ? experienceMonths(state, q.field) >= q.months : state.diplomas.includes(q.id)
  ));
  return { skills, qualified, ok: skills && qualified };
}

export type HireBonus =
  | { type: 'training'; id: string; value: number }
  | { type: 'experience'; field: string; months: number; value: number };

export interface HireBreakdown {
  /** Chance de base, selon le grade du poste. */
  base: number;
  bonuses: HireBonus[];
  /** Base + bonus, plafonnée. */
  total: number;
}

/**
 * Chance d'être embauché chaque mois sur ce poste, détaillée : base du grade, bonus des formations suivies
 * dans le même domaine, et bonus d'expérience dans le domaine.
 */
export function hireBreakdown(state: GameState, job: Job): HireBreakdown {
  const bonuses: HireBonus[] = [];
  for (const id of state.diplomas) {
    const b = TRAININGS[id]?.hireBonus;
    if (b && b.field === job.field) bonuses.push({ type: 'training', id, value: b.bonus });
  }
  const months = experienceMonths(state, job.field);
  const value = Math.min(EXPERIENCE_BONUS_MAX, Math.floor(months / 12) * EXPERIENCE_BONUS_PER_YEAR);
  if (value > 0) bonuses.push({ type: 'experience', field: job.field, months, value });
  const base = HIRE_CHANCE[job.grade];
  return { base, bonuses, total: Math.min(HIRE_CHANCE_MAX, base + bonuses.reduce((sum, b) => sum + b.value, 0)) };
}

export const hireChance = (state: GameState, job: Job): number => hireBreakdown(state, job).total;

/** Postule (ou annule avec null) à une offre visible. Seules les offres accessibles peuvent être visées. */
export function setJobTarget(state: GameState, id: string | null): GameState {
  if (id === state.jobTarget) return state;
  if (id !== null) {
    const job = jobById(id);
    if (!job || job.id === state.job || !state.offers.some((o) => o.jobId === id) || !jobEligibility(state, job).ok) {
      return state;
    }
  }
  const s = structuredClone(state);
  s.jobTarget = id;
  return s;
}

/** Démarre un boulot rapide (ou l'arrête avec null) : un seul à la fois. */
export function setGig(state: GameState, id: string | null): GameState {
  if (id === state.gig || (id !== null && (!gigById(id) || !state.catalog.gigs.includes(id)))) return state;
  const s = structuredClone(state);
  s.gig = id;
  return s;
}

export const trainingTuition = (state: GameState): number => state.training?.tuition ?? 0;

export function enrollTraining(state: GameState, id: string): GameState {
  if (!TRAININGS[id] || state.training || state.diplomas.includes(id)) return state;
  if (TRAININGS[id].requires?.some((r) => !state.diplomas.includes(r))) return state;
  if (!state.catalog[TRAININGS[id].quick ? 'quick' : 'training'].includes(id)) return state;
  const s = structuredClone(state);
  s.training = { id, monthsDone: 0, tuition: trainingPrice(state, id) };
  addLog(s, 'log.enrolled', { trainingId: id }, 'good');
  return s;
}

export function dropTraining(state: GameState): GameState {
  if (!state.training) return state;
  const s = structuredClone(state);
  addLog(s, 'log.trainingDropped', { trainingId: state.training.id });
  s.training = null;
  return s;
}

/** Un mois de travail = un mois d'expérience dans le domaine ; on prévient quand un palier utile est franchi. */
function gainExperience(s: GameState, job: Job) {
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

/** La formation ne progresse que si le joueur étudie assez chaque semaine. */
function progressTraining(s: GameState) {
  const training = s.training;
  if (!training) return;
  const cfg = TRAININGS[training.id];
  if (s.schedule.study < cfg.minStudyHours) {
    addLog(s, 'log.trainingSkipped', { trainingId: training.id, hours: cfg.minStudyHours }, 'bad');
    return;
  }
  training.monthsDone += 1;
  if (training.monthsDone >= cfg.months) {
    s.diplomas.push(training.id);
    s.training = null;
    for (const [id, v] of Object.entries(cfg.skills ?? {}) as [SkillId, number][]) s.skills[id] = clamp(s.skills[id] + v, 0, SKILL_MAX);
    addLog(s, cfg.quick ? 'log.certificate' : 'log.diploma', { trainingId: training.id }, 'good');
  }
}

// ---------- Logement ----------

export const housingTypeById = (id: string): HousingType => HOUSING_TYPES[id] ?? HOUSING_TYPES.studio;

/** Logement de départ : loué au loyer de base en centre-ville, sans caution (le joueur y vit déjà). */
function starterHome(typeId: string): Home {
  return { typeId, area: 'center', tenure: 'rent', rent: housingTypeById(typeId).rent ?? 0, deposit: 0, value: 0, charges: 0, loan: null };
}

/** Nouvelle annonce pour un type de bien : à louer ou à vendre (50/50 si les deux sont possibles), dans un quartier tiré au sort. */
function makeListing(typeId: string): HousingListing {
  const type = housingTypeById(typeId);
  const tenure = type.rent === null ? 'buy' : type.price === null || Math.random() < 0.5 ? 'rent' : 'buy';
  const area = drawWeighted(AREA_IDS, (a) => AREAS[a].weight, 1)[0];
  const base = (tenure === 'rent' ? type.rent : type.price)!;
  const raw = base * AREAS[area].price * (1 + rollFactor());
  return {
    id: Math.random().toString(36).slice(2, 8),
    typeId,
    area,
    tenure,
    price: tenure === 'rent' ? Math.round(raw / 5) * 5 : Math.round(raw / 500) * 500,
    monthsLeft: LISTING_MONTHS[type.grade],
  };
}

/**
 * Tire `count` annonces, chaque type de bien indépendamment des autres (un même type peut revenir dans un autre quartier) :
 * les plus rares (villa) apparaissent bien moins souvent que les communs (studio).
 */
const drawListings = (count: number): HousingListing[] =>
  Array.from({ length: count }, () => makeListing(
    drawWeighted(Object.keys(HOUSING_TYPES), (id) => LISTING_WEIGHT[HOUSING_TYPES[id].grade], 1)[0],
  ));

/** Effet mensuel du confort du bien et de l'ambiance du quartier sur la santé et le bonheur. */
export function comfortOf(typeId: string, area: Home['area']): Record<StatKey, number> {
  const type = housingTypeById(typeId);
  return { health: type.comfort.health ?? 0, happiness: (type.comfort.happiness ?? 0) + AREAS[area].happiness };
}

export const housingEffects = (state: GameState): Record<StatKey, number> => comfortOf(state.home.typeId, state.home.area);

/** Heures de trajet ajoutées chaque semaine par l'éloignement du logement (seulement si l'on travaille). */
export const housingCommute = (state: GameState): number =>
  state.job || state.gig ? AREAS[state.home.area].commute : 0;

/** Revenus mensuels vus par un propriétaire : salaire, boulot rapide et loyers perçus. */
const rentIncome = (state: GameState): number => {
  const gig = gigById(state.gig);
  return currentSalary(state) + (gig ? gigPay(state, gig) : 0) + lettingIncome(state);
};

/** Produit d'une vente au prix `price` : moins les frais de revente et le prêt restant dû. */
export const saleProceeds = (price: number, loan: Home['loan']): number =>
  Math.round(price * (1 - OWNING.saleFee)) - Math.round(loan?.balance ?? 0);

/** Ce que rapporte la vente directe du logement possédé quand on le quitte. */
export const saleNet = (state: GameState): number => saleProceeds(state.home.value, state.home.loan);

/**
 * Argent récupéré en quittant son logement : la caution d'un locataire, ou le produit de la vente d'un propriétaire
 * (rien si le bien est gardé, loué ou vide).
 */
export const moveCredit = (state: GameState, leave: LeaveAction = 'sell'): number => {
  if (state.home.tenure === 'rent') return state.home.deposit;
  return leave === 'sell' ? saleNet(state) : 0;
};

/** Loyer du marché d'un bien : le loyer de base du type, selon le quartier. */
export const marketRent = (typeId: string, area: Area): number =>
  Math.round(((housingTypeById(typeId).rent ?? 0) * AREAS[area].price) / 5) * 5;

const newId = () => Math.random().toString(36).slice(2, 8);

export interface RentQuote {
  rent: number;
  deposit: number;
  fees: number;
  moving: number;
  /** À payer à l'emménagement : caution, frais d'agence et déménagement. */
  upfront: number;
  /** Récupéré sur l'ancien logement. */
  credit: number;
  affordable: boolean;
}

export function rentQuote(state: GameState, l: HousingListing, leave: LeaveAction = state.housingLeave): RentQuote {
  const deposit = l.price * RENT.depositMonths[housingTypeById(l.typeId).grade];
  const fees = housingTypeById(l.typeId).surface * RENT.feePerM2;
  const upfront = deposit + fees + MOVING_COST;
  const credit = moveCredit(state, leave);
  return { rent: l.price, deposit, fees, moving: MOVING_COST, upfront, credit, affordable: state.money + credit >= upfront };
}

export type RentBonus =
  | { type: 'income'; value: number; ratio: number }
  | { type: 'job' | 'savings'; value: number };

export interface RentBreakdown {
  base: number;
  bonuses: RentBonus[];
  total: number;
}

/** Chance d'être accepté chaque mois : base selon la rareté du bien, rapport revenus/loyer, emploi stable et épargne de sécurité. */
export function rentBreakdown(state: GameState, l: HousingListing): RentBreakdown {
  const base = RENT_CHANCE[housingTypeById(l.typeId).grade];
  const bonuses: RentBonus[] = [];
  const ratio = rentIncome(state) / l.price;
  const tier = RENT.incomeTiers.find((x) => ratio >= x.ratio)!;
  if (tier.bonus) bonuses.push({ type: 'income', value: tier.bonus, ratio });
  if (hasStableIncome(state)) bonuses.push({ type: 'job', value: RENT.jobBonus });
  if (state.money + totalSavings(state) >= l.price * RENT.cushionMonths) bonuses.push({ type: 'savings', value: RENT.cushionBonus });
  const total = Math.min(RENT_CHANCE_MAX, Math.max(RENT_CHANCE_MIN, base + bonuses.reduce((sum, b) => sum + b.value, 0)));
  return { base, bonuses, total };
}

export const rentChance = (state: GameState, l: HousingListing): number => rentBreakdown(state, l).total;

/** Mensualité constante d'un prêt amorti sur `months` mois. */
const annuity = (principal: number, rate: number, months: number): number => {
  const r = rate / 12;
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
};

export interface BuyQuote {
  price: number;
  notary: number;
  down: number;
  loan: number;
  rate: number;
  monthly: number;
  /** Coût total du crédit (intérêts). */
  interest: number;
  /** Charges mensuelles du propriétaire. */
  charges: number;
  /** À payer à la signature : apport, frais de notaire et déménagement. */
  upfront: number;
  credit: number;
  /** Part des revenus (salaire) absorbée par la mensualité. */
  debtRatio: number;
  /** Pourquoi l'achat est impossible : prêt refusé (pas d'emploi, trop d'endettement) ou pas assez d'argent. */
  reason: null | 'invalid' | 'job' | 'debt' | 'cash';
}

/** Mensualités des prêts déjà en cours (biens possédés, et logement si on le garde), pour le calcul de l'endettement. */
function existingLoans(state: GameState, keepsHome: boolean): number {
  const home = keepsHome ? state.home.loan?.monthly ?? 0 : 0;
  return home + state.properties.reduce((sum, p) => sum + (p.loan?.monthly ?? 0), 0);
}

/** Revenus réguliers : un emploi ou des loyers perçus (ce que demandent propriétaires et banques). */
const hasStableIncome = (state: GameState): boolean => !!state.job || lettingIncome(state) > 0;

/** Revenus vus par la banque : salaire, plus une part des loyers perçus. */
const bankIncome = (state: GameState): number =>
  currentSalary(state) + OWNING.rentalWeight * state.properties.reduce((sum, p) => sum + (p.status === 'rented' ? p.rent : 0), 0);

/**
 * `live` : on emménage dans le bien (sinon c'est un investissement locatif : pas de déménagement, le bien part en location).
 * `leave` : sort de l'ancien bien possédé, si on emménage.
 */
export function buyQuote(
  state: GameState, l: HousingListing, downPct: number, years: number, live = true, leave: LeaveAction = 'sell',
): BuyQuote {
  const price = l.price;
  const down = Math.round(price * downPct);
  const loan = price - down;
  const rate = OWNING.rates[years] ?? 0;
  const monthly = loan > 0 ? annuity(loan, rate, years * 12) : 0;
  const upfront = down + Math.round(price * OWNING.notaryRate) + (live ? MOVING_COST : 0);
  const credit = live ? moveCredit(state, leave) : 0;
  const income = bankIncome(state);
  const load = monthly + existingLoans(state, !live || leave !== 'sell');
  const debtRatio = income > 0 ? load / income : load > 0 ? Infinity : 0;
  let reason: BuyQuote['reason'] = null;
  if (!OWNING.downChoices.includes(downPct) || !OWNING.terms.includes(years)) reason = 'invalid';
  else if (loan > 0 && !hasStableIncome(state)) reason = 'job';
  else if (loan > 0 && debtRatio > OWNING.debtCap) reason = 'debt';
  else if (state.money + credit < upfront) reason = 'cash';
  return {
    price, notary: Math.round(price * OWNING.notaryRate), down, loan, rate, monthly,
    interest: loan > 0 ? monthly * years * 12 - loan : 0,
    charges: Math.round((price * OWNING.chargesRate) / 12),
    upfront, credit, debtRatio, reason,
  };
}

/** Dépose (ou retire avec null) un dossier de location pour une annonce visible. */
export function setHousingTarget(state: GameState, id: string | null, leave: LeaveAction = 'sell'): GameState {
  if (id === state.housingTarget && (id === null || leave === state.housingLeave)) return state;
  if (id !== null) {
    const l = state.listings.find((x) => x.id === id);
    if (!l || l.tenure !== 'rent' || !rentQuote(state, l, leave).affordable) return state;
  }
  const s = structuredClone(state);
  s.housingTarget = id;
  s.housingLeave = leave;
  return s;
}

/** Bien possédé qu'on ne quitte pas en le vendant : il rejoint les biens possédés, vide ou en recherche de locataire. */
function keepAsProperty(s: GameState, home: Home, leave: 'rent' | 'vacant') {
  s.properties.push({
    id: newId(),
    typeId: home.typeId,
    area: home.area,
    status: leave === 'rent' ? 'letting' : 'vacant',
    value: home.value,
    charges: home.charges,
    loan: home.loan,
    rent: marketRent(home.typeId, home.area),
    ask: home.value,
  });
  addLog(s, leave === 'rent' ? 'log.homeLetting' : 'log.homeVacant', { homeId: home.typeId });
}

/** Quitte l'ancien logement : caution rendue au locataire ; le propriétaire vend, loue ou laisse le bien vide. Rend l'argent récupéré. */
function leaveHome(s: GameState, leave: LeaveAction): number {
  const old = s.home;
  if (old.tenure === 'rent') return old.deposit;
  if (leave === 'sell') {
    const net = saleNet(s);
    addLog(s, 'log.homeSold', { homeId: old.typeId, amount: net });
    return net;
  }
  keepAsProperty(s, old, leave);
  return 0;
}

/** Quitte l'ancien logement, paie l'entrée dans le nouveau et retire l'annonce. */
function moveInto(s: GameState, home: Home, listingId: string | null, cost: number, leave: LeaveAction) {
  s.money += leaveHome(s, leave) - cost;
  s.home = home;
  if (listingId) s.listings = s.listings.filter((l) => l.id !== listingId);
  s.housingTarget = null;
}

/**
 * Achète un bien à vendre, avec l'apport et la durée de prêt choisis, si la banque accepte et que l'argent suffit.
 * `live` : on y emménage (l'ancien bien est vendu, loué ou laissé vide selon `leave`) ; sinon c'est un investissement mis en location.
 */
export function buyHome(
  state: GameState, id: string, downPct: number, years: number, live = true, leave: LeaveAction = 'sell',
): GameState {
  const l = state.listings.find((x) => x.id === id);
  if (!l || l.tenure !== 'buy') return state;
  const q = buyQuote(state, l, downPct, years, live, leave);
  if (q.reason) return state;
  const s = structuredClone(state);
  const loan = q.loan > 0 ? { balance: q.loan, monthly: q.monthly, rate: q.rate, monthsLeft: years * 12 } : null;
  if (live) {
    moveInto(s, {
      typeId: l.typeId, area: l.area, tenure: 'own', rent: 0, deposit: 0, value: l.price, charges: q.charges, loan,
    }, l.id, q.upfront, leave);
  } else {
    s.money -= q.upfront;
    s.listings = s.listings.filter((x) => x.id !== l.id);
    if (s.housingTarget === l.id) s.housingTarget = null;
    s.properties.push({
      id: newId(), typeId: l.typeId, area: l.area, status: 'letting', value: l.price, charges: q.charges, loan,
      rent: marketRent(l.typeId, l.area), ask: l.price,
    });
  }
  addLog(s, 'log.homeBought', { homeId: l.typeId, price: l.price }, 'good');
  return s;
}

// ----- Biens possédés où l'on n'habite pas : location, vente, emménagement -----

const propertyOf = (state: GameState, id: string): Property | undefined => state.properties.find((p) => p.id === id);

/** Chance mensuelle de trouver un locataire : base selon la rareté, plus ou moins selon l'écart au loyer du marché. */
export const lettingChance = (p: Property): number => {
  const market = marketRent(p.typeId, p.area) || 1;
  return Math.min(RENT_CHANCE_MAX, Math.max(RENT_CHANCE_MIN, LETTING.chance[housingTypeById(p.typeId).grade] + (1 - p.rent / market)));
};

/** Chance mensuelle de trouver un acheteur : base selon la rareté, plus ou moins selon l'écart à la valeur du bien. */
export const sellingChance = (p: Property): number => {
  const base = SELLING.chance[housingTypeById(p.typeId).grade];
  return Math.min(RENT_CHANCE_MAX, Math.max(RENT_CHANCE_MIN, base + SELLING.priceSensitivity * (1 - p.ask / p.value)));
};

/** Produit net de la vente d'un bien possédé à son prix demandé. */
export const propertyProceeds = (p: Property, price = p.ask): number => saleProceeds(price, p.loan);

/** Loyers perçus chaque mois sur les biens loués. */
export const lettingIncome = (state: GameState): number =>
  state.properties.reduce((sum, p) => sum + (p.status === 'rented' ? p.rent : 0), 0);

/** Met un bien (vide, en recherche de locataire ou en vente) en location au loyer du marché multiplié par `factor`. */
export function letProperty(state: GameState, id: string, factor: number): GameState {
  const p = propertyOf(state, id);
  if (!p || p.status === 'rented' || !LETTING.rentFactors.includes(factor)) return state;
  const s = structuredClone(state);
  const q = propertyOf(s, id)!;
  q.status = 'letting';
  q.rent = Math.round((marketRent(q.typeId, q.area) * factor) / 5) * 5;
  return s;
}

/** Met un bien en vente au prix de sa valeur multiplié par `factor` (un locataire en place doit partir). */
export function sellProperty(state: GameState, id: string, factor: number): GameState {
  const p = propertyOf(state, id);
  if (!p || !SELLING.priceFactors.includes(factor)) return state;
  const s = structuredClone(state);
  const q = propertyOf(s, id)!;
  q.status = 'selling';
  q.ask = Math.round((q.value * factor) / 500) * 500;
  return s;
}

/** Retire un bien de la location ou de la vente : il redevient vide. */
export function withdrawProperty(state: GameState, id: string): GameState {
  const p = propertyOf(state, id);
  if (!p || (p.status !== 'letting' && p.status !== 'selling')) return state;
  const s = structuredClone(state);
  propertyOf(s, id)!.status = 'vacant';
  return s;
}

/** Emménage dans un bien possédé libre (pas de locataire) ; l'ancien logement est vendu, loué ou laissé vide. */
export function moveToProperty(state: GameState, id: string, leave: LeaveAction = 'sell'): GameState {
  const p = propertyOf(state, id);
  if (!p || p.status === 'rented' || state.money + moveCredit(state, leave) < MOVING_COST) return state;
  const s = structuredClone(state);
  s.properties = s.properties.filter((x) => x.id !== id);
  moveInto(s, {
    typeId: p.typeId, area: p.area, tenure: 'own', rent: 0, deposit: 0, value: p.value, charges: p.charges, loan: p.loan,
  }, null, MOVING_COST, leave);
  addLog(s, 'log.movedIn', { homeId: p.typeId });
  return s;
}

/** Tirage de l'acceptation du dossier : il reste ouvert tant que l'annonce existe, mais il faut pouvoir payer l'entrée. */
function resolveHousingApplication(s: GameState) {
  const l = s.listings.find((x) => x.id === s.housingTarget);
  if (!l) {
    s.housingTarget = null;
    return;
  }
  const quote = rentQuote(s, l);
  if (!quote.affordable) {
    addLog(s, 'log.housingBroke', { homeId: l.typeId }, 'bad');
    s.housingTarget = null;
    return;
  }
  if (Math.random() < rentChance(s, l)) {
    moveInto(s, { typeId: l.typeId, area: l.area, tenure: 'rent', rent: l.price, deposit: quote.deposit, value: 0, charges: 0, loan: null },
      l.id, quote.upfront, s.housingLeave);
    addLog(s, 'log.housingFound', { homeId: l.typeId, rent: l.price }, 'good');
  } else {
    addLog(s, 'log.housingNone', { homeId: l.typeId });
  }
}

/** Fin de mois d'un propriétaire : le bien prend un peu de valeur et le prêt s'amortit. */
function ageProperty(s: GameState, item: { value: number; loan: Home['loan'] }) {
  item.value = Math.round(item.value * Math.pow(1 + OWNING.appreciation, 1 / 12));
  const loan = item.loan;
  if (!loan) return;
  loan.balance = Math.max(0, loan.balance * (1 + loan.rate / 12) - loan.monthly);
  loan.monthsLeft -= 1;
  if (loan.monthsLeft <= 0) {
    item.loan = null;
    addLog(s, 'log.loanRepaid', {}, 'good');
  }
}

function progressHome(s: GameState) {
  if (s.home.tenure === 'own') ageProperty(s, s.home);
}

/** Fin de mois des biens possédés : valeur et prêt évoluent, un locataire arrive ou part, un acheteur se présente. */
function progressProperties(s: GameState) {
  for (const p of [...s.properties]) {
    ageProperty(s, p);
    if (p.status === 'letting' && Math.random() < lettingChance(p)) {
      p.status = 'rented';
      addLog(s, 'log.tenantFound', { homeId: p.typeId, rent: p.rent }, 'good');
    } else if (p.status === 'rented' && Math.random() < LETTING.leaveChance) {
      p.status = 'letting';
      addLog(s, 'log.tenantLeft', { homeId: p.typeId });
    } else if (p.status === 'selling' && Math.random() < sellingChance(p)) {
      const net = propertyProceeds(p);
      s.money += net;
      s.properties = s.properties.filter((x) => x.id !== p.id);
      addLog(s, 'log.propertySold', { homeId: p.typeId, amount: net }, 'good');
    }
  }
}

/** Les annonces vieillissent et expirent ; chaque heure de recherche de logement par semaine en amène une nouvelle par mois. */
function refreshListings(s: GameState) {
  const target = s.listings.find((l) => l.id === s.housingTarget);
  s.listings = s.listings.map((l) => ({ ...l, monthsLeft: l.monthsLeft - 1 })).filter((l) => l.monthsLeft > 0);
  if (target && !s.listings.some((l) => l.id === target.id)) {
    addLog(s, 'log.listingExpired', { homeId: target.typeId });
    s.housingTarget = null;
  }
  const wanted = scheduleEffects(s.schedule).searchListings;
  if (wanted <= 0) return;
  const fresh = drawListings(wanted);
  const overflow = s.listings.length + fresh.length - LISTINGS_MAX;
  if (overflow > 0) {
    const drop = s.listings
      .filter((l) => l.id !== s.housingTarget)
      .sort((a, b) => a.monthsLeft - b.monthsLeft)
      .slice(0, overflow);
    s.listings = s.listings.filter((l) => !drop.includes(l));
  }
  s.listings.push(...fresh);
  addLog(s, 'log.newListings', { count: fresh.length }, 'good');
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
  housing: number;
  /** Heures non planifiées sur les 168 h. */
  free: number;
}

export function weekBreakdown(state: GameState): WeekBreakdown {
  const job = jobById(state.job);
  const gig = gigById(state.gig);
  const planned = {
    sleep: weeklyHours(state.schedule, 'sleep'),
    work: (job?.hours ?? 0) + (gig?.hours ?? 0),
    commute: (job?.commute ?? 0) + (gig?.commute ?? 0) + housingCommute(state),
    essentials: ESSENTIALS_PER_WEEK,
    leisure: weeklyHours(state.schedule, 'leisure'),
    study: weeklyHours(state.schedule, 'study'),
    sport: weeklyHours(state.schedule, 'sport'),
    search: weeklyHours(state.schedule, 'search'),
    housing: weeklyHours(state.schedule, 'housing'),
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
  const def = SCHEDULE[key];
  const next = clamp(Math.round(value), def.min, def.max);
  if (next === state.schedule[key]) return state;
  const s = structuredClone(state);
  s.schedule[key] = next;
  return s;
}

// ---------- Effets du planning ----------

/** Une ligne du détail mensuel : `id` sert à retrouver le libellé traduit selon `kind`. */
export interface MoneyLine {
  kind: 'job' | 'gig' | 'rentals' | 'food' | 'housing' | 'loan' | 'charges' | 'propLoan' | 'propCharges' | 'car' | 'leisure' | 'training';
  id?: string;
  amount: number;
}

export function monthlyIncomeLines(state: GameState): MoneyLine[] {
  const job = jobById(state.job);
  const gig = gigById(state.gig);
  const lines: MoneyLine[] = [];
  if (job) lines.push({ kind: 'job', id: job.id, amount: currentSalary(state) });
  if (gig) lines.push({ kind: 'gig', id: gig.id, amount: gigPay(state, gig) });
  const rentals = lettingIncome(state);
  if (rentals > 0) lines.push({ kind: 'rentals', amount: rentals });
  return lines;
}

/** Nourriture + loyer (ou mensualité du prêt et charges) + entretien de la voiture + coût des loisirs + frais de formation. */
export function monthlyExpenseLines(state: GameState): MoneyLine[] {
  const { home } = state;
  const lines: MoneyLine[] = [{ kind: 'food', amount: FOOD_COST }];
  if (home.tenure === 'rent') {
    lines.push({ kind: 'housing', id: home.typeId, amount: home.rent });
  } else {
    if (home.loan) lines.push({ kind: 'loan', id: home.typeId, amount: home.loan.monthly });
    lines.push({ kind: 'charges', id: home.typeId, amount: home.charges });
  }
  const propLoans = state.properties.reduce((sum, p) => sum + (p.loan?.monthly ?? 0), 0);
  const propCharges = state.properties.reduce((sum, p) => sum + p.charges, 0);
  if (propLoans > 0) lines.push({ kind: 'propLoan', amount: propLoans });
  if (propCharges > 0) lines.push({ kind: 'propCharges', amount: propCharges });
  if (state.car) lines.push({ kind: 'car', id: state.car, amount: CARS[state.car]?.upkeep ?? 0 });
  lines.push({ kind: 'leisure', amount: Math.round(weeklyHours(state.schedule, 'leisure') * LEISURE_COST_PER_WEEKLY_HOUR) });
  if (state.training) lines.push({ kind: 'training', id: state.training.id, amount: trainingTuition(state) });
  return lines;
}

const sumLines = (lines: MoneyLine[]): number => lines.reduce((a, l) => a + l.amount, 0);
export const monthlyIncome = (state: GameState): number => sumLines(monthlyIncomeLines(state));
export const monthlyExpenses = (state: GameState): number => sumLines(monthlyExpenseLines(state));

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
    studyIntelligence: schedule.study * (SKILL_RULES.perStudyHour.intelligence ?? 0),
    sportStrength: schedule.sport * (SKILL_RULES.perSportHour.strength ?? 0),
    /** Nouvelles offres d'emploi par mois : 1 par heure de recherche hebdomadaire. */
    searchOffers: schedule.search,
    /** Nouvelles annonces de logement par mois : 1 par heure de recherche hebdomadaire. */
    searchListings: schedule.housing,
  };
}

/** Jauges attendues le mois prochain avec le planning actuel (hors événements). */
export function projectNextStats(state: GameState): Record<StatKey, number> {
  const fx = scheduleEffects(state.schedule);
  const debt = state.money < 0 ? DEBT_HAPPINESS_LOSS : 0;
  const drawbacks = monthlyDrawbacks(state);
  const comfort = housingEffects(state);
  return {
    health: clamp(state.stats.health + fx.sleepHealth + fx.sportHealth + drawbacks.health + comfort.health),
    happiness: clamp(state.stats.happiness + fx.leisureHappiness - debt + drawbacks.happiness + comfort.happiness),
  };
}

const NO_GAIN = (): Record<SkillId, number> => ({ digital: 0, charisma: 0, strength: 0, intelligence: 0, logistics: 0 });

/**
 * Compétences gagnées chaque mois : études (intelligence, numérique), sport (force), loisirs (charisme)
 * et le métier exercé (voir SKILL_RULES). Sert à l'aperçu du profil et au passage du mois.
 */
export function skillGains(state: GameState): Record<SkillId, number> {
  const gains = NO_GAIN();
  const add = (rule: Partial<Record<SkillId, number>> | undefined, factor = 1) => {
    for (const [id, v] of Object.entries(rule ?? {}) as [SkillId, number][]) gains[id] += v * factor;
  };
  add(SKILL_RULES.perStudyHour, state.schedule.study);
  add(SKILL_RULES.perSportHour, state.schedule.sport);
  add(SKILL_RULES.perLeisureHour, state.schedule.leisure);
  const job = jobById(state.job);
  if (job) add(SKILL_RULES.perJobMonth[job.field]);
  add(gigById(state.gig)?.skills);
  return gains;
}

/** Mois d'expérience dans un domaine à partir desquels un poste s'ouvre (0 si aucun poste n'en exige). */
export const experienceGoal = (field: string): number =>
  Math.max(0, ...JOBS.flatMap((j) => (j.anyOf ?? []).flatMap((q) => (
    q.type === 'experience' && q.field === field ? [q.months] : []
  ))));

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
  for (const k of ['health', 'happiness'] as const) {
    const v = fx[k];
    if (v) s.stats[k] = clamp(s.stats[k] + v);
  }
  for (const { id } of SKILLS) {
    const v = fx[id];
    if (v) s.skills[id] = clamp(s.skills[id] + v, 0, SKILL_MAX);
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

// ---------- Offres d'emploi ----------

/** Tirage de l'embauche pour l'offre visée : la candidature reste ouverte tant que l'offre existe. */
function resolveApplication(s: GameState) {
  const target = jobById(s.jobTarget);
  if (!target) return;
  if (!s.offers.some((o) => o.jobId === target.id) || !jobEligibility(s, target).ok) {
    s.jobTarget = null;
    return;
  }
  if (Math.random() < hireChance(s, target)) {
    const offer = s.offers.find((o) => o.jobId === target.id)!;
    s.job = target.id;
    s.jobSalary = offer.salary;
    s.jobCompany = offer.companyId || null;
    s.jobTarget = null;
    s.offers = s.offers.filter((o) => o.jobId !== target.id);
    const company = companyById(offer.companyId);
    addLog(s, company ? 'log.jobFoundAt' : 'log.jobFound', { jobId: target.id, gender: s.gender, salary: offer.salary, company: company?.name ?? '' }, 'good');
  } else {
    addLog(s, 'log.jobNone', { jobId: target.id, gender: s.gender });
  }
}

/** Tire `count` éléments distincts, chacun avec une probabilité proportionnelle à son poids. */
function drawWeighted<T>(candidates: T[], weight: (item: T) => number, count: number): T[] {
  const pool = [...candidates];
  const picked: T[] = [];
  while (picked.length < count && pool.length) {
    let roll = Math.random() * pool.reduce((sum, item) => sum + weight(item), 0);
    const i = pool.findIndex((item) => (roll -= weight(item)) < 0);
    picked.push(...pool.splice(i === -1 ? pool.length - 1 : i, 1));
  }
  return picked;
}

/** Tire `count` postes distincts, les plus prestigieux étant les plus rares (poids par grade). */
const drawJobs = (candidates: Job[], count: number): Job[] => drawWeighted(candidates, (j) => OFFER_WEIGHT[j.grade], count);

/**
 * Tire le catalogue : 6 éléments au plus par catégorie, les plus lourds revenant plus souvent. Ce qui est en cours
 * (boulot rapide exercé, formation suivie) reste toujours visible, et les diplômes déjà obtenus ne reviennent pas.
 */
export function drawCatalog(state: GameState): Catalog {
  const pick = <T extends { id: string }>(items: T[], weight: (item: T) => number, keep: string | null): string[] => {
    const kept = items.filter((i) => i.id === keep);
    const rest = drawWeighted(items.filter((i) => i.id !== keep), weight, CATALOG_MAX - kept.length);
    return [...kept, ...rest].map((i) => i.id);
  };
  const trainings = Object.entries(TRAININGS)
    .filter(([id]) => !state.diplomas.includes(id))
    .map(([id, cfg]) => ({ id, ...cfg }));
  const inProgress = state.training?.id ?? null;
  const catalog = {
    gigs: pick(GIGS, (g) => g.weight, state.gig),
    quick: pick(trainings.filter((t) => t.quick), (t) => t.weight, inProgress),
    training: pick(trainings.filter((t) => !t.quick), (t) => t.weight, inProgress),
  };
  // Chaque élément visible reçoit un nouvel écart de prix, sauf ce qui est en cours : la paie du boulot exercé ne bouge pas.
  const factors: Record<string, number> = {};
  for (const id of [...catalog.gigs, ...catalog.quick, ...catalog.training]) {
    const kept = id === state.gig || id === inProgress;
    factors[id] = kept ? state.catalog?.factors?.[id] ?? 0 : rollFactor();
  }
  return { ...catalog, factors };
}

/** Désavantages mensuels cumulés sur la santé et le bonheur : gros emploi, boulot rapide et formation en cours. */
export function monthlyDrawbacks(state: GameState): Record<StatKey, number> {
  const total: Record<StatKey, number> = { health: 0, happiness: 0 };
  const job = jobById(state.job);
  const sources: Drawback[] = [
    job ? jobDrawback(job, companyById(state.jobCompany)) : {},
    gigById(state.gig)?.drawback ?? {},
    state.training ? TRAININGS[state.training.id].drawback : {},
  ];
  for (const d of sources) {
    total.health += d.health ?? 0;
    total.happiness += d.happiness ?? 0;
  }
  return total;
}

/**
 * Fin de mois côté offres : les offres vieillissent et expirent, puis chaque heure de recherche hebdomadaire
 * amène une nouvelle offre qui remplace les plus anciennes quand la liste est pleine. Sans recherche, rien de neuf.
 */
function refreshOffers(s: GameState) {
  const before = s.offers.length;
  s.offers = s.offers.map((o) => ({ ...o, monthsLeft: o.monthsLeft - 1 })).filter((o) => o.monthsLeft > 0);
  if (s.jobTarget && !s.offers.some((o) => o.jobId === s.jobTarget)) {
    addLog(s, 'log.offerExpired', { jobId: s.jobTarget, gender: s.gender });
    s.jobTarget = null;
  }
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
      .filter((o) => o.jobId !== s.jobTarget)
      .sort((a, b) => a.monthsLeft - b.monthsLeft)
      .slice(0, overflow);
    s.offers = s.offers.filter((o) => !drop.includes(o));
  }
  s.offers.push(...fresh.map(makeOffer));
  addLog(s, 'log.newOffers', { count: fresh.length }, 'good');
}

// ---------- Actions publiques ----------

/** Passe au mois suivant en appliquant le planning actuel. */
export function endTurn(state: GameState): GameState {
  if (isOverbooked(state)) return state; // garde-fou : l'interface bloque déjà le bouton
  const s = structuredClone(state);

  // Les jauges sont calculées avant de toucher à l'argent, comme dans l'aperçu affiché au joueur.
  const next = projectNextStats(s);
  const gains = skillGains(s);
  s.stats = next;
  for (const { id } of SKILLS) s.skills[id] = clamp(s.skills[id] + gains[id]);

  const job = jobById(s.job);
  if (job) {
    const salary = currentSalary(s);
    s.money += salary;
    addLog(s, 'log.pay', { jobId: job.id, gender: s.gender, amount: salary }, 'good');
    gainExperience(s, job);
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
  accrueSavings(s);

  progressTraining(s);

  resolveApplication(s);
  resolveHousingApplication(s);
  refreshOffers(s);
  refreshListings(s);

  if (s.stats.happiness < 20) addLog(s, 'log.lowMood', {}, 'bad');
  if (s.money < 0) addLog(s, 'log.overdraft', {}, 'bad');

  s.month += 1;
  if (s.month % CATALOG_REFRESH_MONTHS === 0) {
    s.catalog = drawCatalog(s);
    addLog(s, 'log.catalogRefreshed');
  }
  addLog(s, 'log.monthMark', { month: s.month }, 'month');
  closeExpiredSavings(s);

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
