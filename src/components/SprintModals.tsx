import { useState } from 'react';
import type { Issue, Sprint } from '../types';
import { addDays, formatDate, formatRange, pluralize, sumPoints, todayString } from '../lib';
import { AlertIcon, CheckIcon, SprintIcon } from '../icons';
import { Field, Modal } from './ui';

export interface SprintPayload {
  name?: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export function SprintFormModal({
  mode,
  sprint,
  issues,
  defaultName,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit' | 'start';
  sprint?: Sprint | null;
  issues: Issue[];
  defaultName?: string;
  onClose: () => void;
  onSubmit: (payload: SprintPayload) => Promise<void>;
}) {
  const start = todayString();
  const [name, setName] = useState(sprint?.name || defaultName || '');
  const [goal, setGoal] = useState(sprint?.goal || '');
  const [startDate, setStartDate] = useState(sprint?.startDate || start);
  const [endDate, setEndDate] = useState(sprint?.endDate || addDays(sprint?.startDate || start, 13));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const points = sumPoints(issues);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode !== 'start' && !name.trim()) {
      setError('Give the sprint a name.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('The end date needs to be after the start date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        ...(mode === 'start' ? {} : { name: name.trim() }),
        goal: goal.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the sprint');
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    create: 'Create sprint',
    edit: 'Edit sprint',
    start: `Start ${sprint?.name || 'sprint'}`,
  };

  return (
    <Modal
      title={titles[mode]}
      subtitle={
        mode === 'start'
          ? `${pluralize(issues.length, 'issue')} · ${points} points committed when you start`
          : mode === 'edit'
            ? 'Update the name, goal or dates for this sprint.'
            : 'Plan the window now; you can move issues in from the backlog.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="sprint-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : mode === 'start' ? 'Start sprint' : mode === 'edit' ? 'Save changes' : 'Create sprint'}
          </button>
        </>
      }
    >
      <form id="sprint-form" onSubmit={submit} className="form-stack">
        {mode !== 'start' && (
          <Field label="Sprint name">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Sprint 26" autoFocus />
          </Field>
        )}
        <Field label="Sprint goal" hint="One sentence the team can rally around. Shows on the board.">
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={2}
            placeholder="What should be true at the end of this sprint?"
          />
        </Field>
        <div className="form-grid">
          <Field label="Start date">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="End date">
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
        {mode === 'start' && (
          <div className="sprint-start-summary">
            <SprintIcon size={16} />
            <div>
              <strong>
                {pluralize(issues.length, 'issue')} · {points} points
              </strong>
              <span>
                {formatRange(startDate, endDate)} · {issues.filter((issue) => issue.status === 'done').length} already done
              </span>
            </div>
          </div>
        )}
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

export function CompleteSprintModal({
  sprint,
  sprints,
  issues,
  onClose,
  onComplete,
}: {
  sprint: Sprint;
  sprints: Sprint[];
  issues: Issue[];
  onClose: () => void;
  onComplete: (moveIncompleteTo: string) => Promise<void>;
}) {
  const future = sprints.filter((candidate) => candidate.state === 'future');
  const done = issues.filter((issue) => issue.status === 'done');
  const open = issues.filter((issue) => issue.status !== 'done');
  const [target, setTarget] = useState<string>(future[0]?.id || 'backlog');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onComplete(target);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete sprint');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Complete ${sprint.name}`}
      subtitle={`${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}`}
      onClose={onClose}
      width={580}
      footer={
        <>
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Keep sprint open
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Completing…' : 'Complete sprint'}
          </button>
        </>
      }
    >
      <div className="complete-stats">
        <div className="complete-stat done">
          <span className="complete-stat-icon">
            <CheckIcon size={16} />
          </span>
          <div>
            <strong>{done.length} completed</strong>
            <span>{sumPoints(done)} points delivered</span>
          </div>
        </div>
        <div className="complete-stat open">
          <span className="complete-stat-icon">
            <AlertIcon size={16} />
          </span>
          <div>
            <strong>{open.length} not done</strong>
            <span>{sumPoints(open)} points still open</span>
          </div>
        </div>
      </div>

      {open.length > 0 ? (
        <div className="form-stack">
          <span className="field-label">Move the {open.length} unfinished {open.length === 1 ? 'issue' : 'issues'} to</span>
          <div className="radio-cards">
            <label className={`radio-card ${target === 'backlog' ? 'is-selected' : ''}`}>
              <input type="radio" name="target" value="backlog" checked={target === 'backlog'} onChange={() => setTarget('backlog')} />
              <span>
                <strong>Backlog</strong>
                <small>Re-plan these issues later</small>
              </span>
            </label>
            {future.map((candidate) => (
              <label key={candidate.id} className={`radio-card ${target === candidate.id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="target"
                  value={candidate.id}
                  checked={target === candidate.id}
                  onChange={() => setTarget(candidate.id)}
                />
                <span>
                  <strong>{candidate.name}</strong>
                  <small>{formatRange(candidate.startDate, candidate.endDate)}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted-line">Everything in this sprint is done. Nice work.</p>
      )}

      {error && (
        <div className="form-error">
          <AlertIcon size={14} />
          {error}
        </div>
      )}
    </Modal>
  );
}
