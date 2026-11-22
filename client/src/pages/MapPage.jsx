import { useMemo, useState } from 'react';
import { ArrowLeft, Bike, Car, LocateFixed } from 'lucide-react';
import MapView from '../components/MapView';
import SpotList from '../components/SpotList';
import BookingDialog from '../components/BookingDialog';
import { statusText } from '../utils';

export default function MapPage({ slots, zones, myBooking, onEnd, refresh, flyTarget, setFlyTarget }) {
  const [selectedId, setSelectedId] = useState(null);
  const [booking, setBooking] = useState(null);

  const selected = slots.find((s) => s.id === selectedId) || null;
  const free = slots.filter((s) => s.status === 'Available').length;
  const closed = slots.filter((s) => s.status === 'Maintenance').length;

  const select = (id) => {
    setSelectedId(id);
    const s = slots.find((x) => x.id === id);
    if (s) setFlyTarget({ lat: s.lat, lng: s.lng, k: Date.now() });
  };
  const mySlot = useMemo(() => slots.find((s) => s.id === myBooking?.slotId), [slots, myBooking]);

  return (
    <div className="stage">
      <MapView slots={slots} selectedId={selectedId} onSelect={select} flyTarget={flyTarget} />

      <aside className="dock" aria-label="Parking spots">
        {selected ? (
          <SpotDetail
            spot={selected} myBooking={myBooking}
            onBack={() => setSelectedId(null)}
            onBook={() => setBooking(selected)}
            onEnd={onEnd}
          />
        ) : (
          <>
            <div className="dock__head">
              <h1 className="summary"><b>{free}</b> {free === 1 ? 'spot' : 'spots'} free <span>of {slots.length}{closed ? `, ${closed} closed` : ''}</span></h1>
              {slots.length > 0 && (
                <div className="meter" aria-hidden><i style={{ width: `${(free / slots.length) * 100}%` }} /></div>
              )}
              {mySlot && (
                <button className="btn btn--yellow btn--block" onClick={() => select(mySlot.id)}>
                  <LocateFixed size={16} aria-hidden /> Find my car at {mySlot.name}
                </button>
              )}
            </div>
            <SpotList
              slots={slots} zones={zones} selectedId={selectedId} onSelect={select}
              empty="No spots have been placed on the map yet. An admin can add them under Manage spots."
            />
          </>
        )}
      </aside>

      {booking && (
        <BookingDialog
          slot={booking}
          onClose={() => setBooking(null)}
          onDone={async (failed) => { await refresh(); if (!failed) { setBooking(null); } }}
        />
      )}
    </div>
  );
}

function SpotDetail({ spot, myBooking, onBack, onBook, onEnd }) {
  const mine = spot.mine && myBooking?.slotId === spot.id;
  const Icon = spot.vehicleType === 'Two-wheeler' ? Bike : Car;
  return (
    <div className="detail">
      <button className="back" onClick={onBack}><ArrowLeft size={16} aria-hidden /> All spots</button>
      <div className={`plate plate--${mine ? 'mine' : spot.status.toLowerCase()}`}>{spot.name}</div>
      <p className="detail__status">{statusText(spot)}</p>
      <dl className="facts">
        <div><dt>Zone</dt><dd>{spot.zoneName || 'None'}</dd></div>
        <div><dt>Fits</dt><dd><Icon size={15} aria-hidden /> {spot.vehicleType === 'Any' ? 'Any vehicle' : `${spot.vehicleType}s only`}</dd></div>
      </dl>

      {mine ? (
        <div className="stack">
          <button className="btn btn--primary btn--block" onClick={() => onEnd(myBooking, 'complete')}>I have left this spot</button>
          <button className="btn btn--block" onClick={() => onEnd(myBooking, 'cancel')}>Cancel booking</button>
        </div>
      ) : spot.status === 'Available' ? (
        myBooking ? (
          <p className="note">You are already parked at {myBooking.slotName}. Leave or cancel that booking to book another spot.</p>
        ) : (
          <button className="btn btn--primary btn--block" onClick={onBook}>Book {spot.name}</button>
        )
      ) : spot.status === 'Booked' ? (
        <p className="note">Someone else has this spot. Pick a green one.</p>
      ) : (
        <p className="note">This spot is closed for maintenance.</p>
      )}
    </div>
  );
}
