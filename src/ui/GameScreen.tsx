import { useTranslation } from 'react-i18next';
import { jobById } from '../game/engine';
import type { GameState } from '../game/types';
import { formatAge, formatNumber } from '../i18n/format';
import { useStore } from '../store';
import { ActionPanel } from './ActionPanel';
import { EventPanel } from './EventPanel';
import { Gauges } from './Gauges';
import { LogPanel } from './LogPanel';

export function GameScreen({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const { save, quit } = useStore();
  const job = jobById(game.job);

  return (
    <section className="screen">
      <header>
        <div>
          <strong>{game.firstName} {game.lastName}</strong> — <span>{formatAge(t, game.month)}</span>
          <div className="muted">
            {job ? t('game.jobLine', { job: t(`jobs.${job.id}`), salary: job.salary }) : t('game.noJob')}
          </div>
          <div className="muted">
            🏠 {t(`housing.${game.housing}`)}
            {game.car && <> • 🚗 {t(`cars.${game.car}`)}</>}
          </div>
        </div>
        <div className="money" style={game.money < 0 ? { color: 'var(--bad)' } : undefined}>
          💰 {formatNumber(game.money, i18n.language)} €
        </div>
      </header>

      <Gauges stats={game.stats} />
      {game.pendingEvent ? <EventPanel game={game} /> : <ActionPanel game={game} />}
      <LogPanel log={game.log} />

      <div className="row">
        <button className="secondary" onClick={save}>{t('game.save')}</button>
        <button className="secondary" onClick={quit}>{t('game.menu')}</button>
      </div>
    </section>
  );
}
