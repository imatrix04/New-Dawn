import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { SAVINGS, SAVINGS_COLORS } from '../data/content';
import {
  ageYears, canOpen, checkDeposit, checkWithdraw, livretJeuneEligible, pelClosePreview, savingsBalance,
  savingsRoom,
} from '../game/engine';
import type { GameState, SavingsProduct } from '../game/types';
import { formatMoney, formatPercent } from '../i18n/format';
import { useStore } from '../store';
import { Money } from './Money';

interface Props {
  product: SavingsProduct;
  game: GameState;
  expanded: boolean;
  onToggle: () => void;
}

const DEPOSIT_CHIPS = [50, 100, 500, 1000];
const WITHDRAW_CHIPS = [50, 100, 500];

const cents = (n: number) => Math.round(n * 100) / 100;

/** « 1 250,5 » ou « 1250.5 » -> 1250.5 ; tout le reste -> 0. */
function parseAmount(raw: string): number {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? cents(n) : 0;
}

/** Vrai pendant un instant après chaque changement de `value` (pas au premier affichage). */
function usePulse(value: number): boolean {
  const previous = useRef(value);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setOn(true);
    const timer = setTimeout(() => setOn(false), 900);
    return () => clearTimeout(timer);
  }, [value]);
  return on;
}

export function SavingsTile({ product, game, expanded, onToggle }: Props) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const { deposit, withdraw, closePel, openSavings } = useStore();

  const def = SAVINGS[product];
  const isPel = product === 'pel';
  const pel = game.savings.pel;
  const acct = isPel ? pel : game.savings[product];
  const balance = savingsBalance(game, product);
  const principal = acct ? acct.balance - acct.interest : 0;
  const fill = Math.min(1, principal / def.ceiling);
  const rate = isPel && pel ? pel.rate : game.economy.rates[product];
  const jeuneClosed = product === 'livretJeune' && !livretJeuneEligible(game);
  const pulse = usePulse(balance);

  // « out » = retrait pour les livrets, clôture pour le PEL.
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [raw, setRaw] = useState('');
  const amount = parseAmount(raw);
  const out = mode === 'out' && (!isPel || pel !== null);
  const closing = isPel && out;
  const preview = pelClosePreview(game);

  const check = out ? checkWithdraw(game, product, amount) : checkDeposit(game, product, amount);
  const room = savingsRoom(game, product);
  const money = (n: number, decimals = 0) => formatMoney(n, lng, decimals);

  const reason = !check.ok && amount > 0
    ? t(`wallet.reasons.${check.reason}`, { min: money(check.min ?? 0), room: money(check.room ?? room) })
    : null;
  const canConfirm = closing ? true : check.ok;

  const add = (n: number) => setRaw(String(cents(amount + n)));
  const setMax = () => {
    const max = out ? balance : Math.min(game.money, room);
    setRaw(String(Math.floor(Math.max(0, max) * 100) / 100));
  };

  const confirm = () => {
    if (!canConfirm) return;
    if (closing) closePel();
    else if (out) withdraw(product, amount);
    else deposit(product, amount);
    setRaw('');
    if (closing) setMode('in');
  };

  const confirmLabel = closing
    ? t('wallet.closePel')
    : amount <= 0
      ? t('wallet.enterAmount')
      : out
        ? t('wallet.withdrawAmount', { amount: money(amount, 2) })
        : isPel && !pel
          ? t('wallet.openWith', { amount: money(amount, 2) })
          : t('wallet.depositAmount', { amount: money(amount, 2) });

  const yearsLeft = product === 'livretJeune' ? SAVINGS.livretJeune.closesAtAge - ageYears(game) : 0;
  const name = t(`wallet.products.${product}.name`);

  // Produit pas encore ouvert : une carte simple avec son bouton « Ouvrir ». Le PEL fait exception
  // car il s'ouvre avec son premier versement (formulaire ci-dessous).
  if (!isPel && !acct) {
    const eligible = canOpen(game, product);
    return (
      <div className={`stile unopened${eligible ? '' : ' closed'}`} style={{ '--c': SAVINGS_COLORS[product] } as CSSProperties}>
        <div className="stile-head static">
          <span className="stile-title">
            <span className="stile-name">{name}</span>
            <span className="stile-rate">{formatPercent(rate, lng)}</span>
          </span>
          <button className="open-btn" disabled={!eligible} onClick={() => openSavings(product)}>
            {eligible ? t('wallet.open', { name }) : t('wallet.unavailable')}
          </button>
        </div>
        <p className="stile-desc">{t(`wallet.products.${product}.desc`)}</p>
        <div className="stile-meta">
          <span>
            {product === 'livretJeune'
              ? (eligible ? t('wallet.jeune.yearsLeft', { count: yearsLeft }) : t('wallet.jeune.closed'))
              : ''}
          </span>
          <span>{t('wallet.ceiling', { ceiling: money(def.ceiling) })}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stile${expanded ? ' expanded' : ''}${pulse ? ' pulse' : ''}${jeuneClosed ? ' closed' : ''}`}
      style={{ '--c': SAVINGS_COLORS[product] } as CSSProperties}
    >
      <button className="stile-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="stile-title">
          <span className="stile-name">{name}</span>
          <span className="stile-rate">{formatPercent(rate, lng)}</span>
        </span>
        {isPel && !pel
          ? <span className="open-chip">{t('wallet.open', { name })}</span>
          : <Money value={balance} decimals={2} className="stile-amount" />}
        <span className="stile-chevron" aria-hidden>⌄</span>
      </button>

      <div className="stile-meter"><div className="stile-fill" style={{ width: `${fill * 100}%` }} /></div>
      <div className="stile-meta">
        <span>{t('wallet.used', { used: money(principal) })}</span>
        <span>{t('wallet.ceiling', { ceiling: money(def.ceiling) })}</span>
      </div>

      <div className="stile-body" inert={!expanded}>
        <div className="stile-inner">
          <p className="stile-desc">{t(`wallet.products.${product}.desc`)}</p>

          {product === 'livretJeune' && (
            <p className="stile-note">
              {jeuneClosed ? t('wallet.jeune.closed') : t('wallet.jeune.yearsLeft', { count: yearsLeft })}
            </p>
          )}

          {isPel && (
            <div className="stile-note">
              {pel ? (
                <>
                  <span>{t('wallet.pel.netRate', { net: formatPercent(pel.rate * (1 - SAVINGS.pel.tax), lng) })}</span>
                  <div className="lock">
                    <div className="lock-bar">
                      <div
                        className={`lock-fill${(preview?.early ?? true) ? '' : ' done'}`}
                        style={{ width: `${Math.min(100, ((preview?.monthsOpen ?? 0) / SAVINGS.pel.lockMonths) * 100)}%` }}
                      />
                    </div>
                    <small>
                      {(preview?.early ?? true)
                        ? t('wallet.pel.lock', { done: preview?.monthsOpen ?? 0, total: SAVINGS.pel.lockMonths })
                        : t('wallet.pel.unlocked')}
                    </small>
                  </div>
                </>
              ) : (
                t('wallet.pel.notOpen', { min: money(SAVINGS.pel.minOpen), next: money(SAVINGS.pel.minDeposit) })
              )}
            </div>
          )}

          {!jeuneClosed && (
            <div className="stile-form">
              {(!isPel || pel) && (
                <div className="seg" data-mode={mode}>
                  <span className="seg-thumb" />
                  <button className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setRaw(''); }}>
                    {t('wallet.deposit')}
                  </button>
                  <button className={mode === 'out' ? 'on' : ''} onClick={() => { setMode('out'); setRaw(''); }}>
                    {t(isPel ? 'wallet.close' : 'wallet.withdraw')}
                  </button>
                </div>
              )}

              {closing && preview ? (
                <div className="close-preview">
                  <strong>{t('wallet.pel.closePreview', { amount: money(preview.payout, 2) })}</strong>
                  <small className={preview.early ? 'bad' : 'good'}>
                    {preview.early
                      ? t('wallet.pel.penalty', { penalty: money(preview.penalty, 2) })
                      : t('wallet.pel.noPenalty')}
                  </small>
                  <small className="muted">{t('wallet.pel.noPartial')}</small>
                </div>
              ) : (
                <>
                  <div className="amount-row">
                    <input
                      className="amount-input"
                      inputMode="decimal"
                      placeholder={t('wallet.amountPlaceholder')}
                      value={raw}
                      onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                    />
                    <span className="amount-unit">€</span>
                  </div>
                  <div className="chips-row">
                    {(out ? WITHDRAW_CHIPS : DEPOSIT_CHIPS).map((n) => (
                      <button key={n} className="amount-chip" onClick={() => add(n)}>+{n}</button>
                    ))}
                    <button className="amount-chip max" onClick={setMax}>{t(out ? 'wallet.all' : 'wallet.max')}</button>
                  </div>
                  <p className={`stile-hint${reason ? ' error' : ''}`} aria-live="polite">
                    {reason ?? (out
                      ? t('wallet.hintWithdraw', { balance: money(balance, 2) })
                      : t('wallet.hintDeposit', { available: money(game.money), room: money(room) }))}
                  </p>
                </>
              )}

              <button className="confirm-btn" disabled={!canConfirm} onClick={confirm}>{confirmLabel}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
