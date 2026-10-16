import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { DemoProvider } from '../context/Demo';
import { ToastProvider } from '../context/Toast';

vi.mock('recharts', async () => {
  const React = await import('react');
  const Stub = ({ children }: any) => React.createElement('div', { 'data-testid': 'chart' }, children);
  const Null = () => null;
  return { ResponsiveContainer: Stub, PieChart: Stub, BarChart: Stub, AreaChart: Stub, Pie: Stub, Bar: Null, Area: Null, Cell: Null, Tooltip: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null };
});

const project = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111', name: 'Tower Fitout', projectType: 'interior_fitout', clientName: 'Acme',
  location: { city: 'Noida', state: 'Uttar Pradesh', postalCode: null }, description: null, plannedBudget: '2500000.00', currency: 'INR',
  contingencyBudget: null, plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-15', status: 'draft', isDemo: false,
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', ...over,
});
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const emptySummary = { asOfDate: '2026-10-17', timezone: 'UTC', includesDemoData: false, demoProjectCount: 0, totals: { totalProjects: 0, activeProjects: 0, approachingCompletion: 0, overdue: 0, approachingWindowDays: 30 }, plannedBudgetByCurrency: [], statusDistribution: [], budgetByProject: { currency: null, items: [] }, creationTrend: { sufficient: false, months: [] }, recentProjects: [] };

function renderApp(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><DemoProvider><ToastProvider><App /></ToastProvider></DemoProvider></MemoryRouter>);
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { localStorage.clear(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('Dashboard', () => {
  it('shows an honest first-time empty state', async () => {
    fetchMock.mockImplementation(() => json({ data: emptySummary }));
    renderApp('/');
    expect(await screen.findByText('Welcome to TenderLens')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });
  it('shows an error with retry when the API is down, then recovers', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
    fetchMock.mockImplementation(() => json({ data: emptySummary }));
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the TenderLens server/);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Welcome to TenderLens')).toBeInTheDocument();
  });
  it('renders KPIs, charts and the demo banner from API data', async () => {
    const s = { ...emptySummary, includesDemoData: true, demoProjectCount: 1, totals: { totalProjects: 2, activeProjects: 1, approachingCompletion: 1, overdue: 0, approachingWindowDays: 30 },
      plannedBudgetByCurrency: [{ currency: 'INR', total: '3000000.00', projectCount: 2 }], statusDistribution: [{ status: 'active', count: 1 }, { status: 'draft', count: 1 }],
      budgetByProject: { currency: 'INR', items: [{ id: 'a', name: 'Tower Fitout', plannedBudget: '2500000.00' }] }, recentProjects: [project(), project({ id: '2', name: '[DEMO] Thing', isDemo: true })] };
    fetchMock.mockImplementation(() => json({ data: s }));
    renderApp('/');
    expect(await screen.findByText('Demo data is included.')).toBeInTheDocument();
    expect(screen.getByText('Total planned budget')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0);
    expect(screen.getByText('Not enough history for a trend yet')).toBeInTheDocument();
  });
});

describe('Projects list', () => {
  const list = (data: unknown[], total = data.length) => ({ data, pagination: { page: 1, pageSize: 10, totalItems: total, totalPages: 1 } });
  it('renders rows, and requests search/filter/sort params from the API', async () => {
    fetchMock.mockImplementation(() => json(list([project()])));
    renderApp('/projects');
    expect(await screen.findByRole('link', { name: 'Tower Fitout' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'planning');
    await userEvent.type(screen.getByLabelText(/Search projects/), 'noida');
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('status=planning') && u.includes('q=noida'))).toBe(true);
    }, { timeout: 2000 });
  });
  it('shows an empty state with a create action when there are no projects', async () => {
    fetchMock.mockImplementation(() => json(list([])));
    renderApp('/projects');
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create your first project/i })).toHaveAttribute('href', '/projects/new');
  });
  it('shows a no-match state with reset when filters return nothing', async () => {
    fetchMock.mockImplementation(() => json(list([])));
    renderApp('/projects?q=zzz');
    expect(await screen.findByText('No projects match your filters')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /reset/i }).length).toBeGreaterThan(0);
  });
  it('shows an error state with retry', async () => {
    fetchMock.mockImplementation(() => json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The database is currently unavailable.', details: [] } }, 503));
    renderApp('/projects');
    expect(await screen.findByRole('alert')).toHaveTextContent(/database is currently unavailable/);
  });
});

describe('Create project flow', () => {
  it('validates each step, preserves input, reviews, and submits once with an idempotency key', async () => {
    const created = project({ id: '22222222-2222-4222-8222-222222222222', name: 'My New Project' });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return json({ data: created }, 201);
      return json({ data: created });
    });
    const user = userEvent.setup();
    renderApp('/projects/new');

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Project name is required.')).toBeInTheDocument();
    expect(screen.getByText('Select a project type.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Project name/), 'My New Project');
    await user.selectOptions(screen.getByLabelText(/Project type/), 'civil_works');
    await user.type(screen.getByLabelText(/Client or organization/), 'Acme');
    await user.type(screen.getByLabelText(/^City/), 'Noida');
    await user.type(screen.getByLabelText(/^State/), 'Uttar Pradesh');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await user.type(await screen.findByLabelText(/Planned budget/), '-5');
    await user.type(screen.getByLabelText(/Planned start date/), '2026-12-10');
    await user.type(screen.getByLabelText(/Target completion date/), '2026-12-01');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Budget cannot be negative.')).toBeInTheDocument();
    expect(screen.getByText(/on or after the start date/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Planned budget/));
    await user.type(screen.getByLabelText(/Planned budget/), '1500000.50');
    await user.clear(screen.getByLabelText(/Target completion date/));
    await user.type(screen.getByLabelText(/Target completion date/), '2027-01-20');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const review = await screen.findByRole('heading', { name: 'Review & create' });
    expect(review).toBeInTheDocument();
    expect(screen.getByText('My New Project')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!;
    expect(post[1].headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(JSON.parse(post[1].body)).toMatchObject({ name: 'My New Project', plannedBudget: '1500000.50', currency: 'INR', location: { city: 'Noida', state: 'Uttar Pradesh', postalCode: null } });
    expect(await screen.findByText(/was created/)).toBeInTheDocument();
  });

  it('keeps input and offers retry after a server failure; shows server field errors', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'POST'
      ? json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: [{ field: 'name', message: 'Project name already looks invalid.' }] } }, 400)
      : json({ data: project() }));
    const user = userEvent.setup();
    renderApp('/projects/new');
    await user.type(screen.getByLabelText(/Project name/), 'Valid Name');
    await user.selectOptions(screen.getByLabelText(/Project type/), 'other');
    await user.type(screen.getByLabelText(/Client or organization/), 'Acme');
    await user.type(screen.getByLabelText(/^City/), 'Noida');
    await user.type(screen.getByLabelText(/^State/), 'UP');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(await screen.findByLabelText(/Planned budget/), '100');
    await user.type(screen.getByLabelText(/Planned start date/), '2026-12-01');
    await user.type(screen.getByLabelText(/Target completion date/), '2026-12-02');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(await screen.findByRole('button', { name: 'Create project' }));
    // server error for "name" sends the user back to step 1 with the message next to the field and values preserved
    const err = await screen.findByText('Project name already looks invalid.');
    expect(err).toBeInTheDocument();
    expect(screen.getByLabelText(/Project name/)).toHaveValue('Valid Name');
  });
});

describe('Project detail', () => {
  it('shows project data and clearly disabled roadmap placeholders', async () => {
    fetchMock.mockImplementation(() => json({ data: project({ description: 'Scope text' }) }));
    renderApp('/projects/11111111-1111-4111-8111-111111111111');
    expect(await screen.findByRole('heading', { name: 'Tower Fitout' })).toBeInTheDocument();
    expect(screen.getByText('Scope text')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit project/i })).toBeInTheDocument();
    const ws = screen.getByText(/Project workspace - coming next/).closest('section')!;
    expect(within(ws).getAllByText('Not available')).toHaveLength(4);
  });
  it('shows a friendly not-found state for missing/invalid ids', async () => {
    fetchMock.mockImplementation(() => json({ error: { code: 'NOT_FOUND', message: 'Project not found.', details: [] } }, 404));
    renderApp('/projects/00000000-0000-4000-8000-000000000000');
    expect(await screen.findByText(/could not find that project/)).toBeInTheDocument();
  });
});

describe('Edit project', () => {
  it('only offers valid status transitions and PATCHes only changed fields', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'PATCH' ? json({ data: project({ name: 'Renamed Tower' }) }) : json({ data: project() }));
    const user = userEvent.setup();
    renderApp('/projects/11111111-1111-4111-8111-111111111111/edit');
    const status = await screen.findByLabelText(/Project status/);
    expect(within(status).getAllByRole('option').map((o) => o.textContent)).toEqual(['Draft (current)', 'Planning', 'Cancelled']);
    const name = screen.getByLabelText(/Project name/);
    await user.clear(name); await user.type(name, 'Renamed Tower');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(true));
    expect(JSON.parse(fetchMock.mock.calls.find((c) => c[1]?.method === 'PATCH')![1].body)).toEqual({ name: 'Renamed Tower' });
  });
});
