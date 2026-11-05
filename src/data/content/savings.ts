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
