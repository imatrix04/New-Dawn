// Épargne : livrets, PEL, versements, retraits, intérêts.
import { SAVINGS } from '../../data/content';
import type { Account, GameState, Savings, SavingsProduct } from '../types';
import { addLog, cents } from './shared';

export const SAVINGS_PRODUCTS: SavingsProduct[] = ['livretA', 'ldds', 'livretJeune', 'pel'];

/** Au départ, aucun produit d'épargne n'est ouvert : le joueur n'a que son compte courant. */
export const emptySavings = (): Savings => ({ livretA: null, ldds: null, livretJeune: null, pel: null });

/**
 * Sauvegardes d'avant l'ouverture à la demande : le Livret A et le Livret Jeune existaient d'office.
 * On garde ceux qui contiennent de l'argent ; les autres redeviennent « à ouvrir ».
 */
export function migrateSavings(raw: Partial<Savings> | undefined): Savings {
  if (!raw) return emptySavings();
  if ('ldds' in raw) return { ...emptySavings(), ...raw }; // format actuel
  const keep = (a?: Account | null) => (a && (a.balance > 0 || a.interest > 0) ? a : null);
  return { ...emptySavings(), livretA: keep(raw.livretA), livretJeune: keep(raw.livretJeune), pel: raw.pel ?? null };
}

export const ageYears = (state: GameState) => 18 + Math.floor(state.month / 12);

/** Le Livret Jeune est réservé aux moins de 25 ans : il se ferme à l'anniversaire des 25 ans. */
export const livretJeuneEligible = (state: GameState) => ageYears(state) < SAVINGS.livretJeune.closesAtAge;

const accountOf = (state: GameState, p: SavingsProduct): Account | null => state.savings[p];

export const isOpen = (state: GameState, p: SavingsProduct): boolean => accountOf(state, p) !== null;

/** Peut-on ouvrir ce produit ? (Le PEL s'ouvre avec son premier versement, voir `depositSavings`.) */
export function canOpen(state: GameState, p: SavingsProduct): boolean {
  if (isOpen(state, p)) return false;
  return p === 'livretJeune' ? livretJeuneEligible(state) : true;
}

export const savingsBalance = (state: GameState, p: SavingsProduct): number => accountOf(state, p)?.balance ?? 0;

export const totalSavings = (state: GameState): number =>
  SAVINGS_PRODUCTS.reduce((sum, p) => sum + savingsBalance(state, p), 0);

/** Versements encore possibles avant le plafond : les intérêts capitalisés n'y comptent pas. */
export function savingsRoom(state: GameState, p: SavingsProduct): number {
  const a = accountOf(state, p);
  return Math.max(0, SAVINGS[p].ceiling - (a ? a.balance - a.interest : 0));
}

export type TransferCheck =
  | { ok: true }
  | {
    ok: false;
    reason: 'invalid' | 'unavailable' | 'notOpen' | 'min' | 'insufficient' | 'ceiling';
    min?: number;
    room?: number;
  };

export function checkDeposit(state: GameState, p: SavingsProduct, amount: number): TransferCheck {
  if (!(amount > 0)) return { ok: false, reason: 'invalid' };
  if (p === 'livretJeune' && !livretJeuneEligible(state)) return { ok: false, reason: 'unavailable' };
  if (p !== 'pel' && !isOpen(state, p)) return { ok: false, reason: 'notOpen' };
  const room = savingsRoom(state, p);
  const min = p === 'pel'
    ? (state.savings.pel ? SAVINGS.pel.minDeposit : SAVINGS.pel.minOpen)
    : SAVINGS[p].minDeposit;
  // Le minimum ne s'applique pas au dernier versement qui remplit exactement le plafond.
  if (amount < min && amount !== room) return { ok: false, reason: 'min', min };
  if (amount > state.money) return { ok: false, reason: 'insufficient' };
  if (amount > room) return { ok: false, reason: 'ceiling', room };
  return { ok: true };
}

/** Retrait d'un livret. Le PEL ne permet que la clôture complète (voir `closePel`). */
export function checkWithdraw(state: GameState, p: SavingsProduct, amount: number): TransferCheck {
  if (p === 'pel') return { ok: false, reason: 'unavailable' };
  if (!isOpen(state, p)) return { ok: false, reason: 'notOpen' };
  if (!(amount > 0)) return { ok: false, reason: 'invalid' };
  if (amount > savingsBalance(state, p)) return { ok: false, reason: 'insufficient' };
  return { ok: true };
}

/** Ouvre un livret (gratuit, solde nul). Le PEL, lui, s'ouvre avec un premier versement d'au moins 225 €. */
export function openSavings(state: GameState, p: SavingsProduct): GameState {
  if (p === 'pel' || !canOpen(state, p)) return state;
  const s = structuredClone(state);
  s.savings[p] = { balance: 0, interest: 0 };
  addLog(s, 'log.opened', { productId: p }, 'good');
  return s;
}

/** Verse de l'argent du compte courant sur un produit ouvert ; le premier versement sur le PEL l'ouvre. */
export function depositSavings(state: GameState, p: SavingsProduct, rawAmount: number): GameState {
  const amount = cents(rawAmount);
  if (!checkDeposit(state, p, amount).ok) return state;
  const s = structuredClone(state);
  s.money = cents(s.money - amount);
  if (p === 'pel') {
    const pel = s.savings.pel ?? { balance: 0, interest: 0, openedMonth: s.month, rate: SAVINGS.pel.rate };
    pel.balance = cents(pel.balance + amount);
    s.savings.pel = pel;
  } else {
    const acct = s.savings[p]!;
    acct.balance = cents(acct.balance + amount);
  }
  addLog(s, 'log.deposit', { productId: p, amount });
  return s;
}

export function withdrawSavings(state: GameState, p: SavingsProduct, rawAmount: number): GameState {
  const amount = cents(rawAmount);
  if (p === 'pel' || !checkWithdraw(state, p, amount).ok) return state;
  const s = structuredClone(state);
  const acct = s.savings[p]!;
  acct.balance = cents(acct.balance - amount);
  acct.interest = Math.min(acct.interest, acct.balance); // les retraits entament d'abord les versements
  s.money = cents(s.money + amount);
  addLog(s, 'log.withdraw', { productId: p, amount });
  return s;
}

export interface PelClosePreview {
  payout: number;
  /** Intérêts perdus en cas de clôture avant le blocage de 4 ans. */
  penalty: number;
  early: boolean;
  monthsOpen: number;
}

export function pelClosePreview(state: GameState): PelClosePreview | null {
  const pel = state.savings.pel;
  if (!pel) return null;
  const monthsOpen = state.month - pel.openedMonth;
  const early = monthsOpen < SAVINGS.pel.lockMonths;
  const penalty = early ? cents(pel.interest * SAVINGS.pel.earlyInterestLoss) : 0;
  return { payout: cents(pel.balance - penalty), penalty, early, monthsOpen };
}

export function closePel(state: GameState): GameState {
  const preview = pelClosePreview(state);
  if (!preview) return state;
  const s = structuredClone(state);
  s.money = cents(s.money + preview.payout);
  s.savings.pel = null;
  if (preview.early) addLog(s, 'log.pelClosedEarly', { amount: preview.payout, penalty: preview.penalty }, 'bad');
  else addLog(s, 'log.pelClosed', { amount: preview.payout });
  return s;
}

/** Intérêts du mois, crédités sur chaque produit ouvert (le PEL est net du prélèvement de 30 %). */
export function accrueSavings(s: GameState) {
  let total = 0;
  const credit = (acct: Account, amount: number) => {
    const v = cents(amount);
    acct.balance = cents(acct.balance + v);
    acct.interest = cents(acct.interest + v);
    total += v;
  };
  const { livretA, ldds, livretJeune, pel } = s.savings;
  if (livretA) credit(livretA, (livretA.balance * SAVINGS.livretA.rate) / 12);
  if (ldds) credit(ldds, (ldds.balance * SAVINGS.ldds.rate) / 12);
  if (livretJeune && livretJeuneEligible(s)) credit(livretJeune, (livretJeune.balance * SAVINGS.livretJeune.rate) / 12);
  if (pel) credit(pel, ((pel.balance * pel.rate) / 12) * (1 - SAVINGS.pel.tax));
  if (total >= 0.01) addLog(s, 'log.interest', { amount: cents(total) }, 'good');
}

/** Clôtures automatiques : Livret Jeune à 25 ans, PEL au bout de 10 ans. Les fonds reviennent sur le compte courant. */
export function closeExpiredSavings(s: GameState) {
  const jeune = s.savings.livretJeune;
  if (jeune && !livretJeuneEligible(s)) {
    if (jeune.balance > 0) {
      s.money = cents(s.money + jeune.balance);
      addLog(s, 'log.jeuneClosed', { amount: jeune.balance });
    }
    s.savings.livretJeune = null;
  }
  const pel = s.savings.pel;
  if (pel && s.month - pel.openedMonth >= SAVINGS.pel.maxMonths) {
    s.money = cents(s.money + pel.balance);
    addLog(s, 'log.pelMatured', { amount: pel.balance });
    s.savings.pel = null;
  }
}
