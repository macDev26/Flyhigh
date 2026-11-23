import { Link, useLocation } from 'react-router-dom';

const titles = { dashboard: 'Overview', userinfo: 'Users', airlinemanagement: 'Airlines', fltmanagement: 'Flights & routes', scheduled: 'Flight schedules', bookings: 'Bookings', feedback: 'Feedback', profile: 'My profile', addairline: 'Add airline', addflt: 'Add flight', scheduleflt: 'Schedule flight', viewflt: 'Airline flights', passinfo: 'Booking passengers', passlist: 'Passenger manifest' };

export default function AdminNav({ user, onMenu, menuOpen }) {
  const { pathname } = useLocation();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';
  return (
    <header className="admin-topbar">
      <div className="admin-breadcrumb"><button className="admin-menu-toggle" onClick={onMenu} aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="admin-navigation">☰</button><span>Workspace</span><span className="admin-crumb-divider">/</span><strong>{titles[pathname.split('/').pop()] || 'Administration'}</strong></div>
      <Link to="/admin/profile" className="admin-account"><span className="admin-avatar">{name.slice(0, 1)}</span><span><strong>{name}</strong><small>Administration</small></span></Link>
    </header>
  );
}
