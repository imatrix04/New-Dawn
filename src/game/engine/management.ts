// Management : rythme, primes (soumises au supérieur), recrutement, événements d'équipe, audits, passage du mois et bilan du trimestre.
import { REPUTATION, SKILL_MAX, TEAM, TEAM_FATIGUE, TEAM_EVENT_CHOICES, TEAM_EVENT_DEFAULT, TEAM_EXTRA, TEAM_PACE_IDS, TEAM_PACES, TEAM_TRAITS } from '../../data/content';
import type { Management, TeamEventId, TeamPace, TeamTrait } from '../../data/content';
import type { GameState, Job, Team, TeamMember, TeamReply, TeamReport } from '../types';
import { blameJob } from './job';
import type { BlameCause } from './job';
import { companyById, currentSalary, jobById } from './lookup';
import { addReputation } from './reputation';
import { addLog, clamp } from './shared';
import {
  approvalChance, bonusCost, bonusGainFor, memberQuarterPerf, traitKnown, bonusTargets, bossTypeOf, directorPool, effectivePace, maxMembers, memberPerf, outingCost, outingWait, recruitFor,
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
  if (team.event && (team.event.a === id || team.event.b === id)) team.event = null;
  // Voir partir un collègue inquiète, sauf quand on le trouvait peu investi.
  for (const m of team.members) hurt(m, gone.trait === 'lazy' ? 1.5 : TEAM_EXTRA.fireFear);
  addLog(s, 'log.teamFire', { name: gone.name }, 'bad');
  return s;
}

// ---------- Événements d'équipe ----------

const charismaChance = (s: GameState) => clamp(0.35 + 0.55 * (s.skills.charisma / SKILL_MAX), 0.1, 0.95);

/** Départ d'un membre (démission, renvoi forcé par un événement) : un remplaçant arrive, recruté et formé aux frais de l'entreprise. */
function replaceMember(s: GameState, team: Team, m: TeamMember): TeamMember {
  const next = replacementFor(team, m);
  team.members = team.members.map((x) => (x.id === m.id ? next : x));
  team.quits += 1;
  if (team.level === 'director') {
    const cost = Math.round(teamWage(s) * TEAM.quitCost * (1 + m.staff));
    team.fund -= cost;
    team.periodNet -= cost;
    team.periodSpent += cost;
  }
  if (team.event && (team.event.a === m.id || team.event.b === m.id)) team.event = null;
  return next;
}

/** Tire l'événement du mois : certains n'arrivent que dans les bonnes conditions (saison, humeur, effectif). */
function drawEvent(s: GameState, team: Team): { id: TeamEventId; a: string | null; b: string | null } | null {
  const best = [...team.members].sort((x, y) => memberPerf(y) - memberPerf(x))[0];
  const many = team.members.length >= 2;
  const pool: { id: TeamEventId; w: number }[] = ([
    { id: 'rumor', w: 1 },
    { id: 'raise', w: 1 },
    { id: 'idea', w: 1 },
    { id: 'visit', w: 0.7 },
    { id: 'conflict', w: many ? 1 : 0 },
    { id: 'complaint', w: many ? 1 : 0 },
    { id: 'poach', w: team.members.length >= 3 && memberPerf(best) >= 1 ? 1 : 0 },
    { id: 'holiday', w: [5, 6, 7].includes(s.month % 12) ? 2 : 0 },
    { id: 'strike', w: teamMood(team) < 42 ? 3 : 0 },
  ] as { id: TeamEventId; w: number }[]).filter((e) => e.w > 0);
  let roll = Math.random() * pool.reduce((n, e) => n + e.w, 0);
  const id = (pool.find((e) => (roll -= e.w) < 0) ?? pool[0]).id;
  const pickFrom = (list: TeamMember[]) => list[Math.floor(Math.random() * list.length)];
  // Un trait rend un membre plus souvent concerné (les ambitieux réclament, les toxiques s'accrochent).
  const weighted = (trait: TeamTrait, k: number) => team.members.flatMap((m) => Array<TeamMember>(m.trait === trait ? k : 1).fill(m));
  if (id === 'conflict') {
    const a = pickFrom(weighted('toxic', 3));
    return { id, a: a.id, b: pickFrom(team.members.filter((m) => m.id !== a.id)).id };
  }
  if (id === 'raise') return { id, a: pickFrom(weighted('ambitious', 3)).id, b: null };
  if (id === 'complaint') return { id, a: pickFrom(weighted('toxic', 4)).id, b: null };
  if (id === 'idea') return { id, a: pickFrom(weighted('driven', 3)).id, b: null };
  if (id === 'poach' || id === 'visit') return { id, a: best.id, b: null };
  return { id, a: null, b: null };
}

/** Ce que coûte une réaction : une part de l'enveloppe de primes, et de l'argent (au manager) ou de la caisse (au directeur). */
function choiceNeeds(team: Team, id: TeamEventId, a: TeamMember | undefined, index: number): { budget: number; cash: number } {
  const staff = 1 + (a?.staff ?? 0);
  if (id === 'raise' && index === 1) return { budget: 100 * staff, cash: 0 };
  if (id === 'poach' && index === 0) return { budget: 150 * staff, cash: 0 };
  if (id === 'idea' && index === 0) return { budget: 50, cash: 0 };
  if (id === 'rumor' && index === 2) return { budget: 0, cash: 20 * teamHeadcount(team) };
  if (id === 'strike' && index === 0) return { budget: 0, cash: 60 * teamHeadcount(team) };
  return { budget: 0, cash: 0 };
}

/** Le choix `index` de l'événement en attente est-il faisable (enveloppe, argent) ? */
export function eventChoiceOk(state: GameState, index: number): boolean {
  const team = state.team;
  const ev = team?.event;
  if (!team || !ev || index < 0 || index >= TEAM_EVENT_CHOICES[ev.id]) return false;
  const need = choiceNeeds(team, ev.id, team.members.find((m) => m.id === ev.a), index);
  return need.budget <= team.budget && (team.level === 'director' || state.money >= need.cash);
}

/** Applique la réaction `index` à l'événement en attente et le clôt. */
function applyEvent(s: GameState, index: number) {
  const team = s.team!;
  const ev = team.event!;
  const a = team.members.find((m) => m.id === ev.a);
  const b = team.members.find((m) => m.id === ev.b);
  const need = choiceNeeds(team, ev.id, a, index);
  if (need.budget) spend(team, need.budget, true);
  if (need.cash) {
    if (team.level === 'manager') s.money -= need.cash;
    else spend(team, need.cash, false);
  }
  const everyone = (d: number) => team.members.forEach((m) => bump(m, d));
  const others = (d: number) => team.members.filter((m) => m.id !== a?.id).forEach((m) => bump(m, d));
  const eff = (d: number) => { s.efficiency = clamp(s.efficiency + d); };
  const names = { a: a?.name ?? '', b: b?.name ?? '' };
  let outcome = 'ignored';
  let tone: 'good' | 'bad' | '' = '';

  switch (ev.id) {
    case 'conflict':
      if (!a || !b) break;
      if (index === 0) {
        const ok = Math.random() < charismaChance(s);
        outcome = ok ? 'mediated' : 'mediateFail';
        for (const m of [a, b]) bump(m, ok ? 5 : -5);
        tone = ok ? 'good' : 'bad';
      } else if (index === 1) {
        outcome = 'sided'; bump(a, 6); hurt(b, 9);
      } else {
        outcome = 'ignored'; hurt(a, 7); hurt(b, 7); tone = 'bad';
      }
      break;
    case 'raise':
      if (!a) break;
      if (index === 0) {
        const win = Math.random() < approvalChance(s, 'raise');
        outcome = win ? 'pushWin' : 'pushLose';
        if (win) bump(a, 14); else hurt(a, 10);
        tone = win ? 'good' : 'bad';
      } else if (index === 1) {
        outcome = 'bonused'; bump(a, 9); tone = 'good';
      } else {
        outcome = 'refused'; hurt(a, 8); tone = 'bad';
      }
      break;
    case 'rumor':
      if (index === 0) {
        const ok = Math.random() < charismaChance(s);
        outcome = ok ? 'reassured' : 'reassureFail';
        everyone(ok ? 6 : -4);
        tone = ok ? 'good' : 'bad';
      } else if (index === 2) {
        outcome = 'meeting'; everyone(3); tone = 'good';
      } else {
        outcome = 'silent'; everyone(-6); tone = 'bad';
      }
      break;
    case 'poach':
      if (!a) break;
      if (index === 0) {
        outcome = 'kept'; bump(a, 8); tone = 'good';
      } else if (index === 2 && Math.random() < charismaChance(s)) {
        outcome = 'bluffWin'; bump(a, 3); tone = 'good';
      } else {
        outcome = index === 2 ? 'bluffFail' : 'left';
        replaceMember(s, team, a);
        others(index === 2 ? -5 : -3);
        tone = 'bad';
      }
      break;
    case 'complaint':
      if (!a) break;
      if (index === 0) {
        const guilty = Math.random() < (a.trait === 'toxic' ? 0.85 : 0.25);
        if (guilty) {
          outcome = 'investigatedGuilty'; hurt(a, 10); others(5); a.age = Math.max(a.age, TEAM_EXTRA.trainMonths); tone = 'good';
        } else {
          outcome = 'investigatedInnocent'; hurt(a, 6); others(-2); tone = 'bad';
        }
      } else if (index === 1) {
        outcome = 'warned'; hurt(a, 4); others(1);
      } else {
        outcome = 'dismissed'; bump(a, 2); others(-6); tone = 'bad';
      }
      break;
    case 'holiday':
      if (index === 0) { outcome = 'granted'; everyone(8); team.outputSum = Math.max(0, team.outputSum - 0.06); tone = 'good'; }
      else if (index === 1) { outcome = 'rotation'; everyone(3); team.outputSum = Math.max(0, team.outputSum - 0.02); tone = 'good'; }
      else { outcome = 'refusedLeave'; everyone(-5); tone = 'bad'; }
      break;
    case 'strike':
      if (index === 0) { outcome = 'negotiated'; everyone(8); tone = 'good'; }
      else if (index === 1) { outcome = 'hardline'; everyone(-8); eff(-2); tone = 'bad'; }
      else {
        outcome = 'walkout'; everyone(-5);
        const worst = [...team.members].sort((x, y) => x.mood - y.mood)[0];
        names.a = worst.name;
        replaceMember(s, team, worst);
        tone = 'bad';
      }
      break;
    case 'idea':
      if (!a) break;
      if (index === 0) { outcome = 'backed'; bump(a, 10); others(2); eff(2); tone = 'good'; }
      else if (index === 1) { outcome = 'shelved'; hurt(a, 4); }
      else { outcome = 'credit'; hurt(a, 10); eff(3); }
      break;
    case 'visit':
      if (index === 0) { outcome = 'prepared'; everyone(-3); eff(team.lastOutput >= 0.95 ? 4 : 1); tone = 'good'; }
      else if (index === 1) {
        const ok = Math.random() < 0.5;
        outcome = ok ? 'improvisedGood' : 'improvisedBad'; eff(ok ? 3 : -3); tone = ok ? 'good' : 'bad';
      } else if (a) { outcome = 'delegated'; bump(a, 6); others(-2); eff(2); tone = 'good'; }
      break;
  }
  // Un événement dont le membre a disparu en chemin se clôt sans suite.
  if (outcome !== 'ignored' || ev.id === 'conflict') addLog(s, `log.teamEvent.${ev.id}.${outcome}`, names, tone);
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
  team.event = drawEvent(s, team);
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
    addReputation(s, REPUTATION.auditClean);
    addLog(s, 'log.teamAuditClean', {}, 'good');
  } else if (verdict === 'warning') {
    s.efficiency = clamp(s.efficiency + TEAM_EXTRA.audit.warn);
    addLog(s, 'log.teamAuditWarning', {}, 'bad');
  } else {
    addLog(s, 'log.teamAuditBlame', {}, 'bad');
    addReputation(s, REPUTATION.blame);
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
  // Certains traits pèsent (ou aident) toute l'équipe : les toxiques tirent vers le bas, les mentors vers le haut et forment les recrues.
  const auraTotal = team.members.reduce((n, x) => n + (x.trait ? TEAM_TRAITS[x.trait].aura : 0), 0);
  const mentored = team.members.some((x) => x.trait && TEAM_TRAITS[x.trait].train > 0);
  for (const m of team.members) {
    const t = m.trait ? TEAM_TRAITS[m.trait] : null;
    const push = pace.mood < 0 && t ? t.push : 1;
    const pull = (TEAM.baseMood - m.mood) * TEAM.moodPull;
    const aura = auraTotal - (t?.aura ?? 0);
    m.mood = clamp(m.mood + (pace.mood + fatigue) * push + climate + pull + aura + (Math.random() * 2 - 1) * TEAM.moodNoise * (t?.noise ?? 1));
    m.age += m.age < TEAM_EXTRA.trainMonths && mentored ? 2 : 1;
  }

  // Démissions : un membre à bout peut claquer la porte, un remplaçant arrive aussitôt (en formation).
  for (const m of [...team.members]) {
    const chance = TEAM.quitChance * (m.trait ? TEAM_TRAITS[m.trait].quit : 1);
    if (m.mood >= TEAM.quitBelow || Math.random() >= chance) continue;
    const next = replaceMember(s, team, m);
    addLog(s, 'log.teamQuit', { name: m.name, next: next.name }, 'bad');
  }

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
  // Réputation : le résultat, une équipe qui reste (aucun départ) et heureuse.
  const repGain = (blame ? REPUTATION.blame : REPUTATION[outcome])
    + (team.quits === 0 && outcome !== 'miss' ? REPUTATION.calm : 0) + (teamMood(team) >= 70 ? REPUTATION.happy : 0);
  const repDelta = addReputation(s, repGain);
  // Classement des membres sur le trimestre (avant la remise à zéro).
  const ranked = [...team.members].sort((x, y) => memberQuarterPerf(y, team) - memberQuarterPerf(x, team)).map((x) => ({
    name: x.name, perf: memberQuarterPerf(x, team), mood: x.mood, trait: traitKnown(x) ? x.trait : null, staff: x.staff,
  }));
  const quitsThisQuarter = team.quits;
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
  let dividendPaid = 0;
  // Le siège reprend une part du bénéfice : la caisse ne sert qu'à faire tourner l'entreprise.
  if (director && team.periodNet > 0) {
    const dividend = Math.round(team.periodNet * TEAM.dividend);
    team.fund -= dividend;
    dividendPaid = dividend;
    addLog(s, 'log.teamDividend', { amount: dividend });
  }
  team.periodStart = s.month + 1;
  team.outputSum = 0;
  team.outputMonths = 0;
  team.quits = 0;
  const wasObjective = team.objective;
  team.objective = teamObjective(team.streak);
  if (director) {
    // Plafond des primes : une petite part du bénéfice avant primes, fixée par le siège selon son humeur.
    team.budgetTotal = team.budget = directorPool(team, boss, operating);
    addLog(s, 'log.teamPool', { amount: team.budget });
  } else {
    team.budgetTotal = team.budget = teamEnvelope(team, companyById(s.jobCompany), boss, outcome === 'hit' ? 1.15 : outcome === 'miss' ? 0.85 : 1);
    addLog(s, 'log.teamEnvelope', { amount: team.budget });
  }
  const report: TeamReport = {
    month: s.month, ratio, objective: wasObjective, outcome, prime, net, blame, primeBlocked, streak: team.streak, quits: quitsThisQuarter,
    members: ranked, nextBudget: team.budget, dividend: dividendPaid, repDelta, repTotal: s.reputation,
  };
  s.teamReport = report;
  team.periodNet = 0;
  team.periodSpent = 0;
  for (const m of team.members) m.perfSum = 0;

  // En dernier : un blâme peut aller jusqu'au renvoi, qui supprime l'équipe.
  if (blame) blameJob(s, job, 0, blame);
}

/** Le joueur a lu le bilan du trimestre. */
export function dismissTeamReport(state: GameState): GameState {
  return state.teamReport ? { ...state, teamReport: null } : state;
}
