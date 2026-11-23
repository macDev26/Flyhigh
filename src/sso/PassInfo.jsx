import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageHeading, DataTable, MissingSelection } from '../components/AdminUI';
import { formatDateTime } from './adminUtils';

export default function PassInfo() {
  const { state } = useLocation();
  const [query, setQuery] = useState('');
  if (!state?.data) return <MissingSelection to="/admin/bookings" label="bookings" />;
  const flight = state.data;
  const rows = (state.formData || []).filter(row => `${row.firstName} ${row.lastName} ${row.mobile}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [{ key: 'name', label: 'Passenger', render: row => <strong>{[row.title, row.firstName, row.lastName].filter(Boolean).join(' ')}</strong> }, { key: 'dob', label: 'Date of birth' }, { key: 'gender', label: 'Gender' }, { key: 'mobile', label: 'Phone' }, { key: 'seat', label: 'Cabin', render: () => flight.seat || '—' }];
  return <><PageHeading title="Booking passengers" description={`${flight.flightName || ''} · ${flight.flightNumber || ''}`} action={<Link className="admin-button secondary" to="/admin/bookings">← All bookings</Link>} /><section className="admin-panel admin-detail-strip"><div><small>Route</small><strong>{flight.originAirport} → {flight.destinationAirport}</strong></div><div><small>Departure</small><strong>{formatDateTime(flight.departureTime)}</strong></div><div><small>Arrival</small><strong>{formatDateTime(flight.arrivalTime)}</strong></div></section><DataTable columns={columns} rows={rows} query={query} onQuery={setQuery} searchLabel="Search passenger name or phone" empty="No passengers in this booking" /></>;
}
