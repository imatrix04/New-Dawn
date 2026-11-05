// ---------- Promotions ----------

/**
 * Promotion proposée par l'employeur : après `months` mois au poste (clé), il propose le poste de manager `to`.
 * Le joueur accepte ou refuse. S'il accepte sans avoir la formation `training`, elle est payée par l'employeur et
 * suivie pendant les heures de travail ; à la fin il devient manager. Il peut aussi la payer lui-même (catalogue)
 * et postuler au poste. Les montants et la durée de la formation sont des estimations de jeu.
 *
 * Sans `training`, aucune formation n'est exigée : le poste est donné tout de suite. Avec `latest`, la première
 * proposition tombe au hasard entre `months` et `latest` (elle est certaine au plus tard à `latest`).
 */
export const PROMOTIONS: Record<string, { to: string; months: number; latest?: number; training?: string }> = {
  fastFood: { to: 'fastFoodManager', months: 36 },
  diner: { to: 'dinerManager', months: 36 },
  fineDining: { to: 'fineDiningManager', training: 'btsMhr', months: 48 },
  cashier: { to: 'retailManager', months: 24, latest: 36 },
  retailManager: { to: 'storeDirector', months: 36, latest: 60 },
};
/** Après un premier refus (ou une première proposition), chance par mois d'une nouvelle proposition. */
export const PROMOTION_CHANCE = 0.03;
/** Demande de promotion du joueur : chance de base, bonus par année d'ancienneté au-delà du seuil (plafonné), malus par blâme. */
export const PROMOTION_REQUEST_BASE = 0.35;
export const PROMOTION_REQUEST_PER_YEAR = 0.05;
export const PROMOTION_REQUEST_MAX_BONUS = 0.2;
export const PROMOTION_REQUEST_BLAME_PENALTY = 0.15;
/** Mois à attendre entre deux demandes de promotion. */
export const PROMOTION_REQUEST_COOLDOWN = 6;
