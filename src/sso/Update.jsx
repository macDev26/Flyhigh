import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';
import { flightStatus, formatDateTime, money } from './adminUtils';

export default function Update() {
  const schedules = useAdminData('/api/flightinfo');
  const routes = useAdminData('/api/flights');
  const [query, setQuery] = useState('');
  const [, setTick] = useState(0);
  useEffect(() => { const timer = setInterval(() => setTick(value => value + 1), 60000); return () => clearInterval(timer); }, []);
  const rows = schedules.data.map(row => ({ ...routes.data.find(route => route.flightNumber === row.flightNumber), ...row })).filter(row => `${row.flightNumber} ${row.flightName} ${row.originAirport} ${row.destinationAirport}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [
    { key: 'flightNumber', label: 'Flight', render: row => <div><strong>{row.flightNumber}</strong><small className="admin-cell-subtitle">{row.flightName}</small></div> },
    { key: 'route', label: 'Route', render: row => <span className="admin-route">{row.originAirport || '—'}<span>→</span>{row.destinationAirport || '—'}</span> },
    { key: 'departure', label: 'Departure', render: row => formatDateTime(row.newdepTime || row.departureTime) },
    { key: 'arrival', label: 'Arrival', render: row => formatDateTime(row.newarrTime || row.arrivalTime) },
    { key: 'seats', label: 'Seats · E / B / F', render: row => ['economy', 'business', 'first'].map(cabin => Math.max(0, Number(row.seatsAvailable?.[cabin]) || 0)).join(' / ') },
    { key: 'prices', label: 'Fares · E / B / F', render: row => ['economy', 'business', 'first'].map(cabin => Number(row.seatsAvailable?.[cabin]) > 0 ? money(row.prices?.[cabin]) : '—').join(' / ') },
    { key: 'status', label: 'Status', render: row => <span className={`admin-badge ${flightStatus(row) === 'Arrived' ? 'success' : 'purple'}`}>{flightStatus(row)}</span> },
    { key: 'actions', label: 'Passengers', render: row => <Link className="admin-text-link" to="/admin/passlist" state={row}>Manifest ↗</Link> },
  ];
  return <><PageHeading title="Flight schedules" description="Track departures, cabin availability and passenger manifests." action={<Link className="admin-button" to="/admin/fltmanagement">+ Schedule a flight</Link>} /><DataTable loading={schedules.loading || routes.loading} error={schedules.error || routes.error} retry={() => { schedules.retry(); routes.retry(); }} rows={rows} columns={columns} query={query} onQuery={setQuery} searchLabel="Search flight, airline or airport" empty="No scheduled flights yet" /></>;
}
