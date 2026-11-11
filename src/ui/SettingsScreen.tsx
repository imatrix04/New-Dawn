import { useTranslation } from 'react-i18next';
import { LANG_NAMES, LANGS } from '../i18n';
import { useStore } from '../store';
import { SceneOptions } from './SceneOptions';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const go = useStore((s) => s.go);

  return (
    <section className="screen">
      <h1>{t('settings.title')}</h1>
      <div className="panel">
        <h2>{t('settings.language')}</h2>
        <div className="choices">
          {LANGS.map((lng) => (
            <button
              key={lng}
              className={i18n.language === lng ? undefined : 'secondary'}
              onClick={() => void i18n.changeLanguage(lng)}
            >
              {LANG_NAMES[lng]}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>{t('settings.scene.title')}</h2>
        <SceneOptions />
      </div>
      <button className="secondary" onClick={() => go('menu')}>{t('settings.back')}</button>
    </section>
  );
}
