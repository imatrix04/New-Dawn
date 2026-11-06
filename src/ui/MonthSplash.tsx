import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../game/types';
import { formatAge, formatDate } from '../i18n/format';
import { SeasonIcon, useSeason } from './Season';

const SHOW_MS = 2400;

/** Transition de mois : le soleil se lève derrière la date, un instant, quand on passe au mois suivant (pas au chargement). */
export function MonthSplash({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const previous = useRef(game.month);
  const [shown, setShown] = useState<{ month: number; id: number } | null>(null);
  const season = useSeason(shown?.month ?? game.month);

  useEffect(() => {
    if (game.month === previous.current) return;
    const advanced = game.month > previous.current;
    previous.current = game.month;
    if (!advanced) return;
    const id = Date.now();
    setShown({ month: game.month, id });
    const timer = setTimeout(() => setShown((s) => (s?.id === id ? null : s)), SHOW_MS);
    return () => clearTimeout(timer);
  }, [game.month]);

  if (!shown) return null;
  const date = formatDate(shown.month, i18n.language);
  const cut = date.lastIndexOf(' ');

  return (
    <div className={`month-splash season-${season.id}`} key={shown.id} aria-hidden>
      <div className="splash-sun" />
      <div className="splash-date"><span>{date.slice(0, cut)}</span> <b>{date.slice(cut + 1)}</b></div>
      <p className="splash-meta"><SeasonIcon month={shown.month} size={18} /> {season.label} · {formatAge(t, shown.month)}</p>
      {game.report && <p className="splash-note">{t('splash.report', { year: game.report.year })}</p>}
    </div>
  );
}
