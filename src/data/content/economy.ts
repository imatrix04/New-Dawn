import { OWNING } from './housing';
import { SMIC_NET } from './jobs';
import { SAVINGS } from './savings';

// ---------- Calendrier et économie ----------

/** La partie commence en janvier de cette année : le mois 0 est janvier 2026. */
export const START_YEAR = 2026;

/** Taux et paramètres qui évoluent une fois par an (voir le rapport économique de janvier). */
export type RateKey = 'livretA' | 'ldds' | 'livretJeune' | 'pel' | 'loan15' | 'loan20' | 'loan25';
export const RATE_KEYS: RateKey[] = ['livretA', 'ldds', 'livretJeune', 'pel', 'loan15', 'loan20', 'loan25'];

/** Situation économique au départ : les valeurs de base des autres tables de données. */
export const ECONOMY_START: { smic: number; rates: Record<RateKey, number> } = {
  smic: SMIC_NET,
  rates: {
    livretA: SAVINGS.livretA.rate,
    ldds: SAVINGS.ldds.rate,
    livretJeune: SAVINGS.livretJeune.rate,
    pel: SAVINGS.pel.rate,
    loan15: OWNING.rates[15],
    loan20: OWNING.rates[20],
    loan25: OWNING.rates[25],
  },
};

/**
 * Variations annuelles tirées au hasard (loi normale, bornées). L'immobilier a plus de chances de monter que de baisser ;
 * le SMIC suit l'inflation en moyenne mais peut reculer. Taux : `trend` est un choc commun à tous les prêts (ou à tous les
 * livrets), `noise` l'écart propre à chaque produit, `min` et `max` les bornes du taux.
 */
export const ECONOMY_RULES = {
  housing: { mean: 0.025, sd: 0.045, min: -0.1, max: 0.12 },
  smic: { mean: 0.012, sd: 0.02, min: -0.03, max: 0.05 },
  savingsTrend: 0.002,
  loanTrend: 0.0035,
  noise: { livretA: 0.0015, ldds: 0.0025, livretJeune: 0.003, pel: 0.002, loan15: 0.0025, loan20: 0.0025, loan25: 0.0025 } as Record<RateKey, number>,
  bounds: {
    livretA: [0.005, 0.045], ldds: [0.005, 0.045], livretJeune: [0.005, 0.05], pel: [0.01, 0.04],
    loan15: [0.015, 0.075], loan20: [0.015, 0.075], loan25: [0.015, 0.075],
  } as Record<RateKey, [number, number]>,
};

// ---------- Supérieurs et augmentations ----------

/**
 * Type de supérieur, caché au joueur : il se devine à ses réactions.
 * - `cap` : augmentation qu'il accorde sans discuter (en fraction du salaire), avant ancienneté et blâmes.
 * - `stubborn` : chance de refuser net une demande trop haute au lieu de faire une contre-proposition.
 * - `blame` : multiplicateur du risque de blâme quand on saute des heures.
 * - `blameOnRefusal` : chance qu'un refus se solde par un blâme.
 */
export type BossType = 'kind' | 'fair' | 'strict' | 'harsh';
export const BOSS_TYPES: BossType[] = ['kind', 'fair', 'strict', 'harsh'];
export const BOSSES: Record<BossType, { cap: number; stubborn: number; blame: number; blameOnRefusal: number }> = {
  kind: { cap: 0.09, stubborn: 0, blame: 0.6, blameOnRefusal: 0 },
  fair: { cap: 0.06, stubborn: 0.1, blame: 1, blameOnRefusal: 0 },
  strict: { cap: 0.035, stubborn: 0.3, blame: 1.4, blameOnRefusal: 0.1 },
  harsh: { cap: 0.02, stubborn: 0.5, blame: 1.8, blameOnRefusal: 0.25 },
};
/** Poids de départ de chaque type de supérieur ; l'écart de paie de l'entreprise les déplace (voir `rollBoss`). */
export const BOSS_WEIGHTS: Record<BossType, number> = { kind: 0.25, fair: 0.4, strict: 0.25, harsh: 0.1 };
/** Les noms de famille des supérieurs ; la civilité (M. ou Mme) est tirée à part. */
export const BOSS_NAMES = ['Delorme', 'Marchand', 'Vasseur', 'Lefèvre', 'Bertrand', 'Roussel', 'Fontaine', 'Gauthier', 'Perrin', 'Morel', 'Lacroix', 'Faure'];

export const RAISE = {
  /** Mois à passer au poste (ou depuis la dernière augmentation) avant de pouvoir en demander une. */
  minMonths: 12,
  /** Demande minimale et maximale, en fraction du salaire. */
  minAsk: 0.01,
  maxAsk: 0.2,
  /** Mois d'attente après un refus, et après avoir décliné une contre-proposition. */
  refusedWait: 6,
  declinedWait: 3,
  /** Une contre-proposition vaut au plus ce multiple de ce que le supérieur accorde ; au-delà, c'est un refus. */
  counterRange: 2,
  /** Bonus d'efficacité (de -efficiencyBonus à +efficiencyBonus autour de 50) et malus par blâme sur l'augmentation accordée. */
  efficiencyBonus: 0.03,
  perBlame: 0.015,
};
