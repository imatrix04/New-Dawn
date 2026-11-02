import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const { t } = useTranslation();
  const { save, quit } = useStore();
  const [saved, setSaved] = useState(false);

  return (
    <div className="overlay" onClick={onResume}>
      <div className="pause-menu panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t('pause.title')}</h2>
        <div className="menu-buttons">
          <button onClick={onResume}>{t('pause.resume')}</button>
          <button className="secondary" onClick={() => { save(); setSaved(true); }}>
            {t('game.save')}
          </button>
          <button className="secondary" onClick={quit}>{t('game.menu')}</button>
        </div>
        <p className="muted saved-note">{saved ? t('pause.saved') : ' '}</p>
      </div>
    </div>
  );
}
