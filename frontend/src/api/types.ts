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
