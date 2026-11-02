import { useTranslation } from 'react-i18next';
import { actionTextId, availableActions } from '../game/engine';
import type { GameState } from '../game/types';
import { useStore } from '../store';

export function ActionPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const act = useStore((s) => s.act);
  return (
    <div className="panel">
      <h2>{t('game.actionsTitle')}</h2>
      <div className="choices">
        {availableActions(game).map((a) => {
          const textId = actionTextId(game, a);
          return (
            <button key={a.id} onClick={() => act(a.id)}>
              {t(`actions.${textId}.label`)}
              <small>{t(`actions.${textId}.hint`)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
