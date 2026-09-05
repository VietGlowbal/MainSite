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
import { getCatalog, isCatalogLoaded, loadCatalog, type Catalog } from './i18n-catalog-runtime';

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

  /*
   * The catalog is loaded on demand — see `i18n-catalog-runtime.ts` for why it
   * is no longer a static import. Seeding from `getCatalog()` rather than from
   * `{}` is what keeps `/vi/*` free of a text swap: that layout primes the
   * catalog before render, so the server and the first client render both start
   * with the full map and agree.
   */
  const [catalog, setCatalog] = useState<Catalog>(() =>
    // Keyed on `defaultLang`, not on `getCatalog()` alone: the server primes a
    // module-level singleton, so once any `/vi/*` request has been served the
    // catalog is populated for every *later* render in that process, including
    // English ones. Seeding from it directly would therefore make the server's
    // initial state depend on request history while the browser's does not.
    // `t()` short-circuits on English so nothing reads it there anyway — this
    // just keeps both sides provably identical instead of incidentally so.
    defaultLang === 'vi' ? getCatalog() : {},
  );

  useEffect(() => {
    if (lang !== 'vi') return;

    /*
     * Adopt a catalog that is already in memory, rather than assuming this
     * provider's state must already hold it.
     *
     * These are two different things and conflating them was a bug: the module
     * singleton is loaded once per page load, but `catalog` above is seeded
     * from it only when the route itself is Vietnamese. Navigate from `/vi/*`
     * to an English route on the client and the singleton stays primed while
     * the remounted provider holds `{}` — so a guard of "already loaded, do
     * nothing" left `t()` returning English for the rest of the session, no
     * matter how many times the reader hit the switcher. The i18n suite caught
     * it; jsdom primes the catalog in `src/__tests__/setup.ts`, which puts
     * every component test on exactly that path.
     *
     * The identity check is what stops this re-rendering forever.
     */
    if (isCatalogLoaded()) {
      setCatalog((current) => (current === getCatalog() ? current : getCatalog()));
      return;
    }

    let active = true;
    void loadCatalog().then((loaded) => {
      if (active) setCatalog(loaded);
    });
    return () => {
      active = false;
    };
  }, [lang]);

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
      // English is the key, so it never needs the catalog at all — this
      // short-circuit is the reason the 584 KB was pure waste on every route.
      if (lang === 'en') return interpolate(en, vars);
      const entry = catalog[en];
      return interpolate(entry ?? en, vars);
    },
    [lang, catalog],
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
