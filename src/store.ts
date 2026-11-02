import { create } from 'zustand';
import {
  closePel, createGame, depositSavings, dropTraining, endTurn, enrollTraining, migrateGame, openSavings,
  resolveChoice, setJobTarget, setSchedule, withdrawSavings,
} from './game/engine';
import type { GameState, Profile, SavingsProduct, ScheduleKey } from './game/types';

const SAVE_KEY = 'newdawn-save-v5';

export type Screen = 'menu' | 'create' | 'settings' | 'game';

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateGame(JSON.parse(raw) as GameState); // sauvegardes d'une version antérieure
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
  setJobTarget: (id: string | null) => void;
  enrollTraining: (id: string) => void;
  dropTraining: () => void;
  openSavings: (product: SavingsProduct) => void;
  deposit: (product: SavingsProduct, amount: number) => void;
  withdraw: (product: SavingsProduct, amount: number) => void;
  closePel: () => void;
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
    setJobTarget: (id) => { const g = get().game; if (g) update(setJobTarget(g, id)); },
    enrollTraining: (id) => { const g = get().game; if (g) update(enrollTraining(g, id)); },
    dropTraining: () => { const g = get().game; if (g) update(dropTraining(g)); },
    openSavings: (product) => { const g = get().game; if (g) update(openSavings(g, product)); },
    deposit: (product, amount) => { const g = get().game; if (g) update(depositSavings(g, product, amount)); },
    withdraw: (product, amount) => { const g = get().game; if (g) update(withdrawSavings(g, product, amount)); },
    closePel: () => { const g = get().game; if (g) update(closePel(g)); },
    save: () => writeSave(get().game),
    quit: () => set({ game: null, screen: 'menu', hasSave: readSave() !== null }),
  };
});
