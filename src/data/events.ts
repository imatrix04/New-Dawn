import type { GameEvent } from '../game/types';

// Les textes (titre, description, choix, résultats) sont dans src/i18n/locales/*.json
// sous events.<id>. Ici : uniquement la mécanique.
export const EVENTS: GameEvent[] = [
  {
    id: 'washer',
    choices: [
      { run: () => ({ outcome: 'repaired', fx: { money: -150 } }) },
      { run: () => ({ outcome: 'byHand', fx: { energy: -10, happiness: -4 } }) },
    ],
  },
  {
    id: 'party',
    choices: [
      { run: () => ({ outcome: 'went', fx: { money: -50, happiness: 12, energy: -15 }, good: true }) },
      { run: () => ({ outcome: 'stayed', fx: { energy: 5, happiness: -3 } }) },
    ],
  },
  {
    id: 'flu',
    choices: [
      { run: () => ({ outcome: 'doctor', fx: { money: -30, health: -3, energy: -10 } }) },
      { run: () => ({ outcome: 'tough', fx: { health: -12, energy: -20, happiness: -4 } }) },
    ],
  },
  {
    id: 'bill',
    choices: [
      { run: () => ({ outcome: 'kept', fx: { money: 20, happiness: 2 }, good: true }) },
    ],
  },
  {
    id: 'overtime',
    when: (s) => s.job !== null,
    choices: [
      { run: () => ({ outcome: 'accepted', fx: { money: 200, energy: -20, happiness: -4 } }) },
      { run: () => ({ outcome: 'refused', fx: { happiness: 2 } }) },
    ],
  },
  {
    id: 'stranger',
    choices: [
      {
        run: () => Math.random() < 0.5
          ? { outcome: 'great', fx: { happiness: 15 }, good: true }
          : { outcome: 'awkward', fx: { happiness: -5 } },
      },
      { run: () => ({ outcome: 'passed', fx: {} }) },
    ],
  },
  {
    id: 'theft',
    choices: [
      { run: () => ({ outcome: 'rebought', fx: { money: -120 } }) },
      { run: () => ({ outcome: 'without', fx: { happiness: -6, health: 2 } }) },
    ],
  },
  {
    id: 'course',
    choices: [
      { run: () => ({ outcome: 'followed', fx: { knowledge: 5, energy: -10 }, good: true }) },
      { run: () => ({ outcome: 'ignored', fx: {} }) },
    ],
  },
  {
    id: 'bet',
    when: (s) => s.money >= 100,
    choices: [
      {
        run: () => Math.random() < 0.4
          ? { outcome: 'won', fx: { money: 250, happiness: 8 }, good: true }
          : { outcome: 'lost', fx: { money: -100, happiness: -5 } },
      },
      { run: () => ({ outcome: 'declined', fx: {} }) },
    ],
  },
  {
    id: 'parents',
    choices: [
      { run: () => ({ outcome: 'thanked', fx: { money: 150, happiness: 5 }, good: true }) },
    ],
  },
  {
    id: 'charges',
    choices: [
      { run: () => ({ outcome: 'paid', fx: { money: -100 } }) },
    ],
  },
  {
    id: 'exhaustion',
    when: (s) => s.stats.energy < 25,
    choices: [
      { run: () => ({ outcome: 'rest', fx: { energy: 25, health: -5, happiness: -3 } }) },
      { run: () => ({ outcome: 'push', fx: { health: -15, happiness: -8 } }) },
    ],
  },
];

export const eventById = (id: string | null): GameEvent | null =>
  EVENTS.find((e) => e.id === id) ?? null;
