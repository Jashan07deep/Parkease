import { CalendarClock, House, MapPinned, SlidersHorizontal } from 'lucide-react';
import { initialsOf } from '../utils';

const TABS = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'map', label: 'Map', icon: MapPinned },
  { id: 'bookings', label: 'My booking', icon: CalendarClock },
  { id: 'manage', label: 'Manage spots', icon: SlidersHorizontal },
];

export default function TopBar({ tab, setTab, student, activeCount, apiUp }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => setTab('home')} aria-label="ParkEase home">
        <span className="brand__sign" aria-hidden>P</span>
        <span className="brand__name">ParkEase</span>
      </button>
      <nav className="tabs" aria-label="Main">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={18} aria-hidden />
            <span>{label}</span>
            {id === 'bookings' && activeCount > 0 && <i className="tab__badge" aria-label="active booking" />}
          </button>
        ))}
      </nav>
      <div className="topbar__right">
        {apiUp === false && <span className="offline">Server offline</span>}
        <button className={`me${tab === 'profile' ? ' is-on' : ''}`} onClick={() => setTab('profile')} aria-label="Your profile">
          <span className="me__avatar">{initialsOf(student.fullName)}</span>
          <span className="me__name">{student.fullName.split(' ')[0]}</span>
        </button>
      </div>
    </header>
  );
}
