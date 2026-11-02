import { create } from 'zustand';
import { createGame, endTurn, resolveChoice, setSchedule } from './game/engine';
import type { GameState, Profile, ScheduleKey } from './game/types';

const SAVE_KEY = 'newdawn-save-v5';

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
  setSchedule: (key: ScheduleKey, value: number) => void;
  endTurn: () => void;
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
    setSchedule: (key, value) => { const g = get().game; if (g) update(setSchedule(g, key, value)); },
    endTurn: () => { const g = get().game; if (g) update(endTurn(g)); },
    choose: (index) => { const g = get().game; if (g) update(resolveChoice(g, index)); },
    save: () => writeSave(get().game),
    quit: () => set({ game: null, screen: 'menu', hasSave: readSave() !== null }),
  };
});
