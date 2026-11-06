import { useTranslation } from 'react-i18next';
import { seasonOf, type Season } from '../game/engine';
import { Icon, type IconName } from './Icon';

const SEASON_ICONS: Record<Season, IconName> = { winter: 'snowflake', spring: 'sprout', summer: 'sun', autumn: 'leaf' };

/** Icône et nom de la saison du mois donné. */
export function useSeason(month: number): { id: Season; icon: IconName; label: string } {
  const { t } = useTranslation();
  const id = seasonOf(month);
  return { id, icon: SEASON_ICONS[id], label: t(`seasons.${id}`) };
}

export function SeasonIcon({ month, size = 20 }: { month: number; size?: number }) {
  const { icon } = useSeason(month);
  return <Icon name={icon} size={size} />;
}
