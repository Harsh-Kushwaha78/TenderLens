// API contract types. Keep in sync with docs/openapi.yaml and INTEGRATION_CONTRACTS.md.
export type ProjectStatus = 'draft' | 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectType =
  | 'building_renovation' | 'interior_fitout' | 'civil_works' | 'electrical_works' | 'plumbing_works' | 'other';
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
export type SortField = 'name' | 'createdAt' | 'plannedBudget' | 'targetCompletionDate';

/** Money is always a decimal string (e.g. "1000000.00"), never a JS number. */
export type DecimalString = string;

export interface Project {
  id: string;
  name: string;
  projectType: ProjectType;
  clientName: string;
  location: { city: string; state: string; postalCode: string | null };
  description: string | null;
  plannedBudget: DecimalString;
  currency: Currency;
  contingencyBudget: DecimalString | null;
  plannedStartDate: string; // YYYY-MM-DD
  targetCompletionDate: string; // YYYY-MM-DD
  status: ProjectStatus;
  isDemo: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateProjectRequest {
  name: string;
  projectType: ProjectType;
  clientName: string;
  location: { city: string; state: string; postalCode?: string | null };
  description?: string | null;
  plannedBudget: DecimalString;
  currency: Currency;
  contingencyBudget?: DecimalString | null;
  plannedStartDate: string;
  targetCompletionDate: string;
  status?: 'draft' | 'planning';
}
export type UpdateProjectRequest = Partial<Omit<CreateProjectRequest, 'status'>> & { status?: ProjectStatus };

export interface Pagination { page: number; pageSize: number; totalItems: number; totalPages: number }
export interface ProjectListResponse { data: Project[]; pagination: Pagination }

export interface ListParams {
  q?: string;
  status?: ProjectStatus[];
  projectType?: ProjectType[];
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeDemo?: boolean;
}

export interface DashboardSummary {
  asOfDate: string;
  timezone: string;
  includesDemoData: boolean;
  demoProjectCount: number;
  totals: {
    totalProjects: number;
    activeProjects: number;
    approachingCompletion: number;
    overdue: number;
    approachingWindowDays: number;
  };
  plannedBudgetByCurrency: { currency: Currency; total: DecimalString; projectCount: number }[];
  statusDistribution: { status: ProjectStatus; count: number }[];
  budgetByProject: { currency: Currency | null; items: { id: string; name: string; plannedBudget: DecimalString }[] };
  creationTrend: { sufficient: boolean; months: { month: string; count: number }[] };
  recentProjects: Project[];
}

export interface ApiErrorDetail { field?: string; message: string }

/* ---------------- Feature 2: BOQ ---------------- */
export type BoqUnit = 'm' | 'm2' | 'm3' | 'sqft' | 'kg' | 'tonne' | 'litre' | 'piece' | 'set' | 'bag' | 'day' | 'lump_sum';

export interface BoqItem {
  id: string;
  position: number;
  description: string;
  specifications: string | null;
  quantity: DecimalString; // 3 decimals
  unit: BoqUnit;
  estimatedRate: DecimalString | null; // 2 decimals; null = not yet estimated (NOT zero)
  lineTotal: DecimalString | null; // server-derived; null when no rate
}
export interface Boq {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  currency: Currency; // snapshot of the project's currency at creation
  revision: number; // optimistic-concurrency token
  total: DecimalString; // server-derived sum of line totals
  pricedItemCount: number;
  unpricedItemCount: number;
  items: BoqItem[];
  project: { id: string; name: string; clientName: string; location: { city: string; state: string; postalCode: string | null }; currency: Currency; isDemo: boolean };
  createdAt: string;
  updatedAt: string;
}
export interface BoqSummary {
  id: string; projectId: string; title: string; currency: Currency; revision: number;
  itemCount: number; unpricedItemCount: number; total: DecimalString; createdAt: string; updatedAt: string;
}
/** Items never carry position/lineTotal/total: the server derives them. `id: null` = new item. */
export interface BoqItemInput {
  id: string | null; description: string; specifications: string | null; quantity: DecimalString; unit: BoqUnit; estimatedRate: DecimalString | null;
}
export interface CreateBoqRequest { title: string; description: string | null; items: BoqItemInput[] }
export interface UpdateBoqRequest extends CreateBoqRequest { revision: number }
