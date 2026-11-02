import { useTranslation } from 'react-i18next';
import { jobById, projectNextStats } from '../game/engine';
import type { GameState } from '../game/types';
import { Gauges } from './Gauges';

/** Contenu de la carte « Statut » : emploi, logement et jauges. */
export function StatusCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const job = jobById(game.job);
  return (
    <>
      <div className="muted status-info">
        <div>
          {job
            ? t('game.jobLine', { job: t(`jobs.${job.id}`), salary: job.salary, hours: job.hours, commute: job.commute })
            : t('game.noJob')}
        </div>
        <div>
          🏠 {t(`housing.${game.housing}`)}
          {game.car && <> • 🚗 {t(`cars.${game.car}`)}</>}
        </div>
      </div>
      <Gauges stats={game.stats} next={projectNextStats(game)} />
    </>
  );
}
