import { useWorkspaceStore } from '../../stores/workspace';
import { ProjectPicker } from './ProjectPicker';
import { IDEWorkspace } from './IDEWorkspace';

export function IDEApp() {
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const showPicker = useWorkspaceStore((s) => s.showPicker);
  const projects = useWorkspaceStore((s) => s.projects);

  const shouldShowPicker = showPicker || !activeProjectId || projects.length === 0;

  return (
    <>
      <IDEWorkspace />
      {shouldShowPicker && <ProjectPicker />}
    </>
  );
}
