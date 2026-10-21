import { ClipboardList, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { listBoqs } from '../api/boqs';
import { getProject } from '../api/projects';
import { Card, DemoBadge, EmptyState, ErrorState, LinkButton, PageHeader, Skeleton } from '../components/ui';
import { useAsync, useDocumentTitle } from '../hooks/hooks';
import { formatDateTime, formatMoneyFixed } from '../lib/format';
import { NotFoundPage } from './ProjectDetailPage';

export function ProjectBoqsPage() {
  const { projectId = '' } = useParams();
  useDocumentTitle('Bills of Quantities');
  const { data, error, loading, reload } = useAsync(async (s) => {
    const [project, boqs] = await Promise.all([getProject(projectId, s), listBoqs(projectId, s)]);
    return { project, boqs };
  }, [projectId]);

  if (loading && !data) return <><PageHeader title="Bills of Quantities" back={{ to: `/projects/${projectId}`, label: 'Project' }} /><Card><div className="skeleton-rows">{[0, 1, 2].map((i) => <Skeleton key={i} height={56} />)}</div></Card></>;
  if (error && (error as any).isNotFound) return <NotFoundPage what="project" />;
  if (error || !data) return <ErrorState title="Could not load BOQs" message={error?.message ?? 'Unknown error.'} onRetry={reload} />;

  const { project, boqs } = data;
  return (
    <>
      <PageHeader
        back={{ to: `/projects/${project.id}`, label: project.name }}
        title="Bills of Quantities"
        subtitle={<span className="inline-meta">{project.name}{project.isDemo && <DemoBadge />}</span>}
        actions={<LinkButton to={`/projects/${project.id}/boqs/new`} variant="primary"><Plus size={16} aria-hidden="true" />New BOQ</LinkButton>}
      />
      {boqs.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList size={26} />} title="No BOQs for this project yet"
            action={<LinkButton to={`/projects/${project.id}/boqs/new`} variant="primary"><Plus size={16} aria-hidden="true" />Create the first BOQ</LinkButton>}>
            A BOQ lists the work items, quantities and estimated rates for this project and can be exported as a PDF.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">BOQ</th><th scope="col" className="num">Items</th><th scope="col" className="num">Estimated total</th><th scope="col">Last updated</th></tr></thead>
              <tbody>{boqs.map((b) => (
                <tr key={b.id}>
                  <td><Link className="row-link" to={`/boqs/${b.id}`}>{b.title}</Link><div className="sub">Revision {b.revision}</div></td>
                  <td className="num">{b.itemCount}{b.unpricedItemCount > 0 && <div className="sub text-warn">{b.unpricedItemCount} without rate</div>}</td>
                  <td className="num">{formatMoneyFixed(b.total, b.currency)}</td>
                  <td>{formatDateTime(b.updatedAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
