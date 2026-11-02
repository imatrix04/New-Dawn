// Disposition des cartes sur le tableau : ouverture, position et ordre d'empilement.
// C'est une préférence d'affichage du joueur, stockée à part de la partie.
import { create } from 'zustand';

export type WindowId = 'schedule' | 'status' | 'journal';
export const WINDOW_IDS: WindowId[] = ['schedule', 'status', 'journal'];
export const WINDOW_WIDTH: Record<WindowId, number> = { schedule: 620, status: 330, journal: 330 };

export interface WinState {
  open: boolean;
  x: number;
  y: number;
  z: number;
}
type Layout = Record<WindowId, WinState>;

const LAYOUT_KEY = 'newdawn-layout-v1';
/** Part minimale d'une carte qui doit rester visible pour pouvoir la rattraper. */
const MIN_VISIBLE = 100;

export function defaultLayout(boardWidth: number): Layout {
  const right = Math.max(16, boardWidth - WINDOW_WIDTH.status - 16);
  return {
    schedule: { open: true, x: 16, y: 16, z: 1 },
    status: { open: true, x: right, y: 16, z: 2 },
    journal: { open: true, x: right, y: 290, z: 3 },
  };
}

function readSaved(): Layout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Layout>;
    const valid = WINDOW_IDS.every((id) => {
      const w = parsed[id];
      return w && typeof w.x === 'number' && typeof w.y === 'number' && typeof w.open === 'boolean';
    });
    return valid ? (parsed as Layout) : null;
  } catch {
    return null;
  }
}

const topZ = (w: Layout) => Math.max(...WINDOW_IDS.map((id) => w[id].z));

interface LayoutStore {
  windows: Layout;
  /** Vrai si la disposition vient d'une sauvegarde (sinon on la calcule selon la taille du tableau). */
  saved: boolean;
  toggle: (id: WindowId) => void;
  close: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  /** Disposition par défaut ; sans argument, utilise la dernière largeur mesurée du tableau. */
  reset: (boardWidth?: number) => void;
  /** Dernière largeur mesurée du tableau (mise à jour par `fit`). */
  boardWidth: number;
  /** Ramène les cartes dans le tableau après un redimensionnement. */
  fit: (boardWidth: number, boardHeight: number) => void;
}

const initial = readSaved();

export const useLayout = create<LayoutStore>((set) => ({
  windows: initial ?? defaultLayout(1000),
  saved: initial !== null,
  boardWidth: 1000,
  toggle: (id) =>
    set((s) => {
      const w = s.windows[id];
      const z = w.open ? w.z : topZ(s.windows) + 1; // une carte qui s'ouvre passe au premier plan
      return { windows: { ...s.windows, [id]: { ...w, open: !w.open, z } } };
    }),
  close: (id) => set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], open: false } } })),
  focus: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (w.z === topZ(s.windows)) return s;
      return { windows: { ...s.windows, [id]: { ...w, z: topZ(s.windows) + 1 } } };
    }),
  move: (id, x, y) => set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], x, y } } })),
  reset: (boardWidth) => set((s) => ({ windows: defaultLayout(boardWidth ?? s.boardWidth), saved: true })),
  fit: (boardWidth, boardHeight) =>
    set((s) => {
      if (s.boardWidth !== boardWidth) s = { ...s, boardWidth };
      const next = { ...s.windows };
      let changed = false;
      for (const id of WINDOW_IDS) {
        const w = s.windows[id];
        const x = Math.min(boardWidth - MIN_VISIBLE, Math.max(MIN_VISIBLE - WINDOW_WIDTH[id], w.x));
        const y = Math.min(boardHeight - 48, Math.max(0, w.y));
        if (x !== w.x || y !== w.y) {
          next[id] = { ...w, x, y };
          changed = true;
        }
      }
      return changed ? { windows: next, boardWidth } : s;
    }),
}));

useLayout.subscribe((s) => {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(s.windows));
  } catch {
    /* stockage indisponible */
  }
});
