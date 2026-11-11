import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Area, GameState, Home } from '../game/types';
import { Board } from './board/Board';
import { BoardWindow } from './board/BoardWindow';
import { CareerCard } from './CareerCard';
import { EventPanel } from './EventPanel';
import { Hud } from './Hud';
import { MonthSplash } from './MonthSplash';
import { ReportPanel } from './ReportPanel';
import { HousingCard } from './HousingCard';
import { JobDecisionPanel } from './JobDecisionPanel';
import { PromotionPanel } from './PromotionPanel';
import { TeamEventPanel } from './TeamEventPanel';
import { TeamReportPanel } from './TeamReportPanel';
import { LogPanel } from './LogPanel';
import { MarketCard } from './MarketCard';
import { PauseMenu } from './PauseMenu';
import { ProfileCard } from './ProfileCard';
import { SceneBackground } from './SceneBackground';
import { SchedulePanel } from './SchedulePanel';
import { TeamCard } from './TeamCard';
import { useLayout } from './board/layout';
import { DevCheats } from './DevCheats';
import { TopBar } from './TopBar';
import { WalletCard } from './WalletCard';

const SCENE_FILES = import.meta.glob<string>('../asset/image/background/*.jpg', { eager: true, query: '?url', import: 'default' });
/** Cartes de profondeur `<quartier>_<logement>_depth.png`, générées par `tools/make_depth.py`. */
const DEPTH_FILES = import.meta.glob<string>('../asset/image/background/*_depth.png', { eager: true, query: '?url', import: 'default' });

/** Préfixes des fichiers `<quartier>_<logement>_image.jpg` : quartier (Area) et logement (typeId). */
const SCENE_AREA: Partial<Record<Area, string>> = { center: 'centre-ville', suburb: 'banlieue', country: 'campagne' };
const SCENE_HOME: Record<string, string> = {
  shared: 'colocation', studio: 'studio', t2: 'T2', t3: 'T3',
  cottage: 'cottage', duplex: 'duplex', family: 'maison_familiale', penthouse: 'penthouse', bigHouse: 'grosse-maison',
};

/** Photo de fond (et sa carte de profondeur, si elle existe) selon le logement et son quartier ; sans photo, l'ardoise par défaut. */
function sceneOf(home: Home): { photo: string; depth?: string } | undefined {
  const area = SCENE_AREA[home.area];
  const type = SCENE_HOME[home.typeId];
  if (!area || !type) return undefined;
  const base = `../asset/image/background/${area}_${type}`;
  const photo = SCENE_FILES[`${base}_image.jpg`];
  return photo ? { photo, depth: DEPTH_FILES[`${base}_depth.png`] } : undefined;
}

export function GameScreen({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const scene = sceneOf(game.home);

  // La carte Équipe s'ouvre toute seule quand le joueur prend la tête d'une équipe (pas au chargement d'une sauvegarde), et se range quand il la quitte.
  const hasTeam = !!game.team;
  const hadTeam = useRef(hasTeam);
  useEffect(() => {
    const layout = useLayout.getState();
    if (hasTeam && !hadTeam.current) layout.open('team');
    if (!hasTeam) layout.close('team');
    hadTeam.current = hasTeam;
  }, [hasTeam]);

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
      {scene && <SceneBackground photo={scene.photo} depth={scene.depth} month={game.month} paused={paused} />}
      <Hud game={game} onPause={() => setPaused(true)} />
      <Board>
        <BoardWindow id="schedule" title={t('windows.schedule')}>
          <SchedulePanel game={game} />
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
        {game.team && (
          <BoardWindow id="team" title={t('windows.team')}>
            <TeamCard game={game} />
          </BoardWindow>
        )}
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
      <MonthSplash game={game} />
      {import.meta.env.DEV && <DevCheats />}

      {/* Les réponses aux candidatures passent avant l'évènement du mois. */}
      {(game.jobDecision || game.promotion || game.report || game.teamReport || game.team?.event || game.pendingEvent) && (
        <div className="overlay">
          <div className="modal-pop">
            {game.jobDecision ? <JobDecisionPanel game={game} /> : game.promotion ? <PromotionPanel game={game} /> : game.report ? <ReportPanel report={game.report} /> : game.teamReport ? <TeamReportPanel report={game.teamReport} director={game.team?.level === 'director'} /> : game.team?.event ? <TeamEventPanel game={game} /> : <EventPanel game={game} />}
          </div>
        </div>
      )}
      {paused && <PauseMenu onResume={() => setPaused(false)} />}
    </section>
  );
}
