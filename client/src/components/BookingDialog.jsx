import { useState } from 'react';
import Dialog from './Dialog';
import Segmented from './Segmented';
import { api, errMsg } from '../api';
import { useToast } from './Toast';

const LAST_KEY = 'parkease.vehicle';
const loadLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY)) || {}; } catch { return {}; } };

export default function BookingDialog({ slot, onClose, onDone }) {
  const toast = useToast();
  const last = loadLast();
  const forced = slot.vehicleType !== 'Any' ? slot.vehicleType : null;
  const [vehicleNo, setVehicleNo] = useState(last.vehicleNo || '');
  const [vehicleType, setVehicleType] = useState(forced || last.vehicleType || 'Four-wheeler');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.book({ slotId: slot.id, vehicleNo, vehicleType });
      localStorage.setItem(LAST_KEY, JSON.stringify({ vehicleNo, vehicleType }));
      toast(`${slot.name} is yours. Park safe.`);
      onDone();
    } catch (err) {
      setError(errMsg(err));
      onDone(true); // refresh, the spot may have just been taken
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={`Book ${slot.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Vehicle number</span>
          <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. HR 29 AB 1234" autoFocus required maxLength={20} />
        </label>
        <div className="field">
          <span>Vehicle type</span>
          <Segmented
            label="Vehicle type" value={vehicleType} onChange={setVehicleType}
            options={[{ value: 'Two-wheeler', label: 'Two-wheeler' }, { value: 'Four-wheeler', label: 'Four-wheeler' }]}
            disabled={forced ? { [forced === 'Two-wheeler' ? 'Four-wheeler' : 'Two-wheeler']: `${slot.name} is only for ${forced.toLowerCase()}s` } : {}}
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Not now</button>
          <button className="btn btn--primary" disabled={busy}>{busy ? 'Booking…' : `Book ${slot.name}`}</button>
        </div>
      </form>
    </Dialog>
  );
}
