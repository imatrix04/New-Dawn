import { useTranslation } from 'react-i18next';
import { eventById } from '../data/events';
import type { GameState } from '../game/types';
import { useStore } from '../store';

export function EventPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const choose = useStore((s) => s.choose);
  const event = eventById(game.pendingEvent);
  if (!event) return null;

  return (
    <div className="panel">
      <h2>{t(`events.${event.id}.title`)}</h2>
      <p>{t(`events.${event.id}.text`)}</p>
      <div className="choices">
        {event.choices.map((_, i) => (
          <button key={i} onClick={() => choose(i)}>{t(`events.${event.id}.choices.${i}`)}</button>
        ))}
      </div>
    </div>
  );
}
