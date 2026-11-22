import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api, errMsg } from '../api';
import BayStrip from './BayStrip';

const ID_RE = /^[A-Za-z0-9_-]{3,20}$/;

export default function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState('login'); // login | register
  const [f, setF] = useState({ studentId: '', fullName: '', password: '', confirm: '', department: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slots, setSlots] = useState([]);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError(''); };

  // The public availability on the brand panel: proof the lot is live before you even sign in.
  useEffect(() => { api.slots().then(setSlots).catch(() => {}); }, []);
  const free = slots.filter((s) => s.status === 'Available').length;

  const submit = async (e) => {
    e.preventDefault();
    if (!ID_RE.test(f.studentId.trim())) return setError('Student ID must be 3-20 letters or numbers.');
    if (mode === 'register') {
      if (f.password.length < 6) return setError('Choose a password of at least 6 characters.');
      if (f.password !== f.confirm) return setError('The two passwords do not match.');
    }
    setBusy(true); setError('');
    try {
      const r = mode === 'login'
        ? await api.login({ studentId: f.studentId.trim(), password: f.password })
        : await api.register({ studentId: f.studentId.trim(), fullName: f.fullName, password: f.password, department: f.department });
      onSignedIn(r.token, r.student);
    } catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <section className="auth__brand">
        <div className="brand"><span className="brand__sign" aria-hidden>P</span><span className="brand__name">ParkEase</span></div>
        <div className="auth__pitch">
          <h1>Know your spot before you reach campus.</h1>
          <p>Reserve a bay, find your car on the map, and free the spot when you leave.</p>
        </div>
        <div className="auth__live">
          {slots.length > 0 ? (
            <>
              <p><b>{free}</b> of {slots.length} spots free right now</p>
              <BayStrip slots={slots} size="lg" />
            </>
          ) : <p className="muted-on-dark">Live availability appears here once spots are mapped.</p>}
        </div>
      </section>

      <section className="auth__form">
        <form onSubmit={submit} className="form auth__card" noValidate>
          <div className="seg seg--lg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-on' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-on' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
          </div>

          <label className="field"><span>Student ID</span>
            <input value={f.studentId} onChange={set('studentId')} placeholder="e.g. 24CSE1024" autoComplete="username" autoFocus required />
          </label>
          {mode === 'register' && (
            <>
              <label className="field"><span>Full name</span>
                <input value={f.fullName} onChange={set('fullName')} autoComplete="name" required maxLength={80} />
              </label>
              <label className="field"><span>Department <em>optional</em></span>
                <input value={f.department} onChange={set('department')} maxLength={80} />
              </label>
            </>
          )}
          <label className="field"><span>Password</span>
            <span className="pw">
              <input type={show ? 'text' : 'password'} value={f.password} onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {mode === 'register' && (
            <label className="field"><span>Confirm password</span>
              <input type={show ? 'text' : 'password'} value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}
