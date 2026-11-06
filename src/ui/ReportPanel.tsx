import { useTranslation } from 'react-i18next';
import { RATE_KEYS } from '../data/content';
import type { RateKey } from '../data/content';
import type { EconomyReport } from '../game/types';
import { formatMoney, formatPercent } from '../i18n/format';
import { useStore } from '../store';

/** Variation d'un chiffre : flèche et couleur. `upIsGood` dit si une hausse est une bonne nouvelle pour le joueur. */
function Delta({ diff, upIsGood, children }: { diff: number; upIsGood: boolean; children: string }) {
  if (Math.abs(diff) < 1e-9) return <b className="report-flat">= {children}</b>;
  const up = diff > 0;
  return <b className={up === upIsGood ? 'good' : 'bad'}>{up ? '▲' : '▼'} {children}</b>;
}

/** Rapport économique de janvier : immobilier, SMIC, taux des livrets et des prêts. */
export function ReportPanel({ report }: { report: EconomyReport }) {
  const { t, i18n } = useTranslation();
  const dismiss = useStore((s) => s.dismissReport);
  const lng = i18n.language;
  const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatPercent(Math.abs(n), lng)}`;
  const loan = (k: RateKey) => k.startsWith('loan');

  return (
    <div className="panel report">
      <h2>{t('report.title', { year: report.year })}</h2>
      <p className="muted small">{t('report.intro')}</p>

      <dl className="facts report-list">
        <div>
          <dt>{t('report.housing')}</dt>
          <dd><Delta diff={report.housing} upIsGood={false}>{pct(report.housing)}</Delta></dd>
        </div>
        <div>
          <dt>{t('report.smic')}</dt>
          <dd>
            <Delta diff={report.smic.to - report.smic.from} upIsGood>
              {`${formatMoney(report.smic.from, lng)} → ${formatMoney(report.smic.to, lng)}`}
            </Delta>
          </dd>
        </div>
        {RATE_KEYS.map((k) => (
          <div key={k}>
            <dt>{t(`report.rates.${k}`)}</dt>
            <dd>
              <Delta diff={report.rates[k].to - report.rates[k].from} upIsGood={!loan(k)}>
                {`${formatPercent(report.rates[k].from, lng)} → ${formatPercent(report.rates[k].to, lng)}`}
              </Delta>
            </dd>
          </div>
        ))}
      </dl>

      <p className="muted small">{t('report.note')}</p>
      <button className="big-btn" onClick={dismiss}>{t('report.ok')}</button>
    </div>
  );
}
