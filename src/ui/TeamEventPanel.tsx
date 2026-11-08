import { useTranslation } from 'react-i18next';
import { TEAM_EVENT_CHOICES } from '../data/content';
import { eventChoiceOk } from '../game/engine';
import type { GameState } from '../game/types';
import { useStore } from '../store';

/** Événement d'équipe en attente : une fenêtre au premier plan, avec les réactions possibles (les impossibles sont grisées). */
export function TeamEventPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const resolve = useStore((s) => s.resolveTeamEvent);
  const event = game.team?.event;
  if (!game.team || !event) return null;
  const name = (id: string | null) => game.team!.members.find((m) => m.id === id)?.name ?? '';
  const vars = { a: name(event.a), b: name(event.b) };

  return (
    <div className="panel team-event-panel">
      <h2>{t(`team.events.${event.id}.title`)}</h2>
      <p>{t(`team.events.${event.id}.text`, vars)}</p>
      <div className="team-event-choices">
        {Array.from({ length: TEAM_EVENT_CHOICES[event.id] }, (_, i) => (
          <button key={i} className="big-btn secondary" disabled={!eventChoiceOk(game, i)} onClick={() => resolve(i)}>
            {t(`team.events.${event.id}.choices.${i}`, vars)}
          </button>
        ))}
      </div>
      <p className="muted small">{t('team.events.cost')}</p>
    </div>
  );
}
