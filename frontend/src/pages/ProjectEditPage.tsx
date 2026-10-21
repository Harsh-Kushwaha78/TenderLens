import { useNavigate, useParams } from 'react-router-dom';
import { getProject, updateProject } from '../api/projects';
import { ProjectForm } from '../components/ProjectForm';
import { ErrorState, PageHeader, Skeleton } from '../components/ui';
import { useToast } from '../context/Toast';
import { useAsync, useDocumentTitle } from '../hooks/hooks';
import { fromProject, toUpdatePayload } from '../lib/validation';
import { NotFoundPage } from './ProjectDetailPage';

export function ProjectEditPage() {
  const { id = '' } = useParams();
  useDocumentTitle('Edit project');
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: project, error, loading, reload } = useAsync((s) => getProject(id, s), [id]);

  if (loading && !project) return <><PageHeader title="Edit project" /><Skeleton height={320} /></>;
  if (error && (error as any).isNotFound) return <NotFoundPage what="project" />;
  if (error || !project) return <ErrorState title="Could not load the project" message={error?.message ?? 'Unknown error.'} onRetry={reload} />;

  return (
    <>
      <PageHeader title={`Edit: ${project.name}`} back={{ to: `/projects/${project.id}`, label: 'Back to project' }} />
      <ProjectForm
        key={`${project.id}-${project.updatedAt}`}
        mode="edit"
        initial={fromProject(project)}
        current={project}
        onCancel={() => navigate(`/projects/${project.id}`)}
        onSubmit={async (values) => {
          const patch = toUpdatePayload(project, values);
          if (Object.keys(patch).length === 0) {
            notify('info', 'No changes to save.');
            navigate(`/projects/${project.id}`);
            return;
          }
          const updated = await updateProject(project.id, patch);
          notify('success', `Saved changes to "${updated.name}".`);
          navigate(`/projects/${updated.id}`);
        }}
      />
    </>
  );
}
