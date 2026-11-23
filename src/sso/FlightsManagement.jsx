import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';

export default function FlightsManagement() {
  const state = useAdminData('/api/flights');
  const [query, setQuery] = useState('');
  const rows = state.data.filter(row => `${row.flightNumber} ${row.flightName} ${row.originAirport} ${row.destinationAirport}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [
    { key: 'flightNumber', label: 'Flight', render: row => <strong>{row.flightNumber}</strong> },
    { key: 'flightName', label: 'Airline' },
    { key: 'route', label: 'Route', render: row => <span className="admin-route">{row.originAirport}<span>→</span>{row.destinationAirport}</span> },
    { key: 'actions', label: 'Manage', render: row => <Link className="admin-button small secondary" to="/admin/scheduleflt" state={row}>Schedule flight ↗</Link> },
  ];
  return <><PageHeading title="Flyhigh flights & routes" description="Manage the FH flights operated by Flyhigh." action={<Link className="admin-button" to="/admin/addflt">+ Add Flyhigh route</Link>} /><DataTable {...state} rows={rows} columns={columns} query={query} onQuery={setQuery} searchLabel="Search flight, airline or airport" empty="No flights added yet" /></>;
}
