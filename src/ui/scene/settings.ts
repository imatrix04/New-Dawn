import { create } from 'zustand';

/** Préférences du décor animé, persistées à part de la sauvegarde (comme la langue). */
const KEY = 'newdawn-scene';

export const SCENE_LEVELS = ['low', 'normal', 'high'] as const;
export type SceneLevel = (typeof SCENE_LEVELS)[number];

export const SCENE_TIMES = ['auto', 'dawn', 'day', 'dusk', 'night'] as const;
export type SceneTime = (typeof SCENE_TIMES)[number];

export interface ScenePrefs {
  /** Effets animés (lumière, nuages, particules, parallaxe). Désactivés : photo étalonnée, fixe. */
  enabled: boolean;
  /** Intensité : densité des particules et amplitude de la parallaxe. */
  level: SceneLevel;
  /** Moment de la journée : cycle automatique ou moment fixe. */
  time: SceneTime;
}

const DEFAULTS: ScenePrefs = { enabled: true, level: 'normal', time: 'auto' };

function read(): ScenePrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ScenePrefs>;
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULTS.enabled,
      level: SCENE_LEVELS.find((l) => l === saved.level) ?? DEFAULTS.level,
      time: SCENE_TIMES.find((x) => x === saved.time) ?? DEFAULTS.time,
    };
  } catch {
    return DEFAULTS;
  }
}

interface SceneStore extends ScenePrefs {
  set: (patch: Partial<ScenePrefs>) => void;
}

export const useScenePrefs = create<SceneStore>((set, get) => ({
  ...read(),
  set: (patch) => {
    set(patch);
    const { enabled, level, time } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ enabled, level, time })); } catch { /* stockage indisponible */ }
  },
}));
