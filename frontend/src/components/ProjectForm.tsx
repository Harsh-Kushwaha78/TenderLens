import { ArrowLeft, ArrowRight, Check, Rocket, Save } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Card, Field } from './ui';
import { ApiClientError } from '../api/client';
import type { Project, ProjectStatus } from '../api/types';
import { CURRENCIES, PROJECT_TYPES, STATUS_LABELS, TYPE_LABELS, allowedStatuses } from '../lib/constants';
import { formatDate, formatMoney } from '../lib/format';
import {
  STEP_FIELDS, firstStepWithError, mapApiErrors, validateValues,
  type FieldErrors, type FieldKey, type FormValues,
} from '../lib/validation';

const STEPS = ['Basic information', 'Budget & timeline', 'Review & create'];

interface Props {
  mode: 'create' | 'edit';
  initial: FormValues;
  current?: Project;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
}

export function ProjectForm({ mode, initial, current, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isEdit = mode === 'edit';

  const bind = (key: FieldKey) => ({
    value: values[key] as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      if (errors[key]) setErrors((er) => { const n = { ...er }; delete n[key]; return n; });
    },
    onBlur: () => {
      const e = validateValues(values, [key])[key];
      setErrors((er) => (e ? { ...er, [key]: e } : er));
    },
  });

  const goTo = (n: number) => { setStep(n); setFormError(null); requestAnimationFrame(() => headingRef.current?.focus()); };

  const next = () => {
    const e = validateValues(values, STEP_FIELDS[step]);
    setErrors((prev) => ({ ...prev, ...e }));
    if (Object.keys(e).length === 0) goTo(step + 1);
  };

  const submit = async () => {
    const e = validateValues(values);
    if (Object.keys(e).length) {
      setErrors(e);
      if (!isEdit) goTo(firstStepWithError(e));
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true); setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiClientError && err.details.length) {
        const { fieldErrors, unmapped } = mapApiErrors(err.details);
        setErrors(fieldErrors);
        setFormError([err.message, ...unmapped].join(' '));
        if (!isEdit && Object.keys(fieldErrors).length) setStep(firstStepWithError(fieldErrors));
      } else {
        setFormError(err instanceof ApiClientError ? err.message : 'Something went wrong while saving. Your input is preserved - please retry.');
      }
    } finally { setSubmitting(false); }
  };

  const showStep = (n: number) => isEdit || step === n;

  return (
    <form className="project-form" noValidate onSubmit={(e) => { e.preventDefault(); if (isEdit || step === 2) void submit(); else next(); }}>
      {!isEdit && (
        <ol className="stepper" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="step-dot">{i < step ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
              <span className="step-label">{label}</span>
            </li>
          ))}
        </ol>
      )}

      {formError && <div className="form-alert" role="alert">{formError}</div>}

      {showStep(0) && (
        <Card>
          <h2 className="form-section" tabIndex={-1} ref={step === 0 ? headingRef : undefined}>Basic information</h2>
          <div className="grid-2">
            <div className="span-2"><Field id="name" label="Project name" required error={errors.name} hint="A short, recognisable name (3-120 characters).">{(a) => <input {...a} {...bind('name')} maxLength={120} autoComplete="off" />}</Field></div>
            <Field id="projectType" label="Project type" required error={errors.projectType}>
              {(a) => (<select {...a} {...bind('projectType')}><option value="">Select a type…</option>{PROJECT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>)}
            </Field>
            <Field id="clientName" label="Client or organization" required error={errors.clientName} hint="Free text for now; organization ownership is not modelled yet.">{(a) => <input {...a} {...bind('clientName')} maxLength={120} autoComplete="off" />}</Field>
            <Field id="city" label="City" required error={errors.city}>{(a) => <input {...a} {...bind('city')} maxLength={80} autoComplete="off" />}</Field>
            <Field id="state" label="State" required error={errors.state}>{(a) => <input {...a} {...bind('state')} maxLength={80} autoComplete="off" />}</Field>
            <Field id="postalCode" label="Postal code" error={errors.postalCode} hint="Optional.">{(a) => <input {...a} {...bind('postalCode')} maxLength={10} autoComplete="off" />}</Field>
            <div className="span-2"><Field id="description" label="Description / scope summary" error={errors.description} hint={`Optional. ${values.description.length}/2000`}>{(a) => <textarea {...a} {...bind('description')} rows={4} maxLength={2000} />}</Field></div>
          </div>
        </Card>
      )}

      {showStep(1) && (
        <Card>
          <h2 className="form-section" tabIndex={-1} ref={step === 1 ? headingRef : undefined}>Budget &amp; timeline</h2>
          <div className="grid-2">
            <Field id="plannedBudget" label="Planned budget" required error={errors.plannedBudget}
              hint={values.plannedBudget && !validateValues(values, ['plannedBudget']).plannedBudget ? `Reads as ${formatMoney(values.plannedBudget, values.currency)}` : 'Digits and an optional decimal point, e.g. 1500000.50'}>
              {(a) => <input {...a} {...bind('plannedBudget')} inputMode="decimal" autoComplete="off" />}
            </Field>
            <Field id="currency" label="Currency" required error={errors.currency}>
              {(a) => <select {...a} {...bind('currency')}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
            </Field>
            <Field id="contingencyBudget" label="Contingency budget" error={errors.contingencyBudget} hint="Optional. Held separately from the planned budget.">
              {(a) => <input {...a} {...bind('contingencyBudget')} inputMode="decimal" autoComplete="off" />}
            </Field>
            <span className="grid-spacer" aria-hidden="true" />
            <Field id="plannedStartDate" label="Planned start date" required error={errors.plannedStartDate}>{(a) => <input type="date" {...a} {...bind('plannedStartDate')} />}</Field>
            <Field id="targetCompletionDate" label="Target completion date" required error={errors.targetCompletionDate}>{(a) => <input type="date" {...a} {...bind('targetCompletionDate')} min={values.plannedStartDate || undefined} />}</Field>
          </div>
        </Card>
      )}

      {isEdit && current && (
        <Card>
          <h2 className="form-section">Status</h2>
          <div className="grid-2">
            <Field id="status" label="Project status" error={errors.status} hint="Only valid next steps are offered. Completed and cancelled projects are final.">
              {(a) => (
                <select {...a} value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ProjectStatus }))}>
                  {allowedStatuses(current.status).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}{s === current.status ? ' (current)' : ''}</option>)}
                </select>
              )}
            </Field>
          </div>
        </Card>
      )}

      {!isEdit && step === 2 && (
        <Card>
          <h2 className="form-section" tabIndex={-1} ref={headingRef}>Review &amp; create</h2>
          <p className="muted">Check the details below. Use Back to change anything - your entries are kept.</p>
          <div className="review-grid">
            <Review title="Basic information" onEdit={() => goTo(0)} rows={[
              ['Project name', values.name.trim()], ['Type', TYPE_LABELS[values.projectType as keyof typeof TYPE_LABELS] ?? '-'],
              ['Client / organization', values.clientName.trim()],
              ['Location', [values.city.trim(), values.state.trim(), values.postalCode.trim()].filter(Boolean).join(', ')],
              ['Description', values.description.trim() || 'Not provided'],
            ]} />
            <Review title="Budget & timeline" onEdit={() => goTo(1)} rows={[
              ['Planned budget', formatMoney(values.plannedBudget.trim(), values.currency)],
              ['Contingency', values.contingencyBudget.trim() ? formatMoney(values.contingencyBudget.trim(), values.currency) : 'Not provided'],
              ['Planned start', values.plannedStartDate ? formatDate(values.plannedStartDate) : '-'],
              ['Target completion', values.targetCompletionDate ? formatDate(values.targetCompletionDate) : '-'],
            ]} />
          </div>
          <Field id="status" label="Initial status" hint="Projects start as Draft unless you choose Planning.">
            {(a) => (
              <select {...a} value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ProjectStatus }))}>
                <option value="draft">Draft</option><option value="planning">Planning</option>
              </select>
            )}
          </Field>
        </Card>
      )}

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <div className="form-actions-right">
          {!isEdit && step > 0 && <Button onClick={() => goTo(step - 1)} disabled={submitting}><ArrowLeft size={16} aria-hidden="true" />Back</Button>}
          {!isEdit && step < 2 && <Button variant="primary" type="submit">Continue<ArrowRight size={16} aria-hidden="true" /></Button>}
          {!isEdit && step === 2 && <Button variant="primary" type="submit" loading={submitting}><Rocket size={16} aria-hidden="true" />{submitting ? 'Creating…' : formError ? 'Retry create project' : 'Create project'}</Button>}
          {isEdit && <Button variant="primary" type="submit" loading={submitting}><Save size={16} aria-hidden="true" />{submitting ? 'Saving…' : 'Save changes'}</Button>}
        </div>
      </div>
    </form>
  );
}

function Review({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="review">
      <div className="review-head"><h3>{title}</h3><Button variant="ghost" onClick={onEdit}>Edit</Button></div>
      <dl>{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
    </div>
  );
}
