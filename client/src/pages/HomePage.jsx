import { useMemo, useState } from 'react';
import { ArrowRight, MapPin, Zap } from 'lucide-react';
import BayStrip from '../components/BayStrip';
import BookingDialog from '../components/BookingDialog';
import { fmtDate } from '../utils';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function HomePage({ student, slots, zones, myBooking, onEnd, refresh, go, showSpot }) {
  const [booking, setBooking] = useState(null);

  const free = slots.filter((s) => s.status === 'Available').length;
  const groups = useMemo(() => {
    const g = zones.map((z) => ({ id: z.id, name: z.name, description: z.description, slots: slots.filter((s) => s.zoneId === z.id) }));
    const loose = slots.filter((s) => !s.zoneId);
    if (loose.length) g.push({ id: 'none', name: zones.length ? 'Other spots' : 'All spots', slots: loose });
    return g.filter((x) => x.slots.length);
  }, [zones, slots]);

  const firstFree = (list) => list.find((s) => s.status === 'Available');

  return (
    <main className="page page--wide">
      <header className="hello">
        <h1>{greeting()}, {student.fullName.split(' ')[0]}.</h1>
        <p className="muted">{slots.length
          ? <><b className="free-count">{free}</b> of {slots.length} spots are free right now.</>
          : 'No spots have been mapped yet.'}</p>
      </header>

      <section className={`hero${myBooking ? ' hero--parked' : ''}`}>
        {myBooking ? (
          <>
            <div className="plate plate--mine plate--lg">{myBooking.slotName}</div>
            <div className="hero__info">
              <h2>You are parked{myBooking.zoneName ? ` in ${myBooking.zoneName}` : ''}</h2>
              <p className="muted">{myBooking.vehicleNo} · since {fmtDate(myBooking.bookedAt)}</p>
              <div className="row">
                <button className="btn btn--yellow" onClick={() => showSpot(myBooking)}><MapPin size={16} aria-hidden /> Find my car</button>
                <button className="btn" onClick={() => onEnd(myBooking, 'complete')}>I have left</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hero__info">
              <h2>Need a spot?</h2>
              <p className="muted">Pick any green bay on the map, or take the first free one.</p>
              <div className="row">
                <button className="btn btn--primary" onClick={() => go('map')}><MapPin size={16} aria-hidden /> Choose on the map</button>
                <button className="btn" disabled={!free} onClick={() => setBooking(firstFree(slots))}><Zap size={16} aria-hidden /> Book first free spot</button>
              </div>
            </div>
            {slots.length > 0 && <BayStrip slots={slots} size="lg" />}
          </>
        )}
      </section>

      {groups.length > 0 && <h2 className="section-title">Availability by zone</h2>}
      <div className="zone-grid">
        {groups.map((g) => {
          const gFree = g.slots.filter((s) => s.status === 'Available').length;
          const target = firstFree(g.slots);
          return (
            <article className="zone-card" key={g.id}>
              <div className="zone-card__head">
                <h3>{g.name}</h3>
                <span className={`zone-card__free${gFree ? '' : ' is-none'}`}><b>{gFree}</b> free</span>
              </div>
              <p className="muted small">{g.description || `${g.slots.length} spots`}</p>
              <BayStrip slots={g.slots} />
              <div className="row zone-card__actions">
                <button className="btn btn--small" onClick={() => showSpot({ slotId: (target || g.slots[0]).id })}>View on map <ArrowRight size={14} aria-hidden /></button>
                {!myBooking && target && <button className="btn btn--small btn--primary" onClick={() => setBooking(target)}>Book {target.name}</button>}
              </div>
            </article>
          );
        })}
      </div>

      {booking && (
        <BookingDialog slot={booking} onClose={() => setBooking(null)}
          onDone={async (failed) => { await refresh(); if (!failed) setBooking(null); }} />
      )}
    </main>
  );
}
