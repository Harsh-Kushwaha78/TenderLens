import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject } from '../api/projects';
import { ProjectForm } from '../components/ProjectForm';
import { PageHeader } from '../components/ui';
import { useToast } from '../context/Toast';
import { useDocumentTitle } from '../hooks/hooks';
import { newIdempotencyKey } from '../lib/idempotency';
import { emptyValues, toCreatePayload } from '../lib/validation';

export function ProjectCreatePage() {
  useDocumentTitle('Create project');
  const navigate = useNavigate();
  const { notify } = useToast();
  // One key per form session: retries after a failure reuse it, so the server returns the same project.
  const key = useRef(newIdempotencyKey());

  return (
    <>
      <PageHeader title="Create project" subtitle="Set up the project record. BOQs, documents and pricing come in later modules." back={{ to: '/projects', label: 'Projects' }} />
      <ProjectForm
        mode="create"
        initial={emptyValues()}
        onCancel={() => navigate('/projects')}
        onSubmit={async (values) => {
          const project = await createProject(toCreatePayload(values), key.current);
          notify('success', `Project "${project.name}" was created.`);
          navigate(`/projects/${project.id}`);
        }}
      />
    </>
  );
}
