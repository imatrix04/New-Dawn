import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../game/types';
import { Board } from './board/Board';
import { BoardWindow } from './board/BoardWindow';
import { WINDOW_WIDTH } from './board/layout';
import { EventPanel } from './EventPanel';
import { LogPanel } from './LogPanel';
import { PauseMenu } from './PauseMenu';
import { SchedulePanel } from './SchedulePanel';
import { StatusCard } from './StatusCard';
import { TopBar } from './TopBar';

export function GameScreen({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);

  // Échap ouvre / ferme le menu pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="screen wide game-screen">
      <TopBar game={game} onPause={() => setPaused(true)} />

      <Board>
        <BoardWindow id="schedule" title={t('windows.schedule')} width={WINDOW_WIDTH.schedule}>
          <SchedulePanel game={game} />
        </BoardWindow>
        <BoardWindow id="status" title={t('windows.status')} width={WINDOW_WIDTH.status}>
          <StatusCard game={game} />
        </BoardWindow>
        <BoardWindow id="journal" title={t('windows.journal')} width={WINDOW_WIDTH.journal}>
          <LogPanel log={game.log} />
        </BoardWindow>
      </Board>

      {game.pendingEvent && (
        <div className="overlay">
          <div className="modal-pop">
            <EventPanel game={game} />
          </div>
        </div>
      )}
      {paused && <PauseMenu onResume={() => setPaused(false)} />}
    </section>
  );
}
