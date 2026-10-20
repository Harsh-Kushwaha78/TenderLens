import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../App';
import { DemoProvider } from '../context/Demo';
import { ToastProvider } from '../context/Toast';

const P = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const I1 = '33333333-3333-4333-8333-333333333331';
const I2 = '33333333-3333-4333-8333-333333333332';

const project = (o = {}) => ({ id: P, name: 'Riverside Offices', projectType: 'building_renovation', clientName: 'Acme', location: { city: 'Noida', state: 'UP', postalCode: null }, description: null, plannedBudget: '1000000.00', currency: 'INR', contingencyBudget: null, plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-01', status: 'draft', isDemo: false, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', ...o });
const boq = (o = {}) => ({
  id: B, projectId: P, title: 'Ground floor works', description: 'Scope text', currency: 'INR', revision: 3, total: '50301.00', pricedItemCount: 2, unpricedItemCount: 0,
  items: [
    { id: I1, position: 1, description: 'Brickwork', specifications: 'Class A', quantity: '10.000', unit: 'm3', estimatedRate: '5000.00', lineTotal: '50000.00' },
    { id: I2, position: 2, description: 'Plaster', specifications: null, quantity: '2.500', unit: 'm2', estimatedRate: '120.40', lineTotal: '301.00' },
  ],
  project: { id: P, name: 'Riverside Offices', clientName: 'Acme', location: { city: 'Noida', state: 'UP', postalCode: null }, currency: 'INR', isDemo: false },
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z', ...o,
});
const json = (body: unknown, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const err = (status: number, code: string, message: string, details: unknown[] = []) => json({ error: { code, message, details } }, status);

type Handler = (init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
function api(handlers: Record<string, Handler>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url)}`;
    const h = handlers[key];
    if (!h) return err(404, 'NOT_FOUND', `unmocked ${key}`);
    return h(init);
  });
}
const calls = (key: string) => fetchMock.mock.calls.filter((c) => `${c[1]?.method ?? 'GET'} ${c[0]}` === key);
function renderAt(route: string) {
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const utils = render(<DemoProvider><ToastProvider><RouterProvider router={router} /></ToastProvider></DemoProvider>);
  return { router, ...utils };
}

beforeEach(() => { localStorage.clear(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

async function fillRow(user: ReturnType<typeof userEvent.setup>, n: number, v: { d?: string; q?: string; u?: string; r?: string }) {
  if (v.d !== undefined) await user.type(screen.getByLabelText(`Item ${n} description`), v.d);
  if (v.q !== undefined) await user.type(screen.getByLabelText(`Item ${n} quantity`), v.q);
  if (v.u !== undefined) await user.selectOptions(screen.getByLabelText(`Item ${n} unit`), v.u);
  if (v.r !== undefined) await user.type(screen.getByLabelText(`Item ${n} rate per unit`), v.r);
}

describe('BOQ list and project integration', () => {
  it('project detail links to the project BOQs', async () => {
    api({ [`GET /api/projects/${P}`]: () => json({ data: project() }), [`GET /api/projects/${P}/boqs`]: () => json({ data: [{ id: B, projectId: P, title: 'Ground floor works', currency: 'INR', revision: 1, itemCount: 2, unpricedItemCount: 0, total: '50301.00', createdAt: '', updatedAt: '' }] }) });
    renderAt(`/projects/${P}`);
    const link = await screen.findByRole('link', { name: /open boqs \(1\)/i });
    expect(link).toHaveAttribute('href', `/projects/${P}/boqs`);
    expect(screen.getByRole('link', { name: /new boq/i })).toHaveAttribute('href', `/projects/${P}/boqs/new`);
  });
  it('shows an empty state with a create action', async () => {
    api({ [`GET /api/projects/${P}`]: () => json({ data: project() }), [`GET /api/projects/${P}/boqs`]: () => json({ data: [] }) });
    renderAt(`/projects/${P}/boqs`);
    expect(await screen.findByText('No BOQs for this project yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create the first boq/i })).toHaveAttribute('href', `/projects/${P}/boqs/new`);
  });
  it('lists BOQs with totals and unpriced warnings; shows not-found for a missing project; error with retry', async () => {
    api({ [`GET /api/projects/${P}`]: () => json({ data: project() }), [`GET /api/projects/${P}/boqs`]: () => json({ data: [{ id: B, projectId: P, title: 'Ground floor works', currency: 'INR', revision: 2, itemCount: 3, unpricedItemCount: 1, total: '50301.00', createdAt: '', updatedAt: '2026-10-02T10:00:00.000Z' }] }) });
    const { unmount } = renderAt(`/projects/${P}/boqs`);
    expect(await screen.findByRole('link', { name: 'Ground floor works' })).toHaveAttribute('href', `/boqs/${B}`);
    expect(screen.getByText('₹50,301.00')).toBeInTheDocument();
    expect(screen.getByText('1 without rate')).toBeInTheDocument();
    unmount();
    api({ [`GET /api/projects/${P}`]: () => err(404, 'NOT_FOUND', 'Project not found.'), [`GET /api/projects/${P}/boqs`]: () => err(404, 'NOT_FOUND', 'Project not found.') });
    renderAt(`/projects/${P}/boqs`);
    expect(await screen.findByText(/could not find that project/)).toBeInTheDocument();
  });
  it('shows an error state with retry when the API is unreachable', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('x'))).mockImplementationOnce(() => Promise.reject(new TypeError('x')));
    api({});
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('x'))).mockImplementationOnce(() => Promise.reject(new TypeError('x')));
    renderAt(`/projects/${P}/boqs`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the TenderLens server/);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('BOQ editor - create', () => {
  const setup = () => {
    api({
      [`GET /api/projects/${P}`]: () => json({ data: project() }),
      [`POST /api/projects/${P}/boqs`]: () => json({ data: boq() }, 201),
      [`GET /api/boqs/${B}`]: () => json({ data: boq() }),
    });
    return renderAt(`/projects/${P}/boqs/new`);
  };

  it('shows exact live totals as items are added, and flags unpriced items', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText(/BOQ title/);
    await fillRow(user, 1, { d: 'Brickwork', q: '10', u: 'm3', r: '5000' });
    expect(screen.getByTestId('live-total')).toHaveTextContent('₹50,000.00');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await fillRow(user, 2, { d: 'Plaster', q: '2.5', u: 'm2', r: '120.40' });
    expect(screen.getByLabelText('Item 2 amount')).toHaveTextContent('₹301');
    expect(screen.getByTestId('live-total')).toHaveTextContent('₹50,301');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await fillRow(user, 3, { d: 'TBD item', q: '4', u: 'piece' });
    expect(screen.getByTestId('live-total')).toHaveTextContent('₹50,301');
    expect(screen.getByText(/2 priced · 1 without rate/)).toBeInTheDocument();
  });

  it('adds, reorders, and removes items (with confirmation when the row has content)', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText(/BOQ title/);
    await fillRow(user, 1, { d: 'First', q: '1', u: 'm', r: '10' });
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await fillRow(user, 2, { d: 'Second', q: '2', u: 'm', r: '20' });
    await user.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    expect(screen.getByLabelText('Item 1 description')).toHaveValue('Second');
    expect(screen.getByLabelText('Item 2 description')).toHaveValue('First');
    expect(screen.getByRole('button', { name: 'Move item 1 up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete item 1' }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('Second');
    await user.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Item 1 description')).toHaveValue('Second');
    await user.click(screen.getByRole('button', { name: 'Delete item 1' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove item' }));
    expect(screen.queryByLabelText('Item 2 description')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Item 1 description')).toHaveValue('First');
    expect(screen.getByTestId('live-total')).toHaveTextContent('₹10');
    await user.click(screen.getByRole('button', { name: 'Delete item 1' })); // still has content -> confirm again
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('removes an empty row immediately without a confirmation', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText(/BOQ title/);
    await user.click(screen.getByRole('button', { name: 'Delete item 1' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/No items yet/)).toBeInTheDocument();
  });

  it('blocks saving with field-level messages and sends no request', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText(/BOQ title/);
    await fillRow(user, 1, { d: 'Brickwork', q: '-5', r: '12.345' });
    await user.click(screen.getByRole('button', { name: /create boq/i }));
    expect(await screen.findByText('BOQ title is required.')).toBeInTheDocument();
    expect(screen.getByText('Cannot be negative.')).toBeInTheDocument();
    expect(screen.getByText('Select a unit.')).toBeInTheDocument();
    expect(screen.getByText(/up to 2 decimals/)).toBeInTheDocument();
    expect(calls(`POST /api/projects/${P}/boqs`)).toHaveLength(0);
    expect(screen.getByLabelText('Item 1 quantity')).toHaveAttribute('aria-invalid', 'true');
  });

  it('saves a clean payload (no totals/positions), prevents double submit, then opens the saved BOQ', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(await screen.findByLabelText(/BOQ title/), 'Ground floor works');
    await fillRow(user, 1, { d: 'Brickwork', q: '10', u: 'm3', r: '5000' });
    const save = screen.getByRole('button', { name: /create boq/i });
    fireEvent.click(save); fireEvent.click(save);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ground floor works' })).toBeInTheDocument();
    const posts = calls(`POST /api/projects/${P}/boqs`);
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]![1].body)).toEqual({ title: 'Ground floor works', description: null, items: [{ id: null, description: 'Brickwork', specifications: null, quantity: '10', unit: 'm3', estimatedRate: '5000' }] });
    expect(await screen.findByText(/Created BOQ/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /preview/i })).toBeInTheDocument();
  });

  it('shows server validation next to the item, keeps input, and shows NO success toast on failure', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/projects/${P}`]: () => json({ data: project() }), [`POST /api/projects/${P}/boqs`]: () => err(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ field: 'items.0.quantity', message: 'Server says: bad quantity' }]) });
    renderAt(`/projects/${P}/boqs/new`);
    await user.type(await screen.findByLabelText(/BOQ title/), 'Ground floor works');
    await fillRow(user, 1, { d: 'Brickwork', q: '10', u: 'm3', r: '5000' });
    await user.click(screen.getByRole('button', { name: /create boq/i }));
    expect(await screen.findByText('Server says: bad quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Item 1 quantity')).toHaveValue('10');
    expect(screen.queryByText(/Created BOQ/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create boq/i })).toBeEnabled(); // can retry
  });

  it('shows a clear message when the server is offline and keeps the form', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/projects/${P}`]: () => json({ data: project() }), [`POST /api/projects/${P}/boqs`]: () => Promise.reject(new TypeError('Failed to fetch')) });
    renderAt(`/projects/${P}/boqs/new`);
    await user.type(await screen.findByLabelText(/BOQ title/), 'Ground floor works');
    await fillRow(user, 1, { d: 'Brickwork', q: '10', u: 'm3' });
    await user.click(screen.getByRole('button', { name: /create boq/i }));
    expect(await screen.findByText(/Cannot reach the TenderLens server/)).toBeInTheDocument();
    expect(screen.queryByText(/Created BOQ/)).not.toBeInTheDocument();
  });

  it('guards unsaved changes: Cancel asks first; in-app navigation is blocked until confirmed', async () => {
    const user = userEvent.setup();
    const { router } = setup();
    await user.type(await screen.findByLabelText(/BOQ title/), 'Draft title');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    let dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('Discard unsaved changes?');
    await user.click(within(dlg).getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe(`/projects/${P}/boqs/new`);
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('Leave without saving?');
    await user.click(within(dlg).getByRole('button', { name: 'Stay on this page' }));
    expect(router.state.location.pathname).toBe(`/projects/${P}/boqs/new`);
    expect(screen.getByLabelText(/BOQ title/)).toHaveValue('Draft title');
  });

  it('does not block navigation when nothing changed', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/projects/${P}`]: () => json({ data: project() }), [`GET /api/projects/${P}/boqs`]: () => json({ data: [] }) });
    const { router } = renderAt(`/projects/${P}/boqs/new`);
    await screen.findByLabelText(/BOQ title/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${P}/boqs`));
  });
});

describe('BOQ editor - edit existing', () => {
  it('prepopulates, saves with revision and stable item ids, and only reports success when saved', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq() }), [`PUT /api/boqs/${B}`]: () => json({ data: boq({ revision: 4 }) }) });
    renderAt(`/boqs/${B}/edit`);
    expect(await screen.findByLabelText(/BOQ title/)).toHaveValue('Ground floor works');
    expect(screen.getByLabelText('Item 1 quantity')).toHaveValue('10');
    expect(screen.getByLabelText('Item 2 rate per unit')).toHaveValue('120.40');
    await user.clear(screen.getByLabelText('Item 1 quantity')); await user.type(screen.getByLabelText('Item 1 quantity'), '12');
    expect(screen.getByTestId('live-total')).toHaveTextContent('₹60,301');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByRole('article', { name: /preview/i });
    const put = calls(`PUT /api/boqs/${B}`)[0]!;
    expect(JSON.parse(put[1].body)).toEqual({
      title: 'Ground floor works', description: 'Scope text', revision: 3,
      items: [
        { id: I1, description: 'Brickwork', specifications: 'Class A', quantity: '12', unit: 'm3', estimatedRate: '5000.00' },
        { id: I2, description: 'Plaster', specifications: null, quantity: '2.5', unit: 'm2', estimatedRate: '120.40' },
      ],
    });
    expect(await screen.findByText(/Saved "Ground floor works" \(revision 4\)/)).toBeInTheDocument();
  });

  it('handles a concurrent edit: shows the conflict, keeps the form, and can reload the latest', async () => {
    const user = userEvent.setup();
    let version = 3;
    api({
      [`GET /api/boqs/${B}`]: () => json({ data: version === 3 ? boq() : boq({ revision: 4, title: 'Changed elsewhere' }) }),
      [`PUT /api/boqs/${B}`]: () => { version = 4; return err(409, 'CONFLICT', 'This BOQ was changed by someone else since you opened it. Reload to see the latest version.'); },
    });
    renderAt(`/boqs/${B}/edit`);
    const title = await screen.findByLabelText(/BOQ title/);
    await user.type(title, ' (mine)');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument();
    expect(screen.getByLabelText(/BOQ title/)).toHaveValue('Ground floor works (mine)');
    expect(screen.queryByText(/Saved "/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /discard my changes and reload/i }));
    await waitFor(() => expect(screen.getByLabelText(/BOQ title/)).toHaveValue('Changed elsewhere'));
  });

  it('shows not-found for an unknown BOQ', async () => {
    api({ [`GET /api/boqs/${B}`]: () => err(404, 'NOT_FOUND', 'BOQ not found.') });
    renderAt(`/boqs/${B}/edit`);
    expect(await screen.findByText(/could not find that BOQ/)).toBeInTheDocument();
  });
});

describe('BOQ preview, PDF download and delete', () => {
  const pdfResponse = () => Promise.resolve(new Response(new TextEncoder().encode('%PDF-1.4 fake'), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="TenderLens-BOQ-22222222-r3.pdf"' } }));
  let createUrl: ReturnType<typeof vi.fn>, revokeUrl: ReturnType<typeof vi.fn>, clicked: HTMLAnchorElement[];
  beforeEach(() => {
    createUrl = vi.fn(() => 'blob:fake'); revokeUrl = vi.fn(); clicked = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the document preview with all columns, exact amounts, draft marking and unpriced note', async () => {
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq({ unpricedItemCount: 1, items: [...boq().items, { id: 'x', position: 3, description: 'Pending <b>item</b> & more', specifications: null, quantity: '1.000', unit: 'lump_sum', estimatedRate: null, lineTotal: null }] }) }) });
    renderAt(`/boqs/${B}`);
    const paper = await screen.findByRole('article', { name: /preview/i });
    for (const t of ['DRAFT - not an approved or issued tender document', 'Riverside Offices', 'Acme', 'Noida, UP', 'Scope text', 'Brickwork', 'Class A', 'Plaster', 'Rate (INR)', 'Amount (INR)', '₹5,000.00', '₹50,000.00', '₹301.00', '₹120.40', 'lump sum', 'Pending <b>item</b> & more', 'Estimated total (base)', '₹50,301']) {
      expect(paper).toHaveTextContent(t);
    }
    expect(paper.querySelector('b')).toBeNull(); // description text is escaped, not interpreted as HTML
    expect(paper).toHaveTextContent('1 item(s) shown with');
    expect(within(paper).getByText('10')).toBeInTheDocument();
  });

  it('downloads the PDF for the previewed revision', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq() }), [`GET /api/boqs/${B}/pdf?revision=3`]: pdfResponse });
    renderAt(`/boqs/${B}`);
    await user.click(await screen.findByRole('button', { name: /download pdf/i }));
    expect(await screen.findByText('PDF downloaded.')).toBeInTheDocument();
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect((createUrl.mock.calls[0]![0] as Blob).type).toBe('application/pdf');
    expect(await (createUrl.mock.calls[0]![0] as Blob).text()).toBe('%PDF-1.4 fake'); // the real response body is what gets saved
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe('TenderLens-BOQ-22222222-r3.pdf');
    expect(calls(`GET /api/boqs/${B}/pdf?revision=3`)).toHaveLength(1);
  });

  it('shows the server reason when generation fails (e.g. unsupported characters) and never claims success', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq() }), [`GET /api/boqs/${B}/pdf?revision=3`]: () => err(422, 'UNSUPPORTED_CHARACTERS', 'The PDF cannot be generated because some text uses characters the document font does not support.', [{ field: 'item 1 description', message: 'Contains characters the PDF font cannot render: स' }]) });
    renderAt(`/boqs/${B}`);
    await user.click(await screen.findByRole('button', { name: /download pdf/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('PDF not generated');
    expect(alert).toHaveTextContent('item 1 description');
    expect(createUrl).not.toHaveBeenCalled();
    expect(screen.queryByText('PDF downloaded.')).not.toBeInTheDocument();
  });

  it('tells the user when the preview is stale (409) and offers to reload', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq() }), [`GET /api/boqs/${B}/pdf?revision=3`]: () => err(409, 'CONFLICT', 'This BOQ changed after you opened the preview.') });
    renderAt(`/boqs/${B}`);
    await user.click(await screen.findByRole('button', { name: /download pdf/i }));
    expect(await screen.findByText('This preview is out of date')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reload preview/i }));
    await waitFor(() => expect(calls(`GET /api/boqs/${B}`).length).toBeGreaterThan(1));
  });

  it('shows an offline error for the download and does not double-trigger while generating', async () => {
    const user = userEvent.setup();
    let release: (r: Response) => void = () => undefined;
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq() }), [`GET /api/boqs/${B}/pdf?revision=3`]: () => new Promise<Response>((res) => { release = res; }) });
    renderAt(`/boqs/${B}`);
    const btn = await screen.findByRole('button', { name: /download pdf/i });
    fireEvent.click(btn); fireEvent.click(btn);
    expect(await screen.findByRole('button', { name: /generating/i })).toBeDisabled();
    expect(calls(`GET /api/boqs/${B}/pdf?revision=3`)).toHaveLength(1);
    release(new Response(JSON.stringify({ error: { code: 'DOCUMENT_GENERATION_FAILED', message: 'The PDF could not be generated. Please try again.', details: [] } }), { status: 500 }));
    expect(await screen.findByText(/could not be generated/)).toBeInTheDocument();
    void user;
  });

  it('deletes a BOQ only after confirmation, then returns to the project BOQ list', async () => {
    const user = userEvent.setup();
    api({ [`GET /api/boqs/${B}`]: () => json({ data: boq() }), [`DELETE /api/boqs/${B}`]: () => json(null, 204), [`GET /api/projects/${P}`]: () => json({ data: project() }), [`GET /api/projects/${P}/boqs`]: () => json({ data: [] }) });
    const { router } = renderAt(`/boqs/${B}`);
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('permanently deleted');
    await user.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(calls(`DELETE /api/boqs/${B}`)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete BOQ' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${P}/boqs`));
    expect(calls(`DELETE /api/boqs/${B}`)).toHaveLength(1);
  });
});
