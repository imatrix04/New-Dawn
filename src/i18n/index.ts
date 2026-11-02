import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Chaque langue s'affiche dans sa propre langue, jamais traduite. */
export const LANG_NAMES: Record<Lang, string> = { fr: 'Français', en: 'English' };

const LANG_KEY = 'newdawn-lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    /* stockage indisponible */
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React échappe déjà
  initAsync: false,
  react: { useSuspense: false },
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try { localStorage.setItem(LANG_KEY, lng); } catch { /* ignoré */ }
});

export default i18n;
