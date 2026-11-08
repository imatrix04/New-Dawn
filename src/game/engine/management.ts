// Management : rythme, primes (soumises au supérieur), recrutement, événements d'équipe, audits, passage du mois et bilan du trimestre.
import { SKILL_MAX, TEAM, TEAM_FATIGUE, TEAM_EVENT_CHOICES, TEAM_EVENT_DEFAULT, TEAM_EXTRA, TEAM_PACE_IDS, TEAM_PACES, TEAM_TRAITS } from '../../data/content';
import type { Management, TeamEventId, TeamPace } from '../../data/content';
import type { GameState, Job, Team, TeamMember, TeamReply } from '../types';
import { blameJob } from './job';
import type { BlameCause } from './job';
import { companyById, currentSalary, jobById } from './lookup';
import { addLog, clamp } from './shared';
import {
  approvalChance, bonusCost, bonusGainFor, bonusTargets, bossTypeOf, directorPool, effectivePace, maxMembers, memberPerf, outingCost, outingWait, recruitFor,
  replacementFor, teamEnvelope, teamHeadcount, teamMood, teamObjective, teamOutput, teamWage,
} from './team';

const bump = (m: TeamMember, delta: number) => { m.mood = clamp(m.mood + delta); };
/** Une perte d'humeur « subie » : les ambitieux la prennent plus mal. */
const hurt = (m: TeamMember, delta: number) => bump(m, -delta * (m.trait ? TEAM_TRAITS[m.trait].denied : 1));

/** Choisit le rythme demandé à l'équipe (sans coût : seule l'humeur en pâtit). */
export function setTeamPace(state: GameState, pace: TeamPace): GameState {
  if (!state.team || !TEAM_PACE_IDS.includes(pace) || pace === state.team.pace) return state;
  return { ...state, team: { ...state.team, pace } };
}

/** Une dépense de primes, de sortie ou de recrutement : elle puise dans l'enveloppe (primes) et dans la caisse du directeur. */
function spend(team: Team, cost: number, fromBudget: boolean) {
  if (fromBudget) team.budget -= cost;
  if (team.level === 'director') {
    team.fund -= cost;
    team.periodNet -= cost;
    team.periodSpent += cost;
  }
}

/** Le supérieur répond à une demande : approuvée, réduite de moitié (primes seulement) ou refusée, selon son caractère. */
function askBoss(chance: number, canReduce = false): TeamReply['result'] {
  const roll = Math.random();
  const result = roll < chance ? 'approved' : canReduce && roll < chance + (1 - chance) * 0.5 ? 'reduced' : 'refused';
  return result;
}

/** Une prime est-elle possible ? Elle ne peut dépasser l'enveloppe (accordée par le supérieur), et un refus récent impose d'attendre. */
export function bonusCheck(state: GameState, target: string, perHead: number): 'ok' | 'invalid' | 'budget' | 'wait' {
  const team = state.team;
  if (!team || !(perHead >= TEAM.bonusMin) || perHead > TEAM.bonusMax || bonusTargets(team, target).length === 0) return 'invalid';
  if (bonusCost(team, target, perHead) > team.budget) return 'budget';
  return team.level === 'manager' && team.askWaitUntil > state.month ? 'wait' : 'ok';
}

/** Chance d'approbation d'une répartition de primes : plus on demande de l'enveloppe, plus le supérieur hésite. */
export function bonusApproval(state: GameState, target: string, perHead: number): number {
  const team = state.team;
  if (!team) return 0;
  if (team.level === 'director') return 1;
  const share = bonusCost(team, target, perHead) / Math.max(1, team.budgetTotal);
  return clamp(approvalChance(state, 'bonus') - 0.25 * Math.max(0, share - 0.6), 0.05, 0.98);
}

/**
 * Verse une prime de `perHead` € à chaque personne visée (`all` ou l'identifiant d'un membre). Un manager envoie d'abord sa
 * répartition à son directeur, qui l'approuve, la réduit de moitié ou la refuse ; un directeur décide seul, dans la limite de
 * l'enveloppe que le siège lui laisse sur le bénéfice.
 */
export function giveTeamBonus(state: GameState, target: string, perHead: number): GameState {
  if (bonusCheck(state, target, perHead) !== 'ok') return state;
  const s = structuredClone(state);
  const team = s.team!;
  let amount = perHead;
  if (team.level === 'manager') {
    const result = askBoss(bonusApproval(state, target, perHead), true);
    if (result === 'reduced') amount = Math.max(TEAM.bonusMin, Math.floor(perHead / 2 / TEAM.bonusStep) * TEAM.bonusStep);
    team.reply = { kind: 'bonus', result, month: s.month, amount: result === 'refused' ? 0 : amount };
    if (result === 'refused') {
      team.askWaitUntil = s.month + 1;
      addLog(s, 'log.teamBonusRefused', {}, 'bad');
      return s;
    }
  }
  const cost = bonusCost(team, target, amount);
  const wage = teamWage(s);
  for (const m of bonusTargets(team, target)) {
    bump(m, bonusGainFor(m, amount, wage, s.month));
    m.lastBonus = s.month;
  }
  spend(team, cost, true);
  const who = target === 'all' ? null : team.members.find((m) => m.id === target)!.name;
  const key = team.reply?.result === 'reduced' ? 'log.teamBonusReduced' : who ? 'log.teamBonusOne' : 'log.teamBonusAll';
  addLog(s, key, { amount: cost, perHead: amount, name: who ?? '' }, 'good');
  return s;
}

/**
 * Sortie d'équipe (repas, activité) : tout le monde y gagne en humeur, périodiquement. Le directeur la fait payer à
 * l'entreprise, le manager de sa poche.
 */
export function teamOuting(state: GameState): GameState {
  const team = state.team;
  if (!team || outingWait(state) > 0) return state;
  const cost = outingCost(team);
  if (team.level === 'manager' && state.money < cost) return state;
  const s = structuredClone(state);
  const t = s.team!;
  for (const m of t.members) bump(m, TEAM.outing.mood);
  t.outingMonth = s.month;
  if (t.level === 'manager') s.money -= cost;
  else spend(t, cost, false);
  addLog(s, t.level === 'manager' ? 'log.teamOutingOwn' : 'log.teamOutingFund', { amount: cost }, 'good');
  return s;
}

// ---------- Recrutement et licenciement ----------

/** Frais de recrutement ou d'indemnités pour le directeur (en mois de salaire, équipiers du service compris). */
const staffCost = (s: GameState, months: number, staff: number) => Math.round(teamWage(s) * months * (1 + staff));

export function canRecruit(state: GameState): boolean {
  const job = jobById(state.job);
  const team = state.team;
  return !!team && !!job && team.members.length < maxMembers(job, companyById(state.jobCompany)) && team.askWaitUntil <= state.month;
}

/** Recrute un nouveau membre (en formation les premiers mois). Un manager doit obtenir l'accord de son directeur. */
export function recruitMember(state: GameState): GameState {
  if (!canRecruit(state)) return state;
  const s = structuredClone(state);
  const team = s.team!;
  const recruit = recruitFor(team);
  if (team.level === 'manager') {
    const result = askBoss(approvalChance(state, 'recruit'));
    team.reply = { kind: 'recruit', result, month: s.month, amount: 0 };
    if (result === 'refused') {
      team.askWaitUntil = s.month + 2;
      addLog(s, 'log.teamRecruitRefused', {}, 'bad');
      return s;
    }
  } else {
    spend(team, staffCost(s, TEAM_EXTRA.recruitCost, recruit.staff), false);
  }
  team.members.push(recruit);
  addLog(s, 'log.teamRecruit', { name: recruit.name }, 'good');
  return s;
}

export function canFire(state: GameState, id: string): boolean {
  const team = state.team;
  return !!team && team.members.length > TEAM_EXTRA.minMembers && team.members.some((m) => m.id === id) && team.askWaitUntil <= state.month;
}

/** Licencie un membre : ses collègues s'inquiètent. Un manager doit obtenir l'accord de son directeur, le directeur paie des indemnités. */
export function fireMember(state: GameState, id: string): GameState {
  if (!canFire(state, id)) return state;
  const s = structuredClone(state);
  const team = s.team!;
  const gone = team.members.find((m) => m.id === id)!;
  if (team.level === 'manager') {
    const result = askBoss(approvalChance(state, 'fire'));
    team.reply = { kind: 'fire', result, month: s.month, amount: 0 };
    if (result === 'refused') {
      team.askWaitUntil = s.month + 2;
      addLog(s, 'log.teamFireRefused', { name: gone.name }, 'bad');
      return s;
    }
  } else {
    spend(team, staffCost(s, TEAM_EXTRA.fireCost, gone.staff), false);
  }
  team.members = team.members.filter((m) => m.id !== id);
  // Voir partir un collègue inquiète, sauf quand on le trouvait peu investi.
  for (const m of team.members) hurt(m, gone.trait === 'lazy' ? 1.5 : TEAM_EXTRA.fireFear);
  addLog(s, 'log.teamFire', { name: gone.name }, 'bad');
  return s;
}

// ---------- Événements d'équipe ----------

const charismaChance = (s: GameState) => clamp(0.35 + 0.55 * (s.skills.charisma / SKILL_MAX), 0.1, 0.95);

function drawEvent(team: Team): { id: TeamEventId; a: string | null; b: string | null } | null {
  const pool: { id: TeamEventId; w: number }[] = [{ id: 'rumor', w: 1 }];
  if (team.members.length >= 2) pool.push({ id: 'conflict', w: 1 });
  pool.push({ id: 'raise', w: 1 });
  const total = pool.reduce((n, e) => n + e.w, 0);
  let roll = Math.random() * total;
  const id = (pool.find((e) => (roll -= e.w) < 0) ?? pool[0]).id;
  const pick = (exclude?: string) => {
    const list = team.members.filter((m) => m.id !== exclude);
    return list[Math.floor(Math.random() * list.length)];
  };
  if (id === 'conflict') { const a = pick(); return { id, a: a.id, b: pick(a.id).id }; }
  if (id === 'raise') {
    // Les ambitieux sont les premiers à réclamer.
    const weighted = team.members.flatMap((m) => (m.trait === 'ambitious' ? [m, m, m] : [m]));
    return { id, a: weighted[Math.floor(Math.random() * weighted.length)].id, b: null };
  }
  return { id, a: null, b: null };
}

/** Le choix `index` de l'événement en attente est-il faisable (argent, enveloppe) ? */
export function eventChoiceOk(state: GameState, index: number): boolean {
  const team = state.team;
  const ev = team?.event;
  if (!team || !ev || index < 0 || index >= TEAM_EVENT_CHOICES[ev.id]) return false;
  const a = team.members.find((m) => m.id === ev.a);
  if (ev.id === 'raise') return index !== 1 || (!!a && team.budget >= 100 * (1 + a.staff));
  if (ev.id === 'rumor' && index === 2) return team.level === 'director' || state.money >= 20 * teamHeadcount(team);
  return true;
}

/** Applique la réaction `index` à l'événement en attente et le clôt. */
function applyEvent(s: GameState, index: number) {
  const team = s.team!;
  const ev = team.event!;
  const a = team.members.find((m) => m.id === ev.a);
  const b = team.members.find((m) => m.id === ev.b);
  const names = { a: a?.name ?? '', b: b?.name ?? '' };
  let outcome = 'ignored';
  const log = (cls: 'good' | 'bad' | '' = '') => addLog(s, `log.teamEvent.${ev.id}.${outcome}`, names, cls);

  if (ev.id === 'conflict' && a && b) {
    if (index === 0) {
      const ok = Math.random() < charismaChance(s);
      outcome = ok ? 'mediated' : 'mediateFail';
      for (const m of [a, b]) bump(m, ok ? 5 : -5);
      log(ok ? 'good' : 'bad');
    } else if (index === 1) {
      outcome = 'sided';
      bump(a, 6);
      hurt(b, 9);
      log();
    } else {
      outcome = 'ignored';
      hurt(a, 7);
      hurt(b, 7);
      log('bad');
    }
  } else if (ev.id === 'raise' && a) {
    if (index === 0) {
      const win = Math.random() < approvalChance(s, 'raise');
      outcome = win ? 'pushWin' : 'pushLose';
      if (win) bump(a, 14); else hurt(a, 10);
      log(win ? 'good' : 'bad');
    } else if (index === 1 && team.budget >= 100 * (1 + a.staff)) {
      outcome = 'bonused';
      bump(a, 9);
      spend(team, 100 * (1 + a.staff), true);
      log('good');
    } else {
      outcome = 'refused';
      hurt(a, 8);
      log('bad');
    }
  } else if (ev.id === 'rumor') {
    if (index === 0) {
      const ok = Math.random() < charismaChance(s);
      outcome = ok ? 'reassured' : 'reassureFail';
      for (const m of team.members) bump(m, ok ? 6 : -4);
      log(ok ? 'good' : 'bad');
    } else if (index === 2 && (team.level === 'director' || s.money >= 20 * teamHeadcount(team))) {
      outcome = 'meeting';
      const cost = 20 * teamHeadcount(team);
      if (team.level === 'manager') s.money -= cost; else spend(team, cost, false);
      for (const m of team.members) bump(m, 3);
      log('good');
    } else {
      outcome = 'silent';
      for (const m of team.members) bump(m, -6);
      log('bad');
    }
  }
  team.event = null;
}

/** Réaction du joueur à l'événement d'équipe en attente. */
export function resolveTeamEvent(state: GameState, index: number): GameState {
  if (!eventChoiceOk(state, index)) return state;
  const s = structuredClone(state);
  applyEvent(s, index);
  return s;
}

/** Fin de mois : un événement resté sans réponse tourne mal, puis un nouveau peut survenir. */
function rollTeamEvent(s: GameState, team: Team) {
  if (team.event) {
    applyEvent(s, TEAM_EVENT_DEFAULT[team.event.id]);
    addLog(s, 'log.teamEventLate', {}, 'bad');
  }
  if (Math.random() >= TEAM_EXTRA.eventChance) return;
  team.event = drawEvent(team);
  if (team.event) addLog(s, 'log.teamEventNew', { id: team.event.id });
}

// ---------- Audit surprise ----------

/**
 * Audit surprise du siège (directeur) ou du directeur (manager) : s'il ne trouve rien, c'est un bon point ; un souci
 * mineur, un avertissement ; deux soucis ou une caisse dans le rouge, un blâme.
 */
function audit(s: GameState, team: Team, cfg: Management) {
  const finance: string[] = [];
  const climate: string[] = [];
  if (cfg.level === 'director') {
    if (team.fund < 0) finance.push('red', 'red');
    if (team.periodSpent > Math.max(0, team.periodNet + team.periodSpent)) finance.push('spending');
  }
  if (teamMood(team) < 30) climate.push('mood');
  if (team.quits >= 2) climate.push('quits');
  if (team.lastOutput < 0.8) climate.push('output');
  const issues = finance.length + climate.length;
  const verdict = issues === 0 ? 'clean' : issues === 1 ? 'warning' : 'blame';
  team.audit = { month: s.month, verdict };
  if (verdict === 'clean') {
    s.efficiency = clamp(s.efficiency + TEAM_EXTRA.audit.praise);
    addLog(s, 'log.teamAuditClean', {}, 'good');
  } else if (verdict === 'warning') {
    s.efficiency = clamp(s.efficiency + TEAM_EXTRA.audit.warn);
    addLog(s, 'log.teamAuditWarning', {}, 'bad');
  } else {
    addLog(s, 'log.teamAuditBlame', {}, 'bad');
  }
  return verdict === 'blame' ? (finance.length > 0 ? 'finance' : 'team') as BlameCause : null;
}

// ---------- Passage du mois ----------

/**
 * Fin de mois d'une équipe : production du mois (sur l'humeur de début de mois, comme l'aperçu affiché), finances du
 * directeur, évolution de l'humeur, démissions, événement, audit, puis le bilan si le trimestre se termine.
 */
export function progressTeam(s: GameState) {
  const team = s.team;
  const job = jobById(s.job);
  const cfg = job?.management;
  if (!team || !job || !cfg) return;

  const output = teamOutput(s);
  team.outputSum += output;
  team.outputMonths += 1;
  team.lastOutput = output;

  if (cfg.level === 'director') {
    // Recette liée à la production et au marché, moins les salaires et les charges.
    const heads = teamHeadcount(team);
    const market = 1 + (Math.random() * 2 - 1) * TEAM.market;
    const revenue = heads * cfg.wage * TEAM.margin * output * market;
    const costs = heads * cfg.wage * (1 + TEAM.overhead);
    const net = Math.round(revenue - costs);
    team.fund += net;
    team.periodNet += net;
  }

  // Humeur : rythme demandé, ambiance de l'entreprise, retour vers l'humeur de base et un peu de hasard.
  // Performance du mois de chaque membre, sur l'humeur de début de mois comme la production d'équipe.
  for (const m of team.members) m.perfSum = (m.perfSum ?? 0) + memberPerf(m);
  const climate = (companyById(s.jobCompany)?.drawback.happiness ?? 0) * TEAM.climate;
  const paceId = effectivePace(s);
  const pace = TEAM_PACES[paceId];
  // À fond plusieurs mois de suite : l'épuisement s'accumule.
  team.pushMonths = paceId === 'push' ? (team.pushMonths ?? 0) + 1 : 0;
  const fatigue = paceId === 'push' ? -Math.min(TEAM_FATIGUE.pushStackMax, (team.pushMonths - 1) * TEAM_FATIGUE.pushStack) : 0;
  for (const m of team.members) {
    const push = pace.mood < 0 && m.trait ? TEAM_TRAITS[m.trait].push : 1;
    const pull = (TEAM.baseMood - m.mood) * TEAM.moodPull;
    m.mood = clamp(m.mood + (pace.mood + fatigue) * push + climate + pull + (Math.random() * 2 - 1) * TEAM.moodNoise);
    m.age += 1;
  }

  // Démissions : un membre à bout peut claquer la porte, un remplaçant arrive aussitôt (en formation).
  team.members = team.members.map((m) => {
    const chance = TEAM.quitChance * (m.trait ? TEAM_TRAITS[m.trait].quit : 1);
    if (m.mood >= TEAM.quitBelow || Math.random() >= chance) return m;
    const next = replacementFor(team, m);
    team.quits += 1;
    // Recruter et former le remplaçant coûte cher à l'entreprise.
    if (cfg.level === 'director') {
      const cost = Math.round(cfg.wage * TEAM.quitCost * (1 + m.staff));
      team.fund -= cost;
      team.periodNet -= cost;
      team.periodSpent += cost;
    }
    if (team.event && (team.event.a === m.id || team.event.b === m.id)) team.event = null;
    addLog(s, 'log.teamQuit', { name: m.name, next: next.name }, 'bad');
    return next;
  });

  rollTeamEvent(s, team);

  const closing = team.outputMonths >= TEAM.cycle;
  const auditDue = !closing && s.month - (team.audit?.month ?? -99) >= TEAM_EXTRA.audit.gap && Math.random() < TEAM_EXTRA.audit.chance;
  const auditBlame = auditDue ? audit(s, team, cfg) : null;

  if (closing) review(s, team, job, cfg);
  else if (auditBlame) blameJob(s, job, 0, auditBlame);
}

/**
 * Bilan du trimestre. Production moyenne contre objectif : atteint, c'est une prime personnelle, une efficacité en hausse et
 * un objectif plus haut au tour suivant ; presque atteint, une demi-prime ; raté, rien, et un blâme si l'échec est cuisant.
 * Un directeur est aussi jugé sur les comptes : un trimestre dans le rouge supprime sa prime, et lui vaut un blâme si ce sont
 * ses primes et ses sorties qui l'ont creusé (ou si son équipe n'a pas produit).
 */
function review(s: GameState, team: Team, job: Job, cfg: Management) {
  const director = cfg.level === 'director';
  // Chaque démission du trimestre a désorganisé l'équipe : elle retire une part de l'objectif.
  const ratio = team.outputSum / team.outputMonths / team.objective - Math.min(0.15, team.quits * TEAM.quitPenalty);
  const outcome = ratio >= 1 ? 'hit' : ratio >= TEAM.partialAt ? 'partial' : 'miss';
  const net = director ? team.periodNet : null;
  const inRed = director && team.periodNet < 0;
  // Résultat avant les primes et les sorties : si l'entreprise gagnait de l'argent sans elles, c'est le directeur qui l'a dilapidé.
  const operating = team.periodNet + team.periodSpent;

  let blame: 'finance' | 'team' | null = null;
  if (inRed && operating >= 0) blame = 'finance';
  else if (inRed && ratio < TEAM.financeBlameRatio) blame = 'team';
  else if (ratio < TEAM.blameBelow) blame = 'team';

  const primeBlocked = inRed && outcome !== 'miss' && !blame;
  let prime = 0;
  if (!blame && !inRed && outcome !== 'miss') {
    const base = currentSalary(s) * TEAM.prime[cfg.level];
    prime = Math.round(base * (outcome === 'hit' ? clamp(ratio, 1, TEAM.primeMaxRatio) : TEAM.partialPrime));
  }

  s.efficiency = clamp(s.efficiency + TEAM.efficiency[outcome]);
  // Objectifs de suite : un blâme ou un échec remet le compteur à zéro, un « presque » le laisse tel quel.
  team.streak = blame || outcome === 'miss' ? 0 : outcome === 'hit' ? team.streak + 1 : team.streak;
  if (prime > 0) s.money += prime;
  team.review = { month: s.month, ratio, outcome, prime, net, blame, primeBlocked };

  const pct = Math.round(ratio * 100);
  if (prime > 0) addLog(s, outcome === 'hit' ? 'log.teamHit' : 'log.teamPartial', { pct, amount: prime }, 'good');
  else if (primeBlocked) addLog(s, 'log.teamNoPrimeRed', { pct, amount: Math.round(-(net ?? 0)) }, 'bad');
  else if (outcome === 'miss') addLog(s, 'log.teamMiss', { pct }, 'bad');
  else addLog(s, 'log.teamNoPrime', { pct }, 'bad');
  if (inRed && !blame) addLog(s, 'log.teamMarket', { amount: Math.round(-(net ?? 0)) });

  // Nouveau trimestre : l'objectif et l'enveloppe de primes suivent le bilan.
  const boss = bossTypeOf(s);
  // Le siège reprend une part du bénéfice : la caisse ne sert qu'à faire tourner l'entreprise.
  if (director && team.periodNet > 0) {
    const dividend = Math.round(team.periodNet * TEAM.dividend);
    team.fund -= dividend;
    addLog(s, 'log.teamDividend', { amount: dividend });
  }
  team.periodStart = s.month + 1;
  team.outputSum = 0;
  team.outputMonths = 0;
  team.quits = 0;
  team.objective = teamObjective(team.streak);
  if (director) {
    // Plafond des primes : une petite part du bénéfice avant primes, fixée par le siège selon son humeur.
    team.budgetTotal = team.budget = directorPool(team, boss, operating);
    addLog(s, 'log.teamPool', { amount: team.budget });
  } else {
    team.budgetTotal = team.budget = teamEnvelope(team, companyById(s.jobCompany), boss, outcome === 'hit' ? 1.15 : outcome === 'miss' ? 0.85 : 1);
    addLog(s, 'log.teamEnvelope', { amount: team.budget });
  }
  team.periodNet = 0;
  team.periodSpent = 0;
  for (const m of team.members) m.perfSum = 0;

  // En dernier : un blâme peut aller jusqu'au renvoi, qui supprime l'équipe.
  if (blame) blameJob(s, job, 0, blame);
}
