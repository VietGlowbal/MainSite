'use client';

import React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translations } from './i18n-catalog';

export type Lang = 'en' | 'vi';

const STORAGE_KEY = 'glowbal-language';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  /**
   * Translate an English source string. English is the key, so wrapping a
   * string in `t(...)` never breaks the English UI — Vietnamese is returned
   * when a translation exists, otherwise it gracefully falls back to English.
   * Supports `{name}`-style interpolation via the optional vars argument.
   */
  t: (en: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(value: string, vars?: Record<string, string | number>) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
}

export function LanguageProvider({
  children,
  defaultLang,
}: {
  children: ReactNode;
  defaultLang?: Lang;
}) {
  // Always start as defaultLang so server and first client render match
  const [lang, setLangState] = useState<Lang>(defaultLang ?? 'en');

  useEffect(() => {
    if (defaultLang) {
      React.startTransition(() => setLangState(defaultLang));
      document.documentElement.lang = defaultLang;
      return;
    }
    const stored = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? 'en';
    if (stored === 'vi') {
      // Use startTransition to avoid synchronous setState in effect body
      React.startTransition(() => setLangState('vi'));
    }
    document.documentElement.lang = stored;
  }, [defaultLang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Mirror to a cookie so server components can localise too (see docs).
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      window.dispatchEvent(new CustomEvent('glowbal:language-change', { detail: { language: next } }));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === 'en' ? 'vi' : 'en');
  }, [lang, setLang]);

  const t = useCallback(
    (en: string, vars?: Record<string, string | number>) => {
      if (lang === 'en') return interpolate(en, vars);
      const entry = translations[en];
      return interpolate(entry ?? en, vars);
    },
    [lang],
  );

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, toggle, t }), [lang, setLang, toggle, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// Safe default so a stray consumer rendered outside the provider never crashes
// — it simply renders English.
const FALLBACK: LanguageContextValue = {
  lang: 'en',
  setLang: () => {},
  toggle: () => {},
  t: (en, vars) => interpolate(en, vars),
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? FALLBACK;
}

/** Convenience hook returning just the translate function. */
export function useT() {
  return useLanguage().t;
}

/**
 * Tiny client island for translating a static UI string from a server
 * component: <T k="Save" />. Uses the same dictionary as t().
 */
export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  return <>{useLanguage().t(k, vars)}</>;
}
