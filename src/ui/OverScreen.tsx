import { useTranslation } from 'react-i18next';
import type { GameState } from '../game/types';
import { formatAge } from '../i18n/format';
import { useStore } from '../store';

export function OverScreen({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const quit = useStore((s) => s.quit);
  return (
    <section className="screen">
      <h1>{t('over.title')}</h1>
      <p>
        {t('over.summary', {
          name: `${game.firstName} ${game.lastName}`,
          age: formatAge(t, game.month),
          reason: t(`over.${game.over}`),
        })}
      </p>
      <button onClick={quit}>{t('over.restart')}</button>
    </section>
  );
}
