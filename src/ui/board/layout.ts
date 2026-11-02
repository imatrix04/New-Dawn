// Disposition des cartes sur le tableau : ouverture, position, taille et ordre d'empilement.
// C'est une préférence d'affichage du joueur, stockée à part de la partie.
import { create } from 'zustand';

export type WindowId = 'schedule' | 'status' | 'journal';
export const WINDOW_IDS: WindowId[] = ['schedule', 'status', 'journal'];
/** Largeur par défaut de chaque carte. */
export const WINDOW_WIDTH: Record<WindowId, number> = { schedule: 620, status: 330, journal: 330 };
/** Taille minimale d'une carte redimensionnée. */
export const MIN_SIZE = { w: 260, h: 140 };

export interface WinState {
  open: boolean;
  x: number;
  y: number;
  z: number;
  w: number;
  /** Hauteur choisie par le joueur ; null = hauteur automatique selon le contenu. */
  h: number | null;
}
type Layout = Record<WindowId, WinState>;

const LAYOUT_KEY = 'newdawn-layout-v1';
/** Part minimale d'une carte qui doit rester visible pour pouvoir la rattraper. */
const MIN_VISIBLE = 100;

/** Hauteur approximative de la carte Statut, pour empiler le Journal juste en dessous. */
const STATUS_HEIGHT = 380;

export function defaultLayout(boardWidth: number): Layout {
  const size = (id: WindowId) => ({ w: WINDOW_WIDTH[id], h: null });
  const gap = 16;
  const scheduleRight = gap + WINDOW_WIDTH.schedule;
  const threeColumns = boardWidth >= scheduleRight + gap + WINDOW_WIDTH.status + gap + WINDOW_WIDTH.journal + gap;

  if (threeColumns) {
    // Écran large : trois colonnes côte à côte.
    const statusX = scheduleRight + gap;
    return {
      schedule: { open: true, x: gap, y: gap, z: 1, ...size('schedule') },
      status: { open: true, x: statusX, y: gap, z: 2, ...size('status') },
      journal: { open: true, x: statusX + WINDOW_WIDTH.status + gap, y: gap, z: 3, ...size('journal') },
    };
  }
  // Écran plus étroit : Statut et Journal empilés à droite.
  const right = Math.max(gap, boardWidth - WINDOW_WIDTH.status - gap);
  return {
    schedule: { open: true, x: gap, y: gap, z: 1, ...size('schedule') },
    status: { open: true, x: right, y: gap, z: 2, ...size('status') },
    journal: { open: true, x: right, y: gap + STATUS_HEIGHT + gap, z: 3, ...size('journal') },
  };
}

function readSaved(): Layout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<WindowId, Partial<WinState>>>;
    const base = defaultLayout(1000);
    const layout = { ...base };
    for (const id of WINDOW_IDS) {
      const w = parsed[id];
      if (!w || typeof w.x !== 'number' || typeof w.y !== 'number' || typeof w.open !== 'boolean') return null;
      // Les sauvegardes d'avant le redimensionnement n'ont ni largeur ni hauteur.
      layout[id] = {
        ...base[id],
        ...w,
        w: typeof w.w === 'number' ? w.w : base[id].w,
        h: typeof w.h === 'number' ? w.h : null,
      } as WinState;
    }
    return layout;
  } catch {
    return null;
  }
}

const topZ = (w: Layout) => Math.max(...WINDOW_IDS.map((id) => w[id].z));

interface LayoutStore {
  windows: Layout;
  /** Vrai si la disposition vient d'une sauvegarde (sinon on la calcule selon la taille du tableau). */
  saved: boolean;
  /** Dernière largeur mesurée du tableau (mise à jour par `fit`). */
  boardWidth: number;
  toggle: (id: WindowId) => void;
  close: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  resize: (id: WindowId, w: number, h: number | null) => void;
  /** Disposition par défaut ; sans argument, utilise la dernière largeur mesurée du tableau. */
  reset: (boardWidth?: number) => void;
  /** Ramène les cartes dans le tableau après un redimensionnement de la fenêtre. */
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
  resize: (id, w, h) => set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], w, h } } })),
  reset: (boardWidth) => set((s) => ({ windows: defaultLayout(boardWidth ?? s.boardWidth), saved: true })),
  fit: (boardWidth, boardHeight) =>
    set((s) => {
      const next = { ...s.windows };
      let changed = false;
      for (const id of WINDOW_IDS) {
        const win = s.windows[id];
        const w = Math.min(win.w, Math.max(MIN_SIZE.w, boardWidth - 16));
        const h = win.h === null ? null : Math.min(win.h, Math.max(MIN_SIZE.h, boardHeight - 16));
        const x = Math.min(boardWidth - MIN_VISIBLE, Math.max(MIN_VISIBLE - w, win.x));
        const y = Math.min(boardHeight - 48, Math.max(0, win.y));
        if (w !== win.w || h !== win.h || x !== win.x || y !== win.y) {
          next[id] = { ...win, x, y, w, h };
          changed = true;
        }
      }
      const boardChanged = s.boardWidth !== boardWidth;
      if (!changed && !boardChanged) return s;
      return { windows: changed ? next : s.windows, boardWidth };
    }),
}));

useLayout.subscribe((s) => {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(s.windows));
  } catch {
    /* stockage indisponible */
  }
});
