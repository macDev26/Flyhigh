import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable, MissingSelection } from '../components/AdminUI';

export default function ViewFlights() {
  const { state: selection } = useLocation();
  const airlines = useAdminData('/api/airlines');
  const flights = useAdminData('/api/flights');
  const [query, setQuery] = useState('');
  if (!selection?.flightCode) return <MissingSelection to="/admin/airlinemanagement" label="airlines" />;
  const airline = airlines.data.find(row => row.flightCode === selection.flightCode);
  const rows = flights.data.filter(row => airline?.flights?.includes(row.flightNumber)).filter(row => `${row.flightNumber} ${row.originAirport} ${row.destinationAirport}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [{ key: 'flightNumber', label: 'Flight number' }, { key: 'originAirport', label: 'Origin airport' }, { key: 'destinationAirport', label: 'Destination airport' }, { key: 'actions', label: 'Manage', render: row => <Link className="admin-text-link" to="/admin/scheduleflt" state={row}>Schedule ↗</Link> }];
  return <><PageHeading title={airline?.flightName || selection.flightCode} description="Browse the flights in this airline’s network." action={<Link className="admin-button secondary" to="/admin/airlinemanagement">← All airlines</Link>} /><DataTable loading={airlines.loading || flights.loading} error={airlines.error || flights.error} retry={() => { airlines.retry(); flights.retry(); }} columns={columns} rows={rows} query={query} onQuery={setQuery} searchLabel="Search flight or airport" empty="No flights for this airline" /></>;
}
