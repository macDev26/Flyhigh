import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlane, faChartLine, faUsers, faPlaneDeparture, faCalendarDays, faTicket, faCommentDots, faUser, faArrowRightFromBracket, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

const items = [
  ['dashboard', 'Overview', faChartLine], ['userinfo', 'Users', faUsers],
  ['fltmanagement', 'Flights & routes', faPlaneDeparture],
  ['scheduled', 'Flight schedules', faCalendarDays], ['bookings', 'Bookings', faTicket], ['feedback', 'Feedback', faCommentDots],
];

export default function AdminMenu({ open, onClose, setUser }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true); setError('');
    try { await setUser(null); navigate('/admin/login', { replace: true }); }
    catch { setError('Unable to log out. Please try again.'); }
    finally { setPending(false); }
  }
  return (
    <aside className={`admin-sidebar ${open ? 'is-open' : ''}`} id="admin-navigation">
      <Link to="/admin/dashboard" className="admin-brand" onClick={onClose}><span className="admin-brand-icon"><FontAwesomeIcon icon={faPlane} /></span>Flyhigh<span className="admin-brand-dot">.</span></Link>
      <div className="admin-workspace-label"><span className="admin-status-dot" /> Administration workspace</div>
      <p className="admin-nav-label">WORKSPACE</p>
      <nav aria-label="Admin navigation">
        {items.map(([path, label, icon]) => <NavLink key={path} to={`/admin/${path}`} onClick={onClose} className={({ isActive }) => `admin-nav-item ${isActive ? 'is-active' : ''}`}><FontAwesomeIcon icon={icon} /><span>{label}</span></NavLink>)}
      </nav>
      <p className="admin-nav-label">ACCOUNT</p>
      <NavLink to="/admin/profile" onClick={onClose} className={({ isActive }) => `admin-nav-item ${isActive ? 'is-active' : ''}`}><FontAwesomeIcon icon={faUser} /><span>My profile</span></NavLink>
      <button onClick={logout} disabled={pending} className="admin-nav-item admin-logout"><FontAwesomeIcon icon={faArrowRightFromBracket} /><span>{pending ? 'Logging out…' : 'Log out'}</span></button>
      {error && <p className="text-xs text-rose-300 px-3" role="alert">{error}</p>}
      <div className="admin-sidebar-bottom"><span>Ready for takeoff.</span><p>Your operations, all in one place.</p><Link to="/">Booking website <FontAwesomeIcon icon={faArrowUpRightFromSquare} /></Link></div>
    </aside>
  );
}
