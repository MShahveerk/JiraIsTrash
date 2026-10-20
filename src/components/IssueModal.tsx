import { useMemo, useState } from 'react';
import type { Issue, IssueType, Member, Project, Sprint, Status } from '../types';
import type { IssuePayload } from '../api';
import { ISSUE_TYPES, PRIORITIES, STATUSES, STATUS_META, TYPE_META } from '../lib';
import { AlertIcon, TypeIcon } from '../icons';
import { Field, Modal } from './ui';

export interface CreateDefaults {
  sprintId?: string | null;
  status?: Status;
  type?: IssueType;
}

export function IssueModal({
  project,
  sprints,
  members,
  issues,
  defaults,
  actorId,
  onClose,
  onCreate,
}: {
  project: Project;
  sprints: Sprint[];
  members: Member[];
  issues: Issue[];
  defaults: CreateDefaults;
  actorId: string | null;
  onClose: () => void;
  onCreate: (payload: IssuePayload) => Promise<void>;
  onNotify?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>(defaults.type || 'story');
  const [status, setStatus] = useState<Status>(defaults.status || 'todo');
  const [priority, setPriority] = useState<IssuePayload['priority']>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [sprintId, setSprintId] = useState(defaults.sprintId || '');
  const [storyPoints, setStoryPoints] = useState('');
  const [labels, setLabels] = useState('');
  const [epicId, setEpicId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sprintOptions = useMemo(
    () => sprints.filter((sprint) => sprint.state !== 'closed'),
    [sprints],
  );
  const epics = useMemo(() => issues.filter((issue) => issue.type === 'epic'), [issues]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary.trim()) {
      setError('A summary helps the team know what this is.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCreate({
        summary: summary.trim(),
        description,
        type,
        status,
        priority,
        assigneeId: assigneeId || null,
        reporterId: actorId,
        sprintId: sprintId || null,
        epicId: epicId || null,
        storyPoints: storyPoints === '' ? null : Number(storyPoints),
        labels: labels
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the issue');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        <span className="modal-title-row">
          <TypeIcon type={type} size={18} />
          Create issue
        </span>
      }
      subtitle={`${project.key} · ${project.name}`}
      onClose={onClose}
      width={680}
      footer={
        <>
          <span className="footer-hint">Fields marked with * are required</span>
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="create-issue-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create issue'}
          </button>
        </>
      }
    >
      <form id="create-issue-form" className="form-stack" autoComplete="off" onSubmit={submit}>
        <div className="type-toggle" role="radiogroup" aria-label="Issue type">
          {ISSUE_TYPES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={type === candidate}
              className={`type-option ${type === candidate ? 'is-selected' : ''}`}
              onClick={() => setType(candidate)}
              style={type === candidate ? { borderColor: TYPE_META[candidate].color } : undefined}
            >
              <TypeIcon type={candidate} size={15} />
              {TYPE_META[candidate].label}
            </button>
          ))}
        </div>

        <Field label="Summary *">
          <input
            className="input-lg"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Short, specific, starts with a verb"
            autoFocus
            maxLength={220}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="Context, acceptance criteria, links. Plain text is fine."
          />
        </Field>

        <div className="form-grid three">
          <Field label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
              {STATUSES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {STATUS_META[candidate].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as IssuePayload['priority'])}
            >
              {PRIORITIES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate.charAt(0).toUpperCase() + candidate.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Story points">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={storyPoints}
              onChange={(event) => setStoryPoints(event.target.value)}
              placeholder="—"
            />
          </Field>
        </div>

        <div className="form-grid three">
          <Field label="Assignee">
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sprint">
            <select value={sprintId} onChange={(event) => setSprintId(event.target.value)}>
              <option value="">Backlog</option>
              {sprintOptions.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                  {sprint.state === 'active' ? ' · active' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Epic">
            <select value={epicId} onChange={(event) => setEpicId(event.target.value)}>
              <option value="">No epic</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id}>
                  {epic.summary}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Labels" hint="Comma separated, up to 12.">
          <input
            value={labels}
            onChange={(event) => setLabels(event.target.value)}
            placeholder="frontend, performance"
          />
        </Field>

        {error && (
          <div className="form-error">
            <AlertIcon size={14} />
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
