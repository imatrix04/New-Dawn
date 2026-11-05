// Outils internes partagés par tous les modules du moteur (mutent un état déjà cloné).
import { DEBT_LIMIT, PRICE_VARIATION, SKILL_MAX, SKILLS } from '../../data/content';
import type { Fx, GameState, LogClass, LogEntry } from '../types';

export const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/** `jobStart` d'un poste occupé depuis longtemps : plus de période d'essai. */
export const NO_PROBATION = -1000;

/** Écart de prix aléatoire, de -10 % à +10 %. */
export const rollFactor = (): number => Math.round((Math.random() * 2 - 1) * PRICE_VARIATION * 100) / 100;

export const withFactor = (base: number, factor: number): number => Math.round(base * (1 + factor));

export const newId = () => Math.random().toString(36).slice(2, 8);

export const cents = (n: number) => Math.round(n * 100) / 100;

export function addLog(
  s: GameState,
  key: string,
  params: LogEntry['params'] = {},
  cls: LogClass = '',
  extra: Pick<LogEntry, 'titleKey' | 'fx'> = {},
) {
  s.log.push({ key, params, cls, ...extra });
  if (s.log.length > 200) s.log.shift();
}

export function applyFx(s: GameState, fx: Fx) {
  if (fx.money) s.money += fx.money;
  for (const k of ['health', 'happiness'] as const) {
    const v = fx[k];
    if (v) s.stats[k] = clamp(s.stats[k] + v);
  }
  for (const { id } of SKILLS) {
    const v = fx[id];
    if (v) s.skills[id] = clamp(s.skills[id] + v, 0, SKILL_MAX);
  }
}

export function checkOver(s: GameState) {
  if (s.stats.health <= 0) s.over = 'health';
  else if (s.money <= DEBT_LIMIT) s.over = 'debt';
}

/** Tire `count` éléments distincts, chacun avec une probabilité proportionnelle à son poids. */
export function drawWeighted<T>(candidates: T[], weight: (item: T) => number, count: number): T[] {
  const pool = [...candidates];
  const picked: T[] = [];
  while (picked.length < count && pool.length) {
    let roll = Math.random() * pool.reduce((sum, item) => sum + weight(item), 0);
    const i = pool.findIndex((item) => (roll -= weight(item)) < 0);
    picked.push(...pool.splice(i === -1 ? pool.length - 1 : i, 1));
  }
  return picked;
}
