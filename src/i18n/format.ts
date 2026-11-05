import type { TFunction } from 'i18next';
import type { Fx, LogEntry } from '../game/types';

/** Âge affiché à partir du nombre de mois écoulés depuis les 18 ans. */
export function formatAge(t: TFunction, month: number): string {
  const years = t('age.years', { count: 18 + Math.floor(month / 12) });
  const months = month % 12;
  return months ? t('age.joined', { years, months: t('age.months', { count: months }) }) : years;
}

export const formatNumber = (n: number, lng: string) => new Intl.NumberFormat(lng).format(Math.round(n));

function formatFx(t: TFunction, fx: Fx): string {
  return (Object.entries(fx) as [keyof Fx, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v)} ${t(`fx.${k}`)}`)
    .join(', ');
}

/** Traduit une ligne de journal (clé + paramètres) dans la langue courante. */
export function formatLogEntry(t: TFunction, entry: LogEntry): string {
  const params: Record<string, string | number> = { ...entry.params };
  if (typeof params.jobId === 'string') {
    // Le genre du joueur accorde le nom du poste (serveur / serveuse).
    const context = typeof params.gender === 'string' ? params.gender : undefined;
    params.job = t(`jobs.${params.jobId}`, { context }).toLowerCase();
  }
  if (typeof params.homeId === 'string') params.home = t(`housing.${params.homeId}`);
  if (typeof params.trainingId === 'string') params.training = t(`trainings.${params.trainingId}.name`);
  if (typeof params.gigId === 'string') params.gig = t(`gigs.${params.gigId}.name`).toLowerCase();
  if (typeof params.field === 'string') params.field = t(`fields.${params.field}`);
  if (typeof params.vehicleId === 'string') params.vehicle = t(`vehicles.${params.vehicleId}`);
  if (typeof params.severity === 'string') params.severity = t(`market.issue.${params.severity}`).toLowerCase();
  if (typeof params.accidentLevel === 'string') params.accidentLevel = t(`market.accident.${params.accidentLevel}`);
  if (typeof params.repairKind === 'string') params.repairKind = t(`market.repair.kind.${params.repairKind}`).toLowerCase();
  if (typeof params.productId === 'string') params.product = t(`wallet.products.${params.productId}.name`);
  if (typeof params.month === 'number') params.age = formatAge(t, params.month);

  const text = t(entry.key, params);
  if (!entry.titleKey) return text;

  const title = t(entry.titleKey);
  const fx = entry.fx ? formatFx(t, entry.fx) : '';
  return fx ? t('log.eventLineFx', { title, text, fx }) : t('log.eventLine', { title, text });
}

/** Variation signée à une décimale : « +1,5 », « −2 », « 0 ». */
export function formatSigned(n: number, lng: string): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return '0';
  return `${r > 0 ? '+' : '−'}${new Intl.NumberFormat(lng, { maximumFractionDigits: 1 }).format(Math.abs(r))}`;
}

/** Montant en euros, avec le nombre de décimales demandé (0 pour les gros chiffres, 2 pour l'épargne). */
export function formatMoney(n: number, lng: string, decimals = 0): string {
  return `${new Intl.NumberFormat(lng, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)} €`;
}

/** Taux en pourcentage : 0.017 -> « 1,7 % ». */
export function formatPercent(rate: number, lng: string): string {
  return new Intl.NumberFormat(lng, { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}
