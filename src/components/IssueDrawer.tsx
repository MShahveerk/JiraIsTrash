import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Activity,
  Issue,
  IssueDetailResponse,
  Member,
  Priority,
  Sprint,
  Status,
} from '../types';
import { api, type IssuePayload } from '../api';
import {
  ISSUE_TYPES,
  PRIORITIES,
  PRIORITY_META,
  STATUSES,
  STATUS_META,
  TYPE_META,
  formatDate,
  formatDateLong,
  pluralize,
  relativeTime,
} from '../lib';
import {
  ActivityIcon,
  CloseIcon,
  EditIcon,
  MessageIcon,
  PriorityIcon,
  TrashIcon,
  TypeIcon,
  CheckIcon,
  ArrowRightIcon,
  AlertIcon,
} from '../icons';
import { Avatar, IconButton, LabelChip, Spinner, type Toast } from './ui';

function statusLabel(value: string | null) {
  if (!value) return 'nothing';
  return STATUS_META[value as Status]?.label || value;
}

function memberName(members: Member[], id: string | null) {
  if (!id) return 'Unassigned';
  return members.find((member) => member.id === id)?.name || 'Someone';
}

function sprintName(sprints: Sprint[], id: string | null) {
  if (!id) return 'Backlog';
  return sprints.find((sprint) => sprint.id === id)?.name || 'another sprint';
}

function issueName(issues: Issue[], id: string | null) {
  if (!id) return 'none';
  const issue = issues.find((candidate) => candidate.id === id);
  return issue ? `${issue.key} ${issue.summary}` : 'an epic';
}

function ActivityLine({
  entry,
  members,
  sprints,
  issues,
}: {
  entry: Activity;
  members: Member[];
  sprints: Sprint[];
  issues: Issue[];
}) {
  const actor = members.find((member) => member.id === entry.actorId);
  const label = (() => {
    switch (entry.field) {
      case 'created':
        return <>created this issue</>;
      case 'status':
        return (
          <>
            moved it from <strong>{statusLabel(entry.fromValue)}</strong> to <strong>{statusLabel(entry.toValue)}</strong>
          </>
        );
      case 'assigneeId': {
        const from = entry.fromValue ? memberName(members, entry.fromValue) : 'nobody';
        return (
          <>
            assigned it from {from} to <strong>{memberName(members, entry.toValue)}</strong>
          </>
        );
      }
      case 'reporterId':
        return <>changed the reporter to {memberName(members, entry.toValue)}</>;
      case 'priority':
        return (
          <>
            changed priority from {entry.fromValue || 'none'} to <strong>{entry.toValue || 'none'}</strong>
          </>
        );
      case 'storyPoints':
        return <>estimated this at <strong>{entry.toValue ?? 'no'} points</strong></>;
      case 'sprintId':
        return (
          <>
            moved it to <strong>{sprintName(sprints, entry.toValue)}</strong>
          </>
        );
      case 'epicId':
        return <>linked it to {issueName(issues, entry.toValue)}</>;
      case 'labels':
        return <>updated the labels</>;
      case 'summary':
        return <>updated the summary</>;
      case 'description':
        return <>updated the description</>;
      case 'type':
        return <>changed the type to {TYPE_META[entry.toValue as keyof typeof TYPE_META]?.label || entry.toValue}</>;
      default:
        return <>updated {entry.field}</>;
    }
  })();

  return (
    <li className="activity-item">
      <span className="activity-dot">
        <ActivityIcon size={12} />
      </span>
      <div className="activity-body">
        <p>
          <strong>{actor?.name || 'Someone'}</strong> {label}
        </p>
        <time title={formatDateLong(entry.createdAt)}>{relativeTime(entry.createdAt)}</time>
      </div>
    </li>
  );
}

export function IssueDrawer({
  issueId,
  liveIssue,
  members,
  sprints,
  issues,
  actor,
  detailVersion,
  onClose,
  onPatch,
  onDelete,
  onAddComment,
  onOpenIssue,
  onNotify,
}: {
  issueId: string;
  liveIssue: Issue;
  members: Member[];
  sprints: Sprint[];
  issues: Issue[];
  actor: Member | null;
  detailVersion: number;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<IssuePayload> & { rank?: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (id: string, body: string) => Promise<void>;
  onOpenIssue: (id: string) => void;
  onNotify: (message: string, tone?: Toast['tone']) => void;
}) {
  const [detail, setDetail] = useState<IssueDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(liveIssue.summary);
  const [description, setDescription] = useState(liveIssue.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [points, setPoints] = useState(liveIssue.storyPoints == null ? '' : String(liveIssue.storyPoints));
  const [labelDraft, setLabelDraft] = useState('');
  const [feed, setFeed] = useState<'comments' | 'history'>('comments');
  const summaryFocused = useRef(false);
  const pointsFocused = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .issue(issueId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((error) => {
        if (!cancelled) onNotify(error instanceof Error ? error.message : 'Could not load issue', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [issueId, detailVersion, onNotify]);

  useEffect(() => {
    setSummary(liveIssue.summary);
    setDescription(liveIssue.description);
    setPoints(liveIssue.storyPoints == null ? '' : String(liveIssue.storyPoints));
    setEditingDescription(false);
    setComment('');
  }, [issueId]);

  useEffect(() => {
    if (!summaryFocused.current) setSummary(liveIssue.summary);
    if (!editingDescription) setDescription(liveIssue.description);
    if (!pointsFocused.current) setPoints(liveIssue.storyPoints == null ? '' : String(liveIssue.storyPoints));
  }, [liveIssue.summary, liveIssue.description, liveIssue.storyPoints, editingDescription]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [issueId]);

  const assignee = members.find((member) => member.id === liveIssue.assigneeId) || null;
  const reporter = members.find((member) => member.id === liveIssue.reporterId) || null;
  const epic = issues.find((issue) => issue.id === liveIssue.epicId) || null;
  const epicOptions = useMemo(() => issues.filter((issue) => issue.type === 'epic'), [issues]);
  const comments = detail?.comments || [];
  const activity = detail?.activity || [];

  const saveSummary = () => {
    const next = summary.trim();
    if (!next) {
      setSummary(liveIssue.summary);
      return;
    }
    if (next !== liveIssue.summary) {
      void onPatch(issueId, { summary: next });
    }
  };

  const saveDescription = () => {
    if (description !== liveIssue.description) {
      void onPatch(issueId, { description });
    }
    setEditingDescription(false);
  };

  const savePoints = () => {
    const next = points.trim() === '' ? null : Number(points);
    if (next != null && (!Number.isFinite(next) || next < 0)) {
      setPoints(liveIssue.storyPoints == null ? '' : String(liveIssue.storyPoints));
      return;
    }
    if (next !== liveIssue.storyPoints) void onPatch(issueId, { storyPoints: next });
  };

  const addLabel = () => {
    const label = labelDraft.trim();
    if (!label) return;
    if (!liveIssue.labels.some((candidate) => candidate.toLowerCase() === label.toLowerCase())) {
      void onPatch(issueId, { labels: [...liveIssue.labels, label] });
    }
    setLabelDraft('');
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true);
    try {
      await onAddComment(issueId, comment.trim());
      setComment('');
      setFeed('comments');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Could not add comment', 'error');
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="issue-drawer" role="dialog" aria-modal="true" aria-label={`${liveIssue.key} details`}>
        <header className="drawer-header">
          <div className="drawer-crumbs">
            <span className="issue-key">{liveIssue.key}</span>
            <span className="dot-sep">·</span>
            <span className="muted">Updated {relativeTime(liveIssue.updatedAt)}</span>
          </div>
          <div className="drawer-header-actions">
            <button
              type="button"
              className="icon-btn danger-hover"
              title="Delete issue"
              onClick={async () => {
                if (!window.confirm(`Delete ${liveIssue.key}? This cannot be undone.`)) return;
                try {
                  await onDelete(issueId);
                } catch (error) {
                  onNotify(error instanceof Error ? error.message : 'Could not delete issue', 'error');
                }
              }}
            >
              <TrashIcon size={16} />
            </button>
            <IconButton label="Close" onClick={onClose}>
              <CloseIcon size={17} />
            </IconButton>
          </div>
        </header>

        <div className="drawer-scroll" ref={bodyRef}>
          <div className="drawer-title-block">
            <div className="drawer-type-row">
              <TypeIcon type={liveIssue.type} size={17} />
              <span>{TYPE_META[liveIssue.type].label}</span>
              {epic && (
                <button type="button" className="epic-link" onClick={() => onOpenIssue(epic.id)}>
                  {epic.key} · {epic.summary}
                </button>
              )}
            </div>
            <textarea
              className="summary-input"
              value={summary}
              rows={2}
              onChange={(event) => setSummary(event.target.value)}
              onFocus={() => {
                summaryFocused.current = true;
              }}
              onBlur={() => {
                summaryFocused.current = false;
                saveSummary();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  (event.target as HTMLTextAreaElement).blur();
                }
              }}
              aria-label="Issue summary"
            />
          </div>

          <div className="drawer-grid">
            <div className="drawer-main">
              <section className="drawer-section">
                <div className="section-heading">
                  <h3>Description</h3>
                  {!editingDescription ? (
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() => setEditingDescription(true)}
                    >
                      <EditIcon size={13} /> Edit
                    </button>
                  ) : (
                    <div className="edit-actions">
                      <button
                        type="button"
                        className="btn btn-small btn-subtle"
                        onClick={() => {
                          setDescription(liveIssue.description);
                          setEditingDescription(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button type="button" className="btn btn-small btn-primary" onClick={saveDescription}>
                        Save
                      </button>
                    </div>
                  )}
                </div>
                {editingDescription ? (
                  <textarea
                    className="description-editor"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={8}
                    autoFocus
                    placeholder="Add context the team will need."
                  />
                ) : liveIssue.description ? (
                  <p className="description-text">{liveIssue.description}</p>
                ) : (
                  <button type="button" className="description-empty" onClick={() => setEditingDescription(true)}>
                    Add a description…
                  </button>
                )}
              </section>

              <section className="drawer-section">
                <div className="section-heading">
                  <h3>
                    {feed === 'comments' ? 'Comments' : 'History'}
                    <span className="count-badge">
                      {feed === 'comments' ? comments.length : activity.length}
                    </span>
                  </h3>
                  <div className="feed-tabs">
                    <button
                      type="button"
                      className={feed === 'comments' ? 'is-active' : ''}
                      onClick={() => setFeed('comments')}
                    >
                      Comments
                    </button>
                    <button
                      type="button"
                      className={feed === 'history' ? 'is-active' : ''}
                      onClick={() => setFeed('history')}
                    >
                      History
                    </button>
                  </div>
                </div>

                {feed === 'comments' ? (
                  <>
                    <form className="comment-composer" onSubmit={submitComment}>
                      <Avatar member={actor} size={28} />
                      <div className="comment-input-wrap">
                        <textarea
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          rows={2}
                          placeholder={`Comment as ${actor?.name || 'yourself'}…`}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                              event.preventDefault();
                              event.currentTarget.form?.requestSubmit();
                            }
                          }}
                        />
                        <div className="comment-actions">
                          <span className="footer-hint">⌘/Ctrl + Enter to post</span>
                          <button type="submit" className="btn btn-small btn-primary" disabled={commentBusy || !comment.trim()}>
                            {commentBusy ? 'Posting…' : 'Comment'}
                          </button>
                        </div>
                      </div>
                    </form>

                    {loading && comments.length === 0 ? (
                      <Spinner label="Loading comments" />
                    ) : comments.length === 0 ? (
                      <div className="feed-empty">
                        <MessageIcon size={18} />
                        <span>No comments yet. Start the conversation.</span>
                      </div>
                    ) : (
                      <ul className="comment-list">
                        {comments.map((entry) => {
                          const author = members.find((member) => member.id === entry.authorId);
                          return (
                            <li key={entry.id} className="comment-item">
                              <Avatar member={author} size={28} />
                              <div className="comment-body">
                                <div className="comment-head">
                                  <strong>{author?.name || 'Someone'}</strong>
                                  <time title={formatDateLong(entry.createdAt)}>
                                    {formatDate(entry.createdAt, { month: 'short', day: 'numeric' })} ·{' '}
                                    {relativeTime(entry.createdAt)}
                                  </time>
                                </div>
                                <p>{entry.body}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : loading && activity.length === 0 ? (
                  <Spinner label="Loading history" />
                ) : activity.length === 0 ? (
                  <div className="feed-empty">
                    <ActivityIcon size={18} />
                    <span>No changes recorded yet.</span>
                  </div>
                ) : (
                  <ul className="activity-list">
                    {[...activity].reverse().map((entry) => (
                      <ActivityLine
                        key={entry.id}
                        entry={entry}
                        members={members}
                        sprints={sprints}
                        issues={issues}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="drawer-rail">
              <div className="rail-field">
                <span className="field-label">Status</span>
                <select
                  value={liveIssue.status}
                  onChange={(event) => void onPatch(issueId, { status: event.target.value as Status })}
                  className={`select status-select status-${liveIssue.status}`}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rail-field">
                <span className="field-label">Assignee</span>
                <div className="select-with-avatar">
                  <Avatar member={assignee} size={20} />
                  <select
                    value={liveIssue.assigneeId || ''}
                    onChange={(event) => void onPatch(issueId, { assigneeId: event.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rail-field">
                <span className="field-label">Reporter</span>
                <div className="select-with-avatar">
                  <Avatar member={reporter} size={20} />
                  <select
                    value={liveIssue.reporterId || ''}
                    onChange={(event) => void onPatch(issueId, { reporterId: event.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rail-field">
                <span className="field-label">Priority</span>
                <div className="select-with-icon">
                  <PriorityIcon priority={liveIssue.priority} size={14} />
                  <select
                    value={liveIssue.priority}
                    onChange={(event) => void onPatch(issueId, { priority: event.target.value as Priority })}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_META[priority].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rail-field">
                <span className="field-label">Story points</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={points}
                  onChange={(event) => setPoints(event.target.value)}
                  onFocus={() => {
                    pointsFocused.current = true;
                  }}
                  onBlur={() => {
                    pointsFocused.current = false;
                    savePoints();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                  }}
                  placeholder="—"
                />
              </div>

              <div className="rail-field">
                <span className="field-label">Sprint</span>
                <select
                  value={liveIssue.sprintId || ''}
                  onChange={(event) => void onPatch(issueId, { sprintId: event.target.value || null })}
                >
                  <option value="">Backlog</option>
                  {sprints
                    .filter((sprint) => sprint.state !== 'closed')
                    .map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                        {sprint.state === 'active' ? ' · active' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="rail-field">
                <span className="field-label">Epic</span>
                <select
                  value={liveIssue.epicId || ''}
                  onChange={(event) => void onPatch(issueId, { epicId: event.target.value || null })}
                >
                  <option value="">No epic</option>
                  {epicOptions
                    .filter((candidate) => candidate.id !== liveIssue.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.summary}
                      </option>
                    ))}
                </select>
              </div>

              <div className="rail-field">
                <span className="field-label">Type</span>
                <div className="select-with-icon">
                  <TypeIcon type={liveIssue.type} size={14} />
                  <select
                    value={liveIssue.type}
                    onChange={(event) =>
                      void onPatch(issueId, { type: event.target.value as IssuePayload['type'] })
                    }
                  >
                    {ISSUE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_META[type].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rail-field">
                <span className="field-label">Labels</span>
                <div className="label-editor">
                  {liveIssue.labels.map((label) => (
                    <LabelChip
                      key={label}
                      label={label}
                      onRemove={() =>
                        void onPatch(issueId, { labels: liveIssue.labels.filter((candidate) => candidate !== label) })
                      }
                    />
                  ))}
                  <input
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addLabel();
                      }
                    }}
                    onBlur={addLabel}
                    placeholder={liveIssue.labels.length ? 'Add label…' : 'Add a label…'}
                    aria-label="Add label"
                  />
                </div>
              </div>

              <div className="rail-meta">
                <div>
                  <span>Created</span>
                  <strong>{formatDate(liveIssue.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                </div>
                <div>
                  <span>{liveIssue.resolvedAt ? 'Resolved' : 'Updated'}</span>
                  <strong>
                    {formatDate(liveIssue.resolvedAt || liveIssue.updatedAt, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              </div>

              <div className="rail-tip">
                <CheckIcon size={13} /> {pluralize(liveIssue.labels.length, 'label')} · {liveIssue.storyPoints ?? 0} pts
              </div>
            </aside>
          </div>
        </div>

        <footer className="drawer-footer">
          <span className="muted">
            {TYPE_META[liveIssue.type].label} in {liveIssue.key.split('-')[0]}
          </span>
          <span className="drawer-footer-status">
            {liveIssue.status === 'done' ? <AlertIcon size={13} /> : <ArrowRightIcon size={13} />}
            {STATUS_META[liveIssue.status].label}
          </span>
        </footer>
      </aside>
    </div>
  );
}
