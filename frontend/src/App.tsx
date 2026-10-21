import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { Layout } from './components/Layout';
import { BoqEditorPage } from './pages/BoqEditorPage';
import { BoqViewPage } from './pages/BoqViewPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectBoqsPage } from './pages/ProjectBoqsPage';
import { ProjectCreatePage } from './pages/ProjectCreatePage';
import { NotFoundPage, ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectEditPage } from './pages/ProjectEditPage';
import { ProjectsPage } from './pages/ProjectsPage';

/**
 * Route table. A data router (createBrowserRouter / createMemoryRouter) is used so the BOQ editor can
 * block in-app navigation while there are unsaved changes (useBlocker is unavailable with <BrowserRouter>).
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/new', element: <ProjectCreatePage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'projects/:id/edit', element: <ProjectEditPage /> },
      { path: 'projects/:projectId/boqs', element: <ProjectBoqsPage /> },
      { path: 'projects/:projectId/boqs/new', element: <BoqEditorPage /> },
      { path: 'boqs/:id', element: <BoqViewPage /> },
      { path: 'boqs/:id/edit', element: <BoqEditorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
