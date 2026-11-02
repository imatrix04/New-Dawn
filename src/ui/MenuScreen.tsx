import { useTranslation } from 'react-i18next';
import { useStore } from '../store';

export function MenuScreen() {
  const { t } = useTranslation();
  const { go, loadSave, hasSave } = useStore();

  return (
    <section className="screen menu">
      <h1>NewDawn</h1>
      <p className="subtitle">{t('app.tagline')}</p>
      <div className="menu-buttons">
        <button onClick={() => go('create')}>{t('menu.newGame')}</button>
        <button disabled={!hasSave} onClick={loadSave}>{t('menu.continue')}</button>
        <button disabled>
          {t('menu.coop')}
          <small>{t('menu.comingSoon')}</small>
        </button>
        <button className="secondary" onClick={() => go('settings')}>{t('menu.settings')}</button>
      </div>
    </section>
  );
}
