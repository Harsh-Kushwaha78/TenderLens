import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage, ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectEditPage } from './pages/ProjectEditPage';
import { ProjectCreatePage } from './pages/ProjectCreatePage';
import { ProjectsPage } from './pages/ProjectsPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<ProjectCreatePage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="projects/:id/edit" element={<ProjectEditPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
