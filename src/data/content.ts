import type { Job, Schedule, ScheduleKey, SkillId, StartPath, StatDef } from '../game/types';

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
};

export const DEFAULT_SCHEDULE: Schedule = { sleep: 7, leisure: 5, study: 0, sport: 2, search: 0 };

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

export const START_SKILLS: Record<SkillId, number> = {
  digital: 10, charisma: 10, strength: 10, intelligence: 10, logistics: 5,
};

/** Gains de compétences par mois (une valeur par heure de planning, ou par mois travaillé dans le domaine). */
export const SKILL_RULES = {
  /** Par heure d'études hebdomadaire. */
  perStudyHour: { intelligence: 0.2, digital: 0.1 } as Partial<Record<SkillId, number>>,
  /** Par heure de sport hebdomadaire. */
  perSportHour: { strength: 0.25 } as Partial<Record<SkillId, number>>,
  /** Par heure de loisirs quotidienne. */
  perLeisureHour: { charisma: 0.1 } as Partial<Record<SkillId, number>>,
  /** Chaque mois travaillé dans un domaine (job.field). */
  perJobMonth: {
    restaurant: { charisma: 0.5, logistics: 0.3 },
    retail: { charisma: 0.4, logistics: 0.6 },
    transport: { logistics: 0.8, strength: 0.3 },
    office: { digital: 0.6 },
    finance: { digital: 0.5, intelligence: 0.3 },
    engineering: { digital: 0.5, intelligence: 0.5 },
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

export const HOUSING: Record<string, { rent: number }> = {
  studio: { rent: 450 },
  shared: { rent: 300 },
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
export const HIRE_CHANCE: Record<number, number> = { 1: 0.6, 2: 0.45, 3: 0.35, 4: 0.25 };
export const HIRE_CHANCE_MAX = 0.95;

// ---------- Boulots rapides ----------

/**
 * Petits boulots toujours disponibles, sans candidature : un seul à la fois, payés chaque mois.
 * Leurs heures et leurs trajets s'ajoutent à la semaine. Paye ≈ SMIC horaire net × heures × 4,3 semaines.
 */
export interface Gig {
  id: string; // textes : gigs.<id>
  icon: string;
  hours: number;
  commute: number;
  pay: number;
  skills: Partial<Record<SkillId, number>>;
}

export const GIGS: Gig[] = [
  { id: 'delivery', icon: '🛵', hours: 8, commute: 1, pay: 380, skills: { logistics: 0.3, strength: 0.1 } },
  { id: 'babysitting', icon: '🧸', hours: 6, commute: 1, pay: 260, skills: { charisma: 0.3 } },
  { id: 'moving', icon: '📦', hours: 8, commute: 2, pay: 400, skills: { strength: 0.3 } },
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
}

export const TRAININGS: Record<string, TrainingConfig> = {
  hotelSchool: { months: 24, tuition: 758, minStudyHours: 10 },
  caces: { months: 1, tuition: 350, minStudyHours: 5, quick: true, skills: { logistics: 6 }, hireBonus: { field: 'transport', bonus: 0.15 } },
  barista: { months: 1, tuition: 250, minStudyHours: 4, quick: true, skills: { charisma: 4 }, hireBonus: { field: 'restaurant', bonus: 0.15 } },
  officeSuite: { months: 2, tuition: 400, minStudyHours: 6, quick: true, skills: { digital: 8 }, hireBonus: { field: 'office', bonus: 0.15 } },
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
  { id: 'fastFood', grade: 1, field: 'restaurant', salary: 1478, hours: 35, commute: 3 },
  { id: 'diner', grade: 1, field: 'restaurant', salary: 1600, hours: 35, commute: 4 },
  {
    id: 'fineDining', grade: 3, field: 'restaurant', salary: 1900, hours: 39, commute: 6,
    anyOf: [
      { type: 'experience', field: 'restaurant', months: 24 },
      { type: 'diploma', id: 'hotelSchool' },
    ],
  },
  { id: 'cashier', grade: 1, field: 'retail', salary: 1500, minSkills: { charisma: 10 }, hours: 35, commute: 4 },
  { id: 'driver', grade: 1, field: 'transport', salary: 1650, minSkills: { logistics: 12 }, hours: 40, commute: 2 },
  {
    id: 'forklift', grade: 2, field: 'transport', salary: 1700, hours: 35, commute: 5,
    anyOf: [{ type: 'diploma', id: 'caces' }],
  },
  { id: 'office', grade: 2, field: 'office', salary: 1700, minSkills: { digital: 20 }, hours: 35, commute: 7 },
  {
    id: 'adminAssistant', grade: 2, field: 'office', salary: 1800, minSkills: { digital: 25 }, hours: 35, commute: 7,
    anyOf: [{ type: 'diploma', id: 'officeSuite' }],
  },
  { id: 'accountant', grade: 3, field: 'finance', salary: 1750, minSkills: { digital: 30, intelligence: 30 }, hours: 39, commute: 9 },
  { id: 'engineer', grade: 4, field: 'engineering', salary: 2350, minSkills: { intelligence: 45, digital: 35 }, hours: 42, commute: 12 },
];
