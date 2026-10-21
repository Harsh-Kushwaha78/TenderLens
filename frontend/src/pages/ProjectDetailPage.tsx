import { BarChart3, Calendar, ClipboardList, FileText, ListChecks, MapPin, Pencil, Plus, Receipt, SearchX, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { listBoqs } from '../api/boqs';
import { getProject } from '../api/projects';
import { Card, DemoBadge, EmptyState, ErrorState, LinkButton, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { useAsync, useDocumentTitle } from '../hooks/hooks';
import { TYPE_LABELS } from '../lib/constants';
import { daysBetween, formatDate, formatDateTime, formatMoney, formatMoneyFixed, localToday, locationLabel } from '../lib/format';

export function NotFoundPage({ what = 'page' }: { what?: string }) {
  useDocumentTitle('Not found');
  return (
    <EmptyState icon={<SearchX size={26} />} title={`We could not find that ${what}`}
      action={<LinkButton to="/projects" variant="primary">Back to projects</LinkButton>}>
      The link may be wrong, or the {what} may no longer exist.
    </EmptyState>
  );
}

const FUTURE = [
  { icon: FileText, title: 'Quotation requests & OCR', text: 'Generate quotation requests; upload and review quotations.' },
  { icon: BarChart3, title: 'Price benchmarking', text: 'Compare submitted rates with dated, sourced market observations.' },
  { icon: Receipt, title: 'Quotation comparison', text: 'Compare contractor quotations against BOQ items.' },
  { icon: ListChecks, title: 'Milestones & reconciliation', text: 'Track timeline, expenses, invoices and verified work.' },
];

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const { data: p, error, loading, reload } = useAsync((s) => getProject(id, s), [id]);
  useDocumentTitle(p?.name ?? 'Project');
  const boqs = useAsync((s) => listBoqs(id, s), [id]);

  if (loading && !p) return <><PageHeader title="Loading project…" back={{ to: '/projects', label: 'Projects' }} /><div className="grid-3"><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /></div><Skeleton height={240} className="mt" /></>;
  if (error && (error as any).isNotFound) return <NotFoundPage what="project" />;
  if (error || !p) return <ErrorState title="Could not load the project" message={error?.message ?? 'Unknown error.'} onRetry={reload} />;

  const today = localToday();
  const total = Math.max(1, daysBetween(p.plannedStartDate, p.targetCompletionDate));
  const elapsed = Math.min(100, Math.max(0, Math.round((daysBetween(p.plannedStartDate, today) / total) * 100)));
  const remaining = daysBetween(today, p.targetCompletionDate);
  const open = ['planning', 'active', 'on_hold'].includes(p.status);
  const timing = !open ? null : remaining < 0 ? `${-remaining} day${remaining === -1 ? '' : 's'} past target` : remaining === 0 ? 'Due today' : `${remaining} day${remaining === 1 ? '' : 's'} to target`;

  return (
    <>
      <PageHeader
        back={{ to: '/projects', label: 'Projects' }}
        title={p.name}
        subtitle={<span className="inline-meta"><StatusBadge status={p.status} />{p.isDemo && <DemoBadge />}<span>{TYPE_LABELS[p.projectType]}</span></span>}
        actions={<LinkButton to={`/projects/${p.id}/edit`} variant="primary"><Pencil size={16} aria-hidden="true" />Edit project</LinkButton>}
      />

      <div className="grid-3">
        <Card className="stat"><p className="stat-label">Planned budget</p><p className="stat-value">{formatMoney(p.plannedBudget, p.currency)}</p><p className="stat-note">Currency: {p.currency}</p></Card>
        <Card className="stat"><p className="stat-label">Contingency budget</p><p className="stat-value">{p.contingencyBudget ? formatMoney(p.contingencyBudget, p.currency) : '-'}</p><p className="stat-note">{p.contingencyBudget ? 'Held separately from planned budget' : 'Not provided'}</p></Card>
        <Card className="stat"><p className="stat-label">Target completion</p><p className="stat-value">{formatDate(p.targetCompletionDate)}</p><p className={`stat-note ${open && remaining < 0 ? 'text-warn' : ''}`}>{timing ?? 'Project is not open'}</p></Card>
      </div>

      <div className="detail-grid">
        <Card title="Project details">
          <dl className="detail-list">
            <div><dt><UserRound size={15} aria-hidden="true" />Client / organization</dt><dd>{p.clientName}</dd></div>
            <div><dt><MapPin size={15} aria-hidden="true" />Location</dt><dd>{locationLabel(p.location)}{p.location.postalCode ? ` - ${p.location.postalCode}` : ''}</dd></div>
            <div><dt><Calendar size={15} aria-hidden="true" />Planned start</dt><dd>{formatDate(p.plannedStartDate)}</dd></div>
            <div><dt><Calendar size={15} aria-hidden="true" />Target completion</dt><dd>{formatDate(p.targetCompletionDate)}</dd></div>
            <div className="full"><dt>Description / scope summary</dt><dd className={p.description ? 'prewrap' : 'muted'}>{p.description ?? 'No description provided.'}</dd></div>
            <div><dt>Created</dt><dd>{formatDateTime(p.createdAt)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatDateTime(p.updatedAt)}</dd></div>
          </dl>
        </Card>

        <Card title="Schedule" subtitle="Based on planned dates only - this is not a measure of work completed.">
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={elapsed} aria-label="Schedule elapsed"><span style={{ width: `${elapsed}%` }} /></div>
          <div className="progress-meta"><span>{formatDate(p.plannedStartDate)}</span><strong>{elapsed}% of schedule elapsed</strong><span>{formatDate(p.targetCompletionDate)}</span></div>
        </Card>
      </div>

      <Card title="Bill of Quantities" subtitle="List work items, quantities and estimated rates, then export a PDF." className="mt"
        actions={<span className="inline-meta"><LinkButton to={`/projects/${p.id}/boqs`}><ClipboardList size={16} aria-hidden="true" />Open BOQs{boqs.data ? ` (${boqs.data.length})` : ''}</LinkButton><LinkButton to={`/projects/${p.id}/boqs/new`} variant="primary"><Plus size={16} aria-hidden="true" />New BOQ</LinkButton></span>}>
        {boqs.loading && !boqs.data ? <Skeleton height={20} width="60%" /> : boqs.error ? (
          <p className="muted small" role="alert">Could not load BOQs: {boqs.error.message} <button type="button" className="link-btn" onClick={boqs.reload}>Retry</button></p>
        ) : boqs.data && boqs.data.length > 0 ? (
          <ul className="mini-list">{boqs.data.slice(0, 3).map((b) => <li key={b.id}><Link to={`/boqs/${b.id}`}>{b.title}</Link><span className="muted">{b.itemCount} items · {formatMoneyFixed(b.total, b.currency)}</span></li>)}</ul>
        ) : <p className="muted small">No BOQs yet for this project.</p>}
      </Card>

      <Card title="Project workspace - coming next" subtitle="Roadmap preview. None of these modules is implemented yet." className="mt">
        <div className="future-grid">
          {FUTURE.map(({ icon: Icon, title, text }) => (
            <div key={title} className="future" aria-disabled="true">
              <Icon size={20} aria-hidden="true" /><div><strong>{title}</strong><span className="soon">Not available</span><p>{text}</p></div>
            </div>
          ))}
        </div>
      </Card>
      <p className="muted small mt"><Link to="/projects">← All projects</Link></p>
    </>
  );
}
