'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DirectoryPayload = { canonicalSearch: string };
type HistoryMode = 'push' | 'replace' | 'none';

type Options<T extends DirectoryPayload> = {
  pathname: string;
  endpoint: string;
  initialData: T;
  getPrefetchHrefs?: (data: T) => string[];
};

function pageHref(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

export function useDirectoryNavigation<T extends DirectoryPayload>({
  pathname,
  endpoint,
  initialData,
  getPrefetchHrefs,
}: Options<T>) {
  const initialHref = pageHref(pathname, initialData.canonicalSearch);
  const initialHrefRef = useRef(initialHref);
  const cacheRef = useRef(new Map<string, T>([[initialHref, initialData]]));
  const lastSuccessfulHrefRef = useRef(initialHref);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiHref = useCallback(
    (href: string) => {
      const query = href.includes('?') ? href.slice(href.indexOf('?')) : '';
      return `${endpoint}${query}`;
    },
    [endpoint],
  );

  const writeHistory = useCallback((mode: HistoryMode, href: string) => {
    if (mode === 'push') window.history.pushState(null, '', href);
    if (mode === 'replace') window.history.replaceState(null, '', href);
  }, []);

  const load = useCallback(
    async (href: string, mode: HistoryMode) => {
      writeHistory(mode, href);
      abortRef.current?.abort();
      const request = ++requestRef.current;
      const cached = cacheRef.current.get(href);
      if (cached) {
        setData(cached);
        setBusy(false);
        setError(null);
        lastSuccessfulHrefRef.current = href;
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setError(null);

      try {
        const response = await fetch(apiHref(href), { signal: controller.signal });
        if (!response.ok) throw new Error(`Directory request failed (${response.status})`);
        const next = (await response.json()) as T;
        if (request !== requestRef.current) return;

        const canonicalHref = pageHref(pathname, next.canonicalSearch);
        cacheRef.current.set(canonicalHref, next);
        if (canonicalHref !== href) window.history.replaceState(null, '', canonicalHref);
        lastSuccessfulHrefRef.current = canonicalHref;
        setData(next);
      } catch (cause) {
        if (request !== requestRef.current || controller.signal.aborted) return;
        window.history.replaceState(null, '', lastSuccessfulHrefRef.current);
        setError(cause instanceof Error ? cause.message : 'Unable to load this page');
      } finally {
        if (request === requestRef.current) setBusy(false);
      }
    },
    [apiHref, pathname, writeHistory],
  );

  const navigate = useCallback(
    (href: string, replace = false) => {
      void load(href, replace ? 'replace' : 'push');
    },
    [load],
  );

  useEffect(() => {
    window.history.replaceState(null, '', initialHrefRef.current);
    const onPopState = () => {
      if (window.location.pathname !== pathname) return;
      void load(`${pathname}${window.location.search}`, 'none');
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      abortRef.current?.abort();
      window.removeEventListener('popstate', onPopState);
    };
  }, [load, pathname]);

  useEffect(() => {
    if (!getPrefetchHrefs) return;
    const timer = window.setTimeout(() => {
      for (const href of getPrefetchHrefs(data)) {
        if (cacheRef.current.has(href)) continue;
        void fetch(apiHref(href))
          .then((response) => {
            if (!response.ok) return null;
            return response.json() as Promise<T>;
          })
          .then((next) => {
            if (!next) return;
            cacheRef.current.set(pageHref(pathname, next.canonicalSearch), next);
          })
          .catch(() => undefined);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [apiHref, data, getPrefetchHrefs, pathname]);

  return { data, busy, error, navigate };
}
