import type { Area, Drawback, HousingKind, Job, Schedule, ScheduleKey, SkillId, StartPath, StatDef, StatKey } from '../game/types';

export const EVENT_CHANCE = 0.55;
export const DEBT_LIMIT = -2000;

// ---------- Temps ----------

export const HOURS_PER_WEEK = 24 * 7; // 168
// Un tour = un mois ; la semaine type du planning s'applique à toutes les semaines du mois.
/** Repas, hygiène, courses : incompressible (2 h/jour). */
export const ESSENTIALS_PER_WEEK = 14;

/** Réglages du planning : bornes et unité (par jour ou par semaine). */
export const SCHEDULE: Record<ScheduleKey, { min: number; max: number; perDay: boolean }> = {
  sleep:   { min: 3, max: 9,  perDay: true },
  leisure: { min: 0, max: 7,  perDay: true },
  study:   { min: 0, max: 20, perDay: false },
  sport:   { min: 0, max: 14, perDay: false },
  search:  { min: 0, max: 10, perDay: false },
  housing: { min: 0, max: 10, perDay: false },
};

export const DEFAULT_SCHEDULE: Schedule = { sleep: 7, leisure: 5, study: 0, sport: 2, search: 0, housing: 0 };

/** Catégories affichées dans l'anneau de la semaine (ordre = ordre d'affichage). */
export const TIME_CATS = [
  { id: 'sleep',      color: '#5b6cf5', icon: '😴' },
  { id: 'work',       color: '#f5a65b', icon: '💼' },
  { id: 'commute',    color: '#c98b4a', icon: '🚌' },
  { id: 'essentials', color: '#7b8299', icon: '🍽️' },
  { id: 'leisure',    color: '#f5c85b', icon: '🎉' },
  { id: 'study',      color: '#a77bf5', icon: '📚' },
  { id: 'sport',      color: '#5bd48a', icon: '🏃' },
  { id: 'search',     color: '#5bb4f5', icon: '🔎' },
  { id: 'housing',    color: '#e58bd4', icon: '🏠' },
  { id: 'free',       color: '#2e3450', icon: '⏳' },
] as const;
export type TimeCat = (typeof TIME_CATS)[number]['id'];

// ---------- Effets du planning sur les jauges (par mois) ----------

/** Santé : ±1 point par mois pour chaque heure de sommeil par jour au-dessus / en dessous de ce seuil. */
export const SLEEP_NEUTRAL = 7;
/** Bonheur : ±1 point par mois pour chaque heure de loisirs par jour au-dessus / en dessous de ce seuil. */
export const LEISURE_NEUTRAL = 5;
/** Santé gagnée par heure de sport hebdomadaire et par mois. */
export const SPORT_HEALTH_PER_HOUR = 0.5;
/** Bonheur perdu chaque mois passé à découvert. */
export const DEBT_HAPPINESS_LOSS = 3;

// ---------- Compétences ----------

export const SKILLS: { id: SkillId; icon: string; color: string }[] = [
  { id: 'digital', icon: '💻', color: '#5bb4f5' },
  { id: 'charisma', icon: '✨', color: '#ff9f6b' },
  { id: 'strength', icon: '💪', color: '#ff7a95' },
  { id: 'intelligence', icon: '🧠', color: '#a77bf5' },
  { id: 'logistics', icon: '📦', color: '#5bd48a' },
];

/** Valeur maximale d'une compétence (échelle de 0 à 1000). */
export const SKILL_MAX = 1000;

export const START_SKILLS: Record<SkillId, number> = {
  digital: 10, charisma: 10, strength: 10, intelligence: 10, logistics: 10,
};

/** Gains de compétences par mois (une valeur par heure de planning, ou par mois travaillé dans le domaine). */
export const SKILL_RULES = {
  /** Par heure d'études hebdomadaire. */
  perStudyHour: { intelligence: 2, digital: 1 } as Partial<Record<SkillId, number>>,
  /** Par heure de sport hebdomadaire. */
  perSportHour: { strength: 2 } as Partial<Record<SkillId, number>>,
  /** Par heure de loisirs quotidienne. */
  perLeisureHour: { charisma: 1 } as Partial<Record<SkillId, number>>,
  /** Chaque mois travaillé dans un domaine (job.field). */
  perJobMonth: {
    restaurant: { charisma: 5, logistics: 3 },
    retail: { charisma: 4, logistics: 6 },
    transport: { logistics: 8, strength: 3 },
    office: { digital: 6 },
    finance: { digital: 5, intelligence: 3 },
    engineering: { digital: 5, intelligence: 5 },
  } as Record<string, Partial<Record<SkillId, number>>>,
};

// ---------- Épargne (règles françaises, taux en vigueur en novembre 2026) ----------

/**
 * Plafonds de versements (intérêts capitalisés exclus) et conditions.
 * - Livret A : 22 950 €, 1,7 % depuis le 1er août 2026, exonéré d'impôt.
 * - LDDS : 12 000 €, même taux que le Livret A (1,7 %), exonéré d'impôt, un seul par personne.
 * - Livret Jeune : 1 600 €, 12 à 25 ans, taux au moins égal à celui du Livret A, exonéré d'impôt.
 * - PEL : 61 200 €, 2 % pour un plan ouvert en 2026 (fixe), 225 € à l'ouverture puis 45 € minimum par
 *   versement, blocage de 4 ans (10 ans maximum), intérêts soumis au prélèvement forfaitaire de 30 %.
 * Simplifications : les intérêts sont crédités chaque mois (et non en fin d'année) ; la clôture
 * anticipée du PEL fait perdre la moitié des intérêts perçus ; le versement annuel minimum n'est pas imposé.
 */
export const SAVINGS = {
  livretA: { ceiling: 22950, rate: 0.017, minDeposit: 10 },
  ldds: { ceiling: 12000, rate: 0.017, minDeposit: 10 },
  livretJeune: { ceiling: 1600, rate: 0.017, minDeposit: 10, closesAtAge: 25 },
  pel: {
    ceiling: 61200, rate: 0.02, minOpen: 225, minDeposit: 45,
    lockMonths: 48, maxMonths: 120, tax: 0.3, earlyInterestLoss: 0.5,
  },
} as const;

export const SAVINGS_COLORS = {
  checking: '#f5c85b',
  livretA: '#5bb4f5',
  ldds: '#ff9f6b',
  livretJeune: '#5bd48a',
  pel: '#a77bf5',
} as const;
/** Savoir gagné par heure d'étude hebdomadaire et par mois. */
export const KNOWLEDGE_PER_STUDY_HOUR = 0.3;
/** Coût mensuel des loisirs, par heure hebdomadaire de loisirs. */
export const LEISURE_COST_PER_WEEKLY_HOUR = 3;

// ---------- Dépenses et départ ----------

/** Dépenses mensuelles = nourriture + loyer du logement + entretien de la voiture + loisirs. */
export const FOOD_COST = 250;

// ---------- Logement ----------

/** Un type de bien. `rent` / `price` = prix de base (null : ni à louer, ni à vendre). Textes : housing.<id>. */
export interface HousingType {
  kind: HousingKind;
  /** Rareté de 1 (commun) à 4 (très rare) : durée de l'annonce, fréquence d'apparition et chance de dossier en dépendent. */
  grade: 1 | 2 | 3 | 4;
  surface: number;
  rent: number | null;
  price: number | null;
  /** Confort : effet mensuel sur les jauges. */
  comfort: Partial<Record<StatKey, number>>;
}

export const HOUSING_TYPES: Record<string, HousingType> = {
  shared:    { kind: 'studio',    grade: 1, surface: 14,  rent: 300,  price: null,   comfort: { happiness: -1 } },
  studio:    { kind: 'studio',    grade: 1, surface: 20,  rent: 450,  price: 70000,  comfort: {} },
  t2:        { kind: 'apartment', grade: 2, surface: 40,  rent: 650,  price: 130000, comfort: { happiness: 1 } },
  t3:        { kind: 'apartment', grade: 2, surface: 65,  rent: 850,  price: 185000, comfort: { happiness: 1 } },
  duplex:    { kind: 'apartment', grade: 3, surface: 90,  rent: 1300, price: 290000, comfort: { happiness: 2 } },
  cottage:   { kind: 'house',     grade: 3, surface: 80,  rent: 1000, price: 210000, comfort: { happiness: 2, health: 1 } },
  family:    { kind: 'house',     grade: 3, surface: 120, rent: 1500, price: 340000, comfort: { happiness: 2, health: 1 } },
  penthouse: { kind: 'apartment', grade: 4, surface: 130, rent: 2800, price: 620000, comfort: { happiness: 3, health: 1 } },
  villa:     { kind: 'house',     grade: 4, surface: 200, rent: 3200, price: 750000, comfort: { happiness: 3, health: 1 } },
};

export const HOUSING_KINDS: HousingKind[] = ['studio', 'apartment', 'house'];

/** Quartiers : multiplicateur de prix, heures de trajet ajoutées par semaine (si l'on travaille), bonheur mensuel. */
export const AREAS: Record<Area, { price: number; commute: number; happiness: number; weight: number }> = {
  center:  { price: 1.25, commute: 0, happiness: 0, weight: 3 },
  suburb:  { price: 1,    commute: 2, happiness: 0, weight: 4 },
  country: { price: 0.8,  commute: 4, happiness: 1, weight: 3 },
};
export const AREA_IDS = Object.keys(AREAS) as Area[];

/** Annonces visibles : comme les offres d'emploi, elles expirent et ne se renouvellent qu'avec des heures de recherche. */
export const LISTINGS_MAX = 12;
/** Annonces présentes au début de la partie. */
export const START_LISTINGS = 6;
/** Durée de vie d'une annonce, en mois, selon la rareté du bien. */
export const LISTING_MONTHS: Record<number, number> = { 1: 6, 2: 4, 3: 3, 4: 2 };
/** Poids du tirage d'un bien selon la rareté : une villa est bien plus rare qu'un studio. */
export const LISTING_WEIGHT: Record<number, number> = { 1: 6, 2: 4, 3: 2, 4: 1 };

/** Location : chance de base d'un dossier accepté selon la rareté du bien (les biens rares attirent plus de candidats). */
export const RENT_CHANCE: Record<number, number> = { 1: 0.6, 2: 0.5, 3: 0.4, 4: 0.3 };
export const RENT_CHANCE_MIN = 0.05;
export const RENT_CHANCE_MAX = 0.95;
export const RENT = {
  /** Caution, en mois de loyer, selon la rareté du bien. */
  depositMonths: { 1: 1, 2: 1, 3: 2, 4: 2 } as Record<number, number>,
  /** Frais d'agence, en mois de loyer. */
  feeMonths: 0.5,
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
};

export const CARS: Record<string, { upkeep: number }> = {
  small: { upkeep: 60 },
};

/** Ce que chaque parcours de départ donne au personnage. */
export const START: Record<StartPath, { money: number; housing: string; car: string | null }> = {
  comfort: { money: 3000, housing: 'studio', car: 'small' },
  tight: { money: 300, housing: 'shared', car: null },
};

/** Petits boulots proposés au départ confortable (aucune qualification requise). Au départ, ce sont aussi les premières offres visibles. */
export const STARTER_JOBS = ['fastFood', 'diner', 'cashier', 'driver'];

// ---------- Offres d'emploi ----------

/**
 * Les offres visibles sont limitées : elles ne se renouvellent que grâce aux heures de recherche
 * (1 h/semaine = 1 nouvelle offre par mois, jusqu'à 10) et elles expirent d'autant plus vite que le poste est prestigieux.
 */
export const OFFERS_MAX = 10;

/** Durée de vie d'une offre, en mois, selon le grade du poste (1 = poste de base, 4 = très prestigieux). */
export const OFFER_MONTHS: Record<number, number> = { 1: 6, 2: 3, 3: 2, 4: 1 };

/** Poids du tirage d'une nouvelle offre selon le grade : les postes prestigieux sont plus rares. */
export const OFFER_WEIGHT: Record<number, number> = { 1: 6, 2: 4, 3: 2, 4: 1 };

/** Chance d'être embauché chaque mois où l'on postule à une offre encore valable, selon le grade. */
export const HIRE_CHANCE: Record<number, number> = { 1: 0.5, 2: 0.4, 3: 0.3, 4: 0.15 };
export const HIRE_CHANCE_MAX = 0.95;

// ---------- Prix variables ----------

/** Salaire net minimum (SMIC net depuis le 1er juin 2026) : aucune offre d'emploi ne paie moins. */
export const SMIC_NET = 1478;
/**
 * Les prix du jeu sont des prix de base. Chaque salaire (écart fixé par l'entreprise), paie de boulot rapide et
 * coût de formation (tirés au hasard à chaque renouvellement du catalogue) s'en écarte d'au plus 10 %, dans les deux sens.
 */
export const PRICE_VARIATION = 0.1;
/** Bonus d'embauche pour l'expérience déjà acquise dans le domaine du poste : +5 points par année, jusqu'à +15. */
export const EXPERIENCE_BONUS_PER_YEAR = 0.05;
export const EXPERIENCE_BONUS_MAX = 0.15;

// ---------- Catalogue : boulots rapides et formations ----------

/** Les boulots rapides et les formations proposés changent tous les 6 mois, 6 au maximum par catégorie. */
export const CATALOG_REFRESH_MONTHS = 6;
export const CATALOG_MAX = 6;

// ---------- Boulots rapides ----------

/**
 * Petits boulots sans candidature : un seul à la fois, payés chaque mois, à condition d'être au catalogue.
 * Leurs heures et leurs trajets s'ajoutent à la semaine. Paye ≈ SMIC horaire net × heures × 4,3 semaines.
 * `weight` : plus il est grand, plus le boulot revient souvent au catalogue. `drawback` : effet mensuel sur les jauges.
 */
export interface Gig {
  id: string; // textes : gigs.<id>
  icon: string;
  hours: number;
  commute: number;
  pay: number;
  skills: Partial<Record<SkillId, number>>;
  weight: number;
  drawback: Drawback;
}

export const GIGS: Gig[] = [
  { id: 'delivery', icon: '🛵', hours: 8, commute: 1, pay: 380, skills: { logistics: 3, strength: 1 }, weight: 3, drawback: { health: -1.5, happiness: -0.5 } },
  { id: 'babysitting', icon: '🧸', hours: 6, commute: 1, pay: 260, skills: { charisma: 3 }, weight: 2, drawback: { health: -0.5, happiness: -1.5 } },
  { id: 'moving', icon: '📦', hours: 8, commute: 2, pay: 400, skills: { strength: 3 }, weight: 2, drawback: { health: -2, happiness: -0.5 } },
];

/**
 * Formations. Elles coûtent de l'argent chaque mois et ne progressent que si le joueur étudie
 * au moins `minStudyHours` heures par semaine (curseur « Études » du planning).
 *
 * Les formations rapides (`quick`) sont de courts certificats hors diplôme : à la fin elles donnent des compétences
 * (`skills`), comptent comme qualification pour certains postes et augmentent la chance d'être embauché
 * dans un domaine (`hireBonus`). Les montants sont des estimations de jeu.
 *
 * École hôtelière : école privée, 9 100 € par an (Ferrandi Paris, année de mise à niveau, tarif 2026 selon l'Onisep),
 * soit 758 € par mois sur 24 mois (≈ 18 200 € au total). Les lycées hôteliers publics sont gratuits, mais ils ne
 * sont pas modélisés pour l'instant.
 */
export interface TrainingConfig {
  months: number;
  tuition: number;
  minStudyHours: number;
  quick?: boolean;
  /** Compétences gagnées à la fin de la formation. */
  skills?: Partial<Record<SkillId, number>>;
  /** Bonus de chance d'embauche pour les postes de ce domaine. */
  hireBonus?: { field: string; bonus: number };
  /** Formations à avoir déjà obtenues pour s'inscrire (ex : le permis poids lourd suppose le permis B). */
  requires?: string[];
  /** Plus il est grand, plus la formation revient souvent au catalogue. */
  weight: number;
  /** Effet mensuel sur les jauges tant qu'on est inscrit (fatigue, stress). */
  drawback: Drawback;
}

export const TRAININGS: Record<string, TrainingConfig> = {
  hotelSchool: { months: 24, tuition: 758, minStudyHours: 20, weight: 1, drawback: { health: -1.5, happiness: -2.5 } },
  caces: { months: 1, tuition: 350, minStudyHours: 5, quick: true, skills: { logistics: 60 }, hireBonus: { field: 'transport', bonus: 0.15 }, weight: 2, drawback: { health: -1 } },
  permisB: { months: 3, tuition: 600, minStudyHours: 4, quick: true, skills: { logistics: 30 }, hireBonus: { field: 'transport', bonus: 0.1 }, weight: 4, drawback: { happiness: -1.5 } },
  permisA: { months: 2, tuition: 500, minStudyHours: 3, quick: true, skills: { logistics: 20, strength: 10 }, hireBonus: { field: 'transport', bonus: 0.05 }, weight: 2, drawback: { health: -0.5, happiness: -1 } },
  permisC: { months: 3, tuition: 1000, minStudyHours: 6, quick: true, skills: { logistics: 50 }, hireBonus: { field: 'transport', bonus: 0.15 }, requires: ['permisB'], weight: 1, drawback: { health: -1, happiness: -2 } },
  barista: { months: 1, tuition: 250, minStudyHours: 4, quick: true, skills: { charisma: 40 }, hireBonus: { field: 'restaurant', bonus: 0.15 }, weight: 4, drawback: { happiness: -1 } },
  officeSuite: { months: 2, tuition: 400, minStudyHours: 6, quick: true, skills: { digital: 80 }, hireBonus: { field: 'office', bonus: 0.15 }, weight: 3, drawback: { happiness: -1.5 } },
};

export const START_STATS = { health: 80, happiness: 60 };

export const STATS: StatDef[] = [
  { key: 'health',    icon: '❤️', color: '#ff7a95' },
  { key: 'happiness', icon: '😊', color: '#f5c85b' },
];

/**
 * Postes disponibles. Les trois niveaux de serveur forment la filière « restauration » : le haut de gamme
 * demande 2 ans d'expérience dans le domaine OU une formation en école hôtelière (règle du jeu : en France
 * le métier est accessible sans diplôme, mais les maisons exigeantes recrutent des profils formés ou expérimentés).
 *
 * Salaires : NETS mensuels à temps plein, hors pourboires, niveau débutant (novembre 2026). Sources
 * secondaires (sites de calcul de salaires, INSEE relayé par Skello), à recouper avec la grille officielle :
 * - Restauration rapide : SMIC net depuis le 1er juin 2026, 1 478 €.
 * - Restauration basique : repère INSEE, 1 500 € (non qualifié) à 1 700 € (qualifié).
 * - Haut de gamme : 2 200 à 3 000 € brut annoncés, soit environ 1 700 à 2 350 € net ; on prend 1 900 € (estimation).
 * - Caissier 1 450-1 650 ; livreur 1 500-1 800 ; comptable 1 640-1 840 ; ingénieur 2 130-2 550 (net, débutant).
 * - Employé de bureau : aucune donnée trouvée, 1 700 € est une estimation.
 * Le jeu n'a pas d'augmentations avec l'ancienneté : ces montants sont fixes.
 */
export const JOBS: Job[] = [
  { id: 'fastFood', grade: 1, drawback: { health: -1.5, happiness: -1.5 }, field: 'restaurant', salary: 1478, hours: 35, commute: 3 },
  { id: 'diner', grade: 1, drawback: { health: -1.5, happiness: -1 }, field: 'restaurant', salary: 1600, hours: 35, commute: 4 },
  {
    id: 'fineDining', grade: 3, drawback: { health: -2, happiness: -2.5 }, field: 'restaurant', salary: 1900, hours: 39, commute: 6,
    anyOf: [
      { type: 'experience', field: 'restaurant', months: 24 },
      { type: 'diploma', id: 'hotelSchool' },
    ],
  },
  { id: 'cashier', grade: 1, drawback: { health: -1, happiness: -1.5 }, field: 'retail', salary: 1500, minSkills: { charisma: 100 }, hours: 35, commute: 4 },
  { id: 'driver', grade: 1, drawback: { health: -1.5, happiness: -0.5 }, field: 'transport', salary: 1650, minSkills: { logistics: 120 }, hours: 40, commute: 2 },
  {
    id: 'forklift', grade: 2, drawback: { health: -2, happiness: -0.5 }, field: 'transport', salary: 1700, hours: 35, commute: 5,
    anyOf: [{ type: 'diploma', id: 'caces' }],
  },
  { id: 'vtc', grade: 2, drawback: { health: -1, happiness: -1.5 }, field: 'transport', salary: 1800, hours: 40, commute: 2, anyOf: [{ type: 'diploma', id: 'permisB' }] },
  { id: 'motoCourier', grade: 2, drawback: { health: -2, happiness: -1 }, field: 'transport', salary: 1750, hours: 39, commute: 2, anyOf: [{ type: 'diploma', id: 'permisA' }] },
  { id: 'truckDriver', grade: 3, drawback: { health: -2, happiness: -1.5 }, field: 'transport', salary: 2000, hours: 39, commute: 3, anyOf: [{ type: 'diploma', id: 'permisC' }] },
  { id: 'office', grade: 2, drawback: { health: -0.5, happiness: -1.5 }, field: 'office', salary: 1700, minSkills: { digital: 200 }, hours: 35, commute: 7 },
  {
    id: 'adminAssistant', grade: 2, drawback: { health: -0.5, happiness: -1 }, field: 'office', salary: 1800, minSkills: { digital: 250 }, hours: 35, commute: 7,
    anyOf: [{ type: 'diploma', id: 'officeSuite' }],
  },
  { id: 'accountant', grade: 3, drawback: { health: -0.5, happiness: -2 }, field: 'finance', salary: 1750, minSkills: { digital: 300, intelligence: 300 }, hours: 39, commute: 9 },
  { id: 'engineer', grade: 4, drawback: { health: -1, happiness: -2.5 }, field: 'engineering', salary: 2350, minSkills: { intelligence: 450, digital: 350 }, hours: 42, commute: 12 },
];
// ---------- Entreprises (fictives) ----------

/**
 * Entreprises imaginaires qui recrutent. Chacune a son niveau de paie (`pay` : écart fixe avec le salaire de base,
 * de -10 % à +10 %) et sa propre pénibilité (`drawback` : s'ajoute à celle du poste, négatif = pire ambiance ou
 * conditions plus dures, positif = plus agréable). Un nom propre n'est pas traduit.
 */
export interface Company {
  id: string;
  name: string;
  /** Postes pour lesquels elle recrute. */
  jobs: string[];
  pay: number;
  drawback: Drawback;
}

export const COMPANIES: Company[] = [
  // Restauration rapide
  { id: 'burgerBrigade', name: 'Burger Brigade', jobs: ['fastFood'], pay: 0.04, drawback: { happiness: -0.5 } },
  { id: 'croustyExpress', name: 'Crousty Express', jobs: ['fastFood'], pay: -0.03, drawback: { health: -0.5, happiness: -0.5 } },
  { id: 'pizzaPronto', name: 'Pizza Pronto', jobs: ['fastFood'], pay: 0.07, drawback: { health: -0.5 } },
  // Restauration basique
  { id: 'brasserieCoin', name: 'Brasserie du Coin', jobs: ['diner'], pay: 0, drawback: {} },
  { id: 'relaisFleuri', name: 'Le Relais Fleuri', jobs: ['diner'], pay: 0.06, drawback: { happiness: 0.5 } },
  { id: 'chezMarcel', name: 'Chez Marcel & Fils', jobs: ['diner'], pay: -0.05, drawback: { health: -0.5 } },
  // Restauration haut de gamme
  { id: 'maisonAubrac', name: 'Maison Aubrac', jobs: ['fineDining'], pay: 0.09, drawback: { happiness: -1 } },
  { id: 'grandVerger', name: 'Le Grand Verger', jobs: ['fineDining'], pay: 0.02, drawback: { happiness: 0.5 } },
  { id: 'atelierVelours', name: "L'Atelier Velours", jobs: ['fineDining'], pay: -0.04, drawback: { health: -0.5 } },
  // Vente
  { id: 'primeurMarket', name: 'Primeur Market', jobs: ['cashier'], pay: 0, drawback: {} },
  { id: 'epicerieP', name: 'Épicerie Prisma', jobs: ['cashier'], pay: -0.06, drawback: { happiness: 0.5 } },
  { id: 'hyperCobalt', name: 'Hyper Cobalt', jobs: ['cashier'], pay: 0.08, drawback: { health: -0.5, happiness: -0.5 } },
  // Transport et logistique
  { id: 'colisRapide', name: 'Colis Rapide', jobs: ['driver'], pay: 0.03, drawback: { health: -0.5 } },
  { id: 'livrExpress', name: 'LivrExpress', jobs: ['driver'], pay: -0.05, drawback: {} },
  { id: 'velocite', name: 'Vélocité Services', jobs: ['driver', 'motoCourier'], pay: 0.08, drawback: { health: -1 } },
  { id: 'logiStock', name: 'LogiStock', jobs: ['forklift'], pay: 0.02, drawback: {} },
  { id: 'entrepotsNordik', name: 'Entrepôts Nordik', jobs: ['forklift'], pay: 0.07, drawback: { health: -0.5 } },
  { id: 'palettesCo', name: 'Palettes & Co', jobs: ['forklift'], pay: -0.06, drawback: { happiness: 0.5 } },
  { id: 'trajetDirect', name: 'Trajet Direct', jobs: ['vtc'], pay: 0.05, drawback: { happiness: -0.5 } },
  { id: 'citeCab', name: 'Cité Cab', jobs: ['vtc'], pay: -0.04, drawback: {} },
  { id: 'motoFlash', name: 'Moto Flash', jobs: ['motoCourier'], pay: 0.06, drawback: { health: -1 } },
  { id: 'urbainExpress', name: 'Urbain Express', jobs: ['motoCourier'], pay: -0.02, drawback: {} },
  { id: 'bastide', name: 'Transports Bastide', jobs: ['truckDriver'], pay: 0.05, drawback: {} },
  { id: 'eurofretSud', name: 'EuroFret Sud', jobs: ['truckDriver'], pay: 0.09, drawback: { happiness: -1 } },
  { id: 'routierAtlas', name: 'Routier Atlas', jobs: ['truckDriver'], pay: -0.05, drawback: { happiness: 0.5 } },
  // Bureau
  { id: 'cabinetDelmas', name: 'Cabinet Delmas', jobs: ['office', 'adminAssistant'], pay: 0.03, drawback: {} },
  { id: 'bureautix', name: 'Bureautix', jobs: ['office'], pay: -0.07, drawback: { happiness: 0.5 } },
  { id: 'groupeHexagone', name: 'Groupe Hexagone', jobs: ['office', 'adminAssistant'], pay: 0.08, drawback: { happiness: -0.5 } },
  { id: 'agenceEquinoxe', name: 'Agence Équinoxe', jobs: ['adminAssistant'], pay: -0.03, drawback: { happiness: 0.5 } },
  // Finance
  { id: 'fiducia', name: 'Fiducia Conseil', jobs: ['accountant'], pay: 0.04, drawback: {} },
  { id: 'lemaitre', name: 'Lemaître & Associés', jobs: ['accountant'], pay: 0.09, drawback: { happiness: -1 } },
  { id: 'auditHorizon', name: 'Audit Horizon', jobs: ['accountant'], pay: -0.03, drawback: { health: 0.5 } },
  // Ingénierie
  { id: 'technovia', name: 'Technovia', jobs: ['engineer'], pay: 0.06, drawback: { happiness: -0.5 } },
  { id: 'ingenierieLumen', name: 'Ingénierie Lumen', jobs: ['engineer'], pay: -0.02, drawback: { happiness: 0.5 } },
  { id: 'kappaSystemes', name: 'Kappa Systèmes', jobs: ['engineer'], pay: 0.09, drawback: { health: -0.5, happiness: -1 } },
];

