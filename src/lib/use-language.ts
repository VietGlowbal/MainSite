'use client';

import { useEffect, useState } from 'react';

export type Language = 'en' | 'vi';

/**
 * Hook for managing language preference
 * Stores preference in localStorage and provides a way to switch languages
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    return (localStorage.getItem('glowbal-language') as Language) || 'en';
  });

  useEffect(() => {
    // Listen for language changes from other components
    const handleLanguageChange = (e: CustomEvent<{ language: Language }>) => {
      setLanguageState(e.detail.language);
    };

    window.addEventListener('glowbal:language-change' as any, handleLanguageChange);
    return () => {
      window.removeEventListener('glowbal:language-change' as any, handleLanguageChange);
    };
  }, []);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem('glowbal-language', newLang);
    window.dispatchEvent(
      new CustomEvent('glowbal:language-change', { detail: { language: newLang } })
    );
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'vi' : 'en';
    setLanguage(newLang);
  };

  return { language, setLanguage, toggleLanguage };
}

/**
 * Translation helper
 * Usage: const t = useTranslation();
 *        t('home.title')
 */
export function useTranslation() {
  const { language } = useLanguage();

  return (key: string, fallback?: string): string => {
    // This is a placeholder - you would implement actual translation logic here
    // For now, it just returns the key or fallback
    return fallback || key;
  };
}
