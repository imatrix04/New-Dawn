// Véhicules : parc limité par les places de parking, achat (carte grise, malus), usure, pannes, réparations,
// contrôle technique, permis et style de conduite. Un seul véhicule roule pour les trajets ; les autres restent garés.
import {
  ACCIDENT, BREAKDOWN, DEPRECIATION, DRIVING, DRIVING_STYLES, FUELS, INSPECTION, INSURANCE, LICENSE, MALUS_CO2, MALUS_WEIGHT,
  NEW_VEHICLE_FEES, OFFENCES, REGISTRATION, REPAIRS, USED_MARKET, VEHICLE_IDS, VEHICLE_MODELS, WEAR,
} from '../../data/content';
import type { FuelSpec, VehicleModel } from '../../data/content';
import type { Area, Breakdown, Driver, DrivingStyle, FuelType, GameState, RepairKind, Vehicle, VehicleListing } from '../types';
import { housingCommute, parkingOf } from './housing';
import { companyById, gigById, jobById, jobCommute } from './lookup';
import { ageYears } from './savings';
import { addLog, clamp, drawWeighted, newId, rollFactor } from './shared';

export const vehicleModel = (modelId: string): VehicleModel => VEHICLE_MODELS[modelId] ?? VEHICLE_MODELS.city;
export const fuelSpec = (modelId: string, fuel: FuelType): FuelSpec => {
  const fuels = vehicleModel(modelId).fuels;
  return fuels[fuel] ?? fuels.petrol!;
};

const round = (n: number, step = 1) => Math.round(n / step) * step;
const SEVERITY: Record<Breakdown, number> = { minor: 1, major: 2, broken: 3 };

// ---------- Parking ----------

/** Places de parking du logement actuel : c'est là que sont garés les véhicules. */
export const parkingSpots = (state: GameState): number => parkingOf(state.home.typeId, state.home.area);

/** Combien de véhicules ne tiendraient plus dans un logement donné (à revendre si l'on y emménage). */
export const parkingOverflow = (state: GameState, typeId: string, area: Area): number =>
  Math.max(0, state.vehicles.length - parkingOf(typeId, area));

// ---------- État du véhicule et du conducteur ----------

export const newDriver = (): Driver => ({ vehicleId: null, points: LICENSE.points, crm: 1, banUntil: null, lastOffense: null, style: 'normal' });

export const vehicleById = (state: GameState, id: string | null): Vehicle | null => state.vehicles.find((v) => v.id === id) ?? null;

export const vehicleAgeMonths = (state: GameState, v: Vehicle): number => state.month - v.registeredMonth;
export const vehicleAgeYears = (state: GameState, v: Vehicle): number => Math.floor(vehicleAgeMonths(state, v) / 12);

export const hasLicense = (state: GameState): boolean => state.diplomas.includes('permisB');
/** Permis suspendu ou invalidé : mois restants avant de pouvoir conduire (ou repasser le permis), 0 si libre. */
export const banMonthsLeft = (state: GameState): number => Math.max(0, (state.driver.banUntil ?? 0) - state.month);

/** Hors d'usage : l'état maximal est tombé trop bas, plus aucune réparation ne vaut le coup. */
export const isScrap = (v: Vehicle): boolean => v.ceiling < WEAR.scrapCeiling;

/** Immobilisé : panne majeure ou casse, réparation lourde en cours, ou épave. Un simple entretien n'immobilise pas. */
export const isImmobilised = (v: Vehicle): boolean =>
  v.issue === 'major' || v.issue === 'broken' || (v.repair !== null && v.repair.kind !== 'service') || isScrap(v) || v.condition <= 0;

/**
 * Le véhicule qui roule ce mois-ci : celui choisi pour les trajets s'il est en état, sinon le premier qui peut rouler.
 * Aucun si le conducteur n'a pas le permis, est suspendu, ou si tous les véhicules sont immobilisés.
 */
export function drivingVehicle(state: GameState): Vehicle | null {
  if (!hasLicense(state) || banMonthsLeft(state) > 0) return null;
  const usable = state.vehicles.filter((v) => !isImmobilised(v));
  return usable.find((v) => v.id === state.driver.vehicleId) ?? usable[0] ?? null;
}

export type DriveBlock = 'none' | 'license' | 'banned' | 'immobilised';

/** Pourquoi aucun véhicule ne roule ce mois-ci (ou 'none' si l'un roule, ou s'il n'y en a aucun). */
export function driveBlock(state: GameState): DriveBlock {
  if (state.vehicles.length === 0) return 'none';
  if (!hasLicense(state)) return 'license';
  if (banMonthsLeft(state) > 0) return 'banned';
  return drivingVehicle(state) ? 'none' : 'immobilised';
}

export const canDrive = (state: GameState): boolean => drivingVehicle(state) !== null;

/** Choisit le véhicule des trajets. */
export function setDrivingVehicle(state: GameState, id: string): GameState {
  if (state.driver.vehicleId === id || !vehicleById(state, id)) return state;
  const s = structuredClone(state);
  s.driver.vehicleId = id;
  return s;
}

// ---------- Trajets, kilomètres, coûts mensuels ----------

/** Heures de trajet hebdomadaires sans véhicule : emploi, boulot rapide et éloignement du logement. */
export function baseCommute(state: GameState): number {
  const job = jobById(state.job);
  return (job ? jobCommute(job, companyById(state.jobCompany)) : 0) + (gigById(state.gig)?.commute ?? 0) + housingCommute(state);
}

/** Heures de trajet hebdomadaires au volant, selon le style de conduite : le trajet de base divisé, arrondi à la demi-heure. */
export const commuteAt = (base: number, style: DrivingStyle): number => round(base / DRIVING_STYLES[style].timeDivisor, 0.5);

/** Heures de trajet hebdomadaires réelles : celles du style de conduite quand un véhicule roule, sinon le trajet de base. */
export const commuteHours = (state: GameState): number =>
  canDrive(state) ? commuteAt(baseCommute(state), state.driver.style) : baseCommute(state);

/** Kilomètres d'un mois au volant : les trajets (heures de base × vitesse moyenne) plus le quotidien. */
export const estimatedKm = (state: GameState): number =>
  Math.round(baseCommute(state) * DRIVING.weeksPerMonth * DRIVING.kmPerCommuteHour + DRIVING.personalKm);

/** Kilomètres du mois : ceux d'un mois au volant si un véhicule roule, sinon rien. */
export const monthlyKm = (state: GameState): number => (canDrive(state) ? estimatedKm(state) : 0);

export function fuelCost(state: GameState): number {
  const v = drivingVehicle(state);
  if (!v) return 0;
  const l100 = fuelSpec(v.modelId, v.fuel).l100;
  return Math.round((monthlyKm(state) / 100) * l100 * DRIVING_STYLES[state.driver.style].fuel * FUELS[v.fuel].price);
}

/** Assurance mensuelle d'un modèle ayant `years` ans : tarif × bonus-malus, majorée pour les jeunes conducteurs, allégée sur un vieux véhicule. */
export function insuranceFor(state: GameState, modelId: string, years: number): number {
  const young = ageYears(state) < INSURANCE.youngAge ? INSURANCE.youngSurcharge : 1;
  const old = years >= INSURANCE.oldYears ? INSURANCE.oldDiscount : 1;
  return Math.round(vehicleModel(modelId).insurance * state.driver.crm * young * old);
}

/** Chaque véhicule garé ou non est assuré. */
export const insuranceOf = (state: GameState, v: Vehicle): number => insuranceFor(state, v.modelId, vehicleAgeYears(state, v));
export const insuranceCost = (state: GameState): number => state.vehicles.reduce((sum, v) => sum + insuranceOf(state, v), 0);

// ---------- Valeur et prix ----------

/** Valeur marchande d'un véhicule : prix neuf décoté selon l'âge, le kilométrage et l'état. */
export function marketValue(modelId: string, fuel: FuelType, ageMonths: number, km: number, condition: number): number {
  const base = vehicleModel(modelId).price + fuelSpec(modelId, fuel).extra;
  const age = Math.max(DEPRECIATION.floor, Math.pow(DEPRECIATION.perYear, ageMonths / 12));
  const mileage = Math.max(DEPRECIATION.kmFloor, 1 - km / DEPRECIATION.kmRef);
  const shape = DEPRECIATION.conditionBase + (1 - DEPRECIATION.conditionBase) * (condition / 100);
  return Math.max(300, round(base * age * mileage * shape, 50));
}

export const vehicleValue = (state: GameState, v: Vehicle): number =>
  marketValue(v.modelId, v.fuel, vehicleAgeMonths(state, v), v.km, v.condition);

/** Carte grise : chevaux fiscaux × tarif du cheval + taxes fixes, réduite de moitié au-delà de 10 ans. */
export function registrationFee(modelId: string, years: number): number {
  const full = vehicleModel(modelId).hp * REGISTRATION.perHp + REGISTRATION.fixed;
  return Math.round(years >= REGISTRATION.halfAfterYears ? full / 2 : full);
}

/** Malus CO₂ : interpolation linéaire dans le barème (0 sous le seuil, plafonné au dernier palier). */
export function malusCo2(co2: number): number {
  const table = MALUS_CO2;
  if (co2 <= table[0].co2) return 0;
  const last = table[table.length - 1];
  if (co2 >= last.co2) return last.amount;
  const i = table.findIndex((p) => p.co2 >= co2);
  const [a, b] = [table[i - 1], table[i]];
  return Math.round(a.amount + ((co2 - a.co2) / (b.co2 - a.co2)) * (b.amount - a.amount));
}

export const malusWeight = (weight: number): number => Math.max(0, weight - MALUS_WEIGHT.threshold) * MALUS_WEIGHT.perKg;

// ---------- Contrôle technique ----------

export type InspectionStatus = 'exempt' | 'valid' | 'overdue';

/** Exempté avant 4 ans ; ensuite le contrôle doit être réussi et avoir moins de 2 ans. */
export function inspectionStatus(state: GameState, v: Vehicle): InspectionStatus {
  if (vehicleAgeMonths(state, v) < INSPECTION.firstAfterMonths) return 'exempt';
  const i = v.inspection;
  return i?.passed && state.month - i.month <= INSPECTION.validMonths ? 'valid' : 'overdue';
}

/** Contre-visite moins chère si le dernier contrôle a été raté depuis peu. */
export function inspectionPrice(state: GameState, v: Vehicle): number {
  const i = v.inspection;
  return i && !i.passed && state.month - i.month <= INSPECTION.retryMonths ? INSPECTION.retryPrice : INSPECTION.price;
}

/** Contrôle réussi : état suffisant et pas de panne majeure. */
const inspectionPasses = (v: Vehicle): boolean => v.condition >= INSPECTION.minCondition && (v.issue === null || v.issue === 'minor');

export function takeInspection(state: GameState, id: string): GameState {
  const v = vehicleById(state, id);
  if (!v || v.repair || isScrap(v) || state.money < inspectionPrice(state, v)) return state;
  const s = structuredClone(state);
  const car = vehicleById(s, id)!;
  const price = inspectionPrice(s, car);
  const passed = inspectionPasses(car);
  s.money -= price;
  car.inspection = { month: s.month, passed };
  addLog(s, passed ? 'log.inspectionPassed' : 'log.inspectionFailed', { amount: price, vehicleId: car.modelId }, passed ? 'good' : 'bad');
  return s;
}

// ---------- Revente ----------

/** Un véhicule récent, ou avec un contrôle de moins de 6 mois, se revend au meilleur prix. */
export function saleReady(state: GameState, v: Vehicle): boolean {
  if (vehicleAgeMonths(state, v) < INSPECTION.firstAfterMonths) return true;
  const i = v.inspection;
  return !!i?.passed && state.month - i.month <= INSPECTION.saleMonths;
}

export function salePrice(state: GameState, v: Vehicle): number {
  if (isScrap(v)) return WEAR.scrapValue;
  return round(vehicleValue(state, v) * (saleReady(state, v) ? USED_MARKET.resale : USED_MARKET.resaleNoInspection), 50);
}

/** Retire un véhicule du parc (le choix des trajets passe au suivant si besoin). */
function removeVehicle(s: GameState, id: string) {
  s.vehicles = s.vehicles.filter((v) => v.id !== id);
  if (s.driver.vehicleId === id) s.driver.vehicleId = null;
}

export function sellVehicle(state: GameState, id: string): GameState {
  const v = vehicleById(state, id);
  if (!v) return state;
  const s = structuredClone(state);
  const price = salePrice(s, v);
  s.money += price;
  removeVehicle(s, id);
  addLog(s, isScrap(v) ? 'log.vehicleScrapped' : 'log.vehicleSold', { vehicleId: v.modelId, amount: price }, 'good');
  return s;
}

/** Après un déménagement : les véhicules en trop (faute de places de parking) sont revendus, les moins chers d'abord. */
export function enforceParking(s: GameState) {
  while (s.vehicles.length > parkingSpots(s)) {
    const cheapest = [...s.vehicles].sort((a, b) => salePrice(s, a) - salePrice(s, b))[0];
    const price = salePrice(s, cheapest);
    s.money += price;
    removeVehicle(s, cheapest.id);
    addLog(s, 'log.vehicleNoParking', { vehicleId: cheapest.modelId, amount: price }, 'bad');
  }
}

// ---------- Achat ----------

export type VehicleSource = { type: 'new'; modelId: string; fuel: FuelType } | { type: 'used'; id: string };

export interface VehicleQuote {
  modelId: string;
  fuel: FuelType;
  used: boolean;
  price: number;
  /** Frais de mise en circulation (neuf seulement). */
  fees: number;
  /** Carte grise. */
  registration: number;
  /** Malus écologique CO₂ et malus au poids (neuf seulement : ils se paient à la première immatriculation). */
  malusCo2: number;
  malusWeight: number;
  co2: number;
  total: number;
  reason: 'license' | 'parking' | 'cash' | null;
}

export function vehicleQuote(state: GameState, source: VehicleSource): VehicleQuote | null {
  const listing = source.type === 'used' ? state.vehicleListings.find((l) => l.id === source.id) : undefined;
  if (source.type === 'used' && !listing) return null;
  const { modelId, fuel } = listing ?? (source as Extract<VehicleSource, { type: 'new' }>);
  const model = VEHICLE_MODELS[modelId];
  const spec = model?.fuels[fuel];
  if (!model || !spec) return null;
  const used = listing !== undefined;
  const price = listing ? listing.price : model.price + spec.extra;
  const years = listing ? Math.floor((state.month - listing.registeredMonth) / 12) : 0;
  const quote = {
    modelId, fuel, used, price,
    fees: used ? 0 : NEW_VEHICLE_FEES,
    registration: registrationFee(modelId, years),
    malusCo2: used ? 0 : malusCo2(spec.co2),
    malusWeight: used ? 0 : malusWeight(model.weight),
    co2: spec.co2,
  };
  const total = quote.price + quote.fees + quote.registration + quote.malusCo2 + quote.malusWeight;
  const reason = !hasLicense(state) ? 'license' : state.vehicles.length >= parkingSpots(state) ? 'parking' : state.money < total ? 'cash' : null;
  return { ...quote, total, reason };
}

const brandNew = (month: number, modelId: string, fuel: FuelType): Vehicle => ({
  id: newId(), modelId, fuel, km: 0, registeredMonth: month, condition: 100, ceiling: 100, lastServiceKm: 0, inspection: null, issue: null, repair: null,
});

/** Achète un véhicule neuf ou une annonce d'occasion, s'il reste une place de parking. */
export function buyVehicle(state: GameState, source: VehicleSource): GameState {
  const quote = vehicleQuote(state, source);
  if (!quote || quote.reason) return state;
  const s = structuredClone(state);
  const listing = source.type === 'used' ? s.vehicleListings.find((l) => l.id === source.id)! : null;
  s.money -= quote.total;
  let bought: Vehicle;
  if (listing) {
    // Un véhicule de plus de 4 ans est vendu avec un contrôle technique récent.
    const old = s.month - listing.registeredMonth >= INSPECTION.firstAfterMonths;
    bought = {
      id: newId(), modelId: listing.modelId, fuel: listing.fuel, km: listing.km, registeredMonth: listing.registeredMonth,
      condition: listing.condition, ceiling: listing.ceiling,
      lastServiceKm: Math.max(0, listing.km - Math.floor(Math.random() * WEAR.serviceEveryKm)),
      inspection: old ? { month: s.month - Math.floor(Math.random() * 5), passed: true } : null,
      issue: null, repair: null,
    };
    s.vehicleListings = s.vehicleListings.filter((l) => l.id !== listing.id);
  } else {
    bought = brandNew(s.month, quote.modelId, quote.fuel);
  }
  s.vehicles.push(bought);
  if (!vehicleById(s, s.driver.vehicleId)) s.driver.vehicleId = bought.id;
  addLog(s, 'log.vehicleBought', { vehicleId: quote.modelId, amount: quote.total }, 'good');
  return s;
}

export function setDrivingStyle(state: GameState, style: DrivingStyle): GameState {
  if (style === state.driver.style || !DRIVING_STYLES[style]) return state;
  const s = structuredClone(state);
  s.driver.style = style;
  return s;
}

// ---------- Réparations ----------

export interface RepairQuote {
  kind: RepairKind;
  diy: boolean;
  cost: number;
  /** Mois avant la fin (0 : fait sur le champ, au garage). */
  months: number;
  /** Heures par semaine prises dans le planning (à soi-même). */
  hours: number;
  minSkill: number;
  /** État maximal restant après l'intervention. */
  ceilingAfter: number;
  /** Le véhicule est-il immobilisé pendant l'intervention ? */
  immobilised: boolean;
  blocked: 'skill' | 'cash' | 'scrap' | null;
}

/** Interventions possibles : l'entretien à tout moment, et la réparation de la panne en cours. */
export function availableRepairs(v: Vehicle): RepairKind[] {
  if (v.repair || isScrap(v)) return [];
  return v.issue ? [v.issue, 'service'] : ['service'];
}

export function repairQuote(state: GameState, v: Vehicle, kind: RepairKind, diy: boolean): RepairQuote {
  const spec = REPAIRS[kind];
  const parts = vehicleModel(v.modelId).parts;
  const months = diy ? spec.diyMonths : spec.garageMonths;
  const cost = round((diy ? spec.diy : spec.garage) * parts, 5);
  const ceilingAfter = v.ceiling - spec.ceilingLoss;
  const blocked = ceilingAfter < WEAR.scrapCeiling ? 'scrap' : diy && state.skills.mechanics < spec.minSkill ? 'skill' : state.money < cost ? 'cash' : null;
  return { kind, diy, cost, months, hours: diy ? spec.hours : 0, minSkill: diy ? spec.minSkill : 0, ceilingAfter, immobilised: kind !== 'service' && months > 0, blocked };
}

/** Fin d'une intervention : l'état remonte (sans dépasser le nouvel état maximal), la panne disparaît, le maximum baisse. */
function finishRepair(s: GameState, v: Vehicle, kind: RepairKind, diy: boolean) {
  const spec = REPAIRS[kind];
  v.ceiling = Math.max(0, v.ceiling - spec.ceilingLoss);
  v.condition = Math.min(v.ceiling, v.condition + spec.restore);
  if (kind === 'service') v.lastServiceKm = v.km;
  else v.issue = null;
  v.repair = null;
  addLog(s, 'log.repairDone', { repairKind: kind, vehicleId: v.modelId, context: diy ? 'diy' : 'garage' }, 'good');
}

export function startRepair(state: GameState, id: string, kind: RepairKind, diy: boolean): GameState {
  const v = vehicleById(state, id);
  if (!v || !availableRepairs(v).includes(kind)) return state;
  const quote = repairQuote(state, v, kind, diy);
  if (quote.blocked) return state;
  const s = structuredClone(state);
  const car = vehicleById(s, id)!;
  s.money -= quote.cost;
  if (quote.months === 0) {
    finishRepair(s, car, kind, diy);
  } else {
    car.repair = { kind, diy, monthsLeft: quote.months };
    addLog(s, 'log.repairStarted', { repairKind: kind, vehicleId: car.modelId, context: diy ? 'diy' : 'garage', amount: quote.cost });
  }
  return s;
}

/** Heures par semaine passées à réparer soi-même, tous véhicules confondus. */
export const repairHours = (state: GameState): number =>
  state.vehicles.reduce((sum, v) => sum + (v.repair?.diy ? REPAIRS[v.repair.kind].hours : 0), 0);

// ---------- Passage du mois ----------

function pickBreakdown(condition: number): Breakdown {
  const w = BREAKDOWN.weights;
  const weights: Record<Breakdown, number> = { minor: w.minor, major: w.major, broken: condition < BREAKDOWN.wornBelow ? w.brokenWorn : w.broken };
  return drawWeighted(Object.keys(weights) as Breakdown[], (k) => weights[k], 1)[0];
}

/** Retire la licence : diplôme perdu, points remis à plein, délai d'attente avant de repasser le permis. */
function loseLicense(s: GameState) {
  s.diplomas = s.diplomas.filter((d) => d !== 'permisB');
  s.driver.points = LICENSE.points;
  s.driver.banUntil = s.month + LICENSE.invalidMonths + 1;
  if (!s.catalog.quick.includes('permisB')) s.catalog.quick.push('permisB');
  addLog(s, 'log.licenseLost', { count: LICENSE.invalidMonths }, 'bad');
}

function rollOffence(s: GameState, style: DrivingStyle) {
  const table = style === 'fast' || style === 'reckless' ? OFFENCES[style] : null;
  if (!table || Math.random() >= DRIVING_STYLES[style].offence) return;
  const offence = drawWeighted(table, (o) => o.weight, 1)[0];
  s.money -= offence.fine;
  s.driver.points -= offence.points;
  s.driver.lastOffense = s.month;
  addLog(s, 'log.speeding', { amount: offence.fine, count: offence.points }, 'bad');
  if (s.driver.points <= 0) {
    loseLicense(s);
  } else if (offence.ban > 0) {
    s.driver.banUntil = s.month + offence.ban + 1;
    addLog(s, 'log.licenseSuspended', { count: offence.ban }, 'bad');
  }
}

function rollAccident(s: GameState, v: Vehicle, style: DrivingStyle) {
  const chance = DRIVING_STYLES[style].accident * (v.issue === 'minor' ? 1.5 : 1);
  if (Math.random() >= chance) return;
  const severity = drawWeighted(Object.keys(ACCIDENT) as Breakdown[], (k) => ACCIDENT[k].weight, 1)[0];
  const hit = ACCIDENT[severity];
  const [lo, hi] = hit.health;
  const health = lo + Math.floor(Math.random() * (hi - lo + 1));
  s.money -= hit.deductible;
  s.stats.health = clamp(s.stats.health - health);
  v.condition = Math.max(0, v.condition - hit.condition);
  v.issue = v.issue && SEVERITY[v.issue] >= SEVERITY[severity] ? v.issue : severity;
  s.driver.crm = Math.min(INSURANCE.crmMax, s.driver.crm * INSURANCE.crmAccident);
  addLog(s, 'log.accident', { accidentLevel: severity, amount: hit.deductible, health }, 'bad');
}

/** Un mois au volant : kilomètres, usure, pannes, accidents, infractions et contrôles routiers. */
function drive(s: GameState, v: Vehicle) {
  const style = s.driver.style;
  const spec = DRIVING_STYLES[style];
  const km = monthlyKm(s);
  const overdue = v.km - v.lastServiceKm > WEAR.serviceEveryKm;
  const wear = (km / 1000) * WEAR.per1000Km * spec.wear * (overdue ? WEAR.overdueFactor : 1) * (v.issue === 'minor' ? WEAR.minorIssueFactor : 1);
  const wasScrap = isScrap(v);
  v.km += km;
  v.ceiling = Math.max(0, v.ceiling - wear * WEAR.permanentShare);
  v.condition = Math.max(0, Math.min(v.ceiling, v.condition - wear));
  if (!wasScrap && isScrap(v)) {
    addLog(s, 'log.vehicleDead', { vehicleId: v.modelId }, 'bad');
    return;
  }

  if (v.condition <= 0 && v.issue !== 'broken') {
    v.issue = 'broken';
    addLog(s, 'log.breakdown', { severity: 'broken', vehicleId: v.modelId }, 'bad');
    return;
  }
  if (v.issue === 'minor' && Math.random() < BREAKDOWN.minorEscalation) {
    v.issue = 'major';
    addLog(s, 'log.breakdownWorse', { vehicleId: v.modelId }, 'bad');
    return;
  }
  const worn = (100 - v.condition) / 100;
  const chance = (BREAKDOWN.base + BREAKDOWN.slope * worn * worn) * spec.breakdown * (overdue ? BREAKDOWN.overdueFactor : 1);
  if (Math.random() < chance) {
    const severity = pickBreakdown(v.condition);
    // Une panne mineure déjà présente ne se re-signale pas ; une panne plus grave la remplace.
    if (!v.issue || SEVERITY[severity] > SEVERITY[v.issue]) {
      v.issue = severity;
      addLog(s, 'log.breakdown', { severity, vehicleId: v.modelId }, 'bad');
      if (severity !== 'minor') return; // immobilisé : ni accident ni infraction ce mois-ci
    }
  }

  rollAccident(s, v, style);
  rollOffence(s, style);
  if (inspectionStatus(s, v) === 'overdue' && Math.random() < INSPECTION.checkChance) {
    s.money -= INSPECTION.fine;
    addLog(s, 'log.inspectionFine', { amount: INSPECTION.fine }, 'bad');
  }
}

/** Permis : fin de suspension, points rendus après 2 ans sans infraction, bonus-malus qui s'améliore avec le temps. */
function tickDriver(s: GameState) {
  const d = s.driver;
  if (d.banUntil !== null && s.month >= d.banUntil) {
    d.banUntil = null;
    if (hasLicense(s)) addLog(s, 'log.licenseBack', {}, 'good');
  }
  if (d.points < LICENSE.points && d.lastOffense !== null && s.month - d.lastOffense >= LICENSE.recoveryMonths) {
    d.points = LICENSE.points;
    addLog(s, 'log.pointsBack', { points: LICENSE.points }, 'good');
  }
  d.crm = Math.max(INSURANCE.crmMin, d.crm * INSURANCE.crmMonthly);
}

/** Fait vivre le parc un mois : un véhicule roule (avec l'état du début de mois), puis les réparations de tous avancent. */
export function progressVehicle(s: GameState) {
  const driving = drivingVehicle(s);
  if (driving) drive(s, driving);
  tickDriver(s);
  for (const v of s.vehicles) {
    if (!v.repair) continue;
    v.repair.monthsLeft -= 1;
    if (v.repair.monthsLeft <= 0) finishRepair(s, v, v.repair.kind, v.repair.diy);
  }
}

// ---------- Marché de l'occasion ----------

/** Véhicule déjà ancien que le joueur possède au départ : petite citadine d'occasion, entretenue, contrôle à jour. */
export function starterVehicle(modelId: string, month: number): Vehicle {
  return {
    id: newId(), modelId, fuel: 'petrol', km: 90000, registeredMonth: month - 96, condition: 55, ceiling: 72,
    lastServiceKm: 80000, inspection: { month: month - 2, passed: true }, issue: null, repair: null,
  };
}

function makeUsed(month: number): VehicleListing {
  const modelId = drawWeighted(VEHICLE_IDS, (id) => USED_MARKET.weight[VEHICLE_MODELS[id].grade], 1)[0];
  const model = VEHICLE_MODELS[modelId];
  const fuels = Object.keys(model.fuels) as FuelType[];
  const fuel = fuels.includes('diesel') && Math.random() < 0.4 ? 'diesel' : 'petrol';
  const years = 1 + Math.floor(Math.random() * USED_MARKET.maxAge);
  const km = round(years * 12000 * (0.6 + Math.random() * 0.9), 500);
  const registeredMonth = month - years * 12 - Math.floor(Math.random() * 12);
  const ceiling = Math.round(clamp(97 - years * 2.2 - km / 25000, 38, 95));
  const condition = Math.round(clamp(ceiling - Math.random() * 25, Math.min(45, ceiling), ceiling));
  const price = Math.max(300, round(marketValue(modelId, fuel, month - registeredMonth, km, condition) * (1 + rollFactor()), 50));
  return { id: newId(), modelId, fuel, km, registeredMonth, condition, ceiling, price, monthsLeft: USED_MARKET.months[model.grade] };
}

export const drawUsedListings = (month: number, count: number): VehicleListing[] => Array.from({ length: count }, () => makeUsed(month));

/** Les annonces vieillissent et expirent ; de nouvelles arrivent chaque mois dans la limite de la place disponible. */
export function refreshVehicleListings(s: GameState) {
  s.vehicleListings = s.vehicleListings.map((l) => ({ ...l, monthsLeft: l.monthsLeft - 1 })).filter((l) => l.monthsLeft > 0);
  const room = USED_MARKET.max - s.vehicleListings.length;
  if (room > 0) s.vehicleListings.push(...drawUsedListings(s.month, Math.min(USED_MARKET.arrivals, room)));
}
