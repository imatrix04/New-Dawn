import { useTranslation } from 'react-i18next';
import { STATS } from '../data/content';
import { jobById, projectNextStats } from '../game/engine';
import type { GameState, StatKey } from '../game/types';
import { BarGauge, RingGauge } from './Gauges';

const RINGS: StatKey[] = ['health', 'happiness'];
const BARS: StatKey[] = ['energy', 'knowledge'];
const statDef = (key: StatKey) => STATS.find((s) => s.key === key)!;

/** Contenu de la carte « Statut » : emploi, logement, anneaux santé/bonheur et barres. */
export function StatusCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const job = jobById(game.job);
  const next = projectNextStats(game);

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

      <div className="rings">
        {RINGS.map((key) => (
          <RingGauge key={key} stat={statDef(key)} value={game.stats[key]} next={next[key]} />
        ))}
      </div>
      <div className="bars">
        {BARS.map((key) => (
          <BarGauge key={key} stat={statDef(key)} value={game.stats[key]} next={next[key]} />
        ))}
      </div>
    </>
  );
}
