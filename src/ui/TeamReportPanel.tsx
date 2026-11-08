import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { reputationLevel } from '../game/engine';
import type { TeamReport } from '../game/types';
import { formatMoney, formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { Facts } from './cardKit';

/** Bilan du trimestre : verdict, prime, classement des membres, nouvelles enveloppes et réputation. */
export function TeamReportPanel({ report, director }: { report: TeamReport; director: boolean }) {
  const { t, i18n } = useTranslation();
  const dismiss = useStore((s) => s.dismissTeamReport);
  const lng = i18n.language;
  const money = (n: number) => formatMoney(n, lng);
  const pct = Math.round(report.ratio * 100);
  const tone = report.blame || report.outcome === 'miss' ? 'bad' : 'good';
  const top = Math.max(1.4, ...report.members.map((m) => m.perf));
  const level = reputationLevel(report.repTotal);

  return (
    <div className="panel report team-report">
      <h2>{t('teamReport.title')}</h2>
      <p className={`team-verdict ${tone}`}>{t(`team.review.${report.outcome}`, { pct })}</p>
      <Facts rows={[
        [t('teamReport.objective'), `${Math.round(report.objective * 100)} %`],
        [t('teamReport.prime'), report.prime > 0 ? <b className="good" key="p">+{money(report.prime)}</b> : '—'],
        ...(director && report.net !== null ? [[t('teamReport.net'), <b className={report.net < 0 ? 'bad' : 'good'} key="n">{formatSigned(report.net, lng)} €</b>] as [string, ReactNode]] : []),
        ...(report.dividend > 0 ? [[t('teamReport.dividend'), money(report.dividend)] as [string, ReactNode]] : []),
        [t('teamReport.quits'), String(report.quits)],
        [t('teamReport.streak'), String(report.streak)],
        [t(director ? 'teamReport.nextPool' : 'teamReport.nextEnvelope'), money(report.nextBudget)],
      ]} />
      {report.primeBlocked && <p className="job-meta warn">{t('team.review.primeBlocked')}</p>}
      {report.blame && <p className="job-meta warn">{t(`team.review.blame.${report.blame}`)}</p>}

      <h4 className="pick-label">{t(director ? 'teamReport.rankingDirector' : 'teamReport.ranking')}</h4>
      <ol className="team-ranking">
        {report.members.map((m, i) => (
          <li key={i}>
            <span className="rank-n">{i + 1}</span>
            <span className="rank-name">
              {i === 0 && report.members.length > 1 ? '⭐ ' : ''}{m.name}
              {m.trait && <span className={`trait ${m.trait}`}>{t(`team.trait.${m.trait}`)}</span>}
              {m.staff > 0 && <span className="muted small"> · {t('team.members.staff', { count: m.staff })}</span>}
            </span>
            <span className="rank-bar"><i style={{ width: `${Math.min(100, (m.perf / top) * 100)}%` }} /></span>
            <b className="rank-val">{Math.round(m.perf * 100)} %</b>
          </li>
        ))}
      </ol>

      <p className="team-rep">
        <b className={report.repDelta >= 0 ? 'good' : 'bad'}>{report.repDelta >= 0 ? '▲' : '▼'} {formatSigned(report.repDelta, lng)}</b>{' '}
        {t('teamReport.rep', { level: t(`reputation.level.${level}`), total: Math.round(report.repTotal), max: 100 })}
      </p>
      <button className="big-btn" onClick={dismiss}>{t('teamReport.ok')}</button>
    </div>
  );
}
