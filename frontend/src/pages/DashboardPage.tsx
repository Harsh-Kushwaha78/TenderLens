import { AlertCircle, ArrowRight, BarChart3, CalendarClock, FolderKanban, FolderPlus, Plus, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getDashboardSummary } from '../api/projects';
import type { Currency, DashboardSummary } from '../api/types';
import { Card, DemoBadge, EmptyState, ErrorState, LinkButton, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { useDemo } from '../context/Demo';
import { useAsync, useDocumentTitle } from '../hooks/hooks';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/constants';
import { formatCompact, formatDate, formatMonth, formatMoney, locationLabel } from '../lib/format';

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { showDemo } = useDemo();
  const [currency, setCurrency] = useState<Currency | undefined>(undefined);
  const { data, error, loading, reload } = useAsync((s) => getDashboardSummary({ includeDemo: showDemo, currency }, s), [showDemo, currency]);

  const header = (
    <PageHeader title="Dashboard" subtitle="Live overview of your projects."
      actions={<LinkButton to="/projects/new" variant="primary"><Plus size={16} aria-hidden="true" />Create project</LinkButton>} />
  );

  if (error && !data) return <>{header}<ErrorState title="Could not load the dashboard" message={error.message} onRetry={reload} /></>;
  if (!data) return <>{header}<DashboardSkeleton /></>;

  if (data.totals.totalProjects === 0) {
    return (
      <>
        {header}
        {data.includesDemoData && <DemoBanner s={data} />}
        <Card>
          <EmptyState icon={<FolderPlus size={26} />} title="Welcome to TenderLens"
            action={<LinkButton to="/projects/new" variant="primary"><Plus size={16} aria-hidden="true" />Create your first project</LinkButton>}>
            Your dashboard fills in from real project data as soon as you create a project. Nothing here is estimated or pre-filled.
            Developers can load clearly labelled demo rows with <code>npm run seed:demo</code> and the “Show demo data” switch.
          </EmptyState>
        </Card>
      </>
    );
  }

  const { totals } = data;
  const [primary, ...otherCurrencies] = data.plannedBudgetByCurrency;
  return (
    <div className={loading ? 'is-loading' : undefined}>
      {header}
      {data.includesDemoData && <DemoBanner s={data} />}
      {error && <ErrorState title="Refresh failed" message={error.message} onRetry={reload} />}

      <div className="kpi-grid">
        <Kpi icon={<FolderKanban size={20} />} tone="indigo" label="Total projects" value={String(totals.totalProjects)} note="All statuses" />
        <Kpi icon={<Zap size={20} />} tone="teal" label="Active projects" value={String(totals.activeProjects)} note={`${data.statusDistribution.find((s) => s.status === 'planning')?.count ?? 0} in planning`} />
        <Kpi icon={<Wallet size={20} />} tone="blue" label="Total planned budget" value={primary ? formatMoney(primary.total, primary.currency) : '-'}
          note={otherCurrencies.length ? otherCurrencies.map((c) => formatMoney(c.total, c.currency)).join(' · ') + ' (separate currencies)' : 'Excludes cancelled projects'} />
        <Kpi icon={<CalendarClock size={20} />} tone="amber" label={`Due within ${totals.approachingWindowDays} days`} value={String(totals.approachingCompletion)}
          note={totals.overdue > 0 ? `${totals.overdue} past target date` : 'Open projects only'} warn={totals.overdue > 0} />
      </div>

      <div className="chart-grid">
        <Card title="Projects by status" subtitle="Count of projects in each status">
          <StatusChart s={data} />
        </Card>
        <Card title="Planned budget by project" subtitle={data.budgetByProject.currency ? `Top projects in ${data.budgetByProject.currency}` : undefined}
          actions={data.plannedBudgetByCurrency.length > 1 ? (
            <select aria-label="Chart currency" className="mini-select" value={data.budgetByProject.currency ?? ''} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {data.plannedBudgetByCurrency.map((c) => <option key={c.currency} value={c.currency}>{c.currency}</option>)}
            </select>) : undefined}>
          <BudgetChart s={data} />
        </Card>
      </div>

      <Card title="Projects created per month" subtitle="Last 6 months" className="mt">
        <TrendChart s={data} />
      </Card>

      <Card title="Recent projects" className="mt" actions={<Link to="/projects" className="link-arrow">View all<ArrowRight size={14} aria-hidden="true" /></Link>}>
        <div className="table-wrap">
          <table className="table compact">
            <thead><tr><th scope="col">Project</th><th scope="col">Status</th><th scope="col" className="num">Planned budget</th><th scope="col">Target completion</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{data.recentProjects.map((p) => (
              <tr key={p.id}>
                <td><Link className="row-link" to={`/projects/${p.id}`}>{p.name}</Link>{p.isDemo && <> <DemoBadge /></>}<div className="sub">{locationLabel(p.location)}</div></td>
                <td><StatusBadge status={p.status} /></td>
                <td className="num">{formatMoney(p.plannedBudget, p.currency)}</td>
                <td>{formatDate(p.targetCompletionDate)}</td>
                <td className="num"><Link className="btn btn-ghost" to={`/projects/${p.id}`} aria-label={`Open ${p.name}`}>Open<ArrowRight size={14} aria-hidden="true" /></Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DemoBanner({ s }: { s: DashboardSummary }) {
  return (
    <div className="demo-banner" role="note">
      <AlertCircle size={18} aria-hidden="true" />
      <span><strong>Demo data is included.</strong> {s.demoProjectCount} of the {s.totals.totalProjects} projects counted are synthetic demo rows. Turn off “Show demo data” to see only real records.</span>
    </div>
  );
}

function Kpi({ icon, label, value, note, tone, warn }: { icon: ReactNode; label: string; value: string; note: string; tone: 'indigo' | 'teal' | 'blue' | 'amber'; warn?: boolean }) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpi-top"><p className="kpi-label">{label}</p><div className="kpi-icon" aria-hidden="true">{icon}</div></div>
      <p className="kpi-value">{value}</p>
      <p className={`kpi-note ${warn ? 'text-warn' : ''}`}>{note}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="kpi-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={96} />)}</div>
      <div className="chart-grid mt"><Skeleton height={320} /><Skeleton height={320} /></div>
      <Skeleton height={220} className="mt" />
    </div>
  );
}

const ChartFrame = ({ label, children, table }: { label: string; children: ReactNode; table: ReactNode }) => (
  <figure className="chart" aria-label={label}>
    <div className="chart-canvas" role="img" aria-label={label}>{children}</div>
    <div className="sr-only">{table}</div>
  </figure>
);

function StatusChart({ s }: { s: DashboardSummary }) {
  const rows = s.statusDistribution.map((d) => ({ ...d, label: STATUS_LABELS[d.status] }));
  const nonZero = rows.filter((r) => r.count > 0);
  return (
    <ChartFrame label={`Projects by status: ${nonZero.map((r) => `${r.label} ${r.count}`).join(', ')}`}
      table={<table><caption>Projects by status</caption><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{rows.map((r) => <tr key={r.status}><td>{r.label}</td><td>{r.count}</td></tr>)}</tbody></table>}>
      <div className="donut-wrap">
        <div className="donut">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={nonZero} dataKey="count" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={nonZero.length > 1 ? 2 : 0} stroke="none">
                {nonZero.map((r) => <Cell key={r.status} fill={STATUS_COLORS[r.status]} />)}
              </Pie>
              <Tooltip content={<SimpleTooltip render={(p: any) => `${p.label}: ${p.count} project${p.count === 1 ? '' : 's'}`} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center" aria-hidden="true"><strong>{s.totals.totalProjects}</strong><span>projects</span></div>
        </div>
        <ul className="legend">{rows.map((r) => (
          <li key={r.status} className={r.count === 0 ? 'zero' : ''}><span className="swatch" style={{ background: STATUS_COLORS[r.status] }} aria-hidden="true" />{r.label}<strong>{r.count}</strong></li>
        ))}</ul>
      </div>
    </ChartFrame>
  );
}

function BudgetChart({ s }: { s: DashboardSummary }) {
  const { currency, items } = s.budgetByProject;
  if (!currency || items.length === 0) return <EmptyState icon={<BarChart3 size={24} />} title="No budget data yet">Budgets appear once projects with a planned budget exist.</EmptyState>;
  const rows = items.map((i) => ({ id: i.id, name: i.name, short: i.name.length > 30 ? `${i.name.slice(0, 29)}…` : i.name, value: Number(i.plannedBudget), exact: i.plannedBudget }));
  return (
    <ChartFrame label={`Planned budget by project in ${currency}`}
      table={<table><caption>Planned budget by project ({currency})</caption><thead><tr><th>Project</th><th>Planned budget</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{formatMoney(r.exact, currency)}</td></tr>)}</tbody></table>}>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 38 + 40)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e5e9f2" />
          <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fill: '#5b6578', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="short" width={200} tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(99,102,241,.08)' }} content={<SimpleTooltip render={(p: any) => `${p.name}: ${formatMoney(p.exact, currency)}`} />} />
          <Bar dataKey="value" fill="#4f46e5" radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function TrendChart({ s }: { s: DashboardSummary }) {
  const { sufficient, months } = s.creationTrend;
  if (!sufficient) {
    return <EmptyState icon={<TrendingUp size={24} />} title="Not enough history for a trend yet">A trend appears once at least 5 projects have been created across 2 or more months. No trend is estimated or filled in.</EmptyState>;
  }
  const rows = months.map((m) => ({ ...m, label: formatMonth(m.month) }));
  return (
    <ChartFrame label="Projects created per month, last 6 months"
      table={<table><caption>Projects created per month</caption><thead><tr><th>Month</th><th>Projects</th></tr></thead><tbody>{rows.map((r) => <tr key={r.month}><td>{r.label}</td><td>{r.count}</td></tr>)}</tbody></table>}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={rows} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e5e9f2" />
          <XAxis dataKey="label" tick={{ fill: '#5b6578', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#5b6578', fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<SimpleTooltip render={(p: any) => `${p.label}: ${p.count} project${p.count === 1 ? '' : 's'} created`} />} />
          <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2.5} fill="url(#trendFill)" dot={{ r: 3, fill: '#0f766e' }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function SimpleTooltip({ active, payload, render }: { active?: boolean; payload?: any[]; render: (p: any) => string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tip">{render(payload[0].payload)}</div>;
}
