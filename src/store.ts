import { create } from 'zustand';
import { createGame, performAction, resolveChoice } from './game/engine';
import type { ActionId, GameState, Profile } from './game/types';

const SAVE_KEY = 'newdawn-save-v4';

export type Screen = 'menu' | 'create' | 'settings' | 'game';

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function writeSave(game: GameState | null) {
  try {
    if (game && !game.over) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* stockage indisponible */
  }
}

interface Store {
  screen: Screen;
  game: GameState | null;
  hasSave: boolean;
  go: (screen: Screen) => void;
  start: (profile: Profile) => void;
  loadSave: () => void;
  act: (id: ActionId) => void;
  choose: (index: number) => void;
  save: () => void;
  /** Retour au menu principal (la partie est déjà sauvegardée à chaque action). */
  quit: () => void;
}

export const useStore = create<Store>((set, get) => {
  const update = (game: GameState) => {
    writeSave(game);
    set({ game, hasSave: !game.over });
  };

  return {
    screen: 'menu',
    game: null,
    hasSave: readSave() !== null,
    go: (screen) => set({ screen }),
    start: (profile) => {
      update(createGame(profile));
      set({ screen: 'game' });
    },
    loadSave: () => {
      const game = readSave();
      if (game) set({ game, screen: 'game' });
    },
    act: (id) => { const g = get().game; if (g) update(performAction(g, id)); },
    choose: (index) => { const g = get().game; if (g) update(resolveChoice(g, index)); },
    save: () => writeSave(get().game),
    quit: () => set({ game: null, screen: 'menu', hasSave: readSave() !== null }),
  };
});
