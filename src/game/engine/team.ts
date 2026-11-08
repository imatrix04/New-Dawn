// Équipe d'un poste de manager ou de directeur : création, humeur, production, coûts. Calculs sans effet de bord.
import { REPUTATION, TEAM, TEAM_BOSS, TEAM_EXTRA, TEAM_NAMES, TEAM_PACES, TEAM_TRAIT_IDS, TEAM_TRAITS } from '../../data/content';
import type { BossType, Company, TeamTrait } from '../../data/content';
import type { GameState, Job, Team, TeamMember } from '../types';
import { jobById } from './lookup';
import { clamp, newId } from './shared';

const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const round5 = (n: number) => Math.round(n / 5) * 5;

/** Tire `count` prénoms différents (ceux déjà pris sont évités tant qu'il en reste). */
function drawNames(count: number, taken: string[] = []): string[] {
  const pool = TEAM_NAMES.filter((n) => !taken.includes(n));
  const names: string[] = [];
  while (names.length < count) {
    if (pool.length === 0) pool.push(...TEAM_NAMES);
    names.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return names;
}

/** Un trait (selon sa fréquence) pour un peu plus d'un membre sur deux. */
function drawTrait(): TeamTrait | null {
  if (Math.random() >= 0.55) return null;
  let roll = Math.random() * TEAM_TRAIT_IDS.reduce((n, id) => n + TEAM_TRAITS[id].weight, 0);
  return TEAM_TRAIT_IDS.find((id) => (roll -= TEAM_TRAITS[id].weight) < 0) ?? TEAM_TRAIT_IDS[0];
}

/** Un membre qui arrive : humeur correcte, sans plus. */
export const newMember = (name: string, staff: number, mood = rand(52, 68), age = TEAM_EXTRA.trainMonths): TeamMember => ({
  id: newId(), name, mood, staff, lastBonus: null, trait: drawTrait(), age,
});

/** Personnes encadrées en tout : les membres et, pour un directeur, leurs équipiers. */
export const teamHeadcount = (team: Team): number => team.members.reduce((n, m) => n + 1 + m.staff, 0);

/** Humeur générale : moyenne des humeurs, un service nombreux comptant plus. */
export function teamMood(team: Team): number {
  const heads = teamHeadcount(team);
  return heads === 0 ? 0 : team.members.reduce((sum, m) => sum + m.mood * (1 + m.staff), 0) / heads;
}

export type MoodLevel = 'great' | 'good' | 'ok' | 'low' | 'bad';

export function moodLevel(mood: number): MoodLevel {
  return mood >= 80 ? 'great' : mood >= 60 ? 'good' : mood >= 40 ? 'ok' : mood >= 25 ? 'low' : 'bad';
}

/** Le trait d'un membre est-il connu du joueur ? Il faut quelques mois pour cerner quelqu'un. */
export const traitKnown = (m: TeamMember): boolean => m.age >= TEAM_EXTRA.trainMonths;

/** Production d'un membre selon son humeur : 1 à l'humeur de base, 0,6 à zéro. */
export const moodFactor = (mood: number): number => 0.6 + mood / (TEAM.baseMood * 2.5);

/** Performance d'un membre ce mois-ci (1 = rendement normal) : son humeur, son trait et sa formation s'il vient d'arriver. Pour un manager de service, c'est celle de son service. */
export const memberPerf = (m: TeamMember): number =>
  moodFactor(m.mood) * (m.trait ? TEAM_TRAITS[m.trait].output : 1) * (m.age < TEAM_EXTRA.trainMonths ? TEAM_EXTRA.newcomerOutput : 1);

/** Performance moyenne d'un membre sur le trimestre en cours (sa performance actuelle si le trimestre vient de commencer). */
export const memberQuarterPerf = (m: TeamMember, team: Team): number =>
  team.outputMonths > 0 ? (m.perfSum ?? 0) / team.outputMonths : memberPerf(m);

/** Poids d'un membre dans la production : ses équipiers, son trait, et sa formation s'il vient d'arriver. */
export const memberWeight = (m: TeamMember): number =>
  (1 + m.staff) * (m.trait ? TEAM_TRAITS[m.trait].output : 1) * (m.age < TEAM_EXTRA.trainMonths ? TEAM_EXTRA.newcomerOutput : 1);

/** Type du supérieur (le directeur pour un manager, le siège pour un directeur), « équitable » à défaut. */
export const bossTypeOf = (state: GameState): BossType => state.boss?.type ?? 'fair';

/** Enveloppe de primes d'un manager pour un trimestre : par équipier, ajustée par la paie de l'entreprise, le caractère de son directeur et le dernier bilan. */
export const teamEnvelope = (team: Team, company: Company | null, boss: BossType, factor = 1): number =>
  Math.max(5, round5(teamHeadcount(team) * TEAM.budgetPerHead * (1 + (company?.pay ?? 0)) * TEAM_BOSS[boss].envelope * factor));

/**
 * Enveloppe de primes d'un directeur : une part du bénéfice du trimestre que le siège lui laisse (elle dépend du caractère du
 * siège), avec un plancher par personne.
 */
export const directorPool = (team: Team, boss: BossType, profit: number): number =>
  Math.max(round5(teamHeadcount(team) * TEAM_EXTRA.poolFloor), round5(Math.max(0, profit) * TEAM_BOSS[boss].pool));

/** Objectif de production du trimestre : il monte avec les succès de suite. */
export const teamObjective = (streak: number): number => Math.min(TEAM.objectiveMax, TEAM.objective + streak * TEAM.objectiveStep);

/** Effectif maximal : la taille de départ possible de ce poste, plus quelques recrues. */
export const maxMembers = (job: Job, company: Company | null): number =>
  Math.round((job.management?.team[1] ?? 0) * (company?.staff ?? 1)) + TEAM_EXTRA.maxExtra;

/** Crée l'équipe d'un poste de management (null si le poste n'encadre personne). */
export function newTeam(job: Job, company: Company | null, month: number, boss: BossType = 'fair', reputation = 0): Team | null {
  const cfg = job.management;
  if (!cfg) return null;
  const size = company?.staff ?? 1;
  const count = Math.max(TEAM_EXTRA.minMembers, Math.round(rand(...cfg.team) * size));
  const names = drawNames(count);
  // Une nouvelle équipe accueille mieux un manager de bonne réputation.
  const welcome = reputation * REPUTATION.startMood;
  const members = names.map((name) =>
    newMember(name, cfg.staff ? Math.max(2, Math.round(rand(...cfg.staff) * size)) : 0, clamp(rand(52, 68) + welcome, 0, 100)));
  const team: Team = {
    level: cfg.level,
    members,
    pace: 'normal',
    periodStart: month,
    outputSum: 0,
    outputMonths: 0,
    objective: teamObjective(0),
    streak: 0,
    budget: 0,
    budgetTotal: 0,
    fund: 0,
    periodNet: 0,
    periodSpent: 0,
    outingMonth: null,
    quits: 0,
    lastOutput: 1,
    event: null,
    reply: null,
    audit: null,
    askWaitUntil: 0,
    review: null,
  };
  if (cfg.level === 'manager') {
    team.budgetTotal = team.budget = teamEnvelope(team, company, boss);
  } else {
    team.fund = Math.round(teamHeadcount(team) * cfg.wage * TEAM.fundMonths);
    // Premier trimestre : le siège table sur un bénéfice normal.
    const expected = teamHeadcount(team) * cfg.wage * (TEAM.margin - 1 - TEAM.overhead) * TEAM.cycle;
    team.budgetTotal = team.budget = directorPool(team, boss, expected);
  }
  return team;
}

/** Remplaçant d'un membre parti : un nouveau prénom, le même nombre d'équipiers, il commence par se former. */
export const replacementFor = (team: Team, leaving: TeamMember): TeamMember =>
  newMember(drawNames(1, team.members.map((m) => m.name))[0], leaving.staff, rand(46, 58), 0);

/** Une recrue : comme les autres membres du service ou de l'équipe. */
export function recruitFor(team: Team): TeamMember {
  const staff = team.level === 'director' ? Math.round(team.members.reduce((n, m) => n + m.staff, 0) / Math.max(1, team.members.length)) : 0;
  return newMember(drawNames(1, team.members.map((m) => m.name))[0], staff, rand(52, 62), 0);
}

/** Part des heures de travail réellement faites : un manager absent laisse son équipe tourner moins bien. */
function presenceOf(state: GameState): number {
  const job = jobById(state.job);
  return job ? Math.min(1, state.schedule.work / job.hours) : 1;
}

/** Rythme réellement appliqué : en arrêt maladie, personne ne pousse l'équipe. */
export const effectivePace = (state: GameState) => (state.sickLeave > 0 || !state.team ? 'normal' : state.team.pace);

/** Production du mois en cours (1 = rythme habituel) : humeur, traits, rythme demandé, présence du manager. */
export function teamOutput(state: GameState): number {
  const team = state.team;
  if (!team) return 0;
  const heads = teamHeadcount(team);
  const mood = team.members.reduce((sum, m) => sum + moodFactor(m.mood) * memberWeight(m), 0) / Math.max(1, heads);
  const presence = TEAM.presenceFloor + (1 - TEAM.presenceFloor) * presenceOf(state);
  return mood * TEAM_PACES[effectivePace(state)].output * presence * (state.sickLeave > 0 ? 0.9 : 1);
}

export interface TeamProgress {
  /** Mois déjà comptés, mois restants (celui en cours inclus). */
  done: number;
  left: number;
  /** Production moyenne attendue sur le trimestre si le rythme actuel se maintient. */
  projected: number;
  /** Idem, rapportée à l'objectif. */
  ratio: number;
}

export function teamProgress(state: GameState): TeamProgress {
  const team = state.team!;
  const left = Math.max(0, TEAM.cycle - team.outputMonths);
  const projected = (team.outputSum + teamOutput(state) * left) / TEAM.cycle;
  return { done: team.outputMonths, left, projected, ratio: projected / team.objective };
}

/** Effet de l'humeur de l'équipe sur le bonheur du joueur, par mois : une équipe heureuse met de bonne humeur, une équipe à bout pèse. */
export function teamHappiness(state: GameState): number {
  if (!state.team || state.sickLeave > 0) return 0;
  const { perPoint, min, max } = TEAM.happiness;
  return Math.round(clamp((teamMood(state.team) - TEAM.baseMood) * perPoint, min, max) * 10) / 10;
}

/** Bonus à l'augmentation accordée : l'équipe qui atteint ses objectifs de suite plaide pour son manager. */
export const teamRaiseMerit = (state: GameState): number =>
  (state.team ? Math.min(TEAM.streakRaiseMax, state.team.streak * TEAM.streakRaise) : 0) + ((state.reputation ?? 0) / 100) * REPUTATION.raise;

/** Bonus de chance à la demande de promotion. */
export const teamPromotionBonus = (state: GameState): number =>
  (state.team ? Math.min(TEAM.streakPromoMax, state.team.streak * TEAM.streakPromo) : 0) + ((state.reputation ?? 0) / 100) * REPUTATION.promo;

/** Salaire moyen d'un salarié de l'équipe (0 sans équipe). */
export const teamWage = (state: GameState): number => jobById(state.job)?.management?.wage ?? 0;

/** Chance que le supérieur approuve une demande : son caractère, un peu aidé par les bons résultats. */
export const approvalChance = (state: GameState, kind: 'bonus' | 'recruit' | 'fire' | 'raise'): number =>
  clamp(TEAM_BOSS[bossTypeOf(state)][kind] + (state.team ? Math.min(0.1, state.team.streak * 0.04) : 0), 0.05, 0.98);

/** Gain d'humeur d'une prime de `perHead` € par personne : il plafonne, un euro de plus rapporte de moins en moins. */
export const bonusMoodGain = (perHead: number, wage: number): number =>
  TEAM.bonusMood * (1 - Math.exp(-perHead / Math.max(1, wage * TEAM.bonusRef)));

/** Ce membre a-t-il déjà touché une prime ces derniers mois ? Alors il s'y est habitué. */
export const bonusStale = (member: TeamMember, month: number): boolean =>
  member.lastBonus !== null && month - member.lastBonus < TEAM.cycle;

/** Gain d'humeur réel d'une prime pour ce membre : habitude et trait compris. */
export const bonusGainFor = (member: TeamMember, perHead: number, wage: number, month: number): number =>
  bonusMoodGain(perHead, wage) * (bonusStale(member, month) ? TEAM.bonusHabit : 1) * (member.trait ? TEAM_TRAITS[member.trait].bonus : 1);

/** Membres visés par une prime : tout le monde (`all`) ou un seul. */
export function bonusTargets(team: Team, target: string): TeamMember[] {
  return target === 'all' ? team.members : team.members.filter((m) => m.id === target);
}

/** Coût d'une prime de `perHead` € par personne, équipiers des services compris. */
export const bonusCost = (team: Team, target: string, perHead: number): number =>
  bonusTargets(team, target).reduce((sum, m) => sum + perHead * (1 + m.staff), 0);

/** Coût de la sortie d'équipe. */
export const outingCost = (team: Team): number => TEAM.outing.cost * teamHeadcount(team);

/** Mois à attendre avant la prochaine sortie d'équipe (0 = possible). */
export const outingWait = (state: GameState): number =>
  state.team?.outingMonth == null ? 0 : Math.max(0, TEAM.outing.every - (state.month - state.team.outingMonth));
