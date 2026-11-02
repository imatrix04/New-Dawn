import { useTranslation } from 'react-i18next';
import { STATS } from '../data/content';
import { jobById, projectNextStats } from '../game/engine';
import type { GameState } from '../game/types';
import { RingGauge } from './Gauges';

/** Contenu de la carte « Statut » : emploi, logement et anneaux de santé et de bonheur. */
export function StatusCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const job = jobById(game.job);
  const next = projectNextStats(game);

  return (
    <>
      <div className="muted status-info">
        <div>
          {job
            ? t('game.jobLine', { job: t(`jobs.${job.id}`, { context: game.gender }), salary: job.salary, hours: job.hours, commute: job.commute })
            : t('game.noJob')}
        </div>
        <div>
          🏠 {t(`housing.${game.housing}`)}
          {game.car && <> • 🚗 {t(`cars.${game.car}`)}</>}
        </div>
      </div>

      <div className="rings">
        {STATS.map((stat) => (
          <RingGauge key={stat.key} stat={stat} value={game.stats[stat.key]} next={next[stat.key]} />
        ))}
      </div>
    </>
  );
}
