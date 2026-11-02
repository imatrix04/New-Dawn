import { CreateScreen } from './ui/CreateScreen';
import { GameScreen } from './ui/GameScreen';
import { MenuScreen } from './ui/MenuScreen';
import { OverScreen } from './ui/OverScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { useStore } from './store';

export function App() {
  const { screen, game } = useStore();

  let content;
  if (screen === 'game' && game) content = game.over ? <OverScreen game={game} /> : <GameScreen game={game} />;
  else if (screen === 'create') content = <CreateScreen />;
  else if (screen === 'settings') content = <SettingsScreen />;
  else content = <MenuScreen />;

  return <main id="app">{content}</main>;
}
