import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adminRequest } from '../hooks/useAdminData';
import { PageHeading, MissingSelection } from '../components/AdminUI';

const cabins = ['economy', 'business', 'first'];
export default function Schedule() {
  const { state: flight } = useLocation();
  const navigate = useNavigate();
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [classes, setClasses] = useState(Object.fromEntries(cabins.map(cabin => [cabin, { enabled: cabin === 'economy', seats: '', price: '' }])));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!flight?.flightNumber) return <MissingSelection to="/admin/fltmanagement" label="flights" />;
  const invalidTime = departure && arrival && new Date(arrival) <= new Date(departure);
  const noCabin = !cabins.some(cabin => classes[cabin].enabled);
  const duration = departure && arrival && !invalidTime ? `${Math.floor((new Date(arrival) - new Date(departure)) / 3600000)}h ${Math.floor(((new Date(arrival) - new Date(departure)) % 3600000) / 60000)}m` : 'Select departure and arrival times';
  function update(cabin, property, value) { setClasses(previous => ({ ...previous, [cabin]: { ...previous[cabin], [property]: value } })); }
  async function submit(event) {
    event.preventDefault();
    if (saving || invalidTime || noCabin || !departure || !arrival) return;
    setSaving(true); setError('');
    try {
      const existing = await adminRequest('/api/flightinfo');
      if (!Array.isArray(existing)) throw new Error('Unable to check existing schedules. Please try again.');
      if (existing.some(row => row.flightNumber === flight.flightNumber && new Date(row.departureTime).getTime() === new Date(departure).getTime())) throw new Error('This flight is already scheduled at this departure time.');
      await adminRequest('/api/flightin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flightName: flight.flightName, flightNumber: flight.flightNumber, originAirport: flight.originAirport, destinationAirport: flight.destinationAirport, departureDate: departure.split('T')[0], departureTime: departure, arrivalTime: arrival, newdepTime: departure, newarrTime: arrival, seatsAvailable: Object.fromEntries(cabins.map(cabin => [cabin, classes[cabin].enabled ? Number(classes[cabin].seats) : -1])), prices: Object.fromEntries(cabins.map(cabin => [cabin, classes[cabin].enabled ? Number(classes[cabin].price) : 0])) }) });
      navigate('/admin/scheduled');
    } catch (err) { setError(err.message || 'Unable to schedule this flight. Please try again.'); }
    finally { setSaving(false); }
  }
  return <><PageHeading title="Schedule a flight" description={`${flight.flightName} · ${flight.flightNumber} · ${flight.originAirport} → ${flight.destinationAirport}`} action={<Link className="admin-button secondary" to="/admin/fltmanagement">← All flights</Link>} /><section className="admin-panel admin-form-panel"><form className="admin-form" onSubmit={submit}><label className="admin-field">Departure date and time<input type="datetime-local" required value={departure} onChange={event => setDeparture(event.target.value)} disabled={saving} /></label><label className="admin-field">Arrival date and time<input type="datetime-local" required min={departure || undefined} value={arrival} onChange={event => setArrival(event.target.value)} disabled={saving} /></label><p className="admin-form-note admin-form-full">Duration: {duration}</p>{cabins.map(cabin => <div className="admin-cabin admin-form-full" key={cabin}><label><input type="checkbox" checked={classes[cabin].enabled} onChange={event => update(cabin, 'enabled', event.target.checked)} disabled={saving} /><span className="capitalize">{cabin} class</span></label><label className="admin-field">Seats<input aria-label={`${cabin} seats`} type="number" min="1" step="1" required={classes[cabin].enabled} disabled={!classes[cabin].enabled || saving} value={classes[cabin].seats} onChange={event => update(cabin, 'seats', event.target.value)} placeholder="0" /></label><label className="admin-field">Fare (INR)<input aria-label={`${cabin} fare`} type="number" min="1" step="1" required={classes[cabin].enabled} disabled={!classes[cabin].enabled || saving} value={classes[cabin].price} onChange={event => update(cabin, 'price', event.target.value)} placeholder="0" /></label></div>)}{(error || invalidTime || noCabin) && <p className="admin-form-error admin-form-full" role="alert">{error || (invalidTime ? 'Arrival must be after departure.' : 'Select at least one cabin class.')}</p>}<div className="admin-form-actions admin-form-full"><button className="admin-button" disabled={saving || !!invalidTime || noCabin}>{saving ? 'Saving…' : 'Schedule flight'}</button><Link className="admin-button secondary" to="/admin/fltmanagement">Cancel</Link></div></form></section></>;
}
