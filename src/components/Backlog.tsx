import { useMemo, useState } from 'react';
import type { Issue, Member, Project, Sprint, Status } from '../types';
import {
  byRank,
  formatRange,
  pluralize,
  sprintTiming,
  sumPoints,
} from '../lib';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GripIcon,
  PlusIcon,
  SprintIcon,
  StatusIcon,
  TypeIcon,
  PriorityIcon,
  FlagIcon,
  TrashIcon,
  EditIcon,
} from '../icons';
import { Avatar, PointsBadge, type Toast } from './ui';
import { CompleteSprintModal, SprintFormModal, type SprintPayload } from './SprintModals';

interface DropTarget {
  scope: string;
  beforeId: string | null;
}

export function Backlog({
  project,
  sprints,
  issues,
  members,
  onOpenIssue,
  onCreate,
  onMove,
  onCreateSprint,
  onUpdateSprint,
  onStartSprint,
  onCompleteSprint,
  onDeleteSprint,
  onBulkMove,
  onBulkDelete,
  onNotify,
}: {
  project: Project;
  sprints: Sprint[];
  issues: Issue[];
  members: Member[];
  onOpenIssue: (id: string) => void;
  onCreate: (defaults: { sprintId?: string | null; status?: Status }) => void;
  onMove: (id: string, sprintId: string | null, beforeId: string | null, status?: Status) => void;
  onCreateSprint: (payload: SprintPayload) => Promise<void>;
  onUpdateSprint: (id: string, payload: SprintPayload) => Promise<void>;
  onStartSprint: (id: string, payload: { startDate?: string; endDate?: string; goal?: string }) => Promise<void>;
  onCompleteSprint: (id: string, moveIncompleteTo: string) => Promise<void>;
  onDeleteSprint: (id: string) => Promise<void>;
  onBulkMove: (ids: string[], sprintId: string | null) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onNotify: (message: string, tone?: Toast['tone']) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [form, setForm] = useState<{ mode: 'create' | 'edit' | 'start'; sprint?: Sprint | null } | null>(null);
  const [completeSprint, setCompleteSprint] = useState<Sprint | null>(null);
  const [bulkTarget, setBulkTarget] = useState('');

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const epicById = useMemo(
    () => new Map(issues.filter((issue) => issue.type === 'epic').map((issue) => [issue.id, issue])),
    [issues],
  );

  const activeSprints = sprints.filter((sprint) => sprint.state === 'active');
  const futureSprints = sprints
    .filter((sprint) => sprint.state === 'future')
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const backlogIssues = issues.filter((issue) => !issue.sprintId).sort(byRank);
  const sections: { id: string; sprint: Sprint | null; items: Issue[] }[] = [
    ...activeSprints.map((sprint) => ({
      id: sprint.id,
      sprint,
      items: issues.filter((issue) => issue.sprintId === sprint.id).sort(byRank),
    })),
    ...futureSprints.map((sprint) => ({
      id: sprint.id,
      sprint,
      items: issues.filter((issue) => issue.sprintId === sprint.id).sort(byRank),
    })),
    { id: 'backlog', sprint: null, items: backlogIssues },
  ];

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSectionSelected = (items: Issue[]) => {
    setSelected((prev) => {
      const allSelected = items.every((issue) => prev.has(issue.id));
      const next = new Set(prev);
      for (const issue of items) {
        if (allSelected) next.delete(issue.id);
        else next.add(issue.id);
      }
      return next;
    });
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDrop = (scope: string, beforeId: string | null) => {
    if (!dragId) return;
    const sprintId = scope === 'backlog' ? null : scope;
    onMove(dragId, sprintId, beforeId === dragId ? null : beforeId);
    setDragId(null);
    setDrop(null);
  };

  const startDrag = (event: React.DragEvent, issue: Issue) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', issue.id);
    setDragId(issue.id);
  };

  const selectionArray = [...selected];
  const selectionIssues = issues.filter((issue) => selected.has(issue.id));

  return (
    <div className="page backlog-page">
      <div className="page-head">
        <div>
          <h1>Backlog</h1>
          <p className="page-sub">
            {pluralize(backlogIssues.length, 'issue')} waiting ·{' '}
            {pluralize(sprints.filter((sprint) => sprint.state === 'future').length, 'planned sprint')}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => setForm({ mode: 'create' })}
          >
            <PlusIcon size={14} /> Create sprint
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onCreate({ sprintId: null, status: 'todo' })}>
            <PlusIcon size={14} /> Create issue
          </button>
        </div>
      </div>

      <div className="backlog-list">
        {sections.map(({ id, sprint, items }) => {
          const isCollapsed = collapsed.has(id);
          const donePoints = sumPoints(items.filter((issue) => issue.status === 'done'));
          const totalPoints = sprint?.committedPoints || sumPoints(items);
          const allSelected = items.length > 0 && items.every((issue) => selected.has(issue.id));
          const activeExists = activeSprints.length > 0;

          return (
            <section
              key={id}
              className={`sprint-section ${sprint?.state === 'active' ? 'is-active' : ''} ${drop?.scope === id ? 'is-drop-target' : ''}`}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDrop({ scope: id, beforeId: null });
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(id, null);
              }}
            >
              <header className="sprint-section-head">
                <button
                  type="button"
                  className="collapse-btn"
                  onClick={() => toggleCollapse(id)}
                  aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                >
                  {isCollapsed ? <ChevronRightIcon size={15} /> : <ChevronDownIcon size={15} />}
                </button>
                <label className="select-box" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSectionSelected(items)}
                    aria-label={`Select all issues in ${sprint?.name || 'backlog'}`}
                  />
                </label>
                <div className="sprint-section-title">
                  <div className="sprint-title-row">
                    {sprint ? (
                      <>
                        {sprint.state === 'active' ? <span className="live-dot" /> : <SprintIcon size={15} />}
                        <h2>{sprint.name}</h2>
                        <span className={`state-pill ${sprint.state}`}>
                          {sprint.state === 'active' ? 'Active' : 'Future'}
                        </span>
                      </>
                    ) : (
                      <>
                        <StatusIcon status="todo" size={14} />
                        <h2>Backlog</h2>
                      </>
                    )}
                    <span className="section-meta">
                      {sprint && (
                        <>
                          <CalendarIcon size={13} />
                          {formatRange(sprint.startDate, sprint.endDate)}
                          <span className="dot-sep">·</span>
                          {sprint.state === 'active' ? sprintTiming(sprint) : null}
                        </>
                      )}
                      {!sprint && <span>{pluralize(items.length, 'issue')}</span>}
                    </span>
                  </div>
                  {sprint?.goal && <p className="sprint-goal">{sprint.goal}</p>}
                </div>

                <div className="sprint-section-stats">
                  {sprint ? (
                    <>
                      <span className="stat-strong">
                        {donePoints} / {totalPoints} pts
                      </span>
                      <div className="mini-progress">
                        <span style={{ width: `${totalPoints ? Math.min(100, (donePoints / totalPoints) * 100) : 0}%` }} />
                      </div>
                    </>
                  ) : (
                    <span className="stat-strong">{sumPoints(items)} pts</span>
                  )}
                  <span className="muted">{pluralize(items.length, 'issue')}</span>
                </div>

                <div className="sprint-section-actions">
                  {sprint?.state === 'future' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-small btn-subtle"
                        onClick={() => setForm({ mode: 'start', sprint })}
                        disabled={activeExists || items.length === 0}
                        title={
                          activeExists
                            ? 'Complete the active sprint first'
                            : items.length === 0
                              ? 'Add issues before starting'
                              : 'Start this sprint'
                        }
                      >
                        Start sprint
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit sprint"
                        onClick={() => setForm({ mode: 'edit', sprint })}
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger-hover"
                        title="Delete sprint"
                        onClick={async () => {
                          if (!window.confirm(`Delete ${sprint.name}? Its issues move back to the backlog.`)) return;
                          try {
                            await onDeleteSprint(sprint.id);
                          } catch (error) {
                            onNotify(error instanceof Error ? error.message : 'Could not delete sprint', 'error');
                          }
                        }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </>
                  )}
                  {sprint?.state === 'active' && (
                    <>
                      <button type="button" className="btn btn-small btn-subtle" onClick={() => setForm({ mode: 'edit', sprint })}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-small btn-primary" onClick={() => setCompleteSprint(sprint)}>
                        <FlagIcon size={13} /> Complete
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    title="Create issue here"
                    onClick={() => onCreate({ sprintId: sprint?.id ?? null, status: 'todo' })}
                  >
                    <PlusIcon size={15} />
                  </button>
                </div>
              </header>

              {!isCollapsed && (
                <div className="sprint-section-body">
                  {items.map((issue) => {
                    const member = issue.assigneeId ? memberById.get(issue.assigneeId) : null;
                    const epic = issue.epicId ? epicById.get(issue.epicId) : null;
                    const isDropBefore = drop?.scope === id && drop.beforeId === issue.id && dragId !== issue.id;
                    return (
                      <div
                        key={issue.id}
                        className={`backlog-row ${dragId === issue.id ? 'is-dragging' : ''} ${isDropBefore ? 'drop-before' : ''} ${selected.has(issue.id) ? 'is-selected' : ''}`}
                        draggable
                        onDragStart={(event) => startDrag(event, issue)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDrop(null);
                        }}
                        onDragOver={(event) => {
                          if (!dragId || dragId === issue.id) return;
                          event.preventDefault();
                          event.stopPropagation();
                          setDrop({ scope: id, beforeId: issue.id });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleDrop(id, issue.id);
                        }}
                        onClick={() => onOpenIssue(issue.id)}
                      >
                        <span className="drag-handle" aria-hidden onClick={(event) => event.stopPropagation()}>
                          <GripIcon size={13} />
                        </span>
                        <label className="select-box" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(issue.id)}
                            onChange={() => toggleSelected(issue.id)}
                            aria-label={`Select ${issue.key}`}
                          />
                        </label>
                        <span className="row-type">
                          <TypeIcon type={issue.type} size={15} />
                        </span>
                        <span className="row-key">{issue.key}</span>
                        <span className="row-summary">
                          {issue.summary}
                          {epic && <span className="epic-chip">{epic.summary}</span>}
                        </span>
                        <span className="row-labels">
                          {issue.labels.slice(0, 2).map((label) => (
                            <span key={label} className="label-chip small">
                              {label}
                            </span>
                          ))}
                          {issue.labels.length > 2 && <span className="label-more">+{issue.labels.length - 2}</span>}
                        </span>
                        <span className="row-status" title={issue.status}>
                          <StatusIcon status={issue.status} size={14} />
                        </span>
                        <span className="row-priority">
                          <PriorityIcon priority={issue.priority} size={13} />
                        </span>
                        <span className="row-points">
                          <PointsBadge points={issue.storyPoints} />
                        </span>
                        <span className="row-avatar">
                          <Avatar member={member} size={22} />
                        </span>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="backlog-empty">
                      {dragId ? 'Drop issues here' : sprint ? 'Drag issues in or create one' : 'Nothing in the backlog'}
                    </div>
                  )}

                  <button
                    type="button"
                    className="backlog-add"
                    onClick={() => onCreate({ sprintId: sprint?.id ?? null, status: 'todo' })}
                  >
                    <PlusIcon size={14} />
                    Create issue
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {selectionIssues.length > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectionIssues.length} selected</span>
          <span className="bulk-points">{sumPoints(selectionIssues)} pts</span>
          <select
            className="select compact"
            value={bulkTarget}
            onChange={async (event) => {
              const value = event.target.value;
              if (!value) return;
              setBulkTarget('');
              try {
                await onBulkMove([...selected], value === 'backlog' ? null : value);
                setSelected(new Set());
              } catch (error) {
                onNotify(error instanceof Error ? error.message : 'Could not move issues', 'error');
              }
            }}
          >
            <option value="">Move to…</option>
            <option value="backlog">Backlog</option>
            {sprints
              .filter((sprint) => sprint.state !== 'closed')
              .map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn btn-small btn-danger"
            onClick={async () => {
              if (!window.confirm(`Delete ${selectionIssues.length} issues? This cannot be undone.`)) return;
              try {
                await onBulkDelete([...selected]);
                setSelected(new Set());
              } catch (error) {
                onNotify(error instanceof Error ? error.message : 'Could not delete issues', 'error');
              }
            }}
          >
            <TrashIcon size={13} /> Delete
          </button>
          <button type="button" className="link-btn" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {form && (
        <SprintFormModal
          mode={form.mode}
          sprint={form.sprint || null}
          defaultName={`Sprint ${sprints.length + 1}`}
          issues={
            form.sprint
              ? issues.filter((issue) => issue.sprintId === form.sprint?.id)
              : backlogIssues
          }
          onClose={() => setForm(null)}
          onSubmit={async (payload) => {
            if (form.mode === 'create') await onCreateSprint(payload);
            else if (form.mode === 'edit' && form.sprint) await onUpdateSprint(form.sprint.id, payload);
            else if (form.mode === 'start' && form.sprint)
              await onStartSprint(form.sprint.id, {
                startDate: payload.startDate || undefined,
                endDate: payload.endDate || undefined,
                goal: payload.goal,
              });
          }}
        />
      )}

      {completeSprint && (
        <CompleteSprintModal
          sprint={completeSprint}
          sprints={sprints}
          issues={issues.filter((issue) => issue.sprintId === completeSprint.id)}
          onClose={() => setCompleteSprint(null)}
          onComplete={(target) => onCompleteSprint(completeSprint.id, target)}
        />
      )}
    </div>
  );
}
