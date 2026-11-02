import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../game/types';
import { Board } from './board/Board';
import { BoardWindow } from './board/BoardWindow';
import { EventPanel } from './EventPanel';
import { LogPanel } from './LogPanel';
import { PauseMenu } from './PauseMenu';
import { SchedulePanel } from './SchedulePanel';
import { StatusCard } from './StatusCard';
import { TopBar } from './TopBar';
import { WalletCard } from './WalletCard';

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
        <BoardWindow id="schedule" title={t('windows.schedule')}>
          <SchedulePanel game={game} />
        </BoardWindow>
        <BoardWindow id="status" title={t('windows.status')}>
          <StatusCard game={game} />
        </BoardWindow>
        <BoardWindow id="wallet" title={t('windows.wallet')}>
          <WalletCard game={game} />
        </BoardWindow>
        <BoardWindow id="journal" title={t('windows.journal')}>
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
