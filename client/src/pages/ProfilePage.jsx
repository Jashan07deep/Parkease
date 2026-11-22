import { useState } from 'react';
import { api, errMsg } from '../api';
import { useToast } from '../components/Toast';
import { initialsOf } from '../utils';

export default function ProfilePage({ student, bookings, onSaved, onSignOut }) {
  const toast = useToast();
  const [form, setForm] = useState({ fullName: student.fullName, department: student.department || '', email: student.email || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const done = bookings.filter((b) => b.status === 'Completed').length;

  const save = async (e) => {
    e.preventDefault(); setBusy('profile');
    try { onSaved(await api.saveProfile(form)); toast('Profile saved.'); }
    catch (err) { toast(errMsg(err), 'error'); }
    finally { setBusy(''); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setBusy('pw');
    try { await api.changePassword(pw); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed. Other devices were signed out.'); }
    catch (err) { toast(errMsg(err), 'error'); }
    finally { setBusy(''); }
  };

  return (
    <main className="page page--narrow">
      <div className="who">
        <span className="who__avatar">{initialsOf(student.fullName)}</span>
        <div>
          <h1>{student.fullName}</h1>
          <p className="muted">{student.studentId} · {bookings.length} bookings, {done} completed</p>
        </div>
      </div>

      <form onSubmit={save} className="form card">
        <h2>Your details</h2>
        <label className="field"><span>Full name</span><input value={form.fullName} onChange={set('fullName')} required maxLength={80} /></label>
        <label className="field"><span>Department</span><input value={form.department} onChange={set('department')} maxLength={80} /></label>
        <label className="field"><span>University email</span><input type="email" value={form.email} onChange={set('email')} maxLength={120} /></label>
        <div className="form-actions"><button className="btn btn--primary" disabled={busy === 'profile'}>Save changes</button></div>
      </form>

      <form onSubmit={changePw} className="form card">
        <h2>Change password</h2>
        <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></label>
        <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></label>
        <div className="form-actions"><button className="btn" disabled={busy === 'pw'}>Change password</button></div>
      </form>

      <div><button className="btn" onClick={onSignOut}>Sign out</button></div>
    </main>
  );
}
