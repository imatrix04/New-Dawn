import type { Breakdown, DrivingStyle, FuelType, RepairKind } from '../../game/types';

// ---------- Véhicules ----------

/**
 * Carburant : prix moyen au litre en France début novembre 2026 (SP95-E10 ≈ 2,10 €, gazole ≈ 2,25 €). Valeur fixe,
 * pas de fluctuation pour l'instant : le gazole est aujourd'hui plus cher que l'essence.
 */
export const FUELS: Record<FuelType, { price: number; icon: string }> = {
  petrol: { price: 2.1, icon: '⛽' },
  diesel: { price: 2.25, icon: '🛢️' },
};
export const FUEL_IDS = Object.keys(FUELS) as FuelType[];

/** Version d'un modèle pour un carburant : surcoût à l'achat (neuf), consommation et émissions. */
export interface FuelSpec {
  /** Surcoût par rapport au prix de base (le diesel est plus cher à l'achat). */
  extra: number;
  /** Consommation moyenne, en litres aux 100 km (conduite normale). */
  l100: number;
  /** Émissions de CO₂ en g/km : elles décident du malus écologique. */
  co2: number;
}

/**
 * Un modèle de véhicule. Textes : vehicles.<id>.
 * Prix et chiffres de jeu, inspirés du marché français : `hp` = chevaux fiscaux (carte grise), `weight` = masse en kg (malus au poids).
 */
export interface VehicleModel {
  /** Rareté de 1 (commun) à 4 (très rare) : fréquence en annonce d'occasion. */
  grade: 1 | 2 | 3 | 4;
  icon: string;
  hp: number;
  weight: number;
  /** Prix neuf de base (version essence). */
  price: number;
  /** Assurance mensuelle de base, avant bonus-malus. */
  insurance: number;
  /** Coût des pièces et de la main-d'œuvre, en multiple du tarif de référence des réparations. */
  parts: number;
  fuels: Partial<Record<FuelType, FuelSpec>>;
}

export const VEHICLE_MODELS: Record<string, VehicleModel> = {
  city:    { grade: 1, icon: '🚗', hp: 3,  weight: 980,  price: 16500, insurance: 45,  parts: 0.8, fuels: { petrol: { extra: 0, l100: 5.4, co2: 122 } } },
  compact: { grade: 1, icon: '🚙', hp: 5,  weight: 1250, price: 23000, insurance: 55,  parts: 1,   fuels: { petrol: { extra: 0, l100: 6.1, co2: 138 }, diesel: { extra: 2000, l100: 4.9, co2: 128 } } },
  family:  { grade: 2, icon: '🚐', hp: 7,  weight: 1500, price: 33000, insurance: 70,  parts: 1.2, fuels: { petrol: { extra: 0, l100: 7.0, co2: 158 }, diesel: { extra: 2500, l100: 5.6, co2: 147 } } },
  suv:     { grade: 2, icon: '🚙', hp: 8,  weight: 1650, price: 38000, insurance: 85,  parts: 1.4, fuels: { petrol: { extra: 0, l100: 8.0, co2: 182 }, diesel: { extra: 3000, l100: 6.4, co2: 168 } } },
  sedan:   { grade: 3, icon: '🚘', hp: 9,  weight: 1700, price: 48000, insurance: 100, parts: 1.6, fuels: { petrol: { extra: 0, l100: 8.3, co2: 190 }, diesel: { extra: 3000, l100: 6.6, co2: 175 } } },
  luxury:  { grade: 4, icon: '🚘', hp: 12, weight: 2350, price: 95000, insurance: 190, parts: 2.2, fuels: { petrol: { extra: 0, l100: 10.5, co2: 238 }, diesel: { extra: 4000, l100: 8.5, co2: 222 } } },
  sports:  { grade: 4, icon: '🏎️', hp: 14, weight: 1600, price: 78000, insurance: 220, parts: 2.5, fuels: { petrol: { extra: 0, l100: 11.5, co2: 262 } } },
};
export const VEHICLE_IDS = Object.keys(VEHICLE_MODELS);

// ---------- Réglementation : achat ----------

/**
 * Carte grise : taxe régionale = chevaux fiscaux × tarif du cheval (≈ moyenne des régions), plus la taxe de gestion
 * et la redevance d'acheminement. Réduite de moitié au-delà de 10 ans (certaines régions). Payée sur tout véhicule.
 */
export const REGISTRATION = {
  perHp: 45,
  fixed: 14,
  halfAfterYears: 10,
};

/** Frais de mise en circulation d'un véhicule neuf : livraison, préparation, plaques. */
export const NEW_VEHICLE_FEES = 450;

/**
 * Malus écologique, payé à la première immatriculation (donc sur le neuf seulement). Barème simplifié, inspiré du malus
 * CO₂ : rien jusqu'à 107 g/km, puis une courbe qui monte jusqu'au plafond. Interpolation linéaire entre les points.
 */
export const MALUS_CO2: { co2: number; amount: number }[] = [
  { co2: 107, amount: 0 }, { co2: 108, amount: 50 }, { co2: 120, amount: 500 }, { co2: 130, amount: 1500 },
  { co2: 140, amount: 3500 }, { co2: 150, amount: 6500 }, { co2: 160, amount: 10500 }, { co2: 170, amount: 16000 },
  { co2: 180, amount: 23000 }, { co2: 190, amount: 32000 }, { co2: 200, amount: 42000 }, { co2: 220, amount: 60000 },
  { co2: 240, amount: 72000 }, { co2: 260, amount: 80000 },
];
/** Malus au poids : par kilo au-dessus du seuil. */
export const MALUS_WEIGHT = { threshold: 1600, perKg: 10 };

// ---------- Style de conduite ----------

/**
 * Style de conduite. `timeDivisor` divise le temps de trajet de base (transports, marche) quand le véhicule roule :
 * normal = temps / 2, éco = temps / 1,5. Les autres facteurs sont des multiplicateurs : consommation, usure et pannes.
 * `accident` et `offence` sont des chances par mois de conduite.
 */
export interface DrivingStyleSpec {
  icon: string;
  timeDivisor: number;
  fuel: number;
  wear: number;
  breakdown: number;
  accident: number;
  offence: number;
}

export const DRIVING_STYLES: Record<DrivingStyle, DrivingStyleSpec> = {
  eco:      { icon: '🌿', timeDivisor: 1.5, fuel: 0.85, wear: 0.6, breakdown: 0.8, accident: 0.002, offence: 0 },
  normal:   { icon: '🚗', timeDivisor: 2,   fuel: 1,    wear: 1,   breakdown: 1,   accident: 0.005, offence: 0 },
  fast:     { icon: '⚡', timeDivisor: 2.5, fuel: 1.2,  wear: 1.7, breakdown: 1.3, accident: 0.03,  offence: 0.15 },
  reckless: { icon: '🔥', timeDivisor: 3.5, fuel: 1.45, wear: 2.8, breakdown: 1.8, accident: 0.08,  offence: 0.4 },
};
export const DRIVING_STYLE_IDS = Object.keys(DRIVING_STYLES) as DrivingStyle[];

/**
 * Infractions de vitesse (tirées quand `offence` tombe) : poids du tirage, amende, points perdus et suspension (en mois).
 * Barème inspiré des excès de vitesse : -1 pt (< 20 km/h), -2/-3 pts, -4 pts (≥ 40 km/h), puis le grand excès (≥ 50 km/h).
 */
export const OFFENCES: Record<'fast' | 'reckless', { weight: number; fine: number; points: number; ban: number }[]> = {
  fast: [
    { weight: 5, fine: 68, points: 1, ban: 0 },
    { weight: 5, fine: 135, points: 2, ban: 0 },
  ],
  reckless: [
    { weight: 4, fine: 135, points: 3, ban: 0 },
    { weight: 3.5, fine: 135, points: 4, ban: 0 },
    { weight: 2.5, fine: 1500, points: 6, ban: 3 },
  ],
};

/** Permis à points. */
export const LICENSE = {
  points: 12,
  /** Mois sans infraction après lesquels tous les points reviennent. */
  recoveryMonths: 24,
  /** Mois d'attente avant de repasser le permis une fois les points tombés à zéro. */
  invalidMonths: 6,
};

/** Assurance : surprime pour les moins de 25 ans, rabais au-delà de 10 ans, bornes et évolution du bonus-malus. */
export const INSURANCE = {
  youngAge: 25,
  youngSurcharge: 1.4,
  oldYears: 10,
  oldDiscount: 0.9,
  crmMin: 0.5,
  crmMax: 3.5,
  /** À chaque accident responsable. */
  crmAccident: 1.25,
  /** Chaque mois sans accident (≈ -5 % par an). */
  crmMonthly: 0.9958,
};

// ---------- Usage et usure ----------

export const DRIVING = {
  /** Vitesse moyenne de base d'un trajet (transports, marche), pour convertir des heures de trajet en kilomètres. */
  kmPerCommuteHour: 25,
  /** Semaines par mois (les heures de trajet sont hebdomadaires). */
  weeksPerMonth: 4.33,
  /** Kilomètres du quotidien hors travail (courses, sorties), par mois, dès qu'on a un véhicule en état de rouler. */
  personalKm: 150,
};

/** Usure : points d'état perdus aux 1 000 km (conduite normale). */
export const WEAR = {
  per1000Km: 0.6,
  /** Part de l'usure qui est définitive (elle abaisse l'état maximal). */
  permanentShare: 0.15,
  /** Kilomètres entre deux entretiens, et surusure quand il est en retard. */
  serviceEveryKm: 15000,
  overdueFactor: 1.4,
  /** Surusure tant qu'une panne mineure n'est pas réparée. */
  minorIssueFactor: 1.3,
  /** Sous cet état maximal, le véhicule est hors d'usage : il ne se répare plus, il part à la casse. */
  scrapCeiling: 15,
  scrapValue: 250,
};

/** Pannes : chance mensuelle = base + gravité × (usure)², puis tirage de la gravité. */
export const BREAKDOWN = {
  base: 0.005,
  slope: 0.15,
  overdueFactor: 1.5,
  /** Chance mensuelle qu'une panne mineure laissée sans réparation devienne majeure. */
  minorEscalation: 0.1,
  /** Poids du tirage de gravité : la panne « cassé » est plus probable sur un véhicule très usé. */
  weights: { minor: 60, major: 30, broken: 8, brokenWorn: 20 },
  wornBelow: 30,
};

/** Accident : poids de la gravité, franchise, dégâts et santé perdue. */
export const ACCIDENT: Record<Breakdown, { weight: number; deductible: number; condition: number; health: [number, number] }> = {
  minor:  { weight: 55, deductible: 150, condition: 8,  health: [1, 3] },
  major:  { weight: 35, deductible: 300, condition: 20, health: [4, 10] },
  broken: { weight: 10, deductible: 500, condition: 35, health: [10, 20] },
};

// ---------- Contrôle technique ----------

export const INSPECTION = {
  /** Premier contrôle à 4 ans, puis tous les 2 ans. */
  firstAfterMonths: 48,
  validMonths: 24,
  price: 80,
  /** Contre-visite après un échec, dans ce délai. */
  retryMonths: 2,
  retryPrice: 30,
  /** État minimal pour réussir (sans panne majeure). */
  minCondition: 40,
  /** Sans contrôle valable : chance mensuelle d'être arrêté, amende. */
  checkChance: 0.2,
  fine: 135,
  /** Vente entre particuliers : le contrôle doit avoir moins de 6 mois. */
  saleMonths: 6,
};

// ---------- Réparations ----------

/**
 * Les quatre niveaux d'intervention. `garage` et `diy` sont les coûts de référence (le DIY ne paie que les pièces) :
 * ils sont multipliés par `parts` du modèle. En atelier, un niveau majeur immobilise le véhicule `garageMonths` mois ;
 * soi-même, il faut un niveau de mécanique (`minSkill`), des heures par semaine pendant `diyMonths` mois, et le véhicule
 * est immobilisé (sauf l'entretien). Chaque intervention rend de l'état (`restore`) mais abaisse l'état maximal (`ceilingLoss`).
 */
export interface RepairSpec {
  garage: number;
  diy: number;
  garageMonths: number;
  diyMonths: number;
  /** Heures par semaine prises dans le planning quand on le fait soi-même. */
  hours: number;
  minSkill: number;
  restore: number;
  ceilingLoss: number;
  /** Compétence de mécanique gagnée par mois de travail à la main. */
  skillGain: number;
}

export const REPAIRS: Record<RepairKind, RepairSpec> = {
  service: { garage: 180,  diy: 70,   garageMonths: 0, diyMonths: 1, hours: 3,  minSkill: 0,   restore: 12, ceilingLoss: 0.5, skillGain: 3 },
  minor:   { garage: 450,  diy: 160,  garageMonths: 0, diyMonths: 1, hours: 6,  minSkill: 40,  restore: 30, ceilingLoss: 2,   skillGain: 8 },
  major:   { garage: 1400, diy: 520,  garageMonths: 1, diyMonths: 2, hours: 8,  minSkill: 150, restore: 50, ceilingLoss: 6,   skillGain: 18 },
  broken:  { garage: 3200, diy: 1200, garageMonths: 1, diyMonths: 3, hours: 10, minSkill: 350, restore: 65, ceilingLoss: 12,  skillGain: 30 },
};
export const REPAIR_KINDS = Object.keys(REPAIRS) as RepairKind[];

// ---------- Marché de l'occasion ----------

export const USED_MARKET = {
  /** Annonces visibles au plus, présentes au départ, et nouvelles par mois. */
  max: 8,
  start: 6,
  arrivals: 2,
  /** Âge maximal d'un véhicule d'occasion, en années. */
  maxAge: 16,
  /** Durée de vie d'une annonce, en mois, selon la rareté. */
  months: { 1: 5, 2: 4, 3: 3, 4: 2 } as Record<number, number>,
  /** Poids du tirage d'un modèle selon la rareté. */
  weight: { 1: 6, 2: 4, 3: 2, 4: 1 } as Record<number, number>,
  /** Revente : le professionnel reprend à ce prix du marché (contrôle valable ou véhicule récent) ou moins (sans contrôle). */
  resale: 0.92,
  resaleNoInspection: 0.7,
};

/** Perte de valeur : par an (neuf → 1 an), kilométrage de référence et poids de l'état. */
export const DEPRECIATION = {
  perYear: 0.85,
  floor: 0.06,
  kmRef: 400000,
  kmFloor: 0.5,
  conditionBase: 0.6,
};
