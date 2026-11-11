import type { SceneTime } from './settings';

export type Rgb = readonly [number, number, number];

/** Ambiance lumineuse à une heure donnée. Les couleurs sont interpolées d'un repère au suivant. */
interface LightKey {
  hour: number;
  /** Teinte générale, appliquée en `multiply` : blanc = aucune modification. */
  mul: Rgb;
  /** Voile coloré en `soft-light` et son opacité. */
  wash: Rgb;
  washA: number;
  /** 0 = jour, 1 = pleine nuit : lueur des zones claires, lucioles. */
  night: number;
  /** Voile posé sur le ciel (zones lointaines et claires) et son opacité. */
  sky: Rgb;
  skyA: number;
  cloud: Rgb;
}

const NIGHT: Omit<LightKey, 'hour'> = { mul: [108, 124, 188], wash: [64, 84, 170], washA: .5, night: 1, sky: [16, 22, 54], skyA: .86, cloud: [84, 98, 150] };
const DAY: Omit<LightKey, 'hour'> = { mul: [255, 255, 255], wash: [255, 244, 224], washA: 0, night: 0, sky: [150, 200, 250], skyA: .34, cloud: [255, 255, 255] };

const KEYS: LightKey[] = [
  { hour: 0, ...NIGHT },
  { hour: 5, ...NIGHT },
  { hour: 6.5, mul: [255, 208, 164], wash: [255, 186, 104], washA: .55, night: .18, sky: [255, 190, 136], skyA: .36, cloud: [255, 222, 196] }, // aube dorée
  { hour: 9, ...DAY },
  { hour: 17, ...DAY },
  { hour: 19.5, mul: [255, 204, 180], wash: [255, 128, 112], washA: .5, night: .22, sky: [255, 168, 128], skyA: .3, cloud: [255, 196, 178] }, // soir rose orangé
  { hour: 21, mul: [168, 148, 204], wash: [120, 88, 176], washA: .5, night: .7, sky: [58, 40, 96], skyA: .78, cloud: [156, 126, 178] }, // crépuscule
  { hour: 22.5, ...NIGHT },
  { hour: 24, ...NIGHT },
];

/** Heure à laquelle la journée commence à chaque nouveau mois : juste avant l'aube dorée. */
export const START_HOUR = 6;
/** Durée réelle d'une journée complète du cycle automatique, en secondes. */
export const DAY_SECONDS = 8 * 60;

const FIXED_HOURS: Record<Exclude<SceneTime, 'auto'>, number> = { dawn: 6.5, day: 13, dusk: 19.5, night: 0 };

/** Heure affichée : celle du cycle en automatique, sinon le moment fixé par le réglage. */
export const hourOf = (time: SceneTime, clock: number): number => (time === 'auto' ? clock : FIXED_HOURS[time]);

/** Ambiance interpolée à un instant donné (couleurs en 0-255). */
export interface Light {
  mul: Rgb;
  wash: Rgb;
  washA: number;
  night: number;
  sky: Rgb;
  skyA: number;
  cloud: Rgb;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Mélange de deux ambiances : `t` = 0 donne `a`, 1 donne `b`. */
export const mixLight = (a: Light, b: Light, t: number): Light => ({
  mul: mixRgb(a.mul, b.mul, t),
  wash: mixRgb(a.wash, b.wash, t),
  washA: mix(a.washA, b.washA, t),
  night: mix(a.night, b.night, t),
  sky: mixRgb(a.sky, b.sky, t),
  skyA: mix(a.skyA, b.skyA, t),
  cloud: mixRgb(a.cloud, b.cloud, t),
});

/** Écart maximal entre deux ambiances, ramené à 0-1 : sert à savoir si une transition est terminée. */
export function lightGap(a: Light, b: Light): number {
  let gap = Math.max(Math.abs(a.washA - b.washA), Math.abs(a.night - b.night), Math.abs(a.skyA - b.skyA));
  for (const key of ['mul', 'wash', 'sky', 'cloud'] as const) for (let i = 0; i < 3; i++) gap = Math.max(gap, Math.abs(a[key][i] - b[key][i]) / 255);
  return gap;
}

/** Ambiance lumineuse à l'heure donnée (0 à 24). */
export function lightAt(hour: number): Light {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].hour <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const x = (h - a.hour) / (b.hour - a.hour);
  return mixLight(a, b, x * x * (3 - 2 * x));
}

/** Couleur CSS d'un triplet 0-255. */
export const css = (c: Rgb, alpha = 1) => `rgb(${c[0].toFixed(1)} ${c[1].toFixed(1)} ${c[2].toFixed(1)} / ${alpha.toFixed(3)})`;

/** Rendu en calques CSS : écrit l'ambiance dans les variables `--tod-*` du décor, les transitions CSS font le fondu. */
export function applyLight(el: HTMLElement, light: Light): void {
  el.style.setProperty('--tod-mul', css(light.mul));
  el.style.setProperty('--tod-wash', css(light.wash, light.washA));
  el.style.setProperty('--tod-night', light.night.toFixed(3));
}
