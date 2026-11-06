// Effets mensuels : revenus, dépenses, jauges, compétences et pénibilité.
import { DEBT_HAPPINESS_LOSS, EFFICIENCY, FOOD_COST, JOBS, LEISURE_COST_PER_WEEKLY_HOUR, LEISURE_NEUTRAL, REPAIRS, SKILL_RULES, SLEEP_NEUTRAL, SPORT_HEALTH_PER_HOUR, TRAININGS, WORK_STYLES } from '../../data/content';
import type { Drawback, GameState, Schedule, SkillId, StatKey } from '../types';
import { housingEffects } from './housing';
import { companyById, currentSalary, gigById, gigPay, jobById, jobDrawback } from './lookup';
import { lettingIncome } from './property';
import { weeklyHours } from './schedule';
import { clamp } from './shared';
import { trainingTuition } from './training';
import { workActive } from './work';
import { drivingVehicle, fuelCost, insuranceOf } from './vehicle';

/** Une ligne du détail mensuel : `id` sert à retrouver le libellé traduit selon `kind`. */
export interface MoneyLine {
  kind: 'job' | 'gig' | 'rentals' | 'food' | 'housing' | 'loan' | 'charges' | 'propLoan' | 'propCharges' | 'fuel' | 'insurance' | 'leisure' | 'training';
  id?: string;
  amount: number;
}

export function monthlyIncomeLines(state: GameState): MoneyLine[] {
  const job = jobById(state.job);
  const gig = gigById(state.gig);
  const lines: MoneyLine[] = [];
  // En arrêt maladie, seule une part du salaire est versée.
  if (job) lines.push({ kind: 'job', id: job.id, amount: Math.round(currentSalary(state) * (state.sickLeave > 0 ? EFFICIENCY.sickPay : 1)) });
  if (gig) lines.push({ kind: 'gig', id: gig.id, amount: gigPay(state, gig) });
  const rentals = lettingIncome(state);
  if (rentals > 0) lines.push({ kind: 'rentals', amount: rentals });
  return lines;
}

/** Nourriture + loyer (ou mensualité du prêt et charges) + carburant et assurance du véhicule + coût des loisirs + frais de formation. */
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
  // `id` = identifiant du véhicule : une ligne d'assurance par véhicule, le carburant pour celui qui roule.
  for (const v of state.vehicles) lines.push({ kind: 'insurance', id: v.id, amount: insuranceOf(state, v) });
  const fuel = fuelCost(state);
  const driving = drivingVehicle(state);
  if (fuel > 0 && driving) lines.push({ kind: 'fuel', id: driving.id, amount: fuel });
  lines.push({ kind: 'leisure', amount: Math.round(weeklyHours(state.schedule, 'leisure') * LEISURE_COST_PER_WEEKLY_HOUR) });
  if (state.training && trainingTuition(state) > 0) lines.push({ kind: 'training', id: state.training.id, amount: trainingTuition(state) });
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
    sportStrength: schedule.sport * (SKILL_RULES.perSportHour.strength ?? 0),
    /** Nouvelles offres d'emploi par mois : 1 par heure de recherche hebdomadaire. */
    searchOffers: schedule.search,
    /** Nouvelles annonces de logement par mois : 1 par heure de recherche hebdomadaire. */
    searchListings: schedule.housing,
  };
}

/** Jauges attendues le mois prochain avec le planning actuel (hors événements). */
export function projectNextStats(state: GameState): Record<StatKey, number> {
  const next = (key: StatKey) => clamp(state.stats[key] + statEffectLines(state, key).reduce((sum, l) => sum + l.amount, 0));
  return { health: next('health'), happiness: next('happiness') };
}

const NO_GAIN = (): Record<SkillId, number> => ({ digital: 0, charisma: 0, strength: 0, intelligence: 0, logistics: 0, mechanics: 0 });

/**
 * Compétences gagnées chaque mois : études (intelligence, numérique), sport (force), loisirs (charisme)
 * et le métier exercé (voir SKILL_RULES). Sert à l'aperçu du profil et au passage du mois.
 */
export function skillGains(state: GameState): Record<SkillId, number> {
  const gains = NO_GAIN();
  const sources = skillGainSources(state);
  for (const id of Object.keys(gains) as SkillId[]) gains[id] = sources[id].reduce((a, s) => a + s.amount, 0);
  return gains;
}

/** D'où vient chaque gain mensuel de compétence (détail de `skillGains`, pour l'infobulle du profil). */
export type SkillGainSource = { kind: 'study' | 'training' | 'sport' | 'leisure' | 'job' | 'gig' | 'repair'; id?: string; amount: number };

export function skillGainSources(state: GameState): Record<SkillId, SkillGainSource[]> {
  const out: Record<SkillId, SkillGainSource[]> = { digital: [], charisma: [], strength: [], intelligence: [], logistics: [], mechanics: [] };
  const add = (
    kind: SkillGainSource['kind'], rule: Partial<Record<SkillId, number>> | undefined, factor = 1, id?: string,
  ) => {
    for (const [skill, v] of Object.entries(rule ?? {}) as [SkillId, number][]) {
      if (v * factor > 0) out[skill].push({ kind, id, amount: v * factor });
    }
  };
  // Une formation qui a ses propres gains mensuels remplace ceux des heures d'étude, au prorata de l'assiduité.
  const cfg = state.training ? TRAININGS[state.training.id] : null;
  if (cfg?.monthlySkills) add('training', cfg.monthlySkills, Math.min(1, state.schedule.study / cfg.minStudyHours), state.training!.id);
  else add('study', SKILL_RULES.perStudyHour, state.schedule.study);
  add('sport', SKILL_RULES.perSportHour, state.schedule.sport);
  add('leisure', SKILL_RULES.perLeisureHour, state.schedule.leisure);
  const job = jobById(state.job);
  if (job) add('job', SKILL_RULES.perJobMonth[job.field], 1, job.id);
  const gig = gigById(state.gig);
  if (gig) add('gig', gig.skills, 1, gig.id);
  // Réparer soi-même fait progresser la mécanique, mois après mois.
  for (const v of state.vehicles) {
    if (v.repair?.diy) add('repair', { mechanics: REPAIRS[v.repair.kind].skillGain }, 1, v.repair.kind);
  }
  return out;
}

/** Mois d'expérience dans un domaine à partir desquels un poste s'ouvre (0 si aucun poste n'en exige). */
export const experienceGoal = (field: string): number =>
  Math.max(0, ...JOBS.flatMap((j) => (j.anyOf ?? []).flatMap((q) => (
    q.type === 'experience' && q.field === field ? [q.months] : []
  ))));

/** D'où vient la variation mensuelle d'une jauge (détail de `projectNextStats`, pour l'infobulle de la barre du haut). */
export type StatLine = { kind: 'sleep' | 'sport' | 'leisure' | 'debt' | 'style' | 'rest' | 'job' | 'gig' | 'training' | 'home'; id?: string; amount: number };

export function statEffectLines(state: GameState, key: StatKey): StatLine[] {
  const fx = scheduleEffects(state.schedule);
  const comfort = housingEffects(state);
  const job = jobById(state.job);
  const gig = gigById(state.gig);
  const sick = state.sickLeave > 0;
  const drawbacks: [StatLine['kind'], string | undefined, Drawback][] = [
    ['job', job?.id, job && !sick ? jobDrawback(job, companyById(state.jobCompany)) : {}],
    ['gig', gig?.id, gig?.drawback ?? {}],
    ['training', state.training?.id, state.training ? TRAININGS[state.training.id].drawback : {}],
  ];
  const lines: StatLine[] = key === 'health'
    ? [{ kind: 'sleep', amount: fx.sleepHealth }, { kind: 'sport', amount: fx.sportHealth }]
    : [{ kind: 'leisure', amount: fx.leisureHappiness }, { kind: 'debt', amount: state.money < 0 ? -DEBT_HAPPINESS_LOSS : 0 }];
  for (const [kind, id, d] of drawbacks) lines.push({ kind, id, amount: d[key] ?? 0 });
  // Le style de travail pèse sur la santé et le bonheur ; en arrêt maladie, on se repose.
  if (sick) lines.push({ kind: 'rest', amount: key === 'health' ? EFFICIENCY.sickRest : -1 });
  else if (workActive(state)) lines.push({ kind: 'style', amount: WORK_STYLES[state.workStyle][key] });
  lines.push({ kind: 'home', amount: comfort[key] });
  return lines.filter((l) => l.amount !== 0);
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
