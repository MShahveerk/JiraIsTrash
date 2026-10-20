import { useMemo, useState } from 'react';
import type { Issue, IssueType, Member, Project, Sprint, Status } from '../types';
import {
  STATUSES,
  STATUS_META,
  TYPE_META,
  byRank,
  formatRange,
  pluralize,
  sprintTiming,
  sumPoints,
} from '../lib';
import {
  CalendarIcon,
  FlagIcon,
  PlusIcon,
  SearchIcon,
  SprintIcon,
  TypeIcon,
  PriorityIcon,
  StatusIcon,
} from '../icons';
import { Avatar, EmptyState, PointsBadge } from './ui';
import { CompleteSprintModal } from './SprintModals';

export function Board({
  project,
  sprints,
  issues,
  members,
  actorId,
  onOpenIssue,
  onCreate,
  onMove,
  onCompleteSprint,
  onNavigateBacklog,
}: {
  project: Project;
  sprints: Sprint[];
  issues: Issue[];
  members: Member[];
  actorId: string | null;
  onOpenIssue: (id: string) => void;
  onCreate: (defaults: { sprintId?: string | null; status?: Status }) => void;
  onMove: (id: string, sprintId: string | null, beforeId: string | null, status?: Status) => void;
  onCompleteSprint: (id: string, moveIncompleteTo: string) => Promise<void>;
  onNavigateBacklog: () => void;
}) {
  const activeSprint = sprints.find((sprint) => sprint.state === 'active') || null;
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('all');
  const [type, setType] = useState<'all' | IssueType>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ status: Status; beforeId: string | null } | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const epicById = useMemo(
    () => new Map(issues.filter((issue) => issue.type === 'epic').map((issue) => [issue.id, issue])),
    [issues],
  );

  const sprintIssues = useMemo(
    () => (activeSprint ? issues.filter((issue) => issue.sprintId === activeSprint.id).sort(byRank) : []),
    [issues, activeSprint],
  );

  const filtered = sprintIssues.filter((issue) => {
    if (onlyMine && issue.assigneeId !== actorId) return false;
    if (assignee === 'none' && issue.assigneeId) return false;
    if (assignee !== 'all' && assignee !== 'none' && issue.assigneeId !== assignee) return false;
    if (type !== 'all' && issue.type !== type) return false;
    if (search.trim()) {
      const haystack = `${issue.key} ${issue.summary} ${issue.labels.join(' ')}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const doneIssues = sprintIssues.filter((issue) => issue.status === 'done');
  const totalPoints = activeSprint?.committedPoints || sumPoints(sprintIssues);
  const donePoints = sumPoints(doneIssues);
  const completion = totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0;
  const filtersActive = search.trim() || assignee !== 'all' || type !== 'all' || onlyMine;

  const startDrag = (event: React.DragEvent, issue: Issue) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', issue.id);
    setDragId(issue.id);
  };

  const endDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  const handleDrop = (status: Status) => {
    if (!dragId || !activeSprint) return;
    const beforeId = drop?.beforeId || null;
    onMove(dragId, activeSprint.id, beforeId, status);
    endDrag();
  };

  if (!activeSprint) {
    return (
      <div className="page board-page">
        <div className="page-head">
          <div>
            <h1>Board</h1>
            <p className="page-sub">The board fills up when a sprint is running.</p>
          </div>
        </div>
        <div className="surface board-empty-surface">
          <EmptyState
            icon={<SprintIcon size={26} />}
            title="No active sprint"
            description="Start a sprint from the backlog and its issues will show up here, ready to drag between columns."
            action={
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={onNavigateBacklog}>
                  Open backlog
                </button>
                <button type="button" className="btn btn-subtle" onClick={() => onCreate({ sprintId: null })}>
                  <PlusIcon size={14} /> Create issue
                </button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page board-page">
      <div className="sprint-hero">
        <div className="sprint-hero-main">
          <div className="sprint-kicker">
            <span className="live-dot" />
            {activeSprint.name}
            <span className="dot-sep">·</span>
            <CalendarIcon size={13} />
            {formatRange(activeSprint.startDate, activeSprint.endDate)}
            <span className="dot-sep">·</span>
            {sprintTiming(activeSprint)}
          </div>
          <h1>{activeSprint.goal || 'No sprint goal set'}</h1>
          <div className="sprint-metrics">
            <div>
              <span className="metric-label">Points</span>
              <strong>
                {donePoints}
                <span className="metric-muted"> / {totalPoints}</span>
              </strong>
            </div>
            <div>
              <span className="metric-label">Issues</span>
              <strong>
                {doneIssues.length}
                <span className="metric-muted"> / {sprintIssues.length}</span>
              </strong>
            </div>
            <div>
              <span className="metric-label">Completion</span>
              <strong>{completion}%</strong>
            </div>
          </div>
          <div className="progress-track wide">
            <span style={{ width: `${Math.min(100, completion)}%` }} />
          </div>
        </div>
        <div className="sprint-hero-actions">
          <button type="button" className="btn btn-subtle" onClick={() => setCompleteOpen(true)}>
            <FlagIcon size={14} /> Complete sprint
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onCreate({ sprintId: activeSprint.id, status: 'todo' })}>
            <PlusIcon size={14} /> Create issue
          </button>
        </div>
      </div>

      <div className="board-toolbar">
        <div className="search-field">
          <SearchIcon size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this sprint"
            aria-label="Search sprint issues"
          />
        </div>
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="select compact" aria-label="Filter by assignee">
          <option value="all">All assignees</option>
          <option value="none">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as 'all' | IssueType)}
          className="select compact"
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`chip-toggle ${onlyMine ? 'is-on' : ''}`}
          onClick={() => setOnlyMine((value) => !value)}
          disabled={!actorId}
        >
          Only my issues
        </button>
        {filtersActive && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSearch('');
              setAssignee('all');
              setType('all');
              setOnlyMine(false);
            }}
          >
            Clear
          </button>
        )}
        <span className="toolbar-count">
          {filtered.length === sprintIssues.length
            ? pluralize(sprintIssues.length, 'issue')
            : `${filtered.length} of ${sprintIssues.length} issues`}
        </span>
      </div>

      <div className={`board-grid ${dragId ? 'is-dragging' : ''}`}>
        {STATUSES.map((status) => {
          const columnIssues = filtered.filter((issue) => issue.status === status);
          const columnPoints = sumPoints(columnIssues);
          return (
            <section
              key={status}
              className={`board-column status-${status}`}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDrop({ status, beforeId: null });
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(status);
              }}
            >
              <header className="column-head">
                <div className="column-title">
                  <StatusIcon status={status} size={14} />
                  <span>{STATUS_META[status].label}</span>
                  <span className="column-count">{columnIssues.length}</span>
                </div>
                <span className="column-points">{columnPoints} pts</span>
                <button
                  type="button"
                  className="column-add"
                  onClick={() => onCreate({ sprintId: activeSprint.id, status })}
                  aria-label={`Create issue in ${STATUS_META[status].label}`}
                  title={`Create in ${STATUS_META[status].label}`}
                >
                  <PlusIcon size={14} />
                </button>
              </header>

              <div className="column-body">
                {columnIssues.map((issue) => {
                  const member = issue.assigneeId ? memberById.get(issue.assigneeId) : null;
                  const epic = issue.epicId ? epicById.get(issue.epicId) : null;
                  const isDropBefore = drop?.status === status && drop.beforeId === issue.id && dragId !== issue.id;
                  return (
                    <article
                      key={issue.id}
                      className={`issue-card ${dragId === issue.id ? 'is-dragging' : ''} ${isDropBefore ? 'drop-before' : ''}`}
                      draggable
                      onDragStart={(event) => startDrag(event, issue)}
                      onDragEnd={endDrag}
                      onDragOver={(event) => {
                        if (!dragId || dragId === issue.id) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDrop({ status, beforeId: issue.id });
                      }}
                      onClick={() => onOpenIssue(issue.id)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenIssue(issue.id);
                        }
                      }}
                    >
                      <div className="card-top">
                        <TypeIcon type={issue.type} size={14} />
                        <span className="issue-key">{issue.key}</span>
                        {epic && <span className="epic-chip">{epic.summary}</span>}
                        <span className="card-top-end">
                          <PriorityIcon priority={issue.priority} size={13} />
                        </span>
                      </div>
                      <div className="card-summary">{issue.summary}</div>
                      {issue.labels.length > 0 && (
                        <div className="card-labels">
                          {issue.labels.slice(0, 2).map((label) => (
                            <span key={label} className="label-chip small">
                              {label}
                            </span>
                          ))}
                          {issue.labels.length > 2 && <span className="label-more">+{issue.labels.length - 2}</span>}
                        </div>
                      )}
                      <div className="card-bottom">
                        <span className="card-meta">
                          {issue.storyPoints != null ? <PointsBadge points={issue.storyPoints} /> : <span className="no-points">—</span>}
                        </span>
                        <span className="card-meta-end">
                          {issue.status === 'done' && issue.resolvedAt ? (
                            <span className="done-mark">Done</span>
                          ) : null}
                          <Avatar member={member} size={22} />
                        </span>
                      </div>
                    </article>
                  );
                })}

                {columnIssues.length === 0 && (
                  <div className="column-empty">
                    {dragId ? 'Drop here' : search || assignee !== 'all' ? 'Nothing matches' : 'No issues yet'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {completeOpen && activeSprint && (
        <CompleteSprintModal
          sprint={activeSprint}
          sprints={sprints}
          issues={sprintIssues}
          onClose={() => setCompleteOpen(false)}
          onComplete={async (target) => {
            await onCompleteSprint(activeSprint.id, target);
            setCompleteOpen(false);
          }}
        />
      )}
    </div>
  );
}
