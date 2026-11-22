import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { statusText } from '../utils';

export default function SpotList({ slots, zones, selectedId, onSelect, empty }) {
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('all');
  const [freeOnly, setFreeOnly] = useState(false);

  const shown = useMemo(() => slots.filter((s) =>
    (zone === 'all' || (zone === 'none' ? !s.zoneId : s.zoneId === zone)) &&
    (!freeOnly || s.status === 'Available') &&
    s.name.toLowerCase().includes(q.trim().toLowerCase())), [slots, q, zone, freeOnly]);

  const hasUnzoned = slots.some((s) => !s.zoneId);

  return (
    <>
      <div className="filters">
        <label className="search">
          <Search size={16} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a spot by name" aria-label="Find a spot by name" />
        </label>
        <div className="chips" role="group" aria-label="Filter by zone">
          <button className={`chip${zone === 'all' ? ' is-on' : ''}`} onClick={() => setZone('all')}>All</button>
          {zones.map((z) => (
            <button key={z.id} className={`chip${zone === z.id ? ' is-on' : ''}`} onClick={() => setZone(z.id)}>{z.name}</button>
          ))}
          {hasUnzoned && zones.length > 0 && (
            <button className={`chip${zone === 'none' ? ' is-on' : ''}`} onClick={() => setZone('none')}>No zone</button>
          )}
          <button className={`chip chip--toggle${freeOnly ? ' is-on' : ''}`} aria-pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>Free only</button>
        </div>
      </div>

      <ul className="spots">
        {shown.map((s) => (
          <li key={s.id}>
            <button className={`spot-row${s.id === selectedId ? ' is-on' : ''}`} onClick={() => onSelect(s.id)}>
              <span className={`dot dot--${s.mine ? 'mine' : s.status.toLowerCase()}`} aria-hidden />
              <span className="spot-row__name">{s.name}</span>
              <span className="spot-row__meta">{s.zoneName || 'No zone'}{s.vehicleType !== 'Any' ? ` · ${s.vehicleType}` : ''}</span>
              <span className="spot-row__status">{statusText(s)}</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="list-empty">{slots.length ? 'No spots match those filters.' : empty}</li>}
      </ul>
    </>
  );
}
