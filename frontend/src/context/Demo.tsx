import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const KEY = 'tenderlens.showDemo';
interface DemoApi { showDemo: boolean; setShowDemo: (v: boolean) => void }
const Ctx = createContext<DemoApi>({ showDemo: false, setShowDemo: () => undefined });
export const useDemo = () => useContext(Ctx);

function read(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** Demo rows are opt-in and never mixed silently: this switch controls includeDemo on every API call. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [showDemo, setState] = useState(read);
  const setShowDemo = useCallback((v: boolean) => {
    setState(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
  }, []);
  const api = useMemo(() => ({ showDemo, setShowDemo }), [showDemo, setShowDemo]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
