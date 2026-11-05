// Catalogue des boulots rapides et des formations, renouvelé tous les 6 mois.
import { CATALOG_MAX, GIGS, TRAININGS } from '../../data/content';
import type { Catalog, GameState } from '../types';
import { drawWeighted, rollFactor } from './shared';

/**
 * Tire le catalogue : 6 éléments au plus par catégorie, les plus lourds revenant plus souvent. Ce qui est en cours
 * (boulot rapide exercé, formation suivie) reste toujours visible, et les diplômes déjà obtenus ne reviennent pas.
 */
export function drawCatalog(state: GameState): Catalog {
  const pick = <T extends { id: string }>(items: T[], weight: (item: T) => number, keep: string | null): string[] => {
    const kept = items.filter((i) => i.id === keep);
    const rest = drawWeighted(items.filter((i) => i.id !== keep), weight, CATALOG_MAX - kept.length);
    return [...kept, ...rest].map((i) => i.id);
  };
  const trainings = Object.entries(TRAININGS)
    .filter(([id]) => !state.diplomas.includes(id))
    .map(([id, cfg]) => ({ id, ...cfg }));
  const inProgress = state.training?.id ?? null;
  const catalog = {
    gigs: pick(GIGS, (g) => g.weight, state.gig),
    quick: pick(trainings.filter((t) => t.quick), (t) => t.weight, inProgress),
    training: pick(trainings.filter((t) => !t.quick), (t) => t.weight, inProgress),
  };
  // Chaque élément visible reçoit un nouvel écart de prix, sauf ce qui est en cours : la paie du boulot exercé ne bouge pas.
  const factors: Record<string, number> = {};
  for (const id of [...catalog.gigs, ...catalog.quick, ...catalog.training]) {
    const kept = id === state.gig || id === inProgress;
    factors[id] = kept ? state.catalog?.factors?.[id] ?? 0 : rollFactor();
  }
  return { ...catalog, factors };
}
