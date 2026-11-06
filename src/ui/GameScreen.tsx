import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Area, GameState, Home } from '../game/types';
import { Board } from './board/Board';
import { BoardWindow } from './board/BoardWindow';
import { CareerCard } from './CareerCard';
import { EventPanel } from './EventPanel';
import { Hud } from './Hud';
import { ReportPanel } from './ReportPanel';
import { HousingCard } from './HousingCard';
import { JobDecisionPanel } from './JobDecisionPanel';
import { PromotionPanel } from './PromotionPanel';
import { LogPanel } from './LogPanel';
import { MarketCard } from './MarketCard';
import { PauseMenu } from './PauseMenu';
import { ProfileCard } from './ProfileCard';
import { SchedulePanel } from './SchedulePanel';
import { StatusCard } from './StatusCard';
import { DevCheats } from './DevCheats';
import { TopBar } from './TopBar';
import { WalletCard } from './WalletCard';

const SCENE_FILES = import.meta.glob<string>('../asset/image/background/*.jpg', { eager: true, query: '?url', import: 'default' });

/** Préfixes des fichiers `<quartier>_<logement>_image.jpg` : quartier (Area) et logement (typeId). */
const SCENE_AREA: Partial<Record<Area, string>> = { center: 'centre-ville', suburb: 'banlieue', country: 'campagne' };
const SCENE_HOME: Record<string, string> = {
  shared: 'colocation', studio: 'studio', t2: 'T2', t3: 'T3',
  cottage: 'cottage', duplex: 'duplex', family: 'maison_familiale', penthouse: 'penthouse', bigHouse: 'grosse-maison',
};

/** Image de fond selon le logement et son quartier ; sans image, l'ardoise par défaut. */
function sceneOf(home: Home): string | undefined {
  const area = SCENE_AREA[home.area];
  const type = SCENE_HOME[home.typeId];
  return area && type ? SCENE_FILES[`../asset/image/background/${area}_${type}_image.jpg`] : undefined;
}

export function GameScreen({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const scene = sceneOf(game.home);

  // Échap ouvre / ferme le menu pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section
      className={`screen wide game-screen${scene ? ' has-scene' : ''}`}
      style={scene ? { '--scene': `url("${scene}")` } as CSSProperties : undefined}
    >
      <Hud game={game} onPause={() => setPaused(true)} />
      <Board>
        <BoardWindow id="schedule" title={t('windows.schedule')}>
          <SchedulePanel game={game} />
        </BoardWindow>
        <BoardWindow id="status" title={t('windows.status')}>
          <StatusCard game={game} />
        </BoardWindow>
        <BoardWindow id="profile" title={t('windows.profile')}>
          <ProfileCard game={game} />
        </BoardWindow>
        <BoardWindow id="wallet" title={t('windows.wallet')}>
          <WalletCard game={game} />
        </BoardWindow>
        <BoardWindow id="career" title={t('windows.career')}>
          <CareerCard game={game} />
        </BoardWindow>
        <BoardWindow id="housing" title={t('windows.housing')}>
          <HousingCard game={game} />
        </BoardWindow>
        <BoardWindow id="market" title={t('windows.market')}>
          <MarketCard game={game} />
        </BoardWindow>
        <BoardWindow id="journal" title={t('windows.journal')}>
          <LogPanel log={game.log} />
        </BoardWindow>
      </Board>

      <TopBar />
      {import.meta.env.DEV && <DevCheats />}

      {/* Les réponses aux candidatures passent avant l'évènement du mois. */}
      {(game.jobDecision || game.promotion || game.report || game.pendingEvent) && (
        <div className="overlay">
          <div className="modal-pop">
            {game.jobDecision ? <JobDecisionPanel game={game} /> : game.promotion ? <PromotionPanel game={game} /> : game.report ? <ReportPanel report={game.report} /> : <EventPanel game={game} />}
          </div>
        </div>
      )}
      {paused && <PauseMenu onResume={() => setPaused(false)} />}
    </section>
  );
}
