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
   * is no longer a static import.
   *
   * DERIVED DURING RENDER, NOT HELD IN STATE. `getCatalog()` reads a module
   * singleton that is already populated in the two cases that matter: `/vi/*`
   * primes it in its layout before anything renders, and a client navigation
   * away from `/vi/*` leaves it primed for the rest of the session. Reading it
   * here means those cases need no effect and no extra render at all.
   *
   * The earlier version kept it in state and adopted it from inside the effect,
   * which was both a cascading render (`react-hooks/set-state-in-effect`) and,
   * before that, a bug: state seeded from `{}` on an English route never picked
   * the singleton up, so after a client navigation off `/vi/*` the switcher was
   * dead for the rest of the session.
   *
   * `fetched` only exists for the remaining case — an English route where the
   * reader asks for Vietnamese and the chunk is genuinely not in memory yet.
   *
   * Hydration is safe without keying on `defaultLang`: the server's singleton
   * may be primed by an earlier `/vi/*` request in the same process while the
   * browser's is empty, but `t()` returns the source string for English before
   * it ever reads this, so the two cannot render differently.
   */
  const [fetched, setFetched] = useState<Catalog | null>(null);
  const catalog = fetched ?? getCatalog();

  useEffect(() => {
    if (lang !== 'vi' || isCatalogLoaded()) return;
    let active = true;
    void loadCatalog().then((loaded) => {
      if (active) setFetched(loaded);
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
