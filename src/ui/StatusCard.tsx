import { STATS } from '../data/content';
import { projectNextStats } from '../game/engine';
import type { GameState } from '../game/types';
import { RingGauge } from './Gauges';

/** Contenu de la carte « Statut » : anneaux de santé et de bonheur. */
export function StatusCard({ game }: { game: GameState }) {
  const next = projectNextStats(game);

  return (
    <div className="rings">
      {STATS.map((stat) => (
        <RingGauge key={stat.key} stat={stat} value={game.stats[stat.key]} next={next[stat.key]} />
      ))}
    </div>
  );
}
