import { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

const API = 'http://localhost:5000/api';

const TITLES = {
  overview: ['Good morning, Student ✦', '50 Right & 50 Left slots from university gate to main road.'],
  map: ['Live Campus Parking Map', 'View Right and Left side parking spots from gate to main road.'],
  parking: ['Right & Left Parking Slots', 'Booked slots become unavailable for other students.'],
  booking: ['Book a parking slot', 'Select Right or Left side and pick an available slot.'],
  'my-bookings': ['My bookings', 'Your live MySQL parking reservations.'],
  profile: ['My profile', 'Manage your student account details.']
};

function MapFlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 19, { duration: 1.1 });
  }, [coords, map]);
  return null;
}

export default function App() {
  const [view, setView] = useState('overview');
  const [areas, setAreas] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [flyCoords, setFlyCoords] = useState(null);

  const [studentId, setStudentId] = useState('24CSE1024');
  const [vehicleNumber, setVehicleNumber] = useState('HR 29 AB 1234');
  const [vehicleType, setVehicleType] = useState('Two-wheeler');
  const [selectedSide, setSelectedSide] = useState('Right');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [formMsg, setFormMsg] = useState('');

  const [profile, setProfile] = useState({
    name: 'Student User',
    studentId: '24CSE1024',
    department: 'Computer Science',
    email: 'student@university.edu'
  });
  const [profileMsg, setProfileMsg] = useState('');

  const loadDatabase = async () => {
    try {
      const [areasRes, slotsRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/areas`),
        axios.get(`${API}/slots`),
        axios.get(`${API}/bookings`)
      ]);
      setAreas(areasRes.data);
      setSlots(slotsRes.data);
      setBookings(bookingsRes.data);
    } catch (err) {
      console.error('MySQL API error:', err);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  const availableSlotsForSide = slots.filter(
    s => s.side === selectedSide && s.status === 'Available'
  );

  useEffect(() => {
    if (availableSlotsForSide.length > 0) {
      if (!availableSlotsForSide.some(s => s.slot_id === selectedSlot)) {
        setSelectedSlot(availableSlotsForSide[0].slot_id);
      }
    } else {
      setSelectedSlot('');
    }
  }, [selectedSide, slots]);

  const submitBooking = async (slotIdToBook) => {
    if (!studentId.trim() || !vehicleNumber.trim()) {
      return setFormMsg('Please enter Student ID and Vehicle Number.');
    }
    if (!slotIdToBook) {
      return setFormMsg(`No available slots on ${selectedSide} side.`);
    }
    try {
      const res = await axios.post(`${API}/bookings`, {
        student_id: studentId.trim(),
        vehicle_no: vehicleNumber.trim().toUpperCase(),
        vehicle_type: vehicleType,
        slot_id: slotIdToBook
      });
      setFormMsg(res.data.message);
      await loadDatabase();
      setView('my-bookings');
    } catch (err) {
      const msg = err.response?.data?.error || 'Booking failed';
      setFormMsg(msg);
      alert(msg);
      await loadDatabase();
    }
  };

  const handleBookForm = async (e) => {
    e.preventDefault();
    await submitBooking(selectedSlot);
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await axios.post(`${API}/bookings/cancel`, { booking_id: bookingId });
      await loadDatabase();
    } catch (err) {
      alert('Failed to cancel booking');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/profile`, {
        student_id: profile.studentId,
        full_name: profile.name,
        department: profile.department,
        email: profile.email
      });
      setStudentId(profile.studentId);
      setProfileMsg(res.data.message);
    } catch (err) {
      setProfileMsg('Error saving profile');
    }
  };

  const locateMyParkedSpot = () => {
    const myActive = bookings.find(b => b.status === 'Active' && b.student === studentId);
    if (!myActive) return alert('No active reservation found for ' + studentId);
    const slotInfo = slots.find(s => s.slot_id === myActive.slot);
    if (slotInfo) {
      setView('map');
      setFlyCoords([slotInfo.latitude, slotInfo.longitude]);
    }
  };

  const totalSpaces = areas.reduce((sum, a) => sum + Number(a.total || 0), 0);
  const availableSpaces = areas.reduce((sum, a) => sum + Number(a.available || 0), 0);
  const bookedSpaces = areas.reduce((sum, a) => sum + Number(a.booked || 0), 0);
  const activeBookingsCount = bookings.filter(b => b.status === 'Active').length;
  const initials = profile.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'JS';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => setView('overview')}>
          <span className="brand-icon">P</span>
          <span>ParkEase</span>
        </div>
        <div className="campus-label">CAMPUS SERVICES</div>
        <nav>
          <button className={`nav-link ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>
            <span>▦</span> Overview
          </button>
          <button className={`nav-link ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
            <span>⌖</span> Live Campus Map
          </button>
          <button className={`nav-link ${view === 'parking' ? 'active' : ''}`} onClick={() => setView('parking')}>
            <span>▤</span> Right & Left Slots
          </button>
          <button className={`nav-link ${view === 'booking' ? 'active' : ''}`} onClick={() => setView('booking')}>
            <span>＋</span> Book a slot
          </button>
          <button className={`nav-link ${view === 'my-bookings' ? 'active' : ''}`} onClick={() => setView('my-bookings')}>
            <span>◷</span> My bookings
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <b>Need help?</b>
            <p>Contact campus security for parking assistance.</p>
            <a href="mailto:parking@university.edu">Get support ↗</a>
          </div>
          <button className="profile-button" onClick={() => setView('profile')}>
            <div className="avatar">{initials}</div>
            <span>
              <b>{profile.name}</b>
              <small>{profile.studentId || 'Student account'}</small>
            </span>
            <span className="dots">•••</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">CAMPUS PARKING</div>
            <h1>{TITLES[view][0]}</h1>
            <p className="muted">{TITLES[view][1]}</p>
          </div>
          <div className="top-actions">
            <span className="live"><i></i> MySQL Connected</span>
            <button className="avatar" onClick={() => setView('profile')}>{initials}</button>
          </div>
        </header>

        {view === 'overview' && (
          <section>
            <div className="stats">
              <article className="stat-card">
                <div className="stat-top"><span>Total spaces</span><span className="stat-icon blue">▦</span></div>
                <strong>{totalSpaces}</strong>
                <small>50 Right · 50 Left (Gate to Road)</small>
              </article>
              <article className="stat-card">
                <div className="stat-top"><span>Available now</span><span className="stat-icon green">✓</span></div>
                <strong className="green-text">{availableSpaces}</strong>
                <small>Open for booking</small>
              </article>
              <article className="stat-card">
                <div className="stat-top"><span>Booked / Unavailable</span><span className="stat-icon orange">↗</span></div>
                <strong>{bookedSpaces}</strong>
                <small>Locked for other students</small>
              </article>
              <article className="stat-card">
                <div className="stat-top"><span>My active bookings</span><span className="stat-icon purple">◷</span></div>
                <strong>{activeBookingsCount}</strong>
                <small>Saved in MySQL</small>
              </article>
            </div>

            <div className="content-grid">
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">GATE TO MAIN ROAD</div>
                    <h2>Right & Left side parking</h2>
                    <p className="muted">Viewed from university gate toward the main road.</p>
                  </div>
                  <button className="text-btn" onClick={() => setView('parking')}>View all 100 slots →</button>
                </div>
                <div className="area-list">
                  {areas.map(a => (
                    <div className="area-card" key={a.id}>
                      <div>
                        <div className="area-name">{a.name}</div>
                        <div className="area-sub">{a.location}</div>
                      </div>
                      <div className="area-right">
                        <b>{a.available}</b>
                        <small>of {a.total} free</small>
                      </div>
                      <div className="progress">
                        <span style={{ width: `${a.total ? (a.available / a.total) * 100 : 0}%` }}></span>
                      </div>
                      <div className="area-foot">
                        <span>{a.booked} booked (unavailable)</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="mini-book"
                            onClick={() => { setFlyCoords([a.latitude, a.longitude]); setView('map'); }}
                          >
                            View on Map
                          </button>
                          <button
                            className="mini-book"
                            onClick={() => { setSelectedSide(a.id === 'R' ? 'Right' : 'Left'); setView('booking'); }}
                          >
                            Book here →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel overview-book">
                <div className="eyebrow">QUICK ACTION</div>
                <h2>Ready to park?</h2>
                <p className="muted">Reserve a Right or Left slot before another student takes it.</p>
                <div className="quick-illustration">P</div>
                <button className="primary-btn" onClick={() => setView('booking')}>Book a parking slot →</button>
                <button className="secondary-btn" onClick={locateMyParkedSpot}>Find My Parked Vehicle</button>
              </div>
            </div>
          </section>
        )}

        {view === 'map' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">GATE TO MAIN ROAD MAP</div>
                <h2>Campus Parking Spot Map</h2>
                <p className="muted">Green = Available, Purple = Booked (unavailable for other students).</p>
              </div>
            </div>

            <div className="map-toolbar">
              {areas.map(a => (
                <button key={a.id} className="map-btn" onClick={() => setFlyCoords([a.latitude, a.longitude])}>
                  Zoom: {a.name}
                </button>
              ))}
              <button className="map-btn" onClick={locateMyParkedSpot}>Find My Parked Car</button>
            </div>

            <div className="map-box">
              <MapContainer center={[28.2488, 77.06347]} zoom={18} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  maxZoom={21}
                  attribution="&copy; Google Maps"
                />
                <MapFlyTo coords={flyCoords} />

                {slots.map(s => {
                  const isAvailable = s.status === 'Available';
                  const color = isAvailable ? '#15966a' : '#8061ce';
                  return (
                    <CircleMarker
                      key={s.slot_id}
                      center={[s.latitude, s.longitude]}
                      radius={8}
                      pathOptions={{ fillColor: color, color: '#ffffff', weight: 1.5, fillOpacity: 0.92 }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '165px' }}>
                          <strong>Slot {s.slot_id}</strong> ({s.side} Side)<br />
                          <span style={{ fontSize: '12px' }}>
                            Status: <b>{isAvailable ? 'Available' : 'Booked (Unavailable)'}</b>
                          </span>
                          {isAvailable ? (
                            <button
                              className="primary-btn"
                              style={{ height: '30px', marginTop: '8px', fontSize: '11px' }}
                              onClick={() => submitBooking(s.slot_id)}
                            >
                              Book {s.slot_id}
                            </button>
                          ) : (
                            <div style={{ fontSize: '11px', marginTop: '5px' }}>
                              Student: <b>{s.student_id || 'Taken'}</b>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </section>
        )}

        {view === 'parking' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">100 TOTAL SLOTS</div>
                <h2>Right Side (50) & Left Side (50)</h2>
                <p className="muted">Viewed from university gate to main road. Booked slots cannot be booked again.</p>
              </div>
            </div>

            <div className="area-list">
              {areas.map(a => (
                <div className="area-card" key={a.id} style={{ padding: '18px' }}>
                  <div>
                    <div className="area-name">{a.name}</div>
                    <div className="area-sub">{a.available} available · {a.booked} booked</div>
                  </div>
                  <div className="area-right">
                    <b>{a.available}</b>
                    <small>of {a.total} free</small>
                  </div>

                  <div className="slot-grid" style={{ gridColumn: '1 / -1' }}>
                    {slots.filter(s => s.area_id === a.id).map(s => {
                      const isAvailable = s.status === 'Available';
                      return (
                        <div
                          key={s.slot_id}
                          className={`slot-box ${isAvailable ? 'Available' : 'Reserved'}`}
                          onClick={() => isAvailable && submitBooking(s.slot_id)}
                        >
                          <strong>{s.slot_id}</strong>
                          <span>{isAvailable ? 'Available (Click)' : 'Unavailable'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === 'booking' && (
          <section className="booking-layout">
            <div className="panel booking-panel">
              <div className="eyebrow">QUICK RESERVATION</div>
              <h2>Book a parking slot</h2>
              <p className="muted">Once booked, the slot becomes unavailable for other students.</p>

              <form onSubmit={handleBookForm}>
                <label>Student ID</label>
                <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. 24CSE1024" required />

                <label>Vehicle number</label>
                <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. HR 29 AB 1234" required />

                <label>Vehicle type</label>
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                  <option>Two-wheeler</option>
                  <option>Four-wheeler</option>
                </select>

                <label>Side (From University Gate to Main Road)</label>
                <select value={selectedSide} onChange={e => setSelectedSide(e.target.value)}>
                  <option value="Right">Right Side (R-01 to R-50)</option>
                  <option value="Left">Left Side (L-01 to L-50)</option>
                </select>

                <label>Available slot</label>
                <select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} required>
                  {availableSlotsForSide.length > 0 ? (
                    availableSlotsForSide.map(s => (
                      <option key={s.slot_id} value={s.slot_id}>
                        {s.slot_id} ({s.side} Side)
                      </option>
                    ))
                  ) : (
                    <option value="">No available slots on {selectedSide} side</option>
                  )}
                </select>

                <button className="primary-btn" type="submit" disabled={!selectedSlot}>
                  Confirm booking in MySQL →
                </button>
                {formMsg && <div className="form-message">{formMsg}</div>}
              </form>
            </div>

            <div className="panel booking-aside">
              <div className="eyebrow">BOOKING RULE</div>
              <h2>Exclusive slot lock</h2>
              <p>Each slot is locked inside MySQL when booked.</p>
              <ul>
                <li>50 slots on the Right side (gate to main road).</li>
                <li>50 slots on the Left side (gate to main road).</li>
                <li>Booked slots are hidden from available lists for other students.</li>
                <li>Cancelling a booking frees the slot again.</li>
              </ul>
            </div>
          </section>
        )}

        {view === 'my-bookings' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">YOUR ACTIVITY</div>
                <h2>My bookings</h2>
                <p className="muted">Review or cancel your MySQL parking reservations.</p>
              </div>
              <span className="live">{bookings.length} records</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>BOOKING ID</th>
                    <th>STUDENT ID</th>
                    <th>SIDE</th>
                    <th>SLOT</th>
                    <th>VEHICLE</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length > 0 ? (
                    bookings.map(b => (
                      <tr key={b.id}>
                        <td><b>{b.id}</b></td>
                        <td>{b.student}</td>
                        <td>{b.side}</td>
                        <td><b>{b.slot}</b></td>
                        <td>{b.vehicle} ({b.type})</td>
                        <td>
                          <span className={`status ${b.status === 'Cancelled' ? 'cancelled' : ''}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>
                          {b.status === 'Active' ? (
                            <button className="cancel-btn" onClick={() => handleCancelBooking(b.id)}>
                              Cancel & Release
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty">No bookings in MySQL yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="profile-grid">
            <div className="panel profile-card">
              <div className="profile-cover"></div>
              <div className="profile-avatar">{initials}</div>
              <h2>{profile.name}</h2>
              <p className="muted">{profile.department || 'University Student'}</p>
              <span className="profile-tag">STUDENT</span>
              <div className="profile-stats">
                <div><b>{bookings.length}</b><small>Total bookings</small></div>
                <div><b>{activeBookingsCount}</b><small>Active bookings</small></div>
              </div>
            </div>

            <div className="panel profile-details">
              <div className="eyebrow">ACCOUNT SETTINGS</div>
              <h2>My profile</h2>
              <p className="muted">Save your student record into the MySQL students table.</p>

              <form onSubmit={handleSaveProfile}>
                <label>Full name</label>
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required />

                <label>Student ID</label>
                <input value={profile.studentId} onChange={e => setProfile({ ...profile, studentId: e.target.value })} required />

                <label>Department</label>
                <input value={profile.department} onChange={e => setProfile({ ...profile, department: e.target.value })} />

                <label>University email</label>
                <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />

                <button className="primary-btn" type="submit">Save profile to MySQL →</button>
                {profileMsg && <div className="form-message">{profileMsg}</div>}
              </form>
            </div>
          </section>
        )}

        <footer>
          ParkEase · University Parking Management System
          <span>Academic DBMS Project · React + Vite + Node.js + MySQL</span>
        </footer>
      </main>
    </div>
  );
}