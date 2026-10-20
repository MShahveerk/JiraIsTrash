import { useEffect, useRef, useState, type ComponentType } from 'react';
import type { Issue, Member, Project, Route, Sprint } from '../types';
import { STATUS_META, formatRange, pluralize, sprintTiming, sumPoints } from '../lib';
import {
  BacklogIcon,
  BoardIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  LogoutIcon,
  PlusIcon,
  ReportsIcon,
  SprintIcon,
  TeamIcon,
} from '../icons';
import { Avatar } from './ui';

const NAV: { route: Route; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { route: 'board', label: 'Board', icon: BoardIcon },
  { route: 'backlog', label: 'Backlog', icon: BacklogIcon },
  { route: 'reports', label: 'Reports', icon: ReportsIcon },
  { route: 'team', label: 'Team', icon: TeamIcon },
];

export function Sidebar({
  project,
  projects,
  sprints,
  issues,
  members,
  actor,
  route,
  authEnabled,
  onNavigate,
  onSwitchProject,
  onPickActor,
  onNewIssue,
  onLogout,
}: {
  project: Project | null;
  projects: Project[];
  sprints: Sprint[];
  issues: Issue[];
  members: Member[];
  actor: Member | null;
  route: Route;
  authEnabled: boolean;
  onNavigate: (route: Route) => void;
  onSwitchProject: (id: string) => void;
  onPickActor: (id: string) => void;
  onNewIssue: () => void;
  onLogout: () => void;
}) {
  const [projectMenu, setProjectMenu] = useState(false);
  const [actorMenu, setActorMenu] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) setProjectMenu(false);
      if (actorRef.current && !actorRef.current.contains(event.target as Node)) setActorMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const activeSprint = sprints.find((sprint) => sprint.state === 'active') || null;
  const activeIssues = activeSprint ? issues.filter((issue) => issue.sprintId === activeSprint.id) : [];
  const donePoints = sumPoints(activeIssues.filter((issue) => issue.status === 'done'));
  const totalPoints = activeSprint?.committedPoints || sumPoints(activeIssues);
  const progress = totalPoints > 0 ? Math.min(100, Math.round((donePoints / totalPoints) * 100)) : 0;
  const backlogCount = issues.filter((issue) => !issue.sprintId).length;

  const counts: Partial<Record<Route, number>> = {
    board: activeIssues.filter((issue) => issue.status !== 'done').length,
    backlog: backlogCount,
    team: members.length,
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="brand-name">Forgeboard</span>
      </div>

      <div className="project-switcher" ref={projectRef}>
        <button
          type="button"
          className="project-btn"
          aria-label="Switch project"
          onClick={() => setProjectMenu((open) => !open)}
        >
          <span className="project-key">{project?.key || '—'}</span>
          <span className="project-name">{project?.name || 'No project yet'}</span>
          <ChevronDownIcon size={14} className="project-caret" />
        </button>
        {projectMenu && (
          <div className="popover project-popover">
            <div className="popover-label">Projects</div>
            {projects.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={`menu-row ${candidate.id === project?.id ? 'is-selected' : ''}`}
                onClick={() => {
                  onSwitchProject(candidate.id);
                  setProjectMenu(false);
                }}
              >
                <span className="project-key small">{candidate.key}</span>
                <span>{candidate.name}</span>
                {candidate.id === project?.id && <span className="menu-check">✓</span>}
              </button>
            ))}
            <div className="popover-divider" />
            <button
              type="button"
              className="menu-row"
              onClick={() => {
                onNavigate('team');
                setProjectMenu(false);
              }}
            >
              <FolderIcon size={15} />
              <span>Manage projects</span>
              <ChevronRightIcon size={13} className="menu-end" />
            </button>
          </div>
        )}
      </div>

      <button type="button" className="sidebar-create" aria-label="Create issue" onClick={onNewIssue}>
        <PlusIcon size={15} />
        <span>Create issue</span>
        <kbd>c</kbd>
      </button>

      <nav className="sidebar-nav" aria-label="Main">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.route}
              type="button"
              className={`nav-item ${route === item.route ? 'is-active' : ''}`}
              aria-label={item.label}
              title={item.label}
              onClick={() => onNavigate(item.route)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {counts[item.route] ? <span className="nav-count">{counts[item.route]}</span> : null}
            </button>
          );
        })}
      </nav>

      {activeSprint && (
        <button type="button" className="sprint-widget" onClick={() => onNavigate('board')}>
          <div className="sprint-widget-top">
            <span className="sprint-live">
              <span className="live-dot" /> Active sprint
            </span>
            <SprintIcon size={14} />
          </div>
          <div className="sprint-widget-name">{activeSprint.name}</div>
          <div className="sprint-widget-meta">
            <span>{formatRange(activeSprint.startDate, activeSprint.endDate)}</span>
            <span>{sprintTiming(activeSprint)}</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="sprint-widget-meta">
            <span>
              {donePoints} / {totalPoints} pts
            </span>
            <span>{progress}%</span>
          </div>
        </button>
      )}

      <div className="sidebar-spacer" />

      <div className="sidebar-footer" ref={actorRef}>
        {actorMenu && (
          <div className="popover actor-popover">
            <div className="popover-label">Comments and changes are posted as</div>
            <div className="actor-list">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`menu-row ${member.id === actor?.id ? 'is-selected' : ''}`}
                  onClick={() => {
                    onPickActor(member.id);
                    setActorMenu(false);
                  }}
                >
                  <Avatar member={member} size={22} />
                  <span className="menu-row-text">
                    <span>{member.name}</span>
                    <small>{member.role || 'Team member'}</small>
                  </span>
                  {member.id === actor?.id && <span className="menu-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          className="actor-button"
          aria-label="Choose who you are"
          onClick={() => setActorMenu((open) => !open)}
        >
          <Avatar member={actor} size={28} />
          <span className="actor-text">
            <span>{actor?.name || 'Choose teammate'}</span>
            <small>{actor?.role || 'Set who you are'}</small>
          </span>
          <ChevronDownIcon size={14} />
        </button>
        {authEnabled && (
          <button type="button" className="logout-btn" onClick={onLogout} title="Sign out">
            <LogoutIcon size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
