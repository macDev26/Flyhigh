import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminRequest, useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataState } from '../components/AdminUI';

export default function AddFlight() {
  const routes = useAdminData('/api/flights');
  const airports = useAdminData('/api/airports');
  const [number, setNumber] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const flightNumber = `FH${number}`;
  const duplicate = routes.data.some(row => row.flightNumber.replace(/\s/g, '') === flightNumber);
  async function submit(event) {
    event.preventDefault();
    if (saving || duplicate) return;
    setSaving(true); setError('');
    try {
      await adminRequest('/api/flights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flightNumber, originAirport: origin, destinationAirport: destination }) });
      navigate('/admin/fltmanagement');
    } catch (err) { setError(err.message || 'Unable to add this route. Please try again.'); }
    finally { setSaving(false); }
  }
  return <><PageHeading title="Add a Flyhigh route" description="Every route is operated by Flyhigh under the FH flight code." action={<Link className="admin-button secondary" to="/admin/fltmanagement">← Flights & routes</Link>} /><section className="admin-panel admin-form-panel">{routes.loading || airports.loading || routes.error || airports.error ? <DataState loading={routes.loading || airports.loading} error={routes.error || airports.error} retry={() => { routes.retry(); airports.retry(); }} /> : <form className="admin-form" onSubmit={submit}><label className="admin-field">Operating airline<input value="Flyhigh (FH)" disabled /></label><label className="admin-field">Flight number · FH<input required inputMode="numeric" pattern="[0-9]{1,4}" maxLength={4} value={number} onChange={event => setNumber(event.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 201" disabled={saving} /></label><label className="admin-field">Origin airport<select required value={origin} onChange={event => setOrigin(event.target.value)} disabled={saving}><option value="">Select origin</option>{airports.data.filter(row => row.code !== destination).map(row => <option key={row.code} value={row.code}>{row.name} ({row.code})</option>)}</select></label><label className="admin-field">Destination airport<select required value={destination} onChange={event => setDestination(event.target.value)} disabled={saving}><option value="">Select destination</option>{airports.data.filter(row => row.code !== origin).map(row => <option key={row.code} value={row.code}>{row.name} ({row.code})</option>)}</select></label>{(error || duplicate) && <p className="admin-form-error admin-form-full" role="alert">{error || 'This Flyhigh flight number already exists.'}</p>}<div className="admin-form-actions admin-form-full"><button className="admin-button" disabled={saving || duplicate}>{saving ? 'Saving…' : 'Add Flyhigh route'}</button><Link className="admin-button secondary" to="/admin/fltmanagement">Cancel</Link></div></form>}</section></>;
}
