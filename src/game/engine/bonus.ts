// Primes des employés : prime de fin de trimestre du manager, et intéressement annuel de certaines entreprises.
import { EMPLOYEE_BONUS, PROFIT_SHARE, TEAM, TEAM_BOSS } from '../../data/content';
import type { GameState, Job } from '../types';
import { workedHours } from './job';
import { companyById, currentSalary } from './lookup';
import { addLog, clamp } from './shared';
import { bossTypeOf } from './team';

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Fin de trimestre (mars, juin, septembre, décembre) : le mois de la partie est le dernier du trimestre. */
const quarterEnd = (s: GameState) => s.month % TEAM.cycle === TEAM.cycle - 1;

/**
 * Prime de trimestre d'un employé sans équipe. Le manager la verse si l'employé est efficace, assidu et sans trop de blâmes.
 * Son montant dépend du caractère du supérieur (généreux ou pingre) et de la réussite du service ce trimestre.
 */
export function payEmployeeBonus(s: GameState, job: Job) {
  if (job.management || !quarterEnd(s) || s.month - s.jobStart < EMPLOYEE_BONUS.minTenure) return;
  if (s.efficiency < EMPLOYEE_BONUS.minEfficiency || workedHours(s) < job.hours * EMPLOYEE_BONUS.minHours) {
    addLog(s, 'log.employeeBonus.none', {});
    return;
  }
  const good = Math.random() < EMPLOYEE_BONUS.goodQuarter;
  const merit = clamp((s.efficiency - EMPLOYEE_BONUS.minEfficiency) / 40, 0.25, 1.5);
  const amount = round5(
    currentSalary(s) * EMPLOYEE_BONUS.rate * TEAM_BOSS[bossTypeOf(s)].envelope * merit * (good ? 1 : EMPLOYEE_BONUS.badShare)
      * Math.max(0, 1 - s.jobBlames * EMPLOYEE_BONUS.blamePenalty),
  );
  if (amount <= 0) { addLog(s, 'log.employeeBonus.none', {}); return; }
  s.money += amount;
  s.stats.happiness = clamp(s.stats.happiness + EMPLOYEE_BONUS.happiness);
  s.efficiency = clamp(s.efficiency + EMPLOYEE_BONUS.efficiency);
  addLog(s, good ? 'log.employeeBonus.good' : 'log.employeeBonus.bad', { amount }, 'good');
}

/** Intéressement de décembre, pour les entreprises qui en ont un : tout le monde le touche, l'année de l'entreprise décide du montant. */
export function payProfitShare(s: GameState) {
  const company = companyById(s.jobCompany);
  if (!company?.profitShare || s.month % 12 !== 11 || s.month - s.jobStart < PROFIT_SHARE.minTenure) return;
  const [lo, hi] = PROFIT_SHARE.year;
  const year = lo + Math.random() * (hi - lo);
  const amount = round5(currentSalary(s) * company.profitShare * year);
  s.money += amount;
  addLog(s, year >= 1 ? 'log.profitShare.good' : year >= 0.6 ? 'log.profitShare.ok' : 'log.profitShare.poor', { amount, company: company.name }, 'good');
}
