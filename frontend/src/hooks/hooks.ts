import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> { data: T | null; error: Error | null; loading: boolean; reload: () => void }

/** Loads data on mount/when deps change; ignores stale responses and aborts in-flight requests. */
export function useAsync<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef.current(ctrl.signal)
      .then((data) => { if (!ctrl.signal.aborted) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (!ctrl.signal.aborted && error?.name !== 'AbortError') setState((s) => ({ data: s.data, error, loading: false })); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function useDocumentTitle(title: string) {
  useEffect(() => { document.title = `${title} · TenderLens`; }, [title]);
}
