import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';

export default function AirlineManagement() {
  const state = useAdminData('/api/airlines');
  const [query, setQuery] = useState('');
  const rows = state.data.filter(row => `${row.flightName} ${row.flightCode}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [
    { key: 'index', label: '#', render: (_, index) => String(index + 1).padStart(2, '0') },
    { key: 'flightName', label: 'Airline', render: row => <span className="admin-cell-title"><span className="admin-airline-mark">{row.flightCode || '✈'}</span><strong>{row.flightName}</strong></span> },
    { key: 'flightCode', label: 'Airline code', render: row => <span className="admin-badge">{row.flightCode}</span> },
    { key: 'flights', label: 'Flights', render: row => row.flights?.length || 0 },
    { key: 'actions', label: 'Manage', render: row => <div className="admin-row-actions"><Link className="admin-text-link" to="/admin/viewflt" state={{ flightCode: row.flightCode }}>View flights ↗</Link><Link className="admin-button small secondary" to="/admin/addflt" state={{ ...row, flights: row.flights || [] }}>+ Add flight</Link></div> },
  ];
  return <><PageHeading title="Airlines" description="Manage your airline partners and their flight networks." action={<Link className="admin-button" to="/admin/addairline">+ Add airline</Link>} /><DataTable {...state} rows={rows} columns={columns} query={query} onQuery={setQuery} searchLabel="Search airline name or code" empty="No airlines added yet" /></>;
}
