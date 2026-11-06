// Supérieurs : tirage du type (caché) selon la paie de l'entreprise.
import { BOSS_NAMES, BOSS_TYPES, BOSS_WEIGHTS } from '../../data/content';
import type { BossType, Company } from '../../data/content';
import type { Boss } from '../types';
import { drawWeighted } from './shared';

/**
 * Tire un supérieur. Les entreprises qui paient moins que la normale ont plus souvent des supérieurs stricts ou méchants,
 * celles qui paient mieux des supérieurs sympas : c'est une tendance, pas une règle.
 */
export function rollBoss(company: Company | null): Boss {
  const pay = company?.pay ?? 0;
  const weight = (type: BossType): number => {
    const base = BOSS_WEIGHTS[type];
    if (type === 'kind') return Math.max(0.03, base + pay * 3);
    if (type === 'strict') return Math.max(0.05, base - pay * 1.5);
    if (type === 'harsh') return Math.max(0.02, base - pay * 3);
    return base;
  };
  const type = drawWeighted(BOSS_TYPES, weight, 1)[0];
  return {
    type,
    title: Math.random() < 0.5 ? 'm' : 'f',
    surname: BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)],
  };
}
