import type { Drawback } from '../../game/types';

// ---------- Entreprises (fictives) ----------

/**
 * Entreprises imaginaires qui recrutent. Chacune a son niveau de paie (`pay` : écart fixe avec le salaire de base,
 * de -10 % à +10 %) et sa propre pénibilité (`drawback` : s'ajoute à celle du poste, négatif = pire ambiance ou
 * conditions plus dures, positif = plus agréable). Un nom propre n'est pas traduit.
 */
export interface Company {
  id: string;
  name: string;
  /** Postes pour lesquels elle recrute. */
  jobs: string[];
  pay: number;
  drawback: Drawback;
}

export const COMPANIES: Company[] = [
  // Restauration rapide
  { id: 'burgerBrigade', name: 'Burger Brigade', jobs: ['fastFood', 'fastFoodManager'], pay: 0.04, drawback: { happiness: -0.5 } },
  { id: 'croustyExpress', name: 'Crousty Express', jobs: ['fastFood', 'fastFoodManager'], pay: -0.03, drawback: { health: -0.5, happiness: -0.5 } },
  { id: 'pizzaPronto', name: 'Pizza Pronto', jobs: ['fastFood', 'fastFoodManager'], pay: 0.07, drawback: { health: -0.5 } },
  // Restauration basique
  { id: 'brasserieCoin', name: 'Brasserie du Coin', jobs: ['diner', 'dinerManager'], pay: 0,drawback: {} },
  { id: 'relaisFleuri', name: 'Le Relais Fleuri', jobs: ['diner', 'dinerManager'], pay: 0.06, drawback: { happiness: 0.5 } },
  { id: 'chezMarcel', name: 'Chez Marcel & Fils', jobs: ['diner', 'dinerManager'], pay: -0.05, drawback: { health: -0.5 } },
  // Restauration haut de gamme
  { id: 'maisonAubrac', name: 'Maison Aubrac', jobs: ['fineDining', 'fineDiningManager'], pay: 0.09, drawback: { happiness: -1 } },
  { id: 'grandVerger', name: 'Le Grand Verger', jobs: ['fineDining', 'fineDiningManager'], pay: 0.02, drawback: { happiness: 0.5 } },
  { id: 'atelierVelours', name: "L'Atelier Velours", jobs: ['fineDining', 'fineDiningManager'], pay: -0.04, drawback: { health: -0.5 } },
  // Vente
  { id: 'primeurMarket', name: 'Primeur Market', jobs: ['cashier'], pay: 0, drawback: {} },
  { id: 'epicerieP', name: 'Épicerie Prisma', jobs: ['cashier'], pay: -0.06, drawback: { happiness: 0.5 } },
  { id: 'hyperCobalt', name: 'Hyper Cobalt', jobs: ['cashier'], pay: 0.08, drawback: { health: -0.5, happiness: -0.5 } },
  // Transport et logistique
  { id: 'colisRapide', name: 'Colis Rapide', jobs: ['driver'], pay: 0.03, drawback: { health: -0.5 } },
  { id: 'livrExpress', name: 'LivrExpress', jobs: ['driver'], pay: -0.05, drawback: {} },
  { id: 'velocite', name: 'Vélocité Services', jobs: ['driver', 'motoCourier'], pay: 0.08, drawback: { health: -1 } },
  { id: 'logiStock', name: 'LogiStock', jobs: ['forklift'], pay: 0.02, drawback: {} },
  { id: 'entrepotsNordik', name: 'Entrepôts Nordik', jobs: ['forklift'], pay: 0.07, drawback: { health: -0.5 } },
  { id: 'palettesCo', name: 'Palettes & Co', jobs: ['forklift'], pay: -0.06, drawback: { happiness: 0.5 } },
  { id: 'trajetDirect', name: 'Trajet Direct', jobs: ['vtc'], pay: 0.05, drawback: { happiness: -0.5 } },
  { id: 'citeCab', name: 'Cité Cab', jobs: ['vtc'], pay: -0.04, drawback: {} },
  { id: 'motoFlash', name: 'Moto Flash', jobs: ['motoCourier'], pay: 0.06, drawback: { health: -1 } },
  { id: 'urbainExpress', name: 'Urbain Express', jobs: ['motoCourier'], pay: -0.02, drawback: {} },
  { id: 'bastide', name: 'Transports Bastide', jobs: ['truckDriver'], pay: 0.05, drawback: {} },
  { id: 'eurofretSud', name: 'EuroFret Sud', jobs: ['truckDriver'], pay: 0.09, drawback: { happiness: -1 } },
  { id: 'routierAtlas', name: 'Routier Atlas', jobs: ['truckDriver'], pay: -0.05, drawback: { happiness: 0.5 } },
  // Bureau
  { id: 'cabinetDelmas', name: 'Cabinet Delmas', jobs: ['office', 'adminAssistant'], pay: 0.03, drawback: {} },
  { id: 'bureautix', name: 'Bureautix', jobs: ['office'], pay: -0.07, drawback: { happiness: 0.5 } },
  { id: 'groupeHexagone', name: 'Groupe Hexagone', jobs: ['office', 'adminAssistant'], pay: 0.08, drawback: { happiness: -0.5 } },
  { id: 'agenceEquinoxe', name: 'Agence Équinoxe', jobs: ['adminAssistant'], pay: -0.03, drawback: { happiness: 0.5 } },
  // Finance
  { id: 'fiducia', name: 'Fiducia Conseil', jobs: ['accountant'], pay: 0.04, drawback: {} },
  { id: 'lemaitre', name: 'Lemaître & Associés', jobs: ['accountant'], pay: 0.09, drawback: { happiness: -1 } },
  { id: 'auditHorizon', name: 'Audit Horizon', jobs: ['accountant'], pay: -0.03, drawback: { health: 0.5 } },
  // Ingénierie
  { id: 'technovia', name: 'Technovia', jobs: ['engineer'], pay: 0.06, drawback: { happiness: -0.5 } },
  { id: 'ingenierieLumen', name: 'Ingénierie Lumen', jobs: ['engineer'], pay: -0.02, drawback: { happiness: 0.5 } },
  { id: 'kappaSystemes', name: 'Kappa Systèmes', jobs: ['engineer'], pay: 0.09, drawback: { health: -0.5, happiness: -1 } },
];

