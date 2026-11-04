/** Jauges de condition : l'énergie n'existe plus, le sommeil agit directement sur la santé. */
export type StatKey = 'health' | 'happiness';

/** Compétences (0 à 100) : chaque type de connaissance a sa propre valeur. Ajouter une compétence = une entrée ici + dans SKILLS. */
export type SkillId = 'digital' | 'charisma' | 'strength' | 'intelligence' | 'logistics';

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
export type ScheduleKey = 'sleep' | 'leisure' | 'study' | 'sport' | 'search';
export type Schedule = Record<ScheduleKey, number>;

export type SavingsProduct = 'livretA' | 'ldds' | 'livretJeune' | 'pel';

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

/** Formation en cours : `monthsDone` ne progresse que les mois où le joueur étudie assez. */
export interface Training {
  id: string; // textes : trainings.<id>
  monthsDone: number;
  /** Coût mensuel fixé à l'inscription (le prix de base varie de ±10 % selon le catalogue). */
  tuition: number;
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
  /** Offre visible à laquelle on postule : une chance d'embauche est tirée chaque mois tant qu'elle existe. */
  jobTarget: string | null;
  /** Offres d'emploi visibles. Elles expirent, et ne se renouvellent qu'avec les heures de recherche. */
  offers: JobOffer[];
  /** Boulot rapide en cours (voir GIGS), ou null. */
  gig: string | null;
  /** Boulots rapides et formations visibles : tirés au sort, renouvelés tous les 6 mois. */
  catalog: Catalog;
  /** Compétences du personnage. */
  skills: Record<SkillId, number>;
  /** Mois travaillés par poste (job.id) : détail de l'expérience, affiché dans le profil. */
  history: Record<string, number>;
  /** Mois écoulés depuis les 18 ans. */
  month: number;
  money: number;
  job: string | null;
  /** Salaire et entreprise de l'offre acceptée (null pour une ancienne sauvegarde sans entreprise). */
  jobSalary: number | null;
  jobCompany: string | null;
  /** Textes : housing.<id>. */
  housing: string;
  /** Textes : cars.<id>. */
  car: string | null;
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

export interface Job {
  id: string; // texte : jobs.<id> (version féminine : jobs.<id>_female)
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
