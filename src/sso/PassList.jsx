import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable, MissingSelection } from '../components/AdminUI';
import { formatDateTime } from './adminUtils';

export default function PassList() {
  const { state: flight } = useLocation();
  const bookings = useAdminData('/bookings');
  const [query, setQuery] = useState('');
  if (!flight?.flightNumber) return <MissingSelection to="/admin/scheduled" label="flight schedules" />;
  const rows = bookings.data.filter(row => row.data?.flightNumber === flight.flightNumber && row.data?.departureTime === flight.departureTime).flatMap(row => (row.formData || []).map(passenger => ({ ...passenger, seat: row.data.seat }))).filter(row => `${row.firstName} ${row.lastName} ${row.mobile}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [{ key: 'index', label: '#', render: (_, index) => index + 1 }, { key: 'name', label: 'Passenger', render: row => <strong>{[row.title, row.firstName, row.lastName].filter(Boolean).join(' ')}</strong> }, { key: 'dob', label: 'Date of birth' }, { key: 'gender', label: 'Gender' }, { key: 'mobile', label: 'Phone' }, { key: 'seat', label: 'Cabin' }];
  return <><PageHeading title="Passenger manifest" description={`${flight.flightName || ''} · ${flight.flightNumber}`} action={<Link className="admin-button secondary" to="/admin/scheduled">← Flight schedules</Link>} /><section className="admin-panel admin-detail-strip"><div><small>Route</small><strong>{flight.originAirport} → {flight.destinationAirport}</strong></div><div><small>Departure</small><strong>{formatDateTime(flight.newdepTime || flight.departureTime)}</strong></div><div><small>Arrival</small><strong>{formatDateTime(flight.newarrTime || flight.arrivalTime)}</strong></div></section><DataTable {...bookings} columns={columns} rows={rows} query={query} onQuery={setQuery} searchLabel="Search passenger name or phone" empty="No passengers booked on this flight" /></>;
}
