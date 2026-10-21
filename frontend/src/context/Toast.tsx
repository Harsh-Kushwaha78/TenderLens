import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ToastApi { notify: (kind: ToastKind, message: string) => void }

const Ctx = createContext<ToastApi>({ notify: () => undefined });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 5000);
  }, [dismiss]);
  const api = useMemo(() => ({ notify }), [notify]);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <I size={18} aria-hidden="true" />
              <span>{t.message}</span>
              <button type="button" className="icon-btn" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
