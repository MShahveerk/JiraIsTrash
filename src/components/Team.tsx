import { useMemo, useState } from 'react';
import type { Issue, Member, Project, Sprint } from '../types';
import {
  MEMBER_COLORS,
  STATUSES,
  STATUS_META,
  formatRange,
  initials,
  pluralize,
  sumPoints,
} from '../lib';
import {
  AlertIcon,
  ArrowRightIcon,
  EditIcon,
  FolderIcon,
  LogoutIcon,
  PlusIcon,
  SprintIcon,
  TrashIcon,
  TeamIcon,
} from '../icons';
import { Avatar, EmptyState, Field, Modal, type Toast } from './ui';

export function Team({
  project,
  projects,
  members,
  issues,
  sprints,
  onSwitchProject,
  onSaveMember,
  onDeleteMember,
  onCreateProject,
  authEnabled,
  onLogout,
  onNotify,
}: {
  project: Project;
  projects: Project[];
  members: Member[];
  issues: Issue[];
  sprints: Sprint[];
  onSwitchProject: (id: string) => void;
  onSaveMember: (id: string | null, payload: { name: string; email?: string; role?: string; color?: string }) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onCreateProject: (payload: { name: string; key: string; description?: string }) => Promise<void>;
  authEnabled: boolean;
  onLogout: () => void;
  onNotify: (message: string, tone?: Toast['tone']) => void;
}) {
  const [memberModal, setMemberModal] = useState<{ member?: Member } | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  const activeSprint = sprints.find((sprint) => sprint.state === 'active') || null;
  const futureSprint = sprints
    .filter((sprint) => sprint.state === 'future')
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))[0];

  const workload = useMemo(
    () =>
      members.map((member) => {
        const assigned = issues.filter((issue) => issue.assigneeId === member.id);
        return {
          member,
          open: assigned.length,
          points: sumPoints(assigned),
          byStatus: STATUSES.map((status) => ({
            status,
            count: assigned.filter((issue) => issue.status === status).length,
          })).filter((entry) => entry.count > 0),
        };
      }),
    [members, issues],
  );

  return (
    <div className="page team-page">
      <div className="page-head">
        <div>
          <h1>Team & projects</h1>
          <p className="page-sub">Who's on the team, what they're carrying, and where the work lives.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-subtle" onClick={() => setMemberModal({})}>
            <PlusIcon size={14} /> Add member
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setProjectModal(true)}>
            <PlusIcon size={14} /> New project
          </button>
        </div>
      </div>

      <section className="team-section">
        <div className="section-heading">
          <h2>
            <TeamIcon size={16} /> People
            <span className="count-badge">{members.length}</span>
          </h2>
          <span className="muted">Workload is for {project.key}</span>
        </div>

        {members.length === 0 ? (
          <EmptyState
            title="No teammates yet"
            description="Add people so you can assign issues and read the workload report."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setMemberModal({})}>
                Add the first member
              </button>
            }
          />
        ) : (
          <div className="member-grid">
            {workload.map(({ member, open, points, byStatus }) => (
              <article key={member.id} className="member-card">
                <div className="member-top">
                  <Avatar member={member} size={40} />
                  <div className="member-identity">
                    <h3>{member.name}</h3>
                    <span>{member.role || 'Team member'}</span>
                  </div>
                  <div className="member-actions">
                    <button type="button" className="icon-btn" title="Edit member" onClick={() => setMemberModal({ member })}>
                      <EditIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger-hover"
                      title="Remove member"
                      onClick={async () => {
                        if (!window.confirm(`Remove ${member.name}? Their issues become unassigned.`)) return;
                        try {
                          await onDeleteMember(member.id);
                        } catch (error) {
                          onNotify(error instanceof Error ? error.message : 'Could not remove member', 'error');
                        }
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
                <div className="member-email">{member.email || 'No email set'}</div>
                <div className="member-stats">
                  <div>
                    <strong>{open}</strong>
                    <span>open issues</span>
                  </div>
                  <div>
                    <strong>{points}</strong>
                    <span>points</span>
                  </div>
                </div>
                <div className="member-statuses">
                  {byStatus.length === 0 ? (
                    <span className="muted small">Nothing assigned</span>
                  ) : (
                    byStatus.map(({ status, count }) => (
                      <span key={status} className="member-status" style={{ color: STATUS_META[status].color }}>
                        <i style={{ background: STATUS_META[status].color }} />
                        {count} {STATUS_META[status].short}
                      </span>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="team-section">
        <div className="section-heading">
          <h2>
            <FolderIcon size={16} /> Projects
            <span className="count-badge">{projects.length}</span>
          </h2>
        </div>
        <div className="project-grid">
          {projects.map((candidate) => {
            const isCurrent = candidate.id === project.id;
            return (
              <article key={candidate.id} className={`project-card ${isCurrent ? 'is-current' : ''}`}>
                <div className="project-card-top">
                  <span className="project-key large">{candidate.key}</span>
                  {isCurrent && <span className="current-pill">Current</span>}
                </div>
                <h3>{candidate.name}</h3>
                <p>{candidate.description || 'No description yet.'}</p>
                {isCurrent ? (
                  <div className="project-sprint-line">
                    <SprintIcon size={14} />
                    {activeSprint ? (
                      <>
                        <strong>{activeSprint.name}</strong>
                        <span className="muted">{formatRange(activeSprint.startDate, activeSprint.endDate)}</span>
                      </>
                    ) : futureSprint ? (
                      <>
                        <strong>{futureSprint.name}</strong>
                        <span className="muted">starts {formatRange(futureSprint.startDate, futureSprint.endDate)}</span>
                      </>
                    ) : (
                      <span className="muted">No sprints planned</span>
                    )}
                  </div>
                ) : (
                  <div className="project-sprint-line muted">
                    <SprintIcon size={14} /> Switch to view its board
                  </div>
                )}
                <button
                  type="button"
                  className={`btn ${isCurrent ? 'btn-subtle' : 'btn-primary'} btn-small`}
                  onClick={() => onSwitchProject(candidate.id)}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'You are here' : 'Open project'} <ArrowRightIcon size={13} />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="team-section">
        <div className="section-heading">
          <h2>Workspace</h2>
        </div>
        <div className="workspace-row">
          <div className="workspace-card">
            <div className={`workspace-icon ${authEnabled ? 'secure' : ''}`}>
              <AlertIcon size={16} />
            </div>
            <div>
              <strong>{authEnabled ? 'Protected by a shared passcode' : 'Open instance'}</strong>
              <p>
                {authEnabled
                  ? 'Anyone opening this URL needs the team passcode. Sessions last 30 days.'
                  : 'No passcode is configured. Set APP_PASSCODE on the server to lock this instance down.'}
              </p>
            </div>
          </div>
          {authEnabled && (
            <button type="button" className="btn btn-subtle" onClick={onLogout}>
              <LogoutIcon size={14} /> Sign out
            </button>
          )}
        </div>
      </section>

      {memberModal && (
        <MemberModal
          member={memberModal.member}
          onClose={() => setMemberModal(null)}
          onSave={async (payload) => {
            await onSaveMember(memberModal.member?.id || null, payload);
            setMemberModal(null);
          }}
        />
      )}

      {projectModal && (
        <ProjectModal
          onClose={() => setProjectModal(false)}
          onCreate={async (payload) => {
            await onCreateProject(payload);
            setProjectModal(false);
          }}
        />
      )}

      <p className="page-footnote">
        {pluralize(members.length, 'teammate')} · {pluralize(projects.length, 'project')} · Forgeboard keeps scrum light on
        purpose.
      </p>
    </div>
  );
}

function MemberModal({
  member,
  onClose,
  onSave,
}: {
  member?: Member;
  onClose: () => void;
  onSave: (payload: { name: string; email?: string; role?: string; color?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState(member?.role || '');
  const [email, setEmail] = useState(member?.email || '');
  const [color, setColor] = useState(member?.color || MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('A name makes the board readable.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({ name: name.trim(), role: role.trim(), email: email.trim(), color });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save member');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={member ? `Edit ${member.name}` : 'Add teammate'}
      subtitle="Members can be assigned issues and picked as the author for comments."
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : member ? 'Save member' : 'Add member'}
          </button>
        </>
      }
    >
      <form id="member-form" className="form-stack" onSubmit={submit}>
        <div className="member-preview">
          <span className="avatar avatar-preview" style={{ background: color }}>
            {initials(name) || 'AB'}
          </span>
          <div>
            <strong>{name || 'New teammate'}</strong>
            <span>{role || 'What do they do?'}</span>
          </div>
        </div>
        <Field label="Name">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Role">
            <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Frontend engineer" />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ada@team.dev" />
          </Field>
        </div>
        <Field label="Avatar colour">
          <div className="color-row">
            {MEMBER_COLORS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={`color-swatch ${color === candidate ? 'is-selected' : ''}`}
                style={{ background: candidate }}
                onClick={() => setColor(candidate)}
                aria-label={`Use ${candidate}`}
              >
                {color === candidate && '✓'}
              </button>
            ))}
          </div>
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

function ProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: { name: string; key: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const suggestKey = (value: string) => {
    const words = value
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const suggestion = words.length > 1 ? words.map((word) => word[0]).join('') : words[0] || '';
    return suggestion.slice(0, 4);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name the project first.');
      return;
    }
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(key)) {
      setError('The key should be 2–6 characters, starting with a letter.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), key, description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New project"
      subtitle="A project has its own key, backlog, sprints and reports."
      onClose={onClose}
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="project-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="project-form" className="form-stack" onSubmit={submit}>
        <Field label="Project name">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!keyEdited) setKey(suggestKey(event.target.value));
            }}
            placeholder="Mobile app, Website, Platform…"
            autoFocus
          />
        </Field>
        <Field label="Issue key" hint="Used as the prefix for every issue, for example NOVA-14.">
          <input
            value={key}
            onChange={(event) => {
              setKeyEdited(true);
              setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            }}
            placeholder="NOVA"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What is this project responsible for?"
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
