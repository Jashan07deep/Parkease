import { MapPin } from 'lucide-react';
import { fmtDate } from '../utils';

export default function BookingsPage({ bookings, active, onEnd, onShow }) {
  const history = bookings.filter((b) => b.status !== 'Active');
  return (
    <main className="page">
      <h1>My booking</h1>

      {active ? (
        <section className="current">
          <div className="plate plate--mine plate--lg">{active.slotName}</div>
          <div className="current__info">
            <p className="current__title">You are parked{active.zoneName ? ` in ${active.zoneName}` : ''}</p>
            <p className="muted">{active.vehicleNo} · {active.vehicleType} · since {fmtDate(active.bookedAt)}</p>
            <div className="row">
              <button className="btn" onClick={() => onShow(active)}><MapPin size={16} aria-hidden /> Show on map</button>
              <button className="btn btn--primary" onClick={() => onEnd(active, 'complete')}>I have left</button>
              <button className="btn" onClick={() => onEnd(active, 'cancel')}>Cancel booking</button>
            </div>
          </div>
        </section>
      ) : (
        <section className="current current--none">
          <p className="current__title">No spot booked</p>
          <p className="muted">Pick a green spot on the map to reserve it. You can hold one spot at a time.</p>
        </section>
      )}

      <h2>History</h2>
      {history.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Spot</th><th>Vehicle</th><th>Booked</th><th>Ended</th><th>Result</th></tr></thead>
            <tbody>
              {history.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.slotName}</b></td>
                  <td>{b.vehicleNo}</td>
                  <td>{fmtDate(b.bookedAt)}</td>
                  <td>{fmtDate(b.endedAt)}</td>
                  <td><span className={`tag tag--${b.status.toLowerCase()}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">Nothing here yet.</p>}
    </main>
  );
}
