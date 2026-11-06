// Calendrier et économie : rapport annuel (immobilier, taux, SMIC) et ses effets.
import { ECONOMY_RULES, ECONOMY_START, RATE_KEYS, START_YEAR } from '../../data/content';
import type { RateKey } from '../../data/content';
import type { Economy, EconomyReport, GameState } from '../types';
import { jobById } from './lookup';
import { addLog, clamp } from './shared';

export const startEconomy = (): Economy => ({ smic: ECONOMY_START.smic, rates: { ...ECONOMY_START.rates }, housingIndex: 1 });

/** Année et mois (0 = janvier) d'un mois de la partie. */
export const calendarOf = (month: number): { year: number; monthIndex: number } => ({
  year: START_YEAR + Math.floor(month / 12),
  monthIndex: month % 12,
});

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** Saison d'un mois de la partie (météorologique : décembre à février = hiver). */
export const seasonOf = (month: number): Season => {
  const m = calendarOf(month).monthIndex;
  return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
};

/** Plancher d'un salaire : le SMIC net, au prorata des heures du contrat (35 h = plein). */
export const smicFloor = (smic: number, hours: number): number => Math.round(smic * Math.min(1, hours / 35));

/** Tirage selon une loi normale centrée réduite (Box-Muller). */
const gauss = (): number => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

const round = (n: number, step: number) => Number((Math.round(n / step) * step).toFixed(6));

/** Un salaire collé au plancher suit le SMIC (à la hausse comme à la baisse) ; un salaire passé sous le plancher le rejoint. */
function followSmic(salary: number, hours: number, from: number, to: number): number {
  const oldFloor = smicFloor(from, hours);
  const newFloor = smicFloor(to, hours);
  return salary === oldFloor || salary < newFloor ? newFloor : salary;
}

/** Tire la nouvelle situation économique : appliquée en janvier, elle donne lieu au rapport affiché au joueur. */
export function rollEconomy(s: GameState) {
  const prev = s.economy;
  const { housing: h, smic: m, bounds, noise } = ECONOMY_RULES;
  const housing = round(clamp(h.mean + h.sd * gauss(), h.min, h.max), 0.001);
  const smicChange = clamp(m.mean + m.sd * gauss(), m.min, m.max);
  const smic = Math.round(prev.smic * (1 + smicChange));

  const savingsShock = ECONOMY_RULES.savingsTrend * gauss();
  const loanShock = ECONOMY_RULES.loanTrend * gauss();
  const rates = {} as Record<RateKey, number>;
  const report: EconomyReport = { year: calendarOf(s.month).year, housing, smic: { from: prev.smic, to: smic }, rates: {} as EconomyReport['rates'] };
  for (const key of RATE_KEYS) {
    const shock = key.startsWith('loan') ? loanShock : savingsShock;
    const [min, max] = bounds[key];
    rates[key] = round(clamp(prev.rates[key] + shock + noise[key] * gauss(), min, max), 0.0005);
  }
  // Le LDDS a toujours le taux du Livret A (fixé par l'État) ; le Livret Jeune rapporte au moins autant.
  rates.ldds = rates.livretA;
  rates.livretJeune = Math.max(rates.livretJeune, rates.livretA);
  // Un prêt plus long coûte plus cher : l'ordre 15 ≤ 20 ≤ 25 ans est conservé, avec au moins 0,1 point d'écart.
  rates.loan20 = Math.max(rates.loan20, round(rates.loan15 + 0.001, 0.0005));
  rates.loan25 = Math.max(rates.loan25, round(rates.loan20 + 0.001, 0.0005));
  for (const key of RATE_KEYS) report.rates[key] = { from: prev.rates[key], to: rates[key] };

  s.economy = { smic, rates, housingIndex: prev.housingIndex * (1 + housing) };

  // Immobilier : la valeur des biens possédés et le prix des annonces à vendre suivent le marché.
  const grow = (n: number, step = 1) => round(n * (1 + housing), step);
  if (s.home.tenure === 'own') s.home.value = grow(s.home.value);
  for (const p of s.properties) {
    p.value = grow(p.value);
    if (p.status === 'selling') p.ask = grow(p.ask, 500);
  }
  for (const l of s.listings) if (l.tenure === 'buy') l.price = grow(l.price, 500);

  // SMIC : les salaires au plancher le suivent.
  const job = jobById(s.job);
  if (job && s.jobSalary !== null) s.jobSalary = followSmic(s.jobSalary, job.hours, prev.smic, smic);
  const adjust = <T extends { jobId: string; salary: number }>(offer: T): T => {
    const j = jobById(offer.jobId);
    return j ? { ...offer, salary: followSmic(offer.salary, j.hours, prev.smic, smic) } : offer;
  };
  s.offers = s.offers.map(adjust);
  if (s.jobDecision) s.jobDecision.accepted = s.jobDecision.accepted.map(adjust);

  s.report = report;
  addLog(s, 'log.economyReport', { year: report.year });
}

/** Le joueur a lu le rapport annuel. */
export function dismissReport(state: GameState): GameState {
  return state.report ? { ...state, report: null } : state;
}
