import { useState } from 'react';
import { AlertIcon, PlusIcon } from '../icons';

export function FirstRun({
  onCreate,
}: {
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
    return (words.length > 1 ? words.map((word) => word[0]).join('') : words[0] || '').slice(0, 4);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give your first project a name.');
      return;
    }
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(key)) {
      setError('The issue key needs 2–6 characters, starting with a letter.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), key, description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project');
      setBusy(false);
    }
  };

  return (
    <div className="first-run">
      <div className="first-run-card">
        <div className="first-run-badge">Welcome to Forgeboard</div>
        <h1>Set up your first project</h1>
        <p>
          A project gets its own issue key, backlog, sprints and reports. You can add teammates and more projects right
          after this.
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Project name</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!keyEdited) setKey(suggestKey(event.target.value));
              }}
              placeholder="Platform, Mobile app, Design system…"
              autoFocus
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Issue key</span>
              <input
                value={key}
                onChange={(event) => {
                  setKeyEdited(true);
                  setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                }}
                placeholder="NOVA"
              />
            </label>
            <label className="field">
              <span className="field-label">Description</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          {error && (
            <div className="form-error">
              <AlertIcon size={14} />
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            <PlusIcon size={15} />
            {busy ? 'Creating project…' : 'Create project'}
          </button>
        </form>
        <div className="first-run-points">
          <span>Board</span>
          <span>Backlog</span>
          <span>Sprints</span>
          <span>Reports</span>
        </div>
      </div>
    </div>
  );
}
