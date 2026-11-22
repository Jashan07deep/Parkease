import { useEffect, useMemo, useState } from 'react';
import { api, errMsg } from '../api';
import { useToast } from './Toast';

const lastSevenDays = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i));
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { key, label: d.toLocaleDateString([], { weekday: 'short' }), full: d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }) };
});

export default function StatsPanel({ slots }) {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { api.adminStats().then(setStats).catch((e) => toast(errMsg(e), 'error')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bars = useMemo(() => {
    const byDay = Object.fromEntries((stats?.perDay || []).map((d) => [d.day, d.n]));
    return lastSevenDays().map((d) => ({ ...d, n: byDay[d.key] || 0 }));
  }, [stats]);
  const max = Math.max(1, ...bars.map((b) => b.n));
  const free = slots.filter((s) => s.status === 'Available').length;
  const total = bars.reduce((a, b) => a + b.n, 0);

  if (!stats) return <p className="list-empty">Loading…</p>;
  const tiles = [
    ['Parked now', stats.active], ['Free now', free], ['Booked today', stats.today], ['Students', stats.students],
  ];
  return (
    <div className="stats">
      <div className="tiles">
        {tiles.map(([label, n]) => <div className="tile" key={label}><b>{n}</b><span>{label}</span></div>)}
      </div>

      <h3>Bookings per day</h3>
      <p className="muted small chart-note">{hover ? `${hover.full}: ${hover.n} ${hover.n === 1 ? 'booking' : 'bookings'}` : `${total} in the last 7 days`}</p>
      <div className="bars" role="img" aria-label={`Bookings per day, last 7 days: ${bars.map((b) => `${b.label} ${b.n}`).join(', ')}`}>
        {bars.map((b) => (
          <div key={b.key} className="bars__col" tabIndex={0}
            onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(b)} onBlur={() => setHover(null)}>
            <span className="bars__n">{b.n === max && b.n > 0 ? b.n : ''}</span>
            <i style={{ height: `${(b.n / max) * 100}%` }} className={b.n ? '' : 'is-zero'} />
            <span className="bars__label">{b.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Bookings per day</caption>
        <tbody>{bars.map((b) => <tr key={b.key}><th>{b.full}</th><td>{b.n}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
