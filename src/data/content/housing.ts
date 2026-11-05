import type { Area, HousingKind, StatKey } from '../../game/types';

// ---------- Logement ----------

/** Un type de bien. `rent` / `price` = prix de base (null : ni à louer, ni à vendre). Textes : housing.<id>. */
export interface HousingType {
  kind: HousingKind;
  /** Rareté de 1 (commun) à 4 (très rare) : durée de l'annonce, fréquence d'apparition et chance de dossier en dépendent. */
  grade: 1 | 2 | 3 | 4;
  surface: number;
  /** Places de parking du bien (au moins 1 : voir parkingOf). */
  parking: number;
  rent: number | null;
  price: number | null;
  /** Confort : effet mensuel sur les jauges. */
  comfort: Partial<Record<StatKey, number>>;
  /** Quartiers où ce bien n'existe pas (jamais proposé en annonce). */
  notIn?: Area[];
}

export const HOUSING_TYPES: Record<string, HousingType> = {
  shared:    { kind: 'studio',    grade: 1, surface: 14,  parking: 1, rent: 300,  price: null,   comfort: { happiness: -1 } },
  studio:    { kind: 'studio',    grade: 1, surface: 20,  parking: 1, rent: 450,  price: 70000,  comfort: {} },
  t2:        { kind: 'apartment', grade: 2, surface: 40,  parking: 1, rent: 650,  price: 130000, comfort: { happiness: 1 } },
  t3:        { kind: 'apartment', grade: 2, surface: 65,  parking: 1, rent: 850,  price: 185000, comfort: { happiness: 1 } },
  duplex:    { kind: 'apartment', grade: 3, surface: 90,  parking: 2, rent: 1300, price: 290000, comfort: { happiness: 2 } },
  cottage:   { kind: 'house',     grade: 3, surface: 80,  parking: 2, rent: 1000, price: 210000, comfort: { happiness: 2, health: 1 } },
  family:    { kind: 'house',     grade: 3, surface: 120, parking: 3, rent: 1500, price: 340000, comfort: { happiness: 2, health: 1 } },
  penthouse: { kind: 'apartment', grade: 4, surface: 130, parking: 2, rent: 2800, price: 620000, comfort: { happiness: 3, health: 1 }, notIn: ['country'] },
  bigHouse:  { kind: 'house',     grade: 4, surface: 200, parking: 4, rent: 3200, price: 750000, comfort: { happiness: 3, health: 1 }, notIn: ['center'] },
};

export const HOUSING_KINDS: HousingKind[] = ['studio', 'apartment', 'house'];

/**
 * Quartiers : multiplicateur de prix, fourchette [min, max] d'heures de trajet ajoutées par semaine (si l'on travaille,
 * tirée à chaque annonce), bonheur mensuel, places de parking en plus (plus de terrain à la campagne).
 */
export const AREAS: Record<Area, { price: number; commute: [number, number]; happiness: number; weight: number; parking: number }> = {
  center:  { price: 1.25, commute: [0, 0],  happiness: 0, weight: 3, parking: 0 },
  suburb:  { price: 1,    commute: [2, 4],  happiness: 0, weight: 4, parking: 0 },
  country: { price: 0.8,  commute: [6, 10], happiness: 1, weight: 3, parking: 1 },
};
export const AREA_IDS = Object.keys(AREAS) as Area[];

/** Annonces visibles : comme les offres d'emploi, elles expirent et ne se renouvellent qu'avec des heures de recherche. */
export const LISTINGS_MAX = 12;
/** Annonces présentes au début de la partie. */
export const START_LISTINGS = 6;
/** Durée de vie d'une annonce, en mois, selon la rareté du bien. */
export const LISTING_MONTHS: Record<number, number> = { 1: 6, 2: 4, 3: 3, 4: 2 };
/** Poids du tirage d'un bien selon la rareté : une grosse maison est bien plus rare qu'un studio. */
export const LISTING_WEIGHT: Record<number, number> = { 1: 6, 2: 4, 3: 2, 4: 1 };

/** Location : chance de base d'un dossier accepté selon la rareté du bien (les biens rares attirent plus de candidats). */
export const RENT_CHANCE: Record<number, number> = { 1: 0.6, 2: 0.5, 3: 0.4, 4: 0.3 };
export const RENT_CHANCE_MIN = 0.05;
export const RENT_CHANCE_MAX = 0.95;
export const RENT = {
  /** Caution, en mois de loyer, selon la rareté du bien. */
  depositMonths: { 1: 1, 2: 1, 3: 2, 4: 2 } as Record<number, number>,
  /** Frais d'agence, en € par m² (visite, dossier, bail, état des lieux : plafonnés au m² par la loi). */
  feePerM2: 15,
  /** Revenus / loyer : paliers qui rassurent (ou inquiètent) le propriétaire, avec le bonus de chance associé. */
  incomeTiers: [
    { ratio: 3, bonus: 0.3 },
    { ratio: 2, bonus: 0.15 },
    { ratio: 1.5, bonus: 0 },
    { ratio: 1, bonus: -0.2 },
    { ratio: 0, bonus: -0.4 },
  ],
  /** Bonus si l'on a un emploi, et si l'on a de quoi payer six mois de loyer. */
  jobBonus: 0.1,
  cushionBonus: 0.1,
  cushionMonths: 6,
};

/** Coût d'un déménagement, à chaque changement de logement. */
export const MOVING_COST = 200;

/**
 * Achat : frais de notaire (7,5 % dans l'ancien), charges annuelles (taxe foncière + copropriété, part du prix), prêt
 * (apport minimum de 10 %, endettement maximal de 35 % du salaire, emploi exigé), hausse annuelle de la valeur et
 * frais de revente (payés quand on déménage : le bien est alors vendu automatiquement).
 */
export const OWNING = {
  notaryRate: 0.075,
  chargesRate: 0.012,
  debtCap: 0.35,
  appreciation: 0.015,
  saleFee: 0.05,
  downChoices: [0.1, 0.2, 0.3, 0.5, 1],
  terms: [15, 20, 25],
  /** Taux annuel du prêt selon la durée en années. */
  rates: { 15: 0.032, 20: 0.034, 25: 0.036 } as Record<number, number>,
  /** Part des loyers perçus que la banque compte dans les revenus. */
  rentalWeight: 0.7,
};

/** Mise en location d'un bien possédé : chance mensuelle de trouver un locataire, selon la rareté. */
export const LETTING = {
  chance: { 1: 0.7, 2: 0.55, 3: 0.4, 4: 0.3 } as Record<number, number>,
  /** Loyers demandés, en multiple du loyer du marché : chaque 10 % de moins ajoute 10 points de chance. */
  rentFactors: [0.8, 0.9, 1, 1.1, 1.2],
  /** Chance mensuelle qu'un locataire en place parte. */
  leaveChance: 0.04,
};

/** Mise en vente d'un bien possédé : chance mensuelle de trouver un acheteur, selon la rareté. */
export const SELLING = {
  chance: { 1: 0.5, 2: 0.4, 3: 0.3, 4: 0.2 } as Record<number, number>,
  /** Prix demandés, en multiple de la valeur : chaque 10 % de moins ajoute 20 points de chance. */
  priceFactors: [0.9, 1, 1.1],
  priceSensitivity: 2,
};
