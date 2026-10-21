import { Download, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteBoq, fetchBoqPdf, getBoq } from '../api/boqs';
import { ApiClientError } from '../api/client';
import type { Boq } from '../api/types';
import { Button, Card, ConfirmDialog, DemoBadge, ErrorState, LinkButton, PageHeader, Skeleton } from '../components/ui';
import { useToast } from '../context/Toast';
import { useAsync, useDocumentTitle } from '../hooks/hooks';
import { UNIT_LABELS } from '../lib/constants';
import { trimQuantity } from '../lib/boqMath';
import { formatDate, formatDateTime, formatMoneyFixed, localToday, locationLabel } from '../lib/format';
import { NotFoundPage } from './ProjectDetailPage';

export function BoqViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: boq, error, loading, reload } = useAsync((s) => getBoq(id, s), [id]);
  useDocumentTitle(boq?.title ?? 'BOQ');
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<{ message: string; details: string[]; stale: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading && !boq) return <><PageHeader title="Loading BOQ…" /><Skeleton height={420} /></>;
  if (error && (error as any).isNotFound) return <NotFoundPage what="BOQ" />;
  if (error || !boq) return <ErrorState title="Could not load the BOQ" message={error?.message ?? 'Unknown error.'} onRetry={reload} />;

  const download = async () => {
    if (downloading) return;
    setDownloading(true); setPdfError(null);
    try {
      const { blob, filename } = await fetchBoqPdf(boq.id, boq.revision);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = filename ?? `TenderLens-BOQ-${boq.id.slice(0, 8)}-r${boq.revision}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      notify('success', 'PDF downloaded.');
    } catch (err) {
      const e = err instanceof ApiClientError ? err : null;
      setPdfError({ message: e?.message ?? 'The PDF could not be generated.', details: (e?.details ?? []).map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)), stale: e?.code === 'CONFLICT' });
    } finally { setDownloading(false); }
  };

  const remove = async () => {
    setDeleting(true);
    try { await deleteBoq(boq.id); notify('success', `Deleted "${boq.title}".`); navigate(`/projects/${boq.projectId}/boqs`); }
    catch (err) { notify('error', err instanceof ApiClientError ? err.message : 'Could not delete the BOQ.'); setConfirmDelete(false); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <PageHeader
        back={{ to: `/projects/${boq.projectId}/boqs`, label: 'All BOQs' }}
        title={boq.title}
        subtitle={<span className="inline-meta"><Link to={`/projects/${boq.projectId}`}>{boq.project.name}</Link>{boq.project.isDemo && <DemoBadge />}<span>Revision {boq.revision}</span><span>Updated {formatDateTime(boq.updatedAt)}</span></span>}
        actions={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={16} aria-hidden="true" />Delete</Button>
          <LinkButton to={`/boqs/${boq.id}/edit`}><Pencil size={16} aria-hidden="true" />Edit</LinkButton>
          <Button variant="primary" onClick={download} loading={downloading}><Download size={16} aria-hidden="true" />{downloading ? 'Generating…' : 'Download PDF'}</Button>
        </>}
      />

      {pdfError && (
        <div className="error-state" role="alert">
          <div>
            <strong>{pdfError.stale ? 'This preview is out of date' : 'PDF not generated'}</strong>
            <p>{pdfError.message}</p>
            {pdfError.details.length > 0 && <ul className="err-list">{pdfError.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
          {pdfError.stale ? <Button onClick={() => { setPdfError(null); reload(); }}>Reload preview</Button> : <Button onClick={download}>Try again</Button>}
        </div>
      )}

      <p className="muted small preview-note">Document preview · the PDF is generated from the <strong>saved</strong> version (revision {boq.revision}). Unsaved edits are not included.</p>
      <BoqPaper boq={boq} />

      <ConfirmDialog open={confirmDelete} danger busy={deleting} title="Delete this BOQ?" confirmLabel="Delete BOQ"
        message={<>“{boq.title}” and its {boq.items.length} item{boq.items.length === 1 ? '' : 's'} will be permanently deleted. The project itself is not affected. This cannot be undone.</>}
        onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </>
  );
}

/** On-screen document preview mirroring the PDF layout (same saved data, same columns). */
function BoqPaper({ boq }: { boq: Boq }) {
  return (
    <article className="paper" aria-label="BOQ document preview">
      <div className="paper-head"><span>TenderLens · Bill of Quantities</span><span>DRAFT - not an approved or issued tender document</span></div>
      <h2 className="paper-title">{boq.title}</h2>
      <dl className="paper-meta">
        <div><dt>Project</dt><dd>{boq.project.name}</dd></div>
        <div><dt>Client / organization</dt><dd>{boq.project.clientName}</dd></div>
        <div><dt>Location</dt><dd>{[locationLabel(boq.project.location), boq.project.location.postalCode].filter(Boolean).join(', ')}</dd></div>
        <div><dt>Currency</dt><dd>{boq.currency}</dd></div>
        <div><dt>BOQ revision</dt><dd>{boq.revision}</dd></div>
        <div><dt>Generated</dt><dd>{formatDate(localToday())} (set when the PDF is downloaded)</dd></div>
      </dl>
      {boq.description && <><h3 className="paper-h3">Scope of work</h3><p className="prewrap">{boq.description}</p></>}
      <div className="table-wrap">
        <table className="paper-table">
          <thead><tr><th scope="col">No.</th><th scope="col">Description</th><th scope="col" className="num">Qty</th><th scope="col">Unit</th><th scope="col" className="num">Rate ({boq.currency})</th><th scope="col" className="num">Amount ({boq.currency})</th></tr></thead>
          <tbody>
            {boq.items.length === 0 && <tr><td colSpan={6} className="muted">This BOQ has no items yet.</td></tr>}
            {boq.items.map((i) => (
              <tr key={i.id}>
                <td>{i.position}</td>
                <td><span className="prewrap">{i.description}</span>{i.specifications && <div className="spec prewrap">{i.specifications}</div>}</td>
                <td className="num">{trimQuantity(i.quantity)}</td>
                <td>{UNIT_LABELS[i.unit]}</td>
                <td className="num">{i.estimatedUnitRate === null ? '—' : formatMoneyFixed(i.estimatedUnitRate, boq.currency)}</td>
                <td className="num strong">{i.lineTotal === null ? '—' : formatMoneyFixed(i.lineTotal, boq.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="paper-total"><span>Estimated total (base)</span><strong>{formatMoneyFixed(boq.total, boq.currency)}</strong></div>
      <p className="paper-note">Base total = sum of line totals (quantity × rate, each rounded half-up to 2 decimals). It excludes taxes, overheads, contingency and any other adjustments. Rates are estimates, not quotations.</p>
      {boq.unpricedItemCount > 0 && <p className="paper-note text-warn">{boq.unpricedItemCount} item(s) shown with “—” have no estimated rate yet and are not included in the total.</p>}
    </article>
  );
}
