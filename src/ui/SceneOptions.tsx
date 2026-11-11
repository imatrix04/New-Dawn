import { useTranslation } from 'react-i18next';
import { SCENE_LEVELS, SCENE_TIMES, useScenePrefs } from './scene/settings';

/** Réglages du décor animé : activation, intensité et moment de la journée. Partagé par le menu pause et les paramètres. */
export function SceneOptions() {
  const { t } = useTranslation();
  const { enabled, level, time, set } = useScenePrefs();

  return (
    <div className="scene-opts">
      <div className="scene-opt" role="group" aria-label={t('settings.scene.effects')}>
        <span>{t('settings.scene.effects')}</span>
        <div>
          <button aria-pressed={enabled} onClick={() => set({ enabled: true })}>{t('settings.scene.on')}</button>
          <button aria-pressed={!enabled} onClick={() => set({ enabled: false })}>{t('settings.scene.off')}</button>
        </div>
      </div>
      {enabled && (
        <>
          <div className="scene-opt" role="group" aria-label={t('settings.scene.level')}>
            <span>{t('settings.scene.level')}</span>
            <div>
              {SCENE_LEVELS.map((l) => (
                <button key={l} aria-pressed={level === l} onClick={() => set({ level: l })}>{t(`settings.scene.levels.${l}`)}</button>
              ))}
            </div>
          </div>
          <div className="scene-opt" role="group" aria-label={t('settings.scene.time')}>
            <span>{t('settings.scene.time')}</span>
            <div>
              {SCENE_TIMES.map((x) => (
                <button key={x} aria-pressed={time === x} onClick={() => set({ time: x })}>{t(`settings.scene.times.${x}`)}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
