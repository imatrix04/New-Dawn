import { STARTER_JOBS } from '../data/content';
import type { Gender, Profile } from './types';

// Les prénoms et noms ne sont pas traduits : ce sont des données, pas du texte d'interface.
const FIRST_NAMES: Record<Gender, string[]> = {
  male: ['Hugo', 'Lucas', 'Nathan', 'Louis', 'Jules', 'Tom', 'Maxime', 'Noah', 'Léo', 'Gabriel', 'Arthur', 'Théo'],
  female: ['Léa', 'Emma', 'Chloé', 'Camille', 'Inès', 'Manon', 'Sarah', 'Zoé', 'Jade', 'Louise', 'Lina', 'Alice'],
};
const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy',
  'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'Roux', 'Fournier',
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function randomProfile(): Profile {
  const gender: Gender = Math.random() < 0.5 ? 'male' : 'female';
  const path = Math.random() < 0.5 ? 'comfort' : 'tight';
  return {
    firstName: pick(FIRST_NAMES[gender]),
    lastName: pick(LAST_NAMES),
    gender,
    path,
    job: path === 'comfort' ? pick(STARTER_JOBS) : null,
  };
}
