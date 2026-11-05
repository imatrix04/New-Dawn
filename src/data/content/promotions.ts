// ---------- Promotions ----------

/**
 * Promotion proposée par l'employeur : après `months` mois au poste (clé), il propose le poste de manager `to`.
 * Le joueur accepte ou refuse. S'il accepte sans avoir la formation `training`, elle est payée par l'employeur et
 * suivie pendant les heures de travail ; à la fin il devient manager. Il peut aussi la payer lui-même (catalogue)
 * et postuler au poste. Les montants et la durée de la formation sont des estimations de jeu.
 */
export const PROMOTIONS: Record<string, { to: string; training: string; months: number }> = {
  fastFood: { to: 'fastFoodManager', training: 'tpMum', months: 36 },
  diner: { to: 'dinerManager', training: 'bpService', months: 36 },
  fineDining: { to: 'fineDiningManager', training: 'btsMhr', months: 48 },
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
