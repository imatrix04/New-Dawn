import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SAVINGS_COLORS } from '../data/content';
import { SAVINGS_PRODUCTS, savingsBalance, totalSavings } from '../game/engine';
import type { GameState, SavingsProduct } from '../game/types';
import { formatMoney } from '../i18n/format';
import { Money } from './Money';
import { SavingsTile } from './SavingsTile';

/** Contenu de la carte « Portefeuille » : compte courant, répartition et produits d'épargne. */
export function WalletCard({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState<SavingsProduct | null>(null);

  const total = game.money + totalSavings(game);
  const parts = [
    { id: 'checking', label: t('wallet.checking'), value: Math.max(0, game.money), color: SAVINGS_COLORS.checking },
    ...SAVINGS_PRODUCTS.map((p) => ({
      id: p, label: t(`wallet.products.${p}.name`), value: savingsBalance(game, p), color: SAVINGS_COLORS[p],
    })),
  ];
  const sum = parts.reduce((a, p) => a + p.value, 0);

  return (
    <div className="wallet">
      <div className="wallet-hero">
        <span className="wallet-label">{t('wallet.checking')}</span>
        <Money value={game.money} className="wallet-balance" />
        <span className="wallet-total">
          {t('wallet.total')} <Money value={total} />
        </span>

        <div className="split" role="img" aria-label={t('wallet.split')}>
          {sum > 0
            ? parts.map((p) => (
              <i
                key={p.id}
                style={{ flexGrow: p.value, background: p.color }}
                title={`${p.label} : ${formatMoney(p.value, i18n.language)}`}
              />
            ))
            : <i style={{ flexGrow: 1, background: 'transparent' }} />}
        </div>
      </div>

      <div className="wallet-tiles">
        {SAVINGS_PRODUCTS.map((p, i) => (
          <div className="stile-wrap" key={p} style={{ animationDelay: `${i * 70}ms` }}>
            <SavingsTile
              product={p}
              game={game}
              expanded={expanded === p}
              onToggle={() => setExpanded(expanded === p ? null : p)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
