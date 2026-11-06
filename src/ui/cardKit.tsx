import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HIRE_CHANCE_MAX } from '../data/content';

// Briques communes aux cartes à liste de tuiles et détail (Carrière, Logement, Marché).

/** Rareté de 1 (commun) à 4 (très rare). */
export type Rarity = 1 | 2 | 3 | 4;

/** Losanges de rareté : plus il y en a d'allumés, plus l'élément est rare. */
export function Pips({ rarity }: { rarity: Rarity }) {
  const { t } = useTranslation();
  return (
    <span className="pips" title={t(`career.rarity.${rarity}`)} aria-label={t(`career.rarity.${rarity}`)}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= rarity ? 'on' : ''} />)}
    </span>
  );
}

/** Teinte de la barre : rouge pour les petites chances, vert pour les grandes. */
const chanceHue = (chance: number) => Math.round(Math.min(1, chance / HIRE_CHANCE_MAX) * 120);

export function ChanceBar({ chance, big = false, label }: { chance: number; big?: boolean; label: string }) {
  const pct = Math.round(chance * 100);
  return (
    <div
      className={`cbar${big ? ' big' : ''}`}
      style={{ '--h': chanceHue(chance) } as CSSProperties}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      title={`${label} : ${pct} %`}
    >
      <i style={{ width: `${chance * 100}%` }} />
    </div>
  );
}

interface TileProps {
  rarity: Rarity;
  selected: boolean;
  index: number;
  state?: 'current' | 'target' | 'locked' | 'done';
  onSelect: () => void;
  children: ReactNode;
}

/** Carte sélectionnable de la liste de gauche. La couleur et l'éclat dépendent de la rareté. */
export function Tile({ rarity, selected, index, state, onSelect, children }: TileProps) {
  return (
    <div
      className={`ctile${selected ? ' selected' : ''}${state ? ` ${state}` : ''}`}
      data-rarity={rarity}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Pips rarity={rarity} />
      {children}
    </div>
  );
}

/** Liste de cartes à gauche (2 par ligne), détail fixe à droite, ou consigne (`title`) tant que rien n'est sélectionné. */
export function Split({ title, list, detail }: { title: string; list: ReactNode; detail: ReactNode | null }) {
  const { t } = useTranslation();
  return (
    <div className="career-split">
      <div className="career-main">{list}</div>
      <aside className="career-aside">
        {detail ?? (
          <div className="aside-empty">
            <span className="aside-empty-icon" aria-hidden>☝️</span>
            <strong>{title}</strong>
            <span className="muted small">{t('career.selectHint')}</span>
          </div>
        )}
      </aside>
    </div>
  );
}

/** En-tête du détail : la source en haut à gauche, la rareté en haut à droite, l'intitulé centré en dessous. */
export function DetailHead({ rarity, title, source, subtitle }: { rarity: Rarity; title: string; source?: string; subtitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="detail-head" data-rarity={rarity}>
      <div className="detail-top">
        <span className="detail-source">{source}</span>
        <span className="rarity-label"><Pips rarity={rarity} /> {t(`career.rarity.${rarity}`)}</span>
      </div>
      <h3>{title}</h3>
      {subtitle && <p className="muted small">{subtitle}</p>}
    </div>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

/** Choix parmi quelques valeurs (apport, durée du prêt). */
export function Seg<T extends number | string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="pick-wrap">
      <span className="pick-label">{label}</span>
      <div className="pick" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Pourcentage au choix : un curseur et une saisie au clavier. `value` est un multiple (1 = 100 %) et reste dans [min, max].
 * Pendant la frappe le texte est libre ; il est validé et ramené dans la plage à la sortie du champ.
 */
export function PercentPick({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  const [draft, setDraft] = useState<string | null>(null);
  const lo = Math.round(min * 100);
  const hi = Math.round(max * 100);
  const clampPct = (n: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  const commit = () => {
    const n = Number(draft?.replace(',', '.'));
    if (draft !== null && draft.trim() !== '' && Number.isFinite(n)) onChange(clampPct(n) / 100);
    setDraft(null);
  };
  return (
    <div className="pick-wrap">
      <span className="pick-label">{label}</span>
      <div className="pct-pick">
        <input
          className="tile-slider"
          style={{ '--c': 'var(--accent)', '--fill': `${((pct - lo) / (hi - lo)) * 100}%` } as CSSProperties}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label={label}
        />
        <label className="pct-field">
          <input
            type="text"
            inputMode="numeric"
            value={draft ?? String(pct)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, '').slice(0, 4))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            aria-label={label}
          />
          <span>%</span>
        </label>
      </div>
    </div>
  );
}
