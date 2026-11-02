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
  if (typeof params.jobId === 'string') params.job = t(`jobs.${params.jobId}`).toLowerCase();
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
