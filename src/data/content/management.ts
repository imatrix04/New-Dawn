// ---------- Management : équipes, primes et bilans ----------
import type { BossType } from './economy';

/**
 * Un poste de management encadre une équipe. Le manager a des équipiers directs ; le directeur a des managers de
 * service (chacun avec ses propres équipiers) et gère la caisse de l'entreprise.
 */
export type ManagementLevel = 'manager' | 'director';

export interface Management {
  level: ManagementLevel;
  /** Effectif direct (tiré à la prise de poste, puis multiplié par la taille de l'entreprise, voir `Company.staff`). */
  team: [number, number];
  /** Directeur : équipiers sous la responsabilité de chaque manager de service. */
  staff?: [number, number];
  /** Salaire mensuel moyen d'un salarié de l'équipe : base de la masse salariale et des primes. */
  wage: number;
}

/** Rythme demandé à l'équipe : il règle la production du mois et ce que cela coûte à l'humeur. */
export type TeamPace = 'easy' | 'normal' | 'push';
export const TEAM_PACE_IDS: TeamPace[] = ['easy', 'normal', 'push'];
/**
 * - `output` : multiplicateur de production (1 = rythme habituel, avec une humeur normale).
 * - `mood` : variation mensuelle de l'humeur de chaque membre, avant le retour naturel vers l'humeur de base.
 *
 * À long terme le rythme normal rapporte le plus ; « à fond » est un sprint, qui s'use vite.
 */
export const TEAM_PACES: Record<TeamPace, { output: number; mood: number }> = {
  easy: { output: 0.8, mood: 2.5 },
  normal: { output: 1, mood: 0 },
  push: { output: 1.25, mood: -6 },
};

/**
 * Réglages du management (valeurs de jeu, pas des données réelles).
 * - `cycle` : mois entre deux bilans (et deux primes).
 * - `baseMood`, `moodPull`, `moodNoise` : humeur vers laquelle l'équipe revient, part de l'écart regagnée chaque mois, aléa mensuel.
 * - `climate` : poids de l'ambiance de l'entreprise (`drawback.happiness`) sur l'humeur.
 * - `quitBelow`, `quitChance` : sous cette humeur, un membre démissionne avec cette chance par mois (il est remplacé).
 * - `objective`, `objectiveStep`, `objectiveMax` : production moyenne exigée sur un trimestre, qui monte après chaque succès de suite.
 * - `partialAt` : part de l'objectif en dessous de laquelle la prime est perdue ; `blameBelow` : en dessous, c'est un blâme.
 * - `prime`, `partialPrime`, `primeMaxRatio` : prime personnelle (en mois de salaire) à l'objectif atteint, part versée à un objectif
 *   presque atteint, plafond du dépassement qui l'augmente.
 * - `efficiency` : efficacité gagnée ou perdue au bilan (succès, presque, échec).
 * - `streakRaise`, `streakRaiseMax` : bonus à l'augmentation accordée par objectif atteint de suite (plafonné).
 * - `streakPromo`, `streakPromoMax` : bonus de chance de promotion demandée (plafonné).
 * - `presenceFloor` : production restante quand le manager saute toutes ses heures.
 * - `budgetPerHead` : enveloppe de primes du manager, par équipier et par trimestre.
 * - `bonusMax`, `bonusRef`, `bonusMood` : prime maximale par personne ; une prime d'un `bonusRef` de salaire donne 63 % du gain d'humeur maximal `bonusMood`.
 * - `bonusHabit` : part de l'effet d'une prime qui reste si le même membre en a déjà reçu une depuis moins d'un `cycle` (on s'y habitue).
 * - `outing` : sortie d'équipe (coût par personne, gain d'humeur, mois à attendre avant la suivante).
 * - `quitPenalty`, `quitCost` : chaque départ du trimestre retire cette part de l'objectif au bilan ; un directeur paie en plus `quitCost` mois de salaire
 *   pour recruter et former le remplaçant.
 * - `dividend` : part du bénéfice d'un trimestre que le siège reprend (la caisse ne grossit donc pas sans fin).
 * - `margin`, `overhead`, `market`, `fundMonths` : finances du directeur : recette par salarié (en salaire × production), charges en plus du salaire,
 *   aléa du marché sur la recette, caisse de départ (en mois de masse salariale).
 * - `financeBlameRatio` : une perte qui n'est pas due aux primes ne vaut un blâme que si la production est sous cette part de l'objectif.
 * - `happiness` : bonheur du joueur par point d'humeur d'équipe au-dessus (ou en dessous) de `baseMood`, plafonné.
 */
export const TEAM = {
  cycle: 3,
  baseMood: 60,
  moodPull: 0.12,
  moodNoise: 2,
  climate: 1.5,
  quitBelow: 25,
  quitChance: 0.25,
  objective: 1.04,
  objectiveStep: 0.02,
  objectiveMax: 1.16,
  partialAt: 0.93,
  blameBelow: 0.7,
  prime: { manager: 0.45, director: 0.8 } as Record<ManagementLevel, number>,
  partialPrime: 0.5,
  primeMaxRatio: 1.25,
  efficiency: { hit: 6, partial: 1, miss: -4 },
  streakRaise: 0.01,
  streakRaiseMax: 0.03,
  streakPromo: 0.08,
  streakPromoMax: 0.25,
  presenceFloor: 0.6,
  budgetPerHead: 120,
  bonusMin: 5,
  bonusMax: 500,
  bonusStep: 5,
  bonusRef: 0.12,
  bonusMood: 14,
  bonusHabit: 0.15,
  outing: { cost: 40, mood: 5, every: 3 },
  quitPenalty: 0.03,
  quitCost: 2,
  dividend: 0.75,
  margin: 1.25,
  overhead: 0.1,
  market: 0.08,
  fundMonths: 1.5,
  financeBlameRatio: 0.85,
  happiness: { perPoint: 1 / 40, min: -1.5, max: 1 },
};

/** Prénoms des équipiers (un nom propre n'est pas traduit). */
export const TEAM_NAMES = [
  'Léa', 'Hugo', 'Inès', 'Noah', 'Camille', 'Lucas', 'Manon', 'Yanis', 'Sarah', 'Théo',
  'Chloé', 'Nathan', 'Jade', 'Enzo', 'Lina', 'Mathis', 'Clara', 'Rayan', 'Emma', 'Axel',
  'Zoé', 'Maxime', 'Anaïs', 'Kévin', 'Nina', 'Samir', 'Louise', 'Dylan', 'Eva', 'Karim',
  'Julie', 'Bastien', 'Aya', 'Florian', 'Mélanie', 'Tom', 'Sofia', 'Adrien', 'Lola', 'Malik',
];

// ---------- Traits, supérieur, événements et audits ----------

/** Trait de caractère d'un membre : il se révèle après quelques mois dans l'équipe. */
export type TeamTrait = 'driven' | 'lazy' | 'ambitious' | 'toxic' | 'mentor' | 'unstable';
export const TEAM_TRAIT_IDS: TeamTrait[] = ['driven', 'lazy', 'ambitious', 'toxic', 'mentor', 'unstable'];
/**
 * - `output` : multiplicateur de production du membre (un service entier pour un manager de service).
 * - `push` : part de la perte d'humeur du rythme « à fond » qu'il subit.
 * - `bonus` : multiplicateur de l'effet des primes sur son humeur.
 * - `quit` : multiplicateur de sa chance de démissionner quand il va mal.
 * - `denied` : multiplicateur de la perte d'humeur quand on lui refuse quelque chose.
 * - `aura` : humeur gagnée (ou perdue) chaque mois par chacun des autres membres à cause de lui.
 * - `noise` : multiplicateur de l'aléa mensuel de son humeur.
 * - `train` : mois de formation supplémentaires qu'il fait gagner chaque mois aux recrues.
 * - `weight` : fréquence relative du trait au tirage.
 */
export const TEAM_TRAITS: Record<TeamTrait, { output: number; push: number; bonus: number; quit: number; denied: number; aura: number; noise: number; train: number; weight: number }> = {
  driven: { output: 1.25, push: 1, bonus: 1, quit: 1, denied: 1, aura: 0, noise: 1, train: 0, weight: 3 },
  lazy: { output: 0.75, push: 0.5, bonus: 1, quit: 0.5, denied: 1, aura: 0, noise: 1, train: 0, weight: 3 },
  ambitious: { output: 1, push: 1, bonus: 1.4, quit: 1.5, denied: 1.75, aura: 0, noise: 1, train: 0, weight: 3 },
  toxic: { output: 0.9, push: 1, bonus: 1, quit: 1, denied: 1, aura: -0.8, noise: 1, train: 0, weight: 1.5 },
  mentor: { output: 1.05, push: 1, bonus: 1, quit: 0.8, denied: 1, aura: 0.4, noise: 1, train: 1, weight: 2 },
  unstable: { output: 1.1, push: 1.2, bonus: 1, quit: 1.3, denied: 1.3, aura: 0, noise: 3, train: 0, weight: 2 },
};

/**
 * Le supérieur direct (le directeur pour un manager, le siège pour un directeur) décide de l'argent et des approbations.
 * - `envelope` : multiplicateur de l'enveloppe de primes d'un manager.
 * - `pool` : part du bénéfice du trimestre que le siège laisse en primes à un directeur.
 * - `bonus`, `recruit`, `fire`, `raise` : chance d'approuver une répartition de primes, une embauche, un licenciement, une augmentation demandée.
 */
export const TEAM_BOSS: Record<BossType, { envelope: number; pool: number; bonus: number; recruit: number; fire: number; raise: number }> = {
  kind: { envelope: 1.5, pool: 0.07, bonus: 0.97, recruit: 0.9, fire: 0.5, raise: 0.8 },
  fair: { envelope: 1, pool: 0.05, bonus: 0.85, recruit: 0.75, fire: 0.7, raise: 0.6 },
  strict: { envelope: 0.65, pool: 0.035, bonus: 0.6, recruit: 0.5, fire: 0.85, raise: 0.35 },
  harsh: { envelope: 0.35, pool: 0.02, bonus: 0.4, recruit: 0.3, fire: 0.95, raise: 0.15 },
};

/**
 * - `newcomerOutput`, `trainMonths` : production d'un nouvel arrivant pendant sa formation (et mois avant que son trait se révèle).
 * - `eventChance` : chance par mois qu'un événement d'équipe survienne.
 * - `minMembers`, `maxExtra` : effectif minimum, et nombre de recrues possibles au-delà de la taille de départ.
 * - `recruitCost`, `fireCost` : frais pour le directeur, en mois de salaire (recrutement, indemnités).
 * - `fireFear` : humeur perdue par les autres quand un collègue est renvoyé.
 * - `audit` : chance mensuelle d'un audit surprise, mois minimum entre deux audits, efficacité gagnée si tout est en règle, perdue s'il y a un souci.
 * - `poolFloor` : enveloppe minimale du directeur, par personne.
 */
export const TEAM_EXTRA = {
  newcomerOutput: 0.6,
  trainMonths: 2,
  eventChance: 0.22,
  minMembers: 2,
  maxExtra: 2,
  recruitCost: 1,
  fireCost: 2,
  fireFear: 5,
  audit: { chance: 0.1, gap: 4, praise: 4, warn: -3 },
  poolFloor: 10,
};

/** Événements d'équipe : le joueur choisit la réaction (voir l'événement en attente de la carte Équipe). */
export type TeamEventId = 'conflict' | 'raise' | 'rumor' | 'poach' | 'complaint' | 'holiday' | 'strike' | 'idea' | 'visit';
/** Réaction par défaut si l'événement reste sans réponse jusqu'à la fin du mois. */
export const TEAM_EVENT_DEFAULT: Record<TeamEventId, number> = { conflict: 2, raise: 2, rumor: 1, poach: 1, complaint: 2, holiday: 2, strike: 2, idea: 1, visit: 1 };
export const TEAM_EVENT_CHOICES: Record<TeamEventId, number> = { conflict: 3, raise: 3, rumor: 3, poach: 3, complaint: 3, holiday: 3, strike: 3, idea: 3, visit: 3 };

// ---------- Primes des employés ----------

/**
 * Prime de fin de trimestre versée par le manager à un employé (un poste sans équipe à encadrer).
 * - `rate` : part du salaire mensuel pour un trimestre moyen avec un supérieur équitable ; le caractère du supérieur la multiplie (voir TEAM_BOSS.envelope).
 * - `minEfficiency`, `minHours`, `minTenure` : conditions pour y avoir droit (efficacité, part des heures faites, mois au poste).
 * - `goodQuarter` : chance que le service ait atteint ses objectifs ; sinon `badShare` de la prime seulement.
 * - `blamePenalty` : part perdue par blâme au poste.
 * - `happiness`, `efficiency` : bonheur et efficacité gagnés quand une prime est versée.
 */
export const EMPLOYEE_BONUS = {
  rate: 0.12,
  minEfficiency: 40,
  minHours: 0.9,
  minTenure: 3,
  goodQuarter: 0.6,
  badShare: 0.3,
  blamePenalty: 0.25,
  happiness: 3,
  efficiency: 2,
};

/** Intéressement : versé chaque décembre aux salariés d'une entreprise qui en a un, après `minTenure` mois ; l'année de l'entreprise varie dans `year`. */
export const PROFIT_SHARE = { minTenure: 6, year: [0.3, 1.3] as [number, number] };

/** Épuisement : chaque mois de suite à fond après le premier retire `pushStack` d'humeur en plus, jusqu'à `pushStackMax`. */
export const TEAM_FATIGUE = { pushStack: 1.5, pushStackMax: 3 };

// ---------- Réputation de manager et références ----------

/**
 * La réputation (0 à 100) suit le joueur d'un poste à l'autre. Elle monte avec les bons bilans, une équipe soudée et les audits
 * réussis, et baisse avec les échecs et les blâmes.
 * - `levels` : seuils des paliers (inconnu, fiable, reconnu, référence, légende).
 * - `hit`, `partial`, `miss`, `blame`, `calm`, `happy`, `auditClean` : points gagnés ou perdus au bilan, selon le résultat.
 * - `hire`, `hireMax` : bonus de chance d'embauche à un poste de management (points × `hire`, plafonné).
 * - `raise`, `promo` : bonus (à 100 points) sur l'augmentation accordée et sur la chance de promotion demandée.
 * - `startMood` : humeur de départ gagnée par chaque point de réputation par une nouvelle équipe (elle te connaît).
 * - `ref` : bonus d'embauche (dans le même domaine) de chaque référence selon sa note, plafonné à `ref.max` (en plus ou en moins).
 * - `minMonths` : mois minimum à un poste de management pour qu'il laisse une référence.
 */
export const REPUTATION = {
  levels: [0, 20, 40, 60, 80],
  hit: 4,
  partial: 1,
  miss: -3,
  blame: -6,
  calm: 1,
  happy: 1,
  auditClean: 2,
  hire: 0.002,
  hireMax: 0.2,
  raise: 0.02,
  promo: 0.1,
  startMood: 0.1,
  ref: { excellent: 0.05, good: 0.02, poor: -0.05, max: 0.15 },
  minMonths: 6,
};
