import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faPlaneDeparture, faTicket, faUsers, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';
import { formatDateTime, money } from './adminUtils';

export default function AdminDashboard() {
  const departures = useAdminData('/api/flightinfo');
  const flights = useAdminData('/api/flights');
  const bookings = useAdminData('/bookings');
  const users = useAdminData('/api/users');
  const metrics = [ ['Scheduled departures', departures, faCalendarDays, 'scheduled'], ['Flight routes', flights, faPlaneDeparture, 'fltmanagement'], ['Total bookings', bookings, faTicket, 'bookings'], ['Registered users', users, faUsers, 'userinfo'] ];
  const columns = [ { key: 'email', label: 'Traveler' }, { key: 'flight', label: 'Flight', render: row => <strong>{row.data?.flightNumber || '—'}</strong> }, { key: 'time', label: 'Booked on', render: row => formatDateTime(row.time) }, { key: 'paid', label: 'Amount', render: row => money(Number(row.data?.price || 0) * Number(row.data?.passengers || 0)) } ];
  return <><PageHeading eyebrow="YOUR OPERATIONS AT A GLANCE" title="Welcome to your workspace" description="A clear view of every flight, traveler and reservation." action={<Link className="admin-button" to="/admin/fltmanagement">Manage flights <FontAwesomeIcon icon={faArrowRight} /></Link>} />
    <section className="admin-welcome"><div><span className="admin-eyebrow">LET’S GET YOU AIRBORNE</span><h2>Great journeys start<br />with smooth operations.</h2><p>Manage your network. Keep every journey on course.</p><Link to="/admin/scheduled">View flight schedules <FontAwesomeIcon icon={faArrowRight} /></Link></div><div className="admin-orbit" aria-hidden="true"><span>✈</span><i /><b>FLYHIGH · OPERATIONS</b></div></section>
    <div className="admin-metrics">{metrics.map(([label, state, icon, path]) => <Link key={label} to={`/admin/${path}`} className="admin-metric"><div><span>{label}</span><FontAwesomeIcon icon={icon} /></div><strong>{state.loading ? '…' : state.error ? '—' : state.data.length}</strong><small>{state.error ? 'Unable to load · open to retry' : 'View details ↗'}</small></Link>)}</div>
    <div className="admin-section-heading"><div><h2>Recent bookings</h2><p>The latest reservations across your network.</p></div><Link className="admin-text-link" to="/admin/bookings">View all bookings ↗</Link></div><DataTable {...bookings} columns={columns} rows={[...bookings.data].sort((a, b) => (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0)).slice(0, 5)} empty="Your first booking starts here" />
    <div className="admin-quick-links"><Link to="/admin/fltmanagement"><span>01 / NETWORK</span><h3>Manage the Flyhigh network ↗</h3><p>Manage our routes and connect new destinations.</p></Link><Link to="/admin/feedback"><span>02 / EXPERIENCE</span><h3>Hear from your travelers ↗</h3><p>Review feedback from every journey.</p></Link></div>
  </>;
}
