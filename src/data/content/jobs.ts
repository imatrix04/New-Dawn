import type { Job } from '../../game/types';

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
/** Même un dossier très fragilisé garde un minimum de chances. */
export const HIRE_CHANCE_MIN = 0.05;

/** Candidatures simultanées au maximum. */
export const MAX_APPLICATIONS = 3;
/** Mois avant la réponse à une candidature, selon le grade : les postes prestigieux sont longs à intégrer. */
export const REVIEW_MONTHS: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 3 };
/** Période d'essai par défaut, en mois, selon le grade (un poste peut fixer la sienne avec `probation`). */
export const PROBATION_MONTHS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 6 };
/** Après un renvoi, la chance d'embauche baisse de ce montant pendant ce nombre de mois. */
export const FIRED_HIRE_PENALTY = 0.15;
export const FIRED_MEMORY_MONTHS = 6;

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

/**
 * Postes disponibles. Les trois niveaux de serveur forment la filière « restauration » : le haut de gamme
 * demande 4 ans d'expérience dans le domaine OU une formation en école hôtelière (règle du jeu : en France
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
  { id: 'fastFood', grade: 1, drawback: { health: -1.5, happiness: -1.5 }, field: 'restaurant', salary: 1351, hours: 32, commute: 3 },
  { id: 'diner', grade: 1, drawback: { health: -1.5, happiness: -1 }, field: 'restaurant', salary: 1600, hours: 35, commute: 4 },
  {
    id: 'fineDining', grade: 3, drawback: { health: -2, happiness: -2.5 }, field: 'restaurant', salary: 1900, hours: 39, commute: 6,
    anyOf: [
      { type: 'experience', field: 'restaurant', months: 48 },
      { type: 'diploma', id: 'hotelSchool' },
    ],
  },
  {
    id: 'fastFoodManager', grade: 2, drawback: { health: -1.5, happiness: -2 }, field: 'restaurant', salary: 1850, hours: 39, commute: 3,
    anyOf: [{ type: 'diploma', id: 'btsMhr' }, { type: 'experience', field: 'restaurant', months: 24 }],
  },
  {
    id: 'dinerManager', grade: 2, drawback: { health: -1.5, happiness: -1.5 }, field: 'restaurant', salary: 1950, hours: 39, commute: 4,
    anyOf: [{ type: 'diploma', id: 'btsMhr' }, { type: 'experience', field: 'restaurant', months: 24 }],
  },
  {
    id: 'fineDiningManager', grade: 4, drawback: { health: -2, happiness: -3 }, field: 'restaurant', salary: 2600, hours: 42, commute: 6,
    anyOf: [{ type: 'diploma', id: 'btsMhr' }],
  },
  { id: 'cashier', grade: 1, drawback: { health: -1, happiness: -1.5 }, field: 'retail', salary: 1500, minSkills: { charisma: 50 }, hours: 35, commute: 4 },
  {
    id: 'retailManager', grade: 2, drawback: { health: -0.5, happiness: -2 }, field: 'retail', salary: 1850, hours: 39, commute: 4,
    anyOf: [{ type: 'experience', field: 'retail', months: 24 }, { type: 'diploma', id: 'btsMco' }],
  },
  {
    id: 'storeDirector', grade: 3, drawback: { health: -1, happiness: -2.5 }, field: 'retail', salary: 2500, hours: 42, commute: 4,
    anyOf: [{ type: 'experience', field: 'retail', months: 72 }],
  },
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
