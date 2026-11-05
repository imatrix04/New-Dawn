import { useState } from 'react';
import { useStore } from '../store';

const KEY = 'newdawn-dev-open';
const readOpen = (): boolean => {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
};

const AMOUNTS = [1000, 10000, 100000, 1000000];

/** Outils de test, affichés uniquement en mode dev (npm run dev) : jamais dans une version construite. */
export function DevCheats() {
  const { devGiveMoney } = useStore();
  const [custom, setCustom] = useState('');
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    setOpen(!open);
    try { localStorage.setItem(KEY, open ? '0' : '1'); } catch { /* sans stockage : l'état ne persiste pas */ }
  };
  const amount = Number(custom);

  return (
    <div className="dev-cheats" role="group" aria-label="Dev">
      <button className="dev-toggle" onClick={toggle} aria-expanded={open} title={open ? 'Replier' : 'Déplier'}>
        <strong>DEV</strong> {open ? '▾' : '▸'}
      </button>
      {open && AMOUNTS.map((n) => (
        <button key={n} onClick={() => devGiveMoney(n)}>+{n.toLocaleString('fr-FR')} €</button>
      ))}
      {open && <input
        type="number"
        value={custom}
        placeholder="Montant"
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && Number.isFinite(amount) && amount !== 0) devGiveMoney(amount); }}
      />}
      {open && <button disabled={!Number.isFinite(amount) || amount === 0} onClick={() => devGiveMoney(amount)}>OK</button>}
    </div>
  );
}
