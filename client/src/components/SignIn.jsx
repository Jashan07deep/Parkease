import { useState } from 'react';
import Dialog from './Dialog';
import { api, errMsg } from '../api';

const ID_RE = /^[A-Za-z0-9_-]{3,20}$/;

export default function SignIn({ onSignedIn }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const sid = id.trim().toUpperCase();
    if (!ID_RE.test(sid)) return setError('Use 3-20 letters or numbers (dashes and underscores are fine).');
    setBusy(true); setError('');
    try {
      if (!needName) {
        try { return onSignedIn(await api.getStudent(sid)); }
        catch (err) {
          if (err.response?.status !== 404) throw err;
          setNeedName(true); return;
        }
      }
      onSignedIn(await api.saveStudent(sid, { fullName: name }));
    } catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog title="Sign in to ParkEase" dismissible={false}>
      <form onSubmit={submit} className="form">
        <p className="muted">Use your student ID. {needName ? 'We have not seen this ID before, so tell us your name to create your profile.' : 'New here? You will set up your profile next.'}</p>
        <label className="field">
          <span>Student ID</span>
          <input value={id} onChange={(e) => { setId(e.target.value); setNeedName(false); }} placeholder="e.g. 24CSE1024" autoFocus required />
        </label>
        {needName && (
          <label className="field">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus />
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="btn btn--primary" disabled={busy}>{needName ? 'Create profile' : 'Continue'}</button>
        </div>
      </form>
    </Dialog>
  );
}
