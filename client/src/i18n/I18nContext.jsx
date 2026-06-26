import { createContext, useContext, useState } from 'react';
import { translations } from './translations.js';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  const setLanguage = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  return (
    <I18nContext.Provider value={{ lang, setLanguage, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
