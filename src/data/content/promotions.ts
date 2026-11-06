// ---------- Promotions ----------

/**
 * Promotion proposée par l'employeur : quand le joueur est assez efficace (voir EFFICIENCY.promoteAt) et au poste depuis
 * assez longtemps, il propose le poste de manager `to`. Le joueur accepte ou refuse. S'il accepte sans avoir la formation
 * `training`, elle est payée par l'employeur et suivie pendant les heures de travail ; à la fin il devient manager. Il peut
 * aussi la payer lui-même (catalogue) et postuler au poste. Les montants et la durée de la formation sont des estimations
 * de jeu.
 *
 * Sans `training`, aucune formation n'est exigée : le poste est donné tout de suite.
 */
export const PROMOTIONS: Record<string, { to: string; training?: string }> = {
  fastFood: { to: 'fastFoodManager' },
  diner: { to: 'dinerManager' },
  fineDining: { to: 'fineDiningManager', training: 'btsMhr' },
  cashier: { to: 'retailManager' },
  retailManager: { to: 'storeDirector' },
};
/** Chance par mois d'une première proposition une fois la promotion possible, puis après un refus (rare). */
export const PROMOTION_FIRST_CHANCE = 0.3;
export const PROMOTION_CHANCE = 0.03;
/**
 * Demande de promotion du joueur : chance de base une fois la promotion possible, bonus par point d'efficacité au-dessus du
 * seuil (plafonné), malus par blâme.
 */
export const PROMOTION_REQUEST_BASE = 0.35;
export const PROMOTION_REQUEST_PER_POINT = 0.01;
export const PROMOTION_REQUEST_MAX_BONUS = 0.3;
export const PROMOTION_REQUEST_BLAME_PENALTY = 0.15;
/** Mois à attendre entre deux demandes de promotion. */
export const PROMOTION_REQUEST_COOLDOWN = 6;
