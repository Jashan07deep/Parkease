import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errMsg, hasAdminToken, hasStudentToken, setAdminToken, setSessionExpiredHandler, setStudentToken } from './api';
import TopBar from './components/TopBar';
import AuthScreen from './components/AuthScreen';
import { useToast } from './components/Toast';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import BookingsPage from './pages/BookingsPage';
import ProfilePage from './pages/ProfilePage';
import ManagePage from './pages/ManagePage';

export default function App() {
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const [booting, setBooting] = useState(hasStudentToken()); // true while we check a saved session
  const [tab, setTab] = useState('home');
  const [admin, setAdmin] = useState(false);
  const [zones, setZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [apiUp, setApiUp] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const signedOut = useCallback(() => { setStudentToken(''); setStudent(null); setBookings([]); setSlots([]); setTab('home'); }, []);

  // restore a saved session
  useEffect(() => {
    setSessionExpiredHandler(() => { signedOut(); toast('Your session ended. Please sign in again.', 'error'); });
    if (!hasStudentToken()) return;
    api.me().then(setStudent).catch(() => setStudentToken('')).finally(() => setBooting(false));
    if (hasAdminToken()) api.adminSession().then((r) => { if (r.admin) setAdmin(true); else setAdminToken(''); }).catch(() => {});
  }, [signedOut, toast]);

  const refresh = useCallback(async () => {
    if (!student) return;
    try {
      const [z, s, b] = await Promise.all([api.zones(), api.slots(), api.bookings()]);
      setZones(z); setSlots(s); setBookings(b); setApiUp(true);
    } catch (e) { if (!e.response) setApiUp(false); }
  }, [student]);

  useEffect(() => {
    if (!student) return;
    refresh();
    const t = setInterval(refresh, 15000); // keep availability live
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [student, refresh]);

  const signIn = (token, s) => { setStudentToken(token); setStudent(s); };
  const signOut = async () => { try { await api.logout(); } catch { /* token may already be gone */ } signedOut(); };

  const active = useMemo(() => bookings.find((b) => b.status === 'Active') || null, [bookings]);

  const endBooking = async (b, kind) => {
    try {
      await api.endBooking(b.id, kind);
      toast(kind === 'complete' ? `${b.slotName} is free again. Thanks.` : `Booking for ${b.slotName} cancelled.`);
      await refresh();
    } catch (e) { toast(errMsg(e), 'error'); await refresh(); }
  };

  const showSpot = (b) => {
    const s = slots.find((x) => x.id === b.slotId);
    if (s) setFlyTarget({ lat: s.lat, lng: s.lng, k: Date.now() });
    setTab('map');
  };

  if (booting) return <div className="splash"><span className="brand__sign" aria-hidden>P</span></div>;
  if (!student) return <AuthScreen onSignedIn={signIn} />;

  return (
    <div className="app">
      <TopBar tab={tab} setTab={setTab} student={student} activeCount={active ? 1 : 0} apiUp={apiUp} />
      {tab === 'home' && (
        <HomePage student={student} slots={slots} zones={zones} myBooking={active} onEnd={endBooking}
          refresh={refresh} go={setTab} showSpot={showSpot} />
      )}
      {tab === 'map' && (
        <MapPage slots={slots} zones={zones} myBooking={active} onEnd={endBooking}
          refresh={refresh} flyTarget={flyTarget} setFlyTarget={setFlyTarget} />
      )}
      {tab === 'manage' && (
        <ManagePage admin={admin} setAdmin={setAdmin} slots={slots} zones={zones} refresh={refresh}
          flyTarget={flyTarget} setFlyTarget={setFlyTarget} />
      )}
      {tab === 'bookings' && <BookingsPage bookings={bookings} active={active} onEnd={endBooking} onShow={showSpot} />}
      {tab === 'profile' && <ProfilePage student={student} bookings={bookings} onSaved={setStudent} onSignOut={signOut} />}
    </div>
  );
}
