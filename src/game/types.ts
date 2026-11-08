import type { BossType, RateKey } from '../data/content/economy';
import type { Management, TeamEventId, TeamPace, TeamTrait } from '../data/content/management';
import type { WorkStyle } from '../data/content/work';

/** Jauges de condition : l'énergie n'existe plus, le sommeil agit directement sur la santé. */
export type StatKey = 'health' | 'happiness';

/** Compétences (0 à 100) : chaque type de connaissance a sa propre valeur. Ajouter une compétence = une entrée ici + dans SKILLS. */
export type SkillId = 'digital' | 'charisma' | 'strength' | 'intelligence' | 'logistics' | 'mechanics';

/** Variation appliquée à l'état : argent et/ou jauges. */
export type Fx = Partial<Record<StatKey | SkillId | 'money', number>>;

export type LogClass = 'good' | 'bad' | 'month' | '';

/**
 * Une ligne de journal ne contient pas de texte : seulement une clé de traduction
 * et ses paramètres. L'interface la traduit à l'affichage (changement de langue à chaud).
 */
export interface LogEntry {
  key: string;
  params?: Record<string, string | number>;
  cls: LogClass;
  /** Si présent, titre d'événement affiché devant le texte. */
  titleKey?: string;
  /** Si présent, effets affichés entre parenthèses. */
  fx?: Fx;
}

export type OverReason = 'health' | 'debt';

/** Départ confortable (petit capital) ou difficile (presque rien). */
export type StartPath = 'comfort' | 'tight';

export type Gender = 'male' | 'female';

/** Choix faits à la création du personnage. */
export interface Profile {
  firstName: string;
  lastName: string;
  gender: Gender;
  path: StartPath;
  /** Emploi de départ (parcours confortable uniquement). */
  job: string | null;
}

/**
 * Semaine type réglée par le joueur. Sommeil et loisirs sont en heures PAR JOUR,
 * le reste en heures PAR SEMAINE (voir SCHEDULE dans data/content.ts).
 */
export type ScheduleKey = 'sleep' | 'work' | 'leisure' | 'study' | 'sport' | 'search' | 'housing';
export type Schedule = Record<ScheduleKey, number>;

/** Quartier : fait varier le prix, le trajet et l'ambiance d'un logement (voir AREAS). */
export type Area = 'center' | 'suburb' | 'country';

export type HousingKind = 'studio' | 'apartment' | 'house';

/** Prêt immobilier en cours : `balance` est le capital restant dû. */
export interface Loan {
  balance: number;
  monthly: number;
  /** Taux annuel, fixé à la signature. */
  rate: number;
  monthsLeft: number;
}

/** Logement occupé : loué (loyer, caution) ou possédé (valeur, charges, prêt éventuel). */
export interface Home {
  /** Textes : housing.<typeId>. */
  typeId: string;
  area: Area;
  /** Heures de trajet ajoutées par semaine, tirées à l'annonce dans la fourchette du quartier (voir AREAS). */
  commute: number;
  tenure: 'rent' | 'own';
  /** Loyer mensuel (0 pour un propriétaire). */
  rent: number;
  /** Caution versée, rendue au départ (location). */
  deposit: number;
  /** Valeur estimée du bien, qui évolue lentement (achat). */
  value: number;
  /** Charges mensuelles du propriétaire : taxe foncière, copropriété. */
  charges: number;
  loan: Loan | null;
}

/** Ce que devient le bien possédé qu'on quitte : vendu sur le champ, mis en location, ou laissé vide. */
export type LeaveAction = 'sell' | 'rent' | 'vacant';

/**
 * Statut d'un bien possédé où l'on n'habite pas : vide, en recherche de locataire,
 * loué (le loyer rentre chaque mois) ou mis en vente.
 */
export type PropertyStatus = 'vacant' | 'letting' | 'rented' | 'selling';

/** Bien possédé où l'on n'habite pas : charges et prêt restent dus, le loyer rentre s'il est loué. */
export interface Property {
  id: string;
  typeId: string;
  area: Area;
  commute: number;
  status: PropertyStatus;
  value: number;
  charges: number;
  loan: Loan | null;
  /** Loyer demandé (en recherche) ou perçu (loué). */
  rent: number;
  /** Prix de vente demandé (en vente). */
  ask: number;
}

/** Annonce visible : à louer (`price` = loyer mensuel) ou à vendre (`price` = prix d'achat). */
export interface HousingListing {
  id: string;
  typeId: string;
  area: Area;
  commute: number;
  tenure: 'rent' | 'buy';
  price: number;
  /** Mois restants avant que l'annonce disparaisse. */
  monthsLeft: number;
}

export type SavingsProduct = 'livretA' | 'ldds' | 'livretJeune' | 'pel';

/** Situation économique de la partie : elle change chaque janvier (voir EconomyReport). */
export interface Economy {
  /** SMIC net mensuel : plancher de tous les salaires (au prorata des heures). */
  smic: number;
  /** Taux annuels courants (livrets, nouveaux PEL, prêts immobiliers selon la durée). */
  rates: Record<RateKey, number>;
  /** Prix de l'immobilier par rapport au départ (1 = prix de janvier 2026). */
  housingIndex: number;
}

export interface EconomyReport {
  year: number;
  /** Variation des prix de l'immobilier sur l'année (0.03 = +3 %). */
  housing: number;
  smic: { from: number; to: number };
  rates: Record<RateKey, { from: number; to: number }>;
}

/** Supérieur direct : son type est caché au joueur. `title` : civilité (m ou f). */
export interface Boss {
  type: BossType;
  title: 'm' | 'f';
  surname: string;
}

/** Dernière réponse du supérieur à une demande d'augmentation. */
export interface RaiseReply {
  kind: 'approved' | 'counter' | 'refused' | 'declined';
  /** Pourcentage demandé (approved, refused) ou proposé (counter). */
  pct: number;
  month: number;
}

/** Compte d'épargne : `interest` = part du solde qui vient d'intérêts capitalisés (hors plafond de versements). */
export interface Account {
  balance: number;
  interest: number;
}

export interface PelAccount extends Account {
  /** Mois de la partie où le plan a été ouvert. */
  openedMonth: number;
  /** Taux brut annuel, fixé à l'ouverture pour toute la vie du plan. */
  rate: number;
}

/** Un produit à `null` n'est pas ouvert : le joueur doit l'ouvrir lui-même. */
export interface Savings {
  livretA: Account | null;
  ldds: Account | null;
  livretJeune: Account | null;
  pel: PelAccount | null;
}

/** Formation en cours : un mois avec blâme ne fait pas progresser `monthsDone`. */
export interface Training {
  id: string; // textes : trainings.<id>
  monthsDone: number;
  /** Blâmes reçus pour manque d'heures d'étude : renvoi au troisième. */
  blames: number;
  /** Coût mensuel fixé à l'inscription (le prix de base varie de ±10 % selon le catalogue). */
  tuition: number;
  /** Formation payée par l'employeur dans le cadre d'une promotion : sur les heures de travail, sans frais ni blâme. */
  sponsored?: boolean;
}

export type FuelType = 'petrol' | 'diesel';

/** Style de conduite : règle le gain de temps sur les trajets, la consommation, l'usure et les risques (voir DRIVING_STYLES). */
export type DrivingStyle = 'eco' | 'normal' | 'fast' | 'reckless';

/** Intervention mécanique : entretien habituel, panne mineure, panne majeure, véhicule cassé mais réparable. */
export type RepairKind = 'service' | 'minor' | 'major' | 'broken';
/** Pannes qui peuvent frapper le véhicule (tout sauf l'entretien, qui est préventif). */
export type Breakdown = Exclude<RepairKind, 'service'>;

/** Réparation en cours : à soi-même (heures dans le planning) ou au garage (véhicule immobilisé). */
export interface RepairJob {
  kind: RepairKind;
  diy: boolean;
  monthsLeft: number;
}

/** Dernier contrôle technique passé au garage (validé ou non). */
export interface Inspection {
  month: number;
  passed: boolean;
}

/** Véhicule possédé. Textes : vehicles.<modelId>. */
export interface Vehicle {
  id: string;
  modelId: string;
  fuel: FuelType;
  km: number;
  /** Mois de la partie de la première mise en circulation (négatif : véhicule déjà ancien à l'achat). */
  registeredMonth: number;
  /** État actuel, de 0 (mort) à 100 : baisse avec les kilomètres et le style de conduite. */
  condition: number;
  /** État maximal atteignable : il baisse avec l'usure et à chaque réparation, jusqu'à la casse. */
  ceiling: number;
  /** Kilométrage du dernier entretien. */
  lastServiceKm: number;
  inspection: Inspection | null;
  /** Panne non réparée, ou null. */
  issue: Breakdown | null;
  repair: RepairJob | null;
}

/** Véhicule d'occasion à vendre. */
export interface VehicleListing {
  id: string;
  modelId: string;
  fuel: FuelType;
  km: number;
  registeredMonth: number;
  condition: number;
  ceiling: number;
  price: number;
  /** Mois restants avant que l'annonce disparaisse. */
  monthsLeft: number;
}

/** Le conducteur : permis à points, bonus-malus d'assurance et style de conduite. */
export interface Driver {
  /** Véhicule choisi pour les trajets (il ne roule que s'il est en état ; sinon le premier qui peut rouler le remplace). */
  vehicleId: string | null;
  points: number;
  /** Coefficient de réduction-majoration (bonus-malus) de l'assurance : 1 = neutre, moins = bonus. */
  crm: number;
  /** Mois jusqu'auquel le permis est suspendu, ou null. */
  banUntil: number | null;
  /** Mois de la dernière infraction : les points reviennent après 2 ans sans infraction. */
  lastOffense: number | null;
  style: DrivingStyle;
}

/** Membre de l'équipe : un équipier (manager) ou un manager de service (directeur, avec ses propres équipiers). */
export interface TeamMember {
  id: string;
  name: string;
  /** Humeur de 0 (à bout) à 100 (au top). Pour un manager de service, c'est celle de tout son service. */
  mood: number;
  /** Équipiers sous sa responsabilité (directeur seulement, 0 sinon). */
  staff: number;
  /** Mois de la dernière prime reçue : une prime répétée ne fait presque plus d'effet. */
  lastBonus: number | null;
  /** Trait de caractère (null : sans particularité). Il ne se révèle qu'après quelques mois. */
  trait: TeamTrait | null;
  /** Mois passés dans l'équipe : un nouvel arrivant est d'abord en formation. */
  age: number;
}

/** Événement d'équipe en attente de la réaction du joueur. `a` et `b` sont des membres. */
export interface TeamEvent {
  id: TeamEventId;
  a: string | null;
  b: string | null;
}

/** Réponse du supérieur à une demande du joueur (répartition de primes, embauche, licenciement, augmentation). */
export interface TeamReply {
  kind: 'bonus' | 'recruit' | 'fire' | 'raise';
  result: 'approved' | 'reduced' | 'refused';
  month: number;
  /** Montant accordé par personne (primes). */
  amount: number;
}

/** Dernier audit surprise du siège (ou du directeur). */
export interface TeamAudit {
  month: number;
  verdict: 'clean' | 'warning' | 'blame';
}

/** Bilan de fin de trimestre : sert à l'affichage (résultat et prime). */
export interface TeamReview {
  month: number;
  /** Production moyenne rapportée à l'objectif (1 = objectif atteint). */
  ratio: number;
  outcome: 'hit' | 'partial' | 'miss';
  /** Prime personnelle versée (0 si aucune). */
  prime: number;
  /** Directeur : résultat net de l'entreprise sur le trimestre. */
  net: number | null;
  /** Blâme reçu et pourquoi : les comptes (finance) ou l'équipe. */
  blame: 'finance' | 'team' | null;
  /** Prime refusée parce que les comptes sont dans le rouge. */
  primeBlocked: boolean;
}

/** Équipe d'un poste de manager ou de directeur. Elle n'existe que tant que le joueur occupe un tel poste. */
export interface Team {
  level: Management['level'];
  members: TeamMember[];
  /** Rythme demandé à l'équipe (voir TEAM_PACES). */
  pace: TeamPace;
  /** Mois de la partie où le trimestre en cours a commencé. */
  periodStart: number;
  /** Production cumulée sur le trimestre et nombre de mois comptés. */
  outputSum: number;
  outputMonths: number;
  /** Production moyenne exigée par la direction ce trimestre (1 = rythme habituel). */
  objective: number;
  /** Objectifs atteints de suite : ils facilitent augmentations et promotions. */
  streak: number;
  /** Manager : enveloppe de primes accordée pour le trimestre, et ce qu'il en reste. */
  budget: number;
  budgetTotal: number;
  /** Directeur : caisse de l'entreprise. */
  fund: number;
  /** Directeur : résultat net du trimestre (après primes) et part dépensée en primes et sorties. */
  periodNet: number;
  periodSpent: number;
  /** Mois de la dernière sortie d'équipe (voir TEAM.outing). */
  outingMonth: number | null;
  /** Démissions du trimestre : elles pèsent sur le bilan. */
  quits: number;
  /** Production du dernier mois écoulé. */
  lastOutput: number;
  /** Événement en attente, dernière réponse du supérieur, dernier audit, et mois avant lequel on ne peut pas redemander une approbation. */
  event: TeamEvent | null;
  reply: TeamReply | null;
  audit: TeamAudit | null;
  askWaitUntil: number;
  review: TeamReview | null;
}

export interface GameState {
  firstName: string;
  lastName: string;
  gender: Gender;
  /** Mois travaillés par domaine (job.field) : sert aux conditions d'expérience. */
  experience: Record<string, number>;
  /** Diplômes obtenus (voir TRAININGS). */
  diplomas: string[];
  training: Training | null;
  /** Candidatures en cours (3 au plus) : chacune reçoit une réponse une fois son délai écoulé. */
  applications: Application[];
  /** Réponses reçues à la fin du mois, en attente de choix du joueur (alerte). */
  jobDecision: JobDecision | null;
  /** Poste de manager proposé par l'employeur, en attente de réponse (voir PROMOTIONS), ou null. */
  promotion: string | null;
  /** L'employeur a déjà fait une proposition : les suivantes deviennent rares. */
  promotionSeen: boolean;
  /** Mois de la dernière demande de promotion faite par le joueur, ou null. */
  promotionRequested: number | null;
  /** Blâmes reçus au poste actuel pour heures sautées : renvoi au troisième. */
  jobBlames: number;
  /** Mois de la partie où le poste actuel a commencé (sert à la période d'essai). */
  jobStart: number;
  /** Efficacité (0 à 100) : sérieux et performances au travail et dans les études (voir EFFICIENCY). */
  efficiency: number;
  /** Style de travail et d'étude choisi par le joueur. */
  workStyle: WorkStyle;
  /** Mois d'arrêt maladie restants (épuisement) : 0 = en forme. */
  sickLeave: number;
  /** Mois de suite passés à efficacité nulle : au deuxième, c'est le renvoi. */
  zeroMonths: number;
  /** Domaine du dernier poste occupé : retrouver le même domaine fait repartir plus haut. */
  lastField: string | null;
  /** Supérieur du poste actuel, ou null sans emploi. */
  boss: Boss | null;
  /** Équipe encadrée (poste de manager ou de directeur), ou null. */
  team: Team | null;
  /** Mois du début du poste ou de la dernière augmentation : une nouvelle demande est possible un an plus tard. */
  raiseSince: number;
  /** Mois avant lequel le joueur ne peut plus demander d'augmentation (après un refus). */
  raiseWaitUntil: number;
  /** Contre-proposition du supérieur en attente de réponse (fraction du salaire), ou null. */
  raiseOffer: number | null;
  raiseReply: RaiseReply | null;
  /** Mois du dernier renvoi, ou null : il pèse sur les candidatures des mois suivants. */
  firedMonth: number | null;
  /** Offres d'emploi visibles. Elles expirent, et ne se renouvellent qu'avec les heures de recherche. */
  offers: JobOffer[];
  /** Boulot rapide en cours (voir GIGS), ou null. */
  gig: string | null;
  /** Boulots rapides et formations visibles : tirés au sort, renouvelés tous les 6 mois. */
  catalog: Catalog;
  /** Compétences du personnage. */
  skills: Record<SkillId, number>;
  /** Échelle des compétences de la sauvegarde (absente = ancienne échelle de 0 à 100). */
  skillMax?: number;
  /** Mois travaillés par poste (job.id) : détail de l'expérience, affiché dans le profil. */
  history: Record<string, number>;
  /** Mois écoulés depuis janvier 2026 et les 18 ans du personnage. */
  month: number;
  economy: Economy;
  /** Rapport économique de janvier, en attente de lecture (alerte). */
  report: EconomyReport | null;
  money: number;
  job: string | null;
  /** Salaire et entreprise de l'offre acceptée (null pour une ancienne sauvegarde sans entreprise). */
  jobSalary: number | null;
  jobCompany: string | null;
  home: Home;
  /** Annonces de logement visibles. Elles expirent, et ne se renouvellent qu'avec les heures de recherche de logement. */
  listings: HousingListing[];
  /** Annonce à louer pour laquelle un dossier est déposé : réponse à la fin du mois. */
  housingTarget: string | null;
  /** Sort du bien possédé actuel si le dossier de location déposé est accepté. */
  housingLeave: LeaveAction;
  /** Biens possédés où l'on n'habite pas. */
  properties: Property[];
  /** Véhicules possédés : au plus autant que de places de parking du logement. */
  vehicles: Vehicle[];
  /** Permis, assurance et style de conduite. */
  driver: Driver;
  /** Véhicules d'occasion visibles : ils expirent et se renouvellent chaque mois. */
  vehicleListings: VehicleListing[];
  schedule: Schedule;
  /** `money` est le compte courant ; l'épargne est placée ici. */
  savings: Savings;
  lastEvent: string | null;
  pendingEvent: string | null;
  /** Raison de la fin de partie, ou null si la partie continue. */
  over: OverReason | null;
  stats: Record<StatKey, number>;
  log: LogEntry[];
}

/** Les libellés vivent dans src/i18n/locales (clé = stats.<key>). */
export interface StatDef {
  key: StatKey;
  icon: string;
  color: string;
}

/** Une façon d'être qualifié pour un poste : de l'expérience dans le domaine, ou un diplôme. */
export type Qualification =
  | { type: 'experience'; field: string; months: number }
  | { type: 'diploma'; id: string };

/** Désavantage mensuel sur les jauges (valeurs négatives), tant que l'activité est en cours. */
export type Drawback = Partial<Record<StatKey, number>>;

/** Identifiants visibles par catégorie : boulots rapides, formations rapides, formations longues. */
export interface Catalog {
  gigs: string[];
  quick: string[];
  training: string[];
  /** Écart de prix (de -0.1 à +0.1) tiré pour chaque boulot rapide et chaque formation visible. */
  factors: Record<string, number>;
}

export interface JobOffer {
  jobId: string;
  /** Mois restants avant que l'offre disparaisse. */
  monthsLeft: number;
  /** Entreprise qui recrute (voir COMPANIES). */
  companyId: string;
  /** Salaire proposé : prix de base ajusté par l'entreprise, jamais sous le SMIC. */
  salary: number;
}

/** Candidature à une offre visible ; la réponse tombe quand `monthsLeft` atteint 0. */
export interface Application {
  jobId: string;
  monthsLeft: number;
}

/** Réponses du mois : offres acceptées (à prendre ou laisser) et candidatures refusées. */
export interface JobDecision {
  accepted: { jobId: string; companyId: string; salary: number }[];
  refused: string[];
}

export interface Job {
  id: string; // texte : jobs.<id> (version féminine : jobs.<id>_female)
  /** Mois de période d'essai (sinon selon le grade, voir PROBATION_MONTHS) : les blâmes y comptent double. */
  probation?: number;
  /** Prestige, de 1 (poste de base, offre durable) à 4 (offre très éphémère). */
  grade: number;
  /** Ce que le métier coûte chaque mois en santé et en bonheur (pénibilité physique, pression mentale). */
  drawback: Drawback;
  /** Domaine, pour l'expérience (textes : fields.<field>). */
  field: string;
  salary: number;
  /** Compétences minimum requises (toutes). */
  minSkills?: Partial<Record<SkillId, number>>;
  /** Si présent, il faut remplir AU MOINS UNE de ces qualifications. */
  anyOf?: Qualification[];
  /** Heures de travail par semaine. */
  hours: number;
  /** Heures de trajet par semaine (2 à 12). */
  commute: number;
  /** Poste de management : le joueur encadre une équipe (carte Équipe). */
  management?: Management;
}

export interface Outcome {
  /** Nom du résultat : texte = events.<eventId>.outcomes.<outcome>. */
  outcome: string;
  fx: Fx;
  good?: boolean;
}

export interface EventChoice {
  /** Le libellé est events.<eventId>.choices.<index>. */
  run: (state: GameState) => Outcome;
}

export interface GameEvent {
  id: string; // textes : events.<id>.title / .text
  when?: (state: GameState) => boolean;
  choices: EventChoice[];
}
