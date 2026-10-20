import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectStatus } from '../api/types';
import { STATUS_LABELS } from '../lib/constants';

export function Button({ variant = 'secondary', loading, children, className = '', disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return (
    <button {...rest} type={rest.type ?? 'button'} disabled={disabled || loading} aria-busy={loading || undefined} className={`btn btn-${variant} ${className}`}>
      {loading && <Loader2 size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', children, ...rest }: { to: string; variant?: 'primary' | 'secondary' | 'ghost'; children: ReactNode; 'aria-label'?: string }) {
  return <Link to={to} className={`btn btn-${variant}`} {...rest}>{children}</Link>;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function DemoBadge() {
  return <span className="badge badge-demo" title="Synthetic demo data - not a real project">Demo</span>;
}

export function Card({ title, subtitle, actions, children, className = '' }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>{title && <h2 className="card-title">{title}</h2>}{subtitle && <p className="card-sub">{subtitle}</p>}</div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="page-head">
      <div>
        {back && <Link to={back.to} className="back-link"><ChevronLeft size={16} aria-hidden="true" />{back.label}</Link>}
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', className = '' }: { height?: number; width?: number | string; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height, width }} aria-hidden="true" />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">{icon ?? <SearchX size={26} />}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div><strong>{title}</strong><p>{message}</p></div>
      {onRetry && <Button onClick={onRetry}><RefreshCw size={16} aria-hidden="true" />Retry</Button>}
    </div>
  );
}

export function Pagination({ page, totalPages, totalItems, pageSize, onChange }: { page: number; totalPages: number; totalItems: number; pageSize: number; onChange: (p: number) => void }) {
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted" aria-live="polite">Showing {from}-{to} of {totalItems}</span>
      <div className="pagination-btns">
        <Button onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" />Prev</Button>
        <span className="page-indicator">Page {page} of {totalPages}</span>
        <Button onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">Next<ChevronRight size={16} aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}

interface FieldProps { id: string; label: string; error?: string; hint?: string; required?: boolean; children: (a: { id: string; 'aria-invalid': boolean | undefined; 'aria-describedby': string | undefined; 'aria-required': boolean | undefined }) => ReactNode }
export function Field({ id, label, error, hint, required, children }: FieldProps) {
  const describedBy = [hint && !error ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

/** Accessible confirmation dialog (role=alertdialog, focus moved in and restored, Esc cancels, Tab trapped). */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = 'Cancel', danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
      if (e.key === 'Tab' && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
        <h2 id="dlg-title">{title}</h2>
        <div id="dlg-msg" className="dialog-msg">{message}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
