import type { Drawback } from '../../game/types';

// ---------- Entreprises (fictives) ----------

/**
 * Entreprises imaginaires qui recrutent. Chacune a son niveau de paie (`pay` : écart fixe avec le salaire de base,
 * de -10 % à +10 %) et sa propre pénibilité (`drawback` : s'ajoute à celle du poste, négatif = pire ambiance ou
 * conditions plus dures, positif = plus agréable). Un nom propre n'est pas traduit.
 *
 * Son emplacement change le trajet : `commute` s'ajoute (heures par semaine, négatif = plus près) au trajet de base
 * du poste, sans jamais le faire passer sous 0.
 *
 * Sa taille (`staff`, 1 par défaut) multiplie les effectifs de l'équipe d'un poste de manager ou de directeur.
 *
 * Certaines entreprises seulement ont un intéressement (`profitShare`) : une prime annuelle collective, en mois de salaire pour
 * une très bonne année, qui ne dépend ni du manager ni des performances individuelles.
 */
export interface Company {
  id: string;
  name: string;
  /** Postes pour lesquels elle recrute. */
  jobs: string[];
  pay: number;
  commute: number;
  drawback: Drawback;
  staff?: number;
  profitShare?: number;
}

export const COMPANIES: Company[] = [
  // Restauration rapide
  { id: 'burgerBrigade', name: 'Burger Brigade', jobs: ['fastFood', 'fastFoodManager'], pay: 0.04, commute: 0, drawback: { happiness: -0.5 }, staff: 1.2, profitShare: 0.3 },
  { id: 'croustyExpress', name: 'Crousty Express', jobs: ['fastFood', 'fastFoodManager'], pay: -0.03, commute: 1, drawback: { health: -0.5, happiness: -0.5 }, staff: 0.9 },
  { id: 'pizzaPronto', name: 'Pizza Pronto', jobs: ['fastFood', 'fastFoodManager'], pay: 0.07, commute: -1, drawback: { health: -0.5 }, staff: 1 },
  // Restauration basique
  { id: 'brasserieCoin', name: 'Brasserie du Coin', jobs: ['diner', 'dinerManager'], pay: 0, commute: -1, drawback: {}, staff: 0.8 },
  { id: 'relaisFleuri', name: 'Le Relais Fleuri', jobs: ['diner', 'dinerManager'], pay: 0.06, commute: 1, drawback: { happiness: 0.5 }, staff: 1.1 },
  { id: 'chezMarcel', name: 'Chez Marcel & Fils', jobs: ['diner', 'dinerManager'], pay: -0.05, commute: 0, drawback: { health: -0.5 }, staff: 0.75 },
  // Restauration haut de gamme
  { id: 'maisonAubrac', name: 'Maison Aubrac', jobs: ['fineDining', 'fineDiningManager'], pay: 0.09, commute: -1, drawback: { happiness: -1 }, staff: 1.1, profitShare: 0.3 },
  { id: 'grandVerger', name: 'Le Grand Verger', jobs: ['fineDining', 'fineDiningManager'], pay: 0.02, commute: 2, drawback: { happiness: 0.5 }, staff: 0.9 },
  { id: 'atelierVelours', name: "L'Atelier Velours", jobs: ['fineDining', 'fineDiningManager'], pay: -0.04, commute: 0, drawback: { health: -0.5 }, staff: 0.8 },
  // Vente
  { id: 'primeurMarket', name: 'Primeur Market', jobs: ['cashier', 'retailManager', 'storeDirector'], pay: 0, commute: -1, drawback: {}, staff: 1, profitShare: 0.2 },
  { id: 'epicerieP', name: 'Épicerie Prisma', jobs: ['cashier', 'retailManager', 'storeDirector'], pay: -0.06, commute: -1, drawback: { happiness: 0.5 }, staff: 0.7 },
  { id: 'hyperCobalt', name: 'Hyper Cobalt', jobs: ['cashier', 'retailManager', 'storeDirector'], pay: 0.08, commute: 2, drawback: { health: -0.5, happiness: -0.5 }, staff: 1.4, profitShare: 0.5 },
  // Transport et logistique
  { id: 'colisRapide', name: 'Colis Rapide', jobs: ['driver'], pay: 0.03, commute: 0, drawback: { health: -0.5 } },
  { id: 'livrExpress', name: 'LivrExpress', jobs: ['driver'], pay: -0.05, commute: 1, drawback: {} },
  { id: 'velocite', name: 'Vélocité Services', jobs: ['driver', 'motoCourier'], pay: 0.08, commute: -1, drawback: { health: -1 } },
  { id: 'logiStock', name: 'LogiStock', jobs: ['forklift'], pay: 0.02, commute: 1, drawback: {} },
  { id: 'entrepotsNordik', name: 'Entrepôts Nordik', jobs: ['forklift'], pay: 0.07, commute: 2, drawback: { health: -0.5 }, profitShare: 0.25 },
  { id: 'palettesCo', name: 'Palettes & Co', jobs: ['forklift'], pay: -0.06, commute: 0, drawback: { happiness: 0.5 } },
  { id: 'trajetDirect', name: 'Trajet Direct', jobs: ['vtc'], pay: 0.05, commute: 0, drawback: { happiness: -0.5 } },
  { id: 'citeCab', name: 'Cité Cab', jobs: ['vtc'], pay: -0.04, commute: -1, drawback: {} },
  { id: 'motoFlash', name: 'Moto Flash', jobs: ['motoCourier'], pay: 0.06, commute: 0, drawback: { health: -1 } },
  { id: 'urbainExpress', name: 'Urbain Express', jobs: ['motoCourier'], pay: -0.02, commute: -1, drawback: {} },
  { id: 'bastide', name: 'Transports Bastide', jobs: ['truckDriver'], pay: 0.05, commute: 1, drawback: {} },
  { id: 'eurofretSud', name: 'EuroFret Sud', jobs: ['truckDriver'], pay: 0.09, commute: 2, drawback: { happiness: -1 }, profitShare: 0.3 },
  { id: 'routierAtlas', name: 'Routier Atlas', jobs: ['truckDriver'], pay: -0.05, commute: 0, drawback: { happiness: 0.5 } },
  // Bureau
  { id: 'cabinetDelmas', name: 'Cabinet Delmas', jobs: ['office', 'adminAssistant'], pay: 0.03, commute: -2, drawback: {}, profitShare: 0.2 },
  { id: 'bureautix', name: 'Bureautix', jobs: ['office'], pay: -0.07, commute: 1, drawback: { happiness: 0.5 } },
  { id: 'groupeHexagone', name: 'Groupe Hexagone', jobs: ['office', 'adminAssistant'], pay: 0.08, commute: 2, drawback: { happiness: -0.5 }, profitShare: 0.4 },
  { id: 'agenceEquinoxe', name: 'Agence Équinoxe', jobs: ['adminAssistant'], pay: -0.03, commute: 0, drawback: { happiness: 0.5 } },
  // Finance
  { id: 'fiducia', name: 'Fiducia Conseil', jobs: ['accountant'], pay: 0.04, commute: -1, drawback: {}, profitShare: 0.25 },
  { id: 'lemaitre', name: 'Lemaître & Associés', jobs: ['accountant'], pay: 0.09, commute: 1, drawback: { happiness: -1 }, profitShare: 0.4 },
  { id: 'auditHorizon', name: 'Audit Horizon', jobs: ['accountant'], pay: -0.03, commute: 0, drawback: { health: 0.5 } },
  // Ingénierie
  { id: 'technovia', name: 'Technovia', jobs: ['engineer'], pay: 0.06, commute: 2, drawback: { happiness: -0.5 }, profitShare: 0.5 },
  { id: 'ingenierieLumen', name: 'Ingénierie Lumen', jobs: ['engineer'], pay: -0.02, commute: 0, drawback: { happiness: 0.5 } },
  { id: 'kappaSystemes', name: 'Kappa Systèmes', jobs: ['engineer'], pay: 0.09, commute: 3, drawback: { health: -0.5, happiness: -1 }, profitShare: 0.6 },
];

