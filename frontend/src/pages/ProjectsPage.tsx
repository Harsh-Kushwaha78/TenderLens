import { ArrowDown, ArrowUp, ArrowUpDown, FolderPlus, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listProjects } from '../api/projects';
import type { Project, ProjectStatus, ProjectType, SortField } from '../api/types';
import { Button, Card, DemoBadge, EmptyState, ErrorState, LinkButton, PageHeader, Pagination, Skeleton, StatusBadge } from '../components/ui';
import { useDemo } from '../context/Demo';
import { useAsync, useDebounced, useDocumentTitle, useMediaQuery } from '../hooks/hooks';
import { PROJECT_STATUSES, PROJECT_TYPES, SORT_FIELDS, SORT_LABELS, STATUS_LABELS, TYPE_LABELS } from '../lib/constants';
import { formatDate, formatMoney, locationLabel } from '../lib/format';

const PAGE_SIZE = 10;

export function ProjectsPage() {
  useDocumentTitle('Projects');
  const { showDemo } = useDemo();
  const [sp, setSp] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 820px)');

  const q = sp.get('q') ?? '';
  const status = (PROJECT_STATUSES as string[]).includes(sp.get('status') ?? '') ? (sp.get('status') as ProjectStatus) : '';
  const type = (PROJECT_TYPES as string[]).includes(sp.get('type') ?? '') ? (sp.get('type') as ProjectType) : '';
  const sortBy = (SORT_FIELDS as string[]).includes(sp.get('sortBy') ?? '') ? (sp.get('sortBy') as SortField) : 'createdAt';
  const sortOrder = sp.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(sp.get('page')) || 1);

  const update = (changes: Record<string, string>, keepPage = false) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) (v ? n.set(k, v) : n.delete(k));
      if (!keepPage) n.delete('page');
      return n;
    }, { replace: true });

  const [search, setSearch] = useState(q);
  const debounced = useDebounced(search);
  useEffect(() => { if (debounced.trim() !== q) update({ q: debounced.trim() }); /* eslint-disable-next-line */ }, [debounced]);
  useEffect(() => { setSearch(q); }, [q]);

  const { data, error, loading, reload } = useAsync(
    (signal) => listProjects({ q: q || undefined, status: status ? [status] : undefined, projectType: type ? [type] : undefined, sortBy, sortOrder, page, pageSize: PAGE_SIZE, includeDemo: showDemo }, signal),
    [q, status, type, sortBy, sortOrder, page, showDemo],
  );

  // If filters shrink the result set below the current page, jump to the last valid page.
  useEffect(() => {
    if (data && data.data.length === 0 && data.pagination.totalItems > 0 && page > data.pagination.totalPages) update({ page: String(data.pagination.totalPages) }, true);
    // eslint-disable-next-line
  }, [data]);

  const filtered = Boolean(q || status || type);
  const reset = () => { setSearch(''); setSp(new URLSearchParams(), { replace: true }); };
  const toggleSort = (field: SortField) => update(field === sortBy ? { sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' } : { sortBy: field, sortOrder: field === 'name' ? 'asc' : 'desc' });

  const rows = data?.data ?? [];
  const pg = data?.pagination;

  return (
    <>
      <PageHeader title="Projects" subtitle="Create, search and manage your procurement projects."
        actions={<LinkButton to="/projects/new" variant="primary"><Plus size={16} aria-hidden="true" />Create project</LinkButton>} />

      <Card className="filters-card">
        <div className="filters" role="search">
          <div className="search-box">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Search projects by name, client or location" placeholder="Search name, client or location…" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
          </div>
          <select aria-label="Filter by status" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select aria-label="Filter by project type" value={type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">All types</option>{PROJECT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          <select aria-label="Sort by" value={sortBy} onChange={(e) => update({ sortBy: e.target.value })}>
            {SORT_FIELDS.map((f) => <option key={f} value={f}>Sort: {SORT_LABELS[f]}</option>)}
          </select>
          <Button aria-label={`Sort order: ${sortOrder === 'asc' ? 'ascending' : 'descending'}. Activate to reverse.`} onClick={() => update({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })}>
            {sortOrder === 'asc' ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}{sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </Button>
          <Button variant="ghost" onClick={reset} disabled={!filtered && sortBy === 'createdAt' && sortOrder === 'desc'}><X size={16} aria-hidden="true" />Reset</Button>
          <Button variant="ghost" onClick={reload} aria-label="Refresh list"><RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" /></Button>
        </div>
      </Card>

      {showDemo && <p className="demo-note" role="note">Demo data is included in this list. Rows marked “Demo” are synthetic.</p>}

      {error && !data ? (
        <ErrorState title="Could not load projects" message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Card><div className="skeleton-rows">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={52} />)}</div></Card>
      ) : rows.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState title="No projects match your filters" action={<Button onClick={reset}>Reset filters</Button>}>Try a different search term or clear the filters.</EmptyState>
          ) : (
            <EmptyState icon={<FolderPlus size={26} />} title="No projects yet" action={<LinkButton to="/projects/new" variant="primary"><Plus size={16} aria-hidden="true" />Create your first project</LinkButton>}>
              Projects are the starting point for BOQs, quotations and cost tracking.
            </EmptyState>
          )}
        </Card>
      ) : (
        <Card className={`list-card ${loading ? 'is-loading' : ''}`}>
          {error && <ErrorState title="Refresh failed" message={error.message} onRetry={reload} />}
          {isMobile ? (
            <ul className="card-list">{rows.map((p) => <ProjectCard key={p.id} p={p} />)}</ul>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <SortTh label="Project" field="name" {...{ sortBy, sortOrder, toggleSort }} />
                  <th scope="col">Type</th><th scope="col">Status</th>
                  <SortTh label="Planned budget" field="plannedBudget" align="right" {...{ sortBy, sortOrder, toggleSort }} />
                  <SortTh label="Target completion" field="targetCompletionDate" {...{ sortBy, sortOrder, toggleSort }} />
                  <SortTh label="Created" field="createdAt" {...{ sortBy, sortOrder, toggleSort }} />
                </tr></thead>
                <tbody>{rows.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="row-link" to={`/projects/${p.id}`}>{p.name}</Link>{p.isDemo && <> <DemoBadge /></>}<div className="sub">{p.clientName} · {locationLabel(p.location)}</div></td>
                    <td>{TYPE_LABELS[p.projectType]}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="num">{formatMoney(p.plannedBudget, p.currency)}</td>
                    <td>{formatDate(p.targetCompletionDate)}</td>
                    <td>{formatDate(p.createdAt.slice(0, 10))}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {pg && <Pagination page={pg.page} totalPages={pg.totalPages} totalItems={pg.totalItems} pageSize={pg.pageSize} onChange={(n) => update({ page: String(n) }, true)} />}
        </Card>
      )}
    </>
  );
}

function SortTh({ label, field, sortBy, sortOrder, toggleSort, align }: { label: string; field: SortField; sortBy: SortField; sortOrder: 'asc' | 'desc'; toggleSort: (f: SortField) => void; align?: 'right' }) {
  const active = sortBy === field;
  return (
    <th scope="col" aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} className={align === 'right' ? 'num' : undefined}>
      <button type="button" className="th-btn" onClick={() => toggleSort(field)}>
        {label}{active ? (sortOrder === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} className="faint" aria-hidden="true" />}
      </button>
    </th>
  );
}

function ProjectCard({ p }: { p: Project }) {
  return (
    <li>
      <Link to={`/projects/${p.id}`} className="project-card">
        <div className="pc-top"><strong>{p.name}</strong><StatusBadge status={p.status} /></div>
        <div className="sub">{p.clientName} · {locationLabel(p.location)}{p.isDemo && <> · <DemoBadge /></>}</div>
        <div className="pc-meta"><span>{formatMoney(p.plannedBudget, p.currency)}</span><span>Due {formatDate(p.targetCompletionDate)}</span></div>
      </Link>
    </li>
  );
}
