import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../game/types';
import { VehicleSection } from './VehicleSection';

/** Rubriques du marché. Pour en ajouter une : un identifiant ici, ses textes market.sections.<id> et son composant plus bas. */
type Section = 'vehicles';
const SECTIONS: Section[] = ['vehicles'];

/** Contenu de la carte « Marché » : les achats qui améliorent la vie de tous les jours, rubrique par rubrique. */
export function MarketCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('vehicles');

  return (
    <div className="career">
      <nav className="career-nav" style={{ '--tabs': SECTIONS.length } as CSSProperties} aria-label={t('windows.market')}>
        {SECTIONS.map((id) => (
          <button key={id} className={section === id ? 'on' : ''} aria-pressed={section === id} onClick={() => setSection(id)}>
            {t(`market.sections.${id}`)}
          </button>
        ))}
      </nav>

      <div className="career-pane" key={section}>
        {section === 'vehicles' && <VehicleSection game={game} />}
      </div>
    </div>
  );
}
