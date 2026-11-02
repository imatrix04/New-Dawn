import { STARTER_JOBS } from '../data/content';
import type { Profile } from './types';

// Les prénoms et noms ne sont pas traduits : ce sont des données, pas du texte d'interface.
const FIRST_NAMES = [
  'Léa', 'Hugo', 'Emma', 'Lucas', 'Chloé', 'Nathan', 'Camille', 'Louis',
  'Inès', 'Jules', 'Manon', 'Tom', 'Sarah', 'Maxime', 'Zoé', 'Noah',
];
const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy',
  'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'Roux', 'Fournier',
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function randomProfile(): Profile {
  const path = Math.random() < 0.5 ? 'comfort' : 'tight';
  return {
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    path,
    job: path === 'comfort' ? pick(STARTER_JOBS) : null,
  };
}
