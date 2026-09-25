'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isLanguage, loadLanguage, t, type Language } from '@/lib/i18n';

const STORAGE_KEY = 'app-language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof t;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Render English first (matches the server render), then switch to the saved language.
  const [language, setLanguageState] = useState<Language>('en');

  const apply = useCallback(async (lang: Language) => {
    try {
      await loadLanguage(lang);
    } catch {
      await loadLanguage('en');
      lang = 'en';
    }
    document.documentElement.lang = lang;
    setLanguageState(lang);
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    if (isLanguage(saved) && saved !== 'en') apply(saved);
  }, [apply]);

  const setLanguage = useCallback(
    (lang: Language) => {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* storage unavailable */
      }
      apply(lang);
    },
    [apply]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {/* Remount on change so every component re-renders with the new catalog. */}
      <React.Fragment key={language}>{children}</React.Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
