// Biens immobiliers : achat à crédit, mise en location, vente.
import { LETTING, MOVING_COST, OWNING, RENT_CHANCE_MAX, RENT_CHANCE_MIN, SELLING } from '../../data/content';
import type { GameState, Home, HousingListing, LeaveAction, Property } from '../types';
import { housingTypeById, marketRent, moveCredit, moveInto, saleProceeds } from './housing';
import { currentSalary } from './lookup';
import { addLog, newId } from './shared';

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
export const hasStableIncome = (state: GameState): boolean => !!state.job || lettingIncome(state) > 0;

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

/** Bien possédé qu'on ne quitte pas en le vendant : il rejoint les biens possédés, vide ou en recherche de locataire. */
export function keepAsProperty(s: GameState, home: Home, leave: 'rent' | 'vacant') {
  s.properties.push({
    id: newId(),
    typeId: home.typeId,
    area: home.area,
    commute: home.commute,
    status: leave === 'rent' ? 'letting' : 'vacant',
    value: home.value,
    charges: home.charges,
    loan: home.loan,
    rent: marketRent(home.typeId, home.area),
    ask: home.value,
  });
  addLog(s, leave === 'rent' ? 'log.homeLetting' : 'log.homeVacant', { homeId: home.typeId });
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
      typeId: l.typeId, area: l.area, commute: l.commute, tenure: 'own', rent: 0, deposit: 0, value: l.price, charges: q.charges, loan,
    }, l.id, q.upfront, leave);
  } else {
    s.money -= q.upfront;
    s.listings = s.listings.filter((x) => x.id !== l.id);
    if (s.housingTarget === l.id) s.housingTarget = null;
    s.properties.push({
      id: newId(), typeId: l.typeId, area: l.area, commute: l.commute, status: 'letting', value: l.price, charges: q.charges, loan,
      rent: marketRent(l.typeId, l.area), ask: l.price,
    });
  }
  addLog(s, 'log.homeBought', { homeId: l.typeId, price: l.price }, 'good');
  return s;
}

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
    typeId: p.typeId, area: p.area, commute: p.commute, tenure: 'own', rent: 0, deposit: 0, value: p.value, charges: p.charges, loan: p.loan,
  }, null, MOVING_COST, leave);
  addLog(s, 'log.movedIn', { homeId: p.typeId });
  return s;
}

/** Fin de mois d'un propriétaire : le bien prend un peu de valeur et le prêt s'amortit. */
export function ageProperty(s: GameState, item: { value: number; loan: Home['loan'] }) {
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

/** Fin de mois des biens possédés : valeur et prêt évoluent, un locataire arrive ou part, un acheteur se présente. */
export function progressProperties(s: GameState) {
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
