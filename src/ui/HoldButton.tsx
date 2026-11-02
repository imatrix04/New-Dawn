import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  /** Texte affiché pendant que le joueur maintient le bouton. */
  holdLabel: ReactNode;
  disabled?: boolean;
  /** Durée à maintenir, en ms. */
  duration?: number;
  onComplete: () => void;
  className?: string;
}

/**
 * Bouton à maintenir enfoncé (souris, doigt, ou Espace/Entrée) pour valider : un clic rapide
 * ne fait rien, ce qui évite les clics accidentels. Une jauge se remplit pendant l'appui ;
 * relâcher, sortir du bouton ou perdre le focus annule.
 */
export function HoldButton({ label, holdLabel, disabled, duration = 2000, onComplete, className = '' }: Props) {
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (disabled) setHolding(false);
  }, [disabled]);

  const start = () => { if (!disabled) setHolding(true); };
  const stop = () => setHolding(false);
  const isActivationKey = (key: string) => key === ' ' || key === 'Enter';

  return (
    <button
      className={`hold-btn ${className}${holding ? ' holding' : ''}`}
      disabled={disabled}
      onPointerDown={(e) => { if (e.button === 0) start(); }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onBlur={stop}
      onKeyDown={(e) => {
        if (isActivationKey(e.key)) {
          e.preventDefault();
          if (!e.repeat) start();
        }
      }}
      onKeyUp={(e) => { if (isActivationKey(e.key)) stop(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {holding && (
        <span
          className="hold-fill"
          style={{ animationDuration: `${duration}ms` }}
          onAnimationEnd={() => { setHolding(false); onComplete(); }}
        />
      )}
      <span className="hold-label">{holding ? holdLabel : label}</span>
    </button>
  );
}
