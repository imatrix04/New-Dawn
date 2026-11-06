import { create } from 'zustand';
import {
  buyHome, closePel, createGame, depositSavings, dropTraining, endTurn, enrollTraining, letProperty, migrateGame, moveToProperty,
  openSavings, quitJob, requestPromotion, resolveChoice, resolveJobDecision, resolvePromotion, sellProperty, setGig, setHousingTarget, setSchedule, toggleApplication,
  withdrawProperty, withdrawSavings,
  buyVehicle, sellVehicle, setDrivingStyle, setDrivingVehicle, startRepair, takeInspection,
  answerRaiseOffer, dismissReport, requestRaise, setWorkStyle,
} from './game/engine';
import type { VehicleSource } from './game/engine';
import type { WorkStyle } from './data/content';
import type { DrivingStyle, GameState, LeaveAction, Profile, RepairKind, SavingsProduct, ScheduleKey } from './game/types';

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
  toggleApplication: (id: string) => void;
  resolveJobDecision: (jobId: string | null) => void;
  resolvePromotion: (accept: boolean) => void;
  requestPromotion: () => void;
  requestRaise: (pct: number) => void;
  setWorkStyle: (style: WorkStyle) => void;
  answerRaiseOffer: (accept: boolean) => void;
  dismissReport: () => void;
  quitJob: () => void;
  setGig: (id: string | null) => void;
  setHousingTarget: (id: string | null, leave?: LeaveAction) => void;
  buyHome: (id: string, downPct: number, years: number, live?: boolean, leave?: LeaveAction) => void;
  letProperty: (id: string, factor: number) => void;
  sellProperty: (id: string, factor: number) => void;
  withdrawProperty: (id: string) => void;
  moveToProperty: (id: string, leave?: LeaveAction) => void;
  enrollTraining: (id: string) => void;
  dropTraining: () => void;
  buyVehicle: (source: VehicleSource) => void;
  sellVehicle: (id: string) => void;
  setDrivingStyle: (style: DrivingStyle) => void;
  setDrivingVehicle: (id: string) => void;
  startRepair: (id: string, kind: RepairKind, diy: boolean) => void;
  takeInspection: (id: string) => void;
  openSavings: (product: SavingsProduct) => void;
  deposit: (product: SavingsProduct, amount: number) => void;
  withdraw: (product: SavingsProduct, amount: number) => void;
  closePel: () => void;
  /** Triche de développement : ajoute (ou retire) de l'argent. Sans effet hors mode dev. */
  devGiveMoney: (amount: number) => void;
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
    toggleApplication: (id) => { const g = get().game; if (g) update(toggleApplication(g, id)); },
    resolveJobDecision: (jobId) => { const g = get().game; if (g) update(resolveJobDecision(g, jobId)); },
    resolvePromotion: (accept) => { const g = get().game; if (g) update(resolvePromotion(g, accept)); },
    requestPromotion: () => { const g = get().game; if (g) update(requestPromotion(g)); },
    setWorkStyle: (style) => { const g = get().game; if (g) update(setWorkStyle(g, style)); },
    requestRaise: (pct) => { const g = get().game; if (g) update(requestRaise(g, pct)); },
    answerRaiseOffer: (accept) => { const g = get().game; if (g) update(answerRaiseOffer(g, accept)); },
    dismissReport: () => { const g = get().game; if (g) update(dismissReport(g)); },
    quitJob: () => { const g = get().game; if (g) update(quitJob(g)); },
    setGig: (id) => { const g = get().game; if (g) update(setGig(g, id)); },
    setHousingTarget: (id, leave) => { const g = get().game; if (g) update(setHousingTarget(g, id, leave)); },
    buyHome: (id, downPct, years, live, leave) => { const g = get().game; if (g) update(buyHome(g, id, downPct, years, live, leave)); },
    letProperty: (id, factor) => { const g = get().game; if (g) update(letProperty(g, id, factor)); },
    sellProperty: (id, factor) => { const g = get().game; if (g) update(sellProperty(g, id, factor)); },
    withdrawProperty: (id) => { const g = get().game; if (g) update(withdrawProperty(g, id)); },
    devGiveMoney: (amount) => {
      const g = get().game;
      if (import.meta.env.DEV && g) update({ ...g, money: g.money + amount });
    },
    moveToProperty: (id, leave) => { const g = get().game; if (g) update(moveToProperty(g, id, leave)); },
    enrollTraining: (id) => { const g = get().game; if (g) update(enrollTraining(g, id)); },
    dropTraining: () => { const g = get().game; if (g) update(dropTraining(g)); },
    buyVehicle: (source) => { const g = get().game; if (g) update(buyVehicle(g, source)); },
    sellVehicle: (id) => { const g = get().game; if (g) update(sellVehicle(g, id)); },
    setDrivingStyle: (style) => { const g = get().game; if (g) update(setDrivingStyle(g, style)); },
    setDrivingVehicle: (id) => { const g = get().game; if (g) update(setDrivingVehicle(g, id)); },
    startRepair: (id, kind, diy) => { const g = get().game; if (g) update(startRepair(g, id, kind, diy)); },
    takeInspection: (id) => { const g = get().game; if (g) update(takeInspection(g, id)); },
    openSavings: (product) => { const g = get().game; if (g) update(openSavings(g, product)); },
    deposit: (product, amount) => { const g = get().game; if (g) update(depositSavings(g, product, amount)); },
    withdraw: (product, amount) => { const g = get().game; if (g) update(withdrawSavings(g, product, amount)); },
    closePel: () => { const g = get().game; if (g) update(closePel(g)); },
    save: () => writeSave(get().game),
    quit: () => set({ game: null, screen: 'menu', hasSave: readSave() !== null }),
  };
});
