// Disposition des cartes sur le tableau : ouverture, position, taille et ordre d'empilement.
// C'est une préférence d'affichage du joueur, stockée à part de la partie.
import { create } from 'zustand';

export type WindowId = 'schedule' | 'status' | 'profile' | 'wallet' | 'career' | 'housing' | 'journal';
export const WINDOW_IDS: WindowId[] = ['schedule', 'status', 'profile', 'wallet', 'career', 'housing', 'journal'];
/** Largeur par défaut de chaque carte. */
export const WINDOW_WIDTH: Record<WindowId, number> = {
  schedule: 620, status: 330, profile: 380, wallet: 400, career: 780, housing: 780, journal: 330,
};
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
const STATUS_HEIGHT = 320;
const GAP = 16;

/**
 * Disposition par défaut selon la taille du tableau.
 * Écran large : Emploi du temps | Statut + Journal empilés | Portefeuille.
 * Écran étroit : le Portefeuille est rangé (fermé), on l'ouvre depuis la barre du haut.
 */
export function defaultLayout(boardWidth: number, boardHeight = 600): Layout {
  const size = (id: WindowId) => ({ w: WINDOW_WIDTH[id], h: null });
  const middleX = GAP + WINDOW_WIDTH.schedule + GAP;
  const walletX = middleX + WINDOW_WIDTH.status + GAP;
  const wide = boardWidth >= walletX + WINDOW_WIDTH.wallet + GAP;

  const stackX = wide ? middleX : Math.max(GAP, boardWidth - WINDOW_WIDTH.status - GAP);
  const journalY = GAP + STATUS_HEIGHT + GAP;
  // Le Journal occupe le reste de la colonne, sans dépasser du tableau.
  const journalH = Math.max(MIN_SIZE.h, boardHeight - journalY - GAP);

  return {
    schedule: { open: true, x: GAP, y: GAP, z: 1, ...size('schedule') },
    status: { open: true, x: stackX, y: GAP, z: 2, ...size('status') },
    journal: { open: true, x: stackX, y: journalY, z: 3, ...size('journal'), h: journalH },
    // La carte Carrière se range par défaut : on l'ouvre depuis la barre du haut quand on cherche un poste.
    career: { open: false, x: middleX, y: GAP, z: 5, ...size('career') },
    // Comme la carte Carrière, le Logement s'ouvre à la demande.
    housing: { open: false, x: middleX + 15, y: GAP + 15, z: 7, ...size('housing') },
    profile: { open: false, x: middleX + 30, y: GAP + 30, z: 6, ...size('profile') },
    wallet: {
      open: wide,
      x: wide ? walletX : Math.max(GAP, stackX - WINDOW_WIDTH.wallet - GAP),
      y: GAP,
      z: 4,
      ...size('wallet'),
    },
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
      // Une carte absente de la sauvegarde (ajoutée depuis) reprend sa disposition par défaut.
      if (!w) continue;
      if (typeof w.x !== 'number' || typeof w.y !== 'number' || typeof w.open !== 'boolean') return null;
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
  /** Dernières dimensions mesurées du tableau (mises à jour par `fit`). */
  boardWidth: number;
  boardHeight: number;
  toggle: (id: WindowId) => void;
  close: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  resize: (id: WindowId, w: number, h: number | null) => void;
  /** Disposition par défaut ; sans argument, utilise les dernières dimensions mesurées du tableau. */
  reset: (boardWidth?: number, boardHeight?: number) => void;
  /** Ramène les cartes dans le tableau après un redimensionnement de la fenêtre. */
  fit: (boardWidth: number, boardHeight: number) => void;
}

const initial = readSaved();

export const useLayout = create<LayoutStore>((set) => ({
  windows: initial ?? defaultLayout(1000),
  saved: initial !== null,
  boardWidth: 1000,
  boardHeight: 600,
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
  reset: (boardWidth, boardHeight) =>
    set((s) => ({
      windows: defaultLayout(boardWidth ?? s.boardWidth, boardHeight ?? s.boardHeight),
      saved: true,
    })),
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
      const boardChanged = s.boardWidth !== boardWidth || s.boardHeight !== boardHeight;
      if (!changed && !boardChanged) return s;
      return { windows: changed ? next : s.windows, boardWidth, boardHeight };
    }),
}));

useLayout.subscribe((s) => {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(s.windows));
  } catch {
    /* stockage indisponible */
  }
});
