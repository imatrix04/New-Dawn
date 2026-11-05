import type { Drawback } from '../../game/types';

// ---------- Entreprises (fictives) ----------

/**
 * Entreprises imaginaires qui recrutent. Chacune a son niveau de paie (`pay` : écart fixe avec le salaire de base,
 * de -10 % à +10 %) et sa propre pénibilité (`drawback` : s'ajoute à celle du poste, négatif = pire ambiance ou
 * conditions plus dures, positif = plus agréable). Un nom propre n'est pas traduit.
 *
 * Son emplacement change le trajet : `commute` s'ajoute (heures par semaine, négatif = plus près) au trajet de base
 * du poste, sans jamais le faire passer sous 0.
 */
export interface Company {
  id: string;
  name: string;
  /** Postes pour lesquels elle recrute. */
  jobs: string[];
  pay: number;
  commute: number;
  drawback: Drawback;
}

export const COMPANIES: Company[] = [
  // Restauration rapide
  { id: 'burgerBrigade', name: 'Burger Brigade', jobs: ['fastFood', 'fastFoodManager'], pay: 0.04, commute: 0, drawback: { happiness: -0.5 } },
  { id: 'croustyExpress', name: 'Crousty Express', jobs: ['fastFood', 'fastFoodManager'], pay: -0.03, commute: 1, drawback: { health: -0.5, happiness: -0.5 } },
  { id: 'pizzaPronto', name: 'Pizza Pronto', jobs: ['fastFood', 'fastFoodManager'], pay: 0.07, commute: -1, drawback: { health: -0.5 } },
  // Restauration basique
  { id: 'brasserieCoin', name: 'Brasserie du Coin', jobs: ['diner', 'dinerManager'], pay: 0, commute: -1, drawback: {} },
  { id: 'relaisFleuri', name: 'Le Relais Fleuri', jobs: ['diner', 'dinerManager'], pay: 0.06, commute: 1, drawback: { happiness: 0.5 } },
  { id: 'chezMarcel', name: 'Chez Marcel & Fils', jobs: ['diner', 'dinerManager'], pay: -0.05, commute: 0, drawback: { health: -0.5 } },
  // Restauration haut de gamme
  { id: 'maisonAubrac', name: 'Maison Aubrac', jobs: ['fineDining', 'fineDiningManager'], pay: 0.09, commute: -1, drawback: { happiness: -1 } },
  { id: 'grandVerger', name: 'Le Grand Verger', jobs: ['fineDining', 'fineDiningManager'], pay: 0.02, commute: 2, drawback: { happiness: 0.5 } },
  { id: 'atelierVelours', name: "L'Atelier Velours", jobs: ['fineDining', 'fineDiningManager'], pay: -0.04, commute: 0, drawback: { health: -0.5 } },
  // Vente
  { id: 'primeurMarket', name: 'Primeur Market', jobs: ['cashier', 'retailManager', 'storeDirector'], pay: 0, commute: -1, drawback: {} },
  { id: 'epicerieP', name: 'Épicerie Prisma', jobs: ['cashier', 'retailManager', 'storeDirector'], pay: -0.06, commute: -1, drawback: { happiness: 0.5 } },
  { id: 'hyperCobalt', name: 'Hyper Cobalt', jobs: ['cashier', 'retailManager', 'storeDirector'], pay: 0.08, commute: 2, drawback: { health: -0.5, happiness: -0.5 } },
  // Transport et logistique
  { id: 'colisRapide', name: 'Colis Rapide', jobs: ['driver'], pay: 0.03, commute: 0, drawback: { health: -0.5 } },
  { id: 'livrExpress', name: 'LivrExpress', jobs: ['driver'], pay: -0.05, commute: 1, drawback: {} },
  { id: 'velocite', name: 'Vélocité Services', jobs: ['driver', 'motoCourier'], pay: 0.08, commute: -1, drawback: { health: -1 } },
  { id: 'logiStock', name: 'LogiStock', jobs: ['forklift'], pay: 0.02, commute: 1, drawback: {} },
  { id: 'entrepotsNordik', name: 'Entrepôts Nordik', jobs: ['forklift'], pay: 0.07, commute: 2, drawback: { health: -0.5 } },
  { id: 'palettesCo', name: 'Palettes & Co', jobs: ['forklift'], pay: -0.06, commute: 0, drawback: { happiness: 0.5 } },
  { id: 'trajetDirect', name: 'Trajet Direct', jobs: ['vtc'], pay: 0.05, commute: 0, drawback: { happiness: -0.5 } },
  { id: 'citeCab', name: 'Cité Cab', jobs: ['vtc'], pay: -0.04, commute: -1, drawback: {} },
  { id: 'motoFlash', name: 'Moto Flash', jobs: ['motoCourier'], pay: 0.06, commute: 0, drawback: { health: -1 } },
  { id: 'urbainExpress', name: 'Urbain Express', jobs: ['motoCourier'], pay: -0.02, commute: -1, drawback: {} },
  { id: 'bastide', name: 'Transports Bastide', jobs: ['truckDriver'], pay: 0.05, commute: 1, drawback: {} },
  { id: 'eurofretSud', name: 'EuroFret Sud', jobs: ['truckDriver'], pay: 0.09, commute: 2, drawback: { happiness: -1 } },
  { id: 'routierAtlas', name: 'Routier Atlas', jobs: ['truckDriver'], pay: -0.05, commute: 0, drawback: { happiness: 0.5 } },
  // Bureau
  { id: 'cabinetDelmas', name: 'Cabinet Delmas', jobs: ['office', 'adminAssistant'], pay: 0.03, commute: -2, drawback: {} },
  { id: 'bureautix', name: 'Bureautix', jobs: ['office'], pay: -0.07, commute: 1, drawback: { happiness: 0.5 } },
  { id: 'groupeHexagone', name: 'Groupe Hexagone', jobs: ['office', 'adminAssistant'], pay: 0.08, commute: 2, drawback: { happiness: -0.5 } },
  { id: 'agenceEquinoxe', name: 'Agence Équinoxe', jobs: ['adminAssistant'], pay: -0.03, commute: 0, drawback: { happiness: 0.5 } },
  // Finance
  { id: 'fiducia', name: 'Fiducia Conseil', jobs: ['accountant'], pay: 0.04, commute: -1, drawback: {} },
  { id: 'lemaitre', name: 'Lemaître & Associés', jobs: ['accountant'], pay: 0.09, commute: 1, drawback: { happiness: -1 } },
  { id: 'auditHorizon', name: 'Audit Horizon', jobs: ['accountant'], pay: -0.03, commute: 0, drawback: { health: 0.5 } },
  // Ingénierie
  { id: 'technovia', name: 'Technovia', jobs: ['engineer'], pay: 0.06, commute: 2, drawback: { happiness: -0.5 } },
  { id: 'ingenierieLumen', name: 'Ingénierie Lumen', jobs: ['engineer'], pay: -0.02, commute: 0, drawback: { happiness: 0.5 } },
  { id: 'kappaSystemes', name: 'Kappa Systèmes', jobs: ['engineer'], pay: 0.09, commute: 3, drawback: { health: -0.5, happiness: -1 } },
];

