// ---------- Efficacité et style de travail ----------

/**
 * Style de travail (et d'étude) : il règle la vitesse à laquelle l'efficacité progresse, et ce que cela coûte chaque mois
 * en santé et en bonheur.
 * - `gain` : points d'efficacité par mois (négatif : la réputation s'effrite).
 * - `health`, `happiness` : variation mensuelle des jauges tant qu'on travaille ou qu'on étudie.
 */
export type WorkStyle = 'hard' | 'normal' | 'easy';
export const WORK_STYLE_IDS: WorkStyle[] = ['hard', 'normal', 'easy'];
export const WORK_STYLES: Record<WorkStyle, { gain: number; health: number; happiness: number }> = {
  hard: { gain: 3, health: -3, happiness: -2 },
  normal: { gain: 1, health: 0, happiness: 0 },
  easy: { gain: -2, health: 1, happiness: 1 },
};

/**
 * L'efficacité (0 à 100) montre le sérieux du joueur au travail et dans les études. Elle remplace l'ancienneté pour les
 * promotions et pèse sur les augmentations ; une efficacité très basse expose aux blâmes.
 * - `start` : niveau de départ ; `newJob` : niveau à l'embauche dans un autre domaine ; `sameField` : dans le même domaine.
 * - `promoteAt`, `minMonths` : efficacité et mois passés au poste pour qu'une promotion soit possible.
 * - `strainHealth`, `strainFactor` : sous cette santé, le style « à fond » gagne moins (on tire sur la corde).
 * - `burnoutHealth` : sous cette santé, le style « à fond » mène à un arrêt maladie forcé.
 * - `sickMonths`, `sickPay`, `sickRest` : durée de l'arrêt, part du salaire versée, santé récupérée par mois.
 * - `burnoutPenalty` : points d'efficacité perdus à l'arrêt.
 * - `slackPenalty` : points perdus par mois quand on saute toutes ses heures (au prorata des heures sautées).
 * - `zeroMonths` : mois de suite à efficacité nulle avant le renvoi (emploi) ou l'exclusion (formation).
 * - `lowBelow`, `lowBlameRate` : sous ce niveau, chaque point manquant ajoute ce risque de blâme.
 */
export const EFFICIENCY = {
  start: 50,
  newJob: 30,
  sameField: 50,
  promoteAt: 70,
  minMonths: 6,
  strainHealth: 45,
  strainFactor: 0.6,
  burnoutHealth: 25,
  sickMonths: 2,
  sickPay: 0.5,
  sickRest: 8,
  burnoutPenalty: 10,
  slackPenalty: 2,
  zeroMonths: 2,
  lowBelow: 25,
  lowBlameRate: 0.01,
};
