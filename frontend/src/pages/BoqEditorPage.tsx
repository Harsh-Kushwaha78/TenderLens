import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { createBoq, getBoq, updateBoq } from '../api/boqs';
import { ApiClientError } from '../api/client';
import { getProject } from '../api/projects';
import type { Boq, Currency } from '../api/types';
import { Button, Card, ConfirmDialog, DemoBadge, ErrorState, Field, PageHeader, Skeleton } from '../components/ui';
import { useToast } from '../context/Toast';
import { useAsync, useDocumentTitle } from '../hooks/hooks';
import { lineTotal, liveTotals, isValidQuantity, isValidRate } from '../lib/boqMath';
import {
  emptyForm, emptyRow, formFromBoq, hasErrors, mapServerErrors, rowHasContent, snapshot, toPayload, validateForm,
  type BoqErrors, type BoqFormValues, type BoqRow, type RowField,
} from '../lib/boqForm';
import { BOQ_UNITS, MAX_BOQ_ITEMS, UNIT_LABELS } from '../lib/constants';
import { formatMoneyFixed } from '../lib/format';
import { NotFoundPage } from './ProjectDetailPage';

interface ProjectRef { id: string; name: string; currency: Currency; isDemo: boolean }

export function BoqEditorPage() {
  const { id, projectId } = useParams();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit BOQ' : 'New BOQ');
  const { data, error, loading, reload } = useAsync(async (s) => (isEdit
    ? { boq: await getBoq(id!, s), project: null as ProjectRef | null }
    : { boq: null as Boq | null, project: await getProject(projectId!, s) as ProjectRef }), [id, projectId]);

  if (loading && !data) return <><PageHeader title={isEdit ? 'Edit BOQ' : 'New BOQ'} /><Skeleton height={380} /></>;
  if (error && (error as any).isNotFound) return <NotFoundPage what={isEdit ? 'BOQ' : 'project'} />;
  if (error || !data) return <ErrorState title="Could not load" message={error?.message ?? 'Unknown error.'} onRetry={reload} />;

  const project: ProjectRef = data.boq ? { id: data.boq.project.id, name: data.boq.project.name, currency: data.boq.project.currency, isDemo: data.boq.project.isDemo } : data.project!;
  // key: re-initialise the form whenever a different/newer saved revision is loaded (e.g. after "Reload latest")
  return <BoqEditor key={`${data.boq?.id ?? 'new'}-${data.boq?.revision ?? 0}`} boq={data.boq} project={project} onReload={reload} />;
}

function BoqEditor({ boq, project, onReload }: { boq: Boq | null; project: ProjectRef; onReload: () => void }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const currency = boq?.currency ?? project.currency;
  const [values, setValues] = useState<BoqFormValues>(() => (boq ? formFromBoq(boq) : emptyForm()));
  const initial = useRef(snapshot(values));
  const [errors, setErrors] = useState<BoqErrors>({ rows: {} });
  const [formError, setFormError] = useState<string | null>(null);
  const [general, setGeneral] = useState<string[]>([]);
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const focusKey = useRef<string | null>(null);

  // ---- unsaved-changes protection (in-app navigation + tab close/refresh)
  const dirtyRef = useRef(false);
  dirtyRef.current = snapshot(values) !== initial.current;
  const blocker = useBlocker(useCallback(() => dirtyRef.current, []));
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  useEffect(() => {
    if (!focusKey.current) return;
    document.querySelector<HTMLElement>(`[data-row-key="${focusKey.current}"] textarea`)?.focus();
    focusKey.current = null;
  }, [values.rows.length]);

  const totals = liveTotals(values.rows.map((r) => ({ quantity: r.quantity, rate: r.rate })));
  const setRow = (key: string, field: RowField, v: string) => {
    setValues((s) => ({ ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, [field]: v } : r)) }));
    setErrors((e) => { if (!e.rows[key]?.[field]) return e; const rows = { ...e.rows, [key]: { ...e.rows[key], [field]: undefined } }; return { ...e, rows }; });
  };
  const addRow = () => { const r = emptyRow(); focusKey.current = r.key; setValues((s) => ({ ...s, rows: [...s.rows, r] })); };
  const move = (i: number, d: -1 | 1) => setValues((s) => { const rows = [...s.rows]; const j = i + d; if (j < 0 || j >= rows.length) return s; [rows[i], rows[j]] = [rows[j]!, rows[i]!]; return { ...s, rows }; });
  const removeRow = (key: string) => { setValues((s) => ({ ...s, rows: s.rows.filter((r) => r.key !== key) })); setRemoveKey(null); };
  const askRemove = (r: BoqRow) => (rowHasContent(r) ? setRemoveKey(r.key) : removeRow(r.key));

  const submit = async () => {
    if (submittingRef.current) return; // guard against double submit
    const e = validateForm(values);
    setErrors(e); setGeneral([]); setConflict(false);
    if (hasErrors(e)) {
      setFormError('Please fix the highlighted fields before saving.');
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    submittingRef.current = true; setSubmitting(true); setFormError(null);
    try {
      const body = toPayload(values);
      const saved = boq ? await updateBoq(boq.id, { ...body, revision: boq.revision }) : await createBoq(project.id, body);
      dirtyRef.current = false; initial.current = snapshot(values);
      notify('success', boq ? `Saved "${saved.title}" (revision ${saved.revision}).` : `Created BOQ "${saved.title}".`);
      navigate(`/boqs/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT') { setConflict(true); setFormError(err.message); }
        else {
          const m = mapServerErrors(err.details, values.rows);
          setErrors(m.errors); setGeneral(m.general); setFormError(err.message);
        }
      } else setFormError('Something went wrong while saving. Your input is preserved - please retry.');
    } finally { submittingRef.current = false; setSubmitting(false); }
  };

  const cancel = () => { if (dirtyRef.current) setConfirmCancel(true); else navigate(boq ? `/boqs/${boq.id}` : `/projects/${project.id}/boqs`); };
  const rowErr = (key: string) => errors.rows[key] ?? {};
  const pendingRemove = values.rows.find((r) => r.key === removeKey);

  return (
    <>
      <PageHeader
        back={{ to: boq ? `/boqs/${boq.id}` : `/projects/${project.id}/boqs`, label: boq ? 'Back to BOQ' : 'Bills of Quantities' }}
        title={boq ? `Edit BOQ` : 'New BOQ'}
        subtitle={<span className="inline-meta">{project.name}{project.isDemo && <DemoBadge />}<span>Currency: {currency}</span></span>}
      />
      {boq && boq.currency !== project.currency && (
        <p className="demo-note" role="note">This BOQ is in {boq.currency} (fixed when it was created); the project currency is now {project.currency}. Amounts are not converted.</p>
      )}
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
          {general.length > 0 && <ul className="err-list">{general.map((g) => <li key={g}>{g}</li>)}</ul>}
          {conflict && <div className="alert-actions"><Button onClick={onReload}>Discard my changes and reload the latest</Button></div>}
        </div>
      )}

      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="boq-form">
        <Card>
          <div className="grid-2">
            <div className="span-2"><Field id="boq-title" label="BOQ title" required error={errors.title} hint="e.g. “Ground floor civil works”">{(a) => <input {...a} value={values.title} maxLength={150} autoComplete="off" onChange={(e) => { setValues((s) => ({ ...s, title: e.target.value })); setErrors((er) => ({ ...er, title: undefined })); }} />}</Field></div>
            <div className="span-2"><Field id="boq-desc" label="Scope of work" error={errors.description} hint={`Optional. ${values.description.length}/2000`}>{(a) => <textarea {...a} rows={3} maxLength={2000} value={values.description} onChange={(e) => setValues((s) => ({ ...s, description: e.target.value }))} />}</Field></div>
          </div>
        </Card>

        <Card title="Items" subtitle={`Quantity × rate per unit = amount. Leave the rate empty if it is not estimated yet - it is then excluded from the total, not counted as zero.`}>
          {errors.items && <p className="field-error" role="alert">{errors.items}</p>}
          <div className="table-wrap">
            <table className="boq-table">
              <thead><tr><th scope="col">No.</th><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Unit</th><th scope="col">Rate ({currency})</th><th scope="col" className="num">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {values.rows.length === 0 && <tr className="boq-empty"><td colSpan={7}>No items yet. Use “Add item” to start the BOQ.</td></tr>}
                {values.rows.map((r, i) => {
                  const e = rowErr(r.key);
                  const n = i + 1;
                  const amount = isValidQuantity(r.quantity) && r.rate.trim() !== '' && isValidRate(r.rate) ? lineTotal(r.quantity, r.rate) : null;
                  return (
                    <tr key={r.key} data-row-key={r.key}>
                      <td data-label="No." className="no">{n}</td>
                      <td data-label="Description">
                        <textarea aria-label={`Item ${n} description`} aria-invalid={e.description ? true : undefined} aria-describedby={e.description ? `d-${r.key}` : undefined} rows={2} maxLength={1000} value={r.description} onChange={(ev) => setRow(r.key, 'description', ev.target.value)} />
                        {e.description && <p id={`d-${r.key}`} className="field-error" role="alert">{e.description}</p>}
                        <input aria-label={`Item ${n} specifications (optional)`} className="spec-input" placeholder="Specifications (optional)" maxLength={1000} value={r.specifications} onChange={(ev) => setRow(r.key, 'specifications', ev.target.value)} />
                        {e.specifications && <p className="field-error" role="alert">{e.specifications}</p>}
                      </td>
                      <td data-label="Quantity">
                        <input aria-label={`Item ${n} quantity`} inputMode="decimal" aria-invalid={e.quantity ? true : undefined} aria-describedby={e.quantity ? `q-${r.key}` : undefined} value={r.quantity} onChange={(ev) => setRow(r.key, 'quantity', ev.target.value)} />
                        {e.quantity && <p id={`q-${r.key}`} className="field-error" role="alert">{e.quantity}</p>}
                      </td>
                      <td data-label="Unit">
                        <select aria-label={`Item ${n} unit`} aria-invalid={e.unit ? true : undefined} value={r.unit} onChange={(ev) => setRow(r.key, 'unit', ev.target.value)}>
                          <option value="">Select…</option>{BOQ_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                        </select>
                        {e.unit && <p className="field-error" role="alert">{e.unit}</p>}
                      </td>
                      <td data-label={`Rate (${currency})`}>
                        <input aria-label={`Item ${n} rate per unit`} inputMode="decimal" placeholder="optional" aria-invalid={e.rate ? true : undefined} aria-describedby={e.rate ? `r-${r.key}` : undefined} value={r.rate} onChange={(ev) => setRow(r.key, 'rate', ev.target.value)} />
                        {e.rate && <p id={`r-${r.key}`} className="field-error" role="alert">{e.rate}</p>}
                      </td>
                      <td data-label="Amount" className="num amount" aria-label={`Item ${n} amount`}>{amount ? formatMoneyFixed(amount, currency) : '—'}</td>
                      <td data-label="Actions" className="row-actions">
                        <button type="button" className="icon-btn" aria-label={`Move item ${n} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                        <button type="button" className="icon-btn" aria-label={`Move item ${n} down`} disabled={i === values.rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                        <button type="button" className="icon-btn danger" aria-label={`Delete item ${n}`} onClick={() => askRemove(r)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="boq-foot">
            <Button onClick={addRow} disabled={values.rows.length >= MAX_BOQ_ITEMS}><Plus size={16} aria-hidden="true" />Add item</Button>
            <div className="totals" aria-live="polite">
              <div><span>Estimated total (base)</span><strong data-testid="live-total">{formatMoneyFixed(totals.total, currency)}</strong></div>
              <p className="small muted">
                {totals.priced} priced · {totals.unpriced} without rate{totals.invalid > 0 && <span className="text-warn"> · {totals.invalid} with invalid numbers (excluded)</span>}. Excludes taxes and other adjustments. The server recalculates this total when you save.
              </p>
            </div>
          </div>
        </Card>

        <div className="form-actions">
          <Button variant="ghost" onClick={cancel} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" loading={submitting}><Save size={16} aria-hidden="true" />{submitting ? 'Saving…' : boq ? 'Save changes' : 'Create BOQ'}</Button>
        </div>
      </form>

      <ConfirmDialog open={Boolean(pendingRemove)} danger title="Remove this item?" confirmLabel="Remove item"
        message={<>Item {pendingRemove ? values.rows.indexOf(pendingRemove) + 1 : ''} “{pendingRemove?.description.trim() || 'untitled'}” will be removed from this BOQ. It is only deleted from the database when you save.</>}
        onConfirm={() => pendingRemove && removeRow(pendingRemove.key)} onCancel={() => setRemoveKey(null)} />
      <ConfirmDialog open={confirmCancel} danger title="Discard unsaved changes?" confirmLabel="Discard changes" cancelLabel="Keep editing"
        message="You have unsaved changes to this BOQ. If you leave now they will be lost."
        onConfirm={() => { dirtyRef.current = false; setConfirmCancel(false); navigate(boq ? `/boqs/${boq.id}` : `/projects/${project.id}/boqs`); }} onCancel={() => setConfirmCancel(false)} />
      <ConfirmDialog open={blocker.state === 'blocked'} danger title="Leave without saving?" confirmLabel="Leave and discard" cancelLabel="Stay on this page"
        message="You have unsaved changes to this BOQ. If you leave now they will be lost."
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()} onCancel={() => blocker.state === 'blocked' && blocker.reset()} />
    </>
  );
}
