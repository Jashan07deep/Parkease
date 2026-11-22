import { useEffect, useMemo, useState } from 'react';
import { Check, Crosshair, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import MapView from '../components/MapView';
import SpotList from '../components/SpotList';
import StatsPanel from '../components/StatsPanel';
import Segmented from '../components/Segmented';
import { api, errMsg, setAdminToken } from '../api';
import { useToast } from '../components/Toast';
import { fmtDate, nextName } from '../utils';

export default function ManagePage({ admin, setAdmin, slots, zones, refresh, flyTarget, setFlyTarget }) {
  if (!admin) return <AdminGate onUnlock={() => setAdmin(true)} />;
  return <Editor slots={slots} zones={zones} refresh={refresh} flyTarget={flyTarget} setFlyTarget={setFlyTarget}
    onLock={() => { setAdminToken(''); setAdmin(false); }} />;
}

function AdminGate({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const { token } = await api.adminLogin(pin); setAdminToken(token); onUnlock(); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };
  return (
    <main className="page page--narrow">
      <div className="gate">
        <Lock size={22} aria-hidden />
        <h1>Manage spots</h1>
        <p className="muted">Enter the admin PIN to place, rename and close parking spots on the map.</p>
        <form onSubmit={submit} className="form">
          <label className="field"><span>Admin PIN</span><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn--primary" disabled={busy}>Unlock</button>
        </form>
      </div>
    </main>
  );
}

function Editor({ slots, zones, refresh, flyTarget, setFlyTarget, onLock }) {
  const toast = useToast();
  const [panel, setPanel] = useState('spots');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null); // {lat,lng,name,zoneId,vehicleType} while placing a new spot
  const [placing, setPlacing] = useState(false);
  const [lastZone, setLastZone] = useState('');

  // Owner info is only sent to admins; refetch with the admin token on entry.
  useEffect(() => { refresh(); }, [refresh]);

  const selected = slots.find((s) => s.id === selectedId) || null;

  const fail = (e) => toast(errMsg(e), 'error');

  const startPlacing = () => { setPlacing(true); setSelectedId(null); setDraft(null); };
  const stopPlacing = () => { setPlacing(false); setDraft(null); };

  const onMapClick = (lat, lng) => {
    if (!placing) { setSelectedId(null); return; }
    const last = [...slots].sort((a, b) => b.id - a.id)[0];
    setDraft((d) => d
      ? { ...d, lat, lng }
      : { lat, lng, name: nextName(last?.name), zoneId: lastZone || last?.zoneId || '', vehicleType: last?.vehicleType || 'Any' });
  };

  const create = async (f) => {
    try {
      await api.createSlot({ name: f.name, zoneId: f.zoneId || null, vehicleType: f.vehicleType, lat: draft.lat, lng: draft.lng });
      toast(`${f.name} placed.`);
      setLastZone(f.zoneId || '');
      setDraft(null); // stay in placing mode: the next click drops the next spot, name pre-filled
      await refresh();
    } catch (e) { fail(e); }
  };

  const save = async (f) => {
    try {
      await api.updateSlot(selected.id, { name: f.name, zoneId: f.zoneId || null, vehicleType: f.vehicleType, state: f.state, lat: selected.lat, lng: selected.lng });
      toast(`${f.name} saved.`); await refresh();
    } catch (e) { fail(e); }
  };
  const move = async (s, lat, lng) => {
    try {
      await api.updateSlot(s.id, { name: s.name, zoneId: s.zoneId, vehicleType: s.vehicleType, state: s.state, lat, lng });
      toast(`${s.name} moved.`); await refresh();
    } catch (e) { fail(e); await refresh(); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${selected.name}? Past bookings keep its name.`)) return;
    try { await api.deleteSlot(selected.id); toast(`${selected.name} deleted.`); setSelectedId(null); await refresh(); }
    catch (e) { fail(e); }
  };

  const select = (id) => {
    stopPlacing(); setSelectedId(id);
    const s = slots.find((x) => x.id === id);
    if (s) setFlyTarget({ lat: s.lat, lng: s.lng, k: Date.now() });
  };

  return (
    <div className="stage">
      <MapView
        slots={slots} selectedId={selectedId} onSelect={select} flyTarget={flyTarget} editor
        draft={draft} onMapClick={onMapClick} onMove={move} onDraftMove={(lat, lng) => setDraft((d) => ({ ...d, lat, lng }))}
      />
      {placing && !draft && <div className="map-hint">Click the map where the spot is</div>}

      <aside className="dock" aria-label="Manage spots">
        <div className="dock__head">
          <div className="panel-tabs" role="tablist">
            {[['spots', 'Spots'], ['zones', 'Zones'], ['bookings', 'Bookings'], ['stats', 'Stats']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={panel === id} className={panel === id ? 'is-on' : ''} onClick={() => { setPanel(id); stopPlacing(); }}>{label}</button>
            ))}
            <button className="icon-btn panel-tabs__lock" onClick={onLock} title="Lock admin tools" aria-label="Lock admin tools"><Lock size={16} /></button>
          </div>
        </div>

        {panel === 'spots' && (
          draft ? (
            <SpotForm key="new" title="New spot" initial={draft} zones={zones} submitLabel="Place spot"
              coords={draft} onCancel={stopPlacing} onSubmit={create} onChange={(f) => setDraft((d) => ({ ...d, ...f }))} />
          ) : selected ? (
            <SpotForm key={selected.id} title={`Edit ${selected.name}`} initial={selected} zones={zones} submitLabel="Save changes"
              coords={selected} withState bookedBy={selected.bookedBy}
              onCancel={() => setSelectedId(null)} onSubmit={save} onDelete={remove} />
          ) : (
            <>
              <div className="dock__sub">
                {placing ? (
                  <button className="btn btn--block" onClick={stopPlacing}><X size={16} aria-hidden /> Stop placing</button>
                ) : (
                  <button className="btn btn--primary btn--block" onClick={startPlacing}><Plus size={16} aria-hidden /> Place a new spot</button>
                )}
                <p className="muted small">Select a spot to rename it or change its zone. Drag a selected spot to move it.</p>
              </div>
              <SpotList slots={slots} zones={zones} selectedId={selectedId} onSelect={select}
                empty="Nothing placed yet. Use Place a new spot, click the map, and give it a name." />
            </>
          )
        )}
        {panel === 'zones' && <ZonesPanel zones={zones} refresh={refresh} />}
        {panel === 'bookings' && <AdminBookings refresh={refresh} />}
        {panel === 'stats' && <StatsPanel slots={slots} />}
      </aside>
    </div>
  );
}

function SpotForm({ title, initial, zones, submitLabel, coords, withState, bookedBy, onCancel, onSubmit, onDelete, onChange }) {
  const [f, setF] = useState({
    name: initial.name || '', zoneId: initial.zoneId || '', vehicleType: initial.vehicleType || 'Any', state: initial.state || 'Open',
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { const n = { ...f, [k]: v }; setF(n); onChange?.(n); };
  const submit = async (e) => { e.preventDefault(); setBusy(true); await onSubmit(f); setBusy(false); };

  return (
    <form className="form form--panel" onSubmit={submit}>
      <h2>{title}</h2>
      <label className="field"><span>Spot name</span>
        <input value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={40} autoFocus placeholder="e.g. A-01" />
      </label>
      <label className="field"><span>Zone</span>
        <select value={f.zoneId} onChange={(e) => set('zoneId', e.target.value ? Number(e.target.value) : '')}>
          <option value="">No zone</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </label>
      <div className="field"><span>Allowed vehicles</span>
        <Segmented label="Allowed vehicles" value={f.vehicleType} onChange={(v) => set('vehicleType', v)}
          options={[{ value: 'Any', label: 'Any' }, { value: 'Two-wheeler', label: 'Two-wheeler' }, { value: 'Four-wheeler', label: 'Four-wheeler' }]} />
      </div>
      {withState && (
        <div className="field"><span>Availability</span>
          <Segmented label="Availability" value={f.state} onChange={(v) => set('state', v)}
            options={[{ value: 'Open', label: 'Open' }, { value: 'Maintenance', label: 'Closed for maintenance' }]} />
        </div>
      )}
      <p className="coords"><Crosshair size={14} aria-hidden /> {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p>
      {bookedBy && <p className="note">Currently booked by {bookedBy}.</p>}
      <div className="form-actions form-actions--split">
        {onDelete ? <button type="button" className="btn btn--danger" onClick={onDelete}><Trash2 size={16} aria-hidden /> Delete</button> : <span />}
        <span className="row">
          <button type="button" className="btn" onClick={onCancel}>{onDelete ? 'Close' : 'Cancel'}</button>
          <button className="btn btn--primary" disabled={busy}>{submitLabel}</button>
        </span>
      </div>
    </form>
  );
}

function ZonesPanel({ zones, refresh }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // {id, name}
  const run = async (fn, ok) => {
    try { await fn(); if (ok) toast(ok); await refresh(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <div className="zones">
      <form className="inline-add" onSubmit={(e) => { e.preventDefault(); run(() => api.createZone({ name }), `${name} added.`).then(() => setName('')); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New zone, e.g. Main gate" aria-label="New zone name" required maxLength={60} />
        <button className="btn btn--primary">Add zone</button>
      </form>
      <ul className="spots">
        {zones.map((z) => (
          <li key={z.id} className="zone-row">
            {editing?.id === z.id ? (
              <form className="inline-add" onSubmit={(e) => { e.preventDefault(); run(() => api.updateZone(z.id, { name: editing.name }), 'Zone renamed.').then(() => setEditing(null)); }}>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus aria-label="Zone name" required maxLength={60} />
                <button className="icon-btn" aria-label="Save"><Check size={16} /></button>
                <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => setEditing(null)}><X size={16} /></button>
              </form>
            ) : (
              <>
                <span><b>{z.name}</b><small className="muted"> {z.total} spots, {z.available} free</small></span>
                <span className="row">
                  <button className="icon-btn" aria-label={`Rename ${z.name}`} onClick={() => setEditing({ id: z.id, name: z.name })}><Pencil size={15} /></button>
                  <button className="icon-btn" aria-label={`Delete ${z.name}`} onClick={() => window.confirm(`Delete zone ${z.name}? Its spots stay on the map with no zone.`) && run(() => api.deleteZone(z.id), 'Zone deleted.')}><Trash2 size={15} /></button>
                </span>
              </>
            )}
          </li>
        ))}
        {!zones.length && <li className="list-empty">No zones yet. Zones are optional groups like “Main gate” or “Library lot”.</li>}
      </ul>
    </div>
  );
}

function AdminBookings({ refresh }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const load = () => api.allBookings().then(setRows).catch((e) => toast(errMsg(e), 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const active = useMemo(() => (rows || []).filter((b) => b.status === 'Active'), [rows]);
  const release = async (b) => {
    try { await api.endBooking(b.id, 'cancel'); toast(`${b.slotName} released.`); await load(); await refresh(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  if (!rows) return <p className="list-empty">Loading…</p>;
  return (
    <ul className="spots">
      {active.map((b) => (
        <li key={b.id} className="zone-row">
          <span><b>{b.slotName}</b> <small className="muted">{b.studentName} ({b.studentId}) · {b.vehicleNo} · {fmtDate(b.bookedAt)}</small></span>
          <button className="btn btn--small" onClick={() => release(b)}>Release</button>
        </li>
      ))}
      {!active.length && <li className="list-empty">No active bookings right now.</li>}
    </ul>
  );
}
