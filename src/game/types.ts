export type StatKey = 'health' | 'happiness' | 'energy' | 'knowledge';

/** Variation appliquée à l'état : argent et/ou jauges. */
export type Fx = Partial<Record<StatKey | 'money', number>>;

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

/** Choix faits à la création du personnage. */
export interface Profile {
  firstName: string;
  lastName: string;
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

export interface GameState {
  firstName: string;
  lastName: string;
  /** Mois écoulés depuis les 18 ans. */
  month: number;
  money: number;
  job: string | null;
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

export interface Job {
  id: string; // texte : jobs.<id>
  salary: number;
  knowledge: number;
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
