// Logement : annonces, location, déménagement, confort.
import { AREA_IDS, AREAS, HOUSING_TYPES, LISTING_MONTHS, LISTING_WEIGHT, LISTINGS_MAX, MOVING_COST, OWNING, RENT, RENT_CHANCE, RENT_CHANCE_MAX, RENT_CHANCE_MIN } from '../../data/content';
import type { HousingType } from '../../data/content';
import type { Area, GameState, Home, HousingListing, LeaveAction, StatKey } from '../types';
import { scheduleEffects } from './effects';
import { currentSalary, gigById, gigPay } from './lookup';
import { ageProperty, hasStableIncome, keepAsProperty, lettingIncome } from './property';
import { totalSavings } from './savings';
import { addLog, drawWeighted, rollFactor } from './shared';
import { enforceParking } from './vehicle';

export const housingTypeById = (id: string): HousingType => HOUSING_TYPES[id] ?? HOUSING_TYPES.studio;

/** Logement de départ : loué au loyer de base en centre-ville, sans caution (le joueur y vit déjà). */
export function starterHome(typeId: string): Home {
  return { typeId, area: 'center', commute: 0, tenure: 'rent', rent: housingTypeById(typeId).rent ?? 0, deposit: 0, value: 0, charges: 0, loan: null };
}

/** Places de parking d'un logement : celles du bien plus celles du quartier, au moins une. */
export const parkingOf = (typeId: string, area: Area): number => Math.max(1, housingTypeById(typeId).parking + AREAS[area].parking);

/** Trajet hebdomadaire d'un logement : entier tiré dans la fourchette de son quartier. */
const rollCommute = (area: Area): number => {
  const [min, max] = AREAS[area].commute;
  return min + Math.floor(Math.random() * (max - min + 1));
};

/** Nouvelle annonce pour un type de bien : à louer ou à vendre (50/50 si les deux sont possibles), dans un quartier tiré au sort. */
function makeListing(typeId: string): HousingListing {
  const type = housingTypeById(typeId);
  const tenure = type.rent === null ? 'buy' : type.price === null || Math.random() < 0.5 ? 'rent' : 'buy';
  const area = drawWeighted(AREA_IDS.filter((a) => !type.notIn?.includes(a)), (a) => AREAS[a].weight, 1)[0];
  const base = (tenure === 'rent' ? type.rent : type.price)!;
  const raw = base * AREAS[area].price * (1 + rollFactor());
  return {
    id: Math.random().toString(36).slice(2, 8),
    typeId,
    area,
    commute: rollCommute(area),
    tenure,
    price: tenure === 'rent' ? Math.round(raw / 5) * 5 : Math.round(raw / 500) * 500,
    monthsLeft: LISTING_MONTHS[type.grade],
  };
}

/**
 * Tire `count` annonces, chaque type de bien indépendamment des autres (un même type peut revenir dans un autre quartier) :
 * les plus rares (grosse maison) apparaissent bien moins souvent que les communs (studio).
 */
export const drawListings = (count: number): HousingListing[] =>
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
  state.job || state.gig ? state.home.commute : 0;

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
export function moveInto(s: GameState, home: Home, listingId: string | null, cost: number, leave: LeaveAction) {
  s.money += leaveHome(s, leave) - cost;
  s.home = home;
  if (listingId) s.listings = s.listings.filter((l) => l.id !== listingId);
  s.housingTarget = null;
  enforceParking(s);
}

/** Tirage de l'acceptation du dossier : il reste ouvert tant que l'annonce existe, mais il faut pouvoir payer l'entrée. */
export function resolveHousingApplication(s: GameState) {
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
    moveInto(s, { typeId: l.typeId, area: l.area, commute: l.commute, tenure: 'rent', rent: l.price, deposit: quote.deposit, value: 0, charges: 0, loan: null },
      l.id, quote.upfront, s.housingLeave);
    addLog(s, 'log.housingFound', { homeId: l.typeId, rent: l.price }, 'good');
  } else {
    addLog(s, 'log.housingNone', { homeId: l.typeId });
  }
}

export function progressHome(s: GameState) {
  if (s.home.tenure === 'own') ageProperty(s, s.home);
}

/** Les annonces vieillissent et expirent ; chaque heure de recherche de logement par semaine en amène une nouvelle par mois. */
export function refreshListings(s: GameState) {
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
