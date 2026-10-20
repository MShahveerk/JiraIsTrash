import type { Project, Route, Sprint } from '../types';
import { formatRange } from '../lib';
import { ChevronRightIcon, PlusIcon } from '../icons';

const LABELS: Record<Route, string> = {
  board: 'Board',
  backlog: 'Backlog',
  reports: 'Reports',
  team: 'Team',
};

export function TopBar({
  project,
  route,
  activeSprint,
  onNewIssue,
}: {
  project: Project | null;
  route: Route;
  activeSprint: Sprint | null;
  onNewIssue: () => void;
  onNavigate: (route: Route) => void;
}) {
  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumb-muted">Projects</span>
        <ChevronRightIcon size={13} className="crumb-sep" />
        <span className="crumb-project">{project?.name || 'Workspace'}</span>
        <ChevronRightIcon size={13} className="crumb-sep" />
        <span className="crumb-current">{LABELS[route]}</span>
        {route === 'board' && activeSprint && (
          <span className="topbar-sprint">
            <span className="live-dot" />
            {activeSprint.name}
            <span className="topbar-sprint-dates">{formatRange(activeSprint.startDate, activeSprint.endDate)}</span>
          </span>
        )}
      </div>
      <div className="topbar-actions">
        <span className="kbd-hint">
          <kbd>c</kbd> new issue
        </span>
        <button type="button" className="btn btn-primary" onClick={onNewIssue}>
          <PlusIcon size={15} />
          Create issue
        </button>
      </div>
    </header>
  );
}
