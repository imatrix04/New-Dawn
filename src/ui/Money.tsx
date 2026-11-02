import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatSigned } from '../i18n/format';
import { useAnimatedNumber } from './useAnimatedNumber';

interface Props {
  value: number;
  /** 0 pour les gros chiffres, 2 pour l'épargne (les intérêts se comptent en centimes). */
  decimals?: number;
  className?: string;
}

/**
 * Montant qui se décompte en douceur vers sa nouvelle valeur. Une puce flottante (+250 € / −40 €)
 * s'envole à chaque variation visible, puis disparaît d'elle-même (animation CSS).
 */
export function Money({ value, decimals = 0, className = '' }: Props) {
  const { i18n } = useTranslation();
  const shown = useAnimatedNumber(value, 900);
  const previous = useRef(value);
  const [change, setChange] = useState<{ amount: number; id: number } | null>(null);

  useEffect(() => {
    const diff = value - previous.current;
    previous.current = value;
    if (Math.abs(diff) >= 0.5) setChange({ amount: diff, id: Date.now() });
  }, [value]);

  return (
    <span className={`money-amount${value < 0 ? ' neg' : ''} ${className}`}>
      {formatMoney(shown, i18n.language, decimals)}
      {change && (
        <span key={change.id} className={`money-delta ${change.amount > 0 ? 'up' : 'down'}`} aria-hidden>
          {formatSigned(change.amount, i18n.language)} €
        </span>
      )}
    </span>
  );
}
