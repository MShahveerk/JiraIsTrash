import { useState } from 'react';
import { api } from '../api';
import { AlertIcon } from '../icons';

export function Login({ onSuccess, onError }: { onSuccess: () => void; onError: (message: string) => void }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setError('Enter the team passcode to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.login(passcode);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in';
      setError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark large" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Forgeboard</span>
        </div>
        <h1>Your team's board, without the bloat.</h1>
        <p className="login-lead">
          This instance is protected with a shared passcode. Ask whoever deployed Forgeboard for the code.
        </p>
        <form onSubmit={submit}>
          <label className="field">
            <span className="field-label">Team passcode</span>
            <input
              type="password"
              value={passcode}
              onChange={(event) => {
                setPasscode(event.target.value);
                setError('');
              }}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          {error && (
            <div className="form-error">
              <AlertIcon size={14} />
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Checking…' : 'Open workspace'}
          </button>
        </form>
        <p className="login-foot">Sprints, backlog, board and reports. Nothing else.</p>
      </div>
    </div>
  );
}
