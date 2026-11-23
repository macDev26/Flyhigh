import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';
import { formatDateTime, money } from './adminUtils';

export default function Bookings() {
  const state = useAdminData('/bookings');
  const [query, setQuery] = useState('');
  const rows = state.data.filter(row => `${row.email} ${row.data?.flightNumber} ${row._id}`.toLowerCase().includes(query.toLowerCase()));
  function exportBookings() {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'" + '$&').replaceAll('"', '""') + '"';
    const csv = [['Email', 'Flight', 'Booked on', 'Passengers', 'Total paid', 'Seat class'], ...rows.map(row => [row.email, row.data?.flightNumber, row.time, row.data?.passengers, Number(row.data?.price || 0) * Number(row.data?.passengers || 0), row.data?.seat])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'flyhigh-bookings.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const columns = [
    { key: 'email', label: 'Traveler' },
    { key: 'payment', label: 'Payment', render: row => <span className={`admin-badge ${row.payment?.status === 'paid' ? 'success' : ''}`}>{row.payment?.status === 'paid' ? 'Test paid' : 'Legacy demo'}</span> },
    { key: 'flight', label: 'Flight', render: row => <strong>{row.data?.flightNumber || '—'}</strong> },
    { key: 'time', label: 'Booked on', render: row => formatDateTime(row.time) },
    { key: 'passengers', label: 'Passengers', render: row => row.data?.passengers ?? '—' },
    { key: 'paid', label: 'Total paid', render: row => money(Number(row.data?.price || 0) * Number(row.data?.passengers || 0)) },
    { key: 'seat', label: 'Cabin', render: row => <span className="admin-badge">{row.data?.seat || '—'}</span> },
    { key: 'actions', label: 'Details', render: row => <Link className="admin-text-link" to="/admin/passinfo" state={{ data: row.data, formData: row.formData || [] }}>Passengers ↗</Link> },
  ];
  return <><PageHeading title="Bookings" description="A clear view of your reservations and passenger details." action={<button className="admin-button secondary" disabled={state.loading || !!state.error || !rows.length} onClick={exportBookings}>Export CSV ↓</button>} /><DataTable {...state} rows={rows} columns={columns} query={query} onQuery={setQuery} searchLabel="Search email, flight or booking ID" empty="No bookings yet" /></>;
}
