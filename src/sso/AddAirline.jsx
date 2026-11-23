import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminRequest, useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataState } from '../components/AdminUI';

export default function AddAirline() {
  const airlines = useAdminData('/api/airlines');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const duplicate = airlines.data.some(row => row.flightName?.toLowerCase() === name.trim().toLowerCase() || row.flightCode?.toLowerCase() === code.trim().toLowerCase());
  async function submit(event) {
    event.preventDefault();
    if (saving || duplicate || !name.trim() || !/^[A-Z0-9]{2}$/.test(code)) return;
    setSaving(true); setError('');
    try {
      await adminRequest('/api/airlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flightName: name.trim(), flightCode: code, flights: [] }) });
      navigate('/admin/airlinemanagement');
    } catch (err) { setError(err.message || 'Unable to save the airline. Please try again.'); }
    finally { setSaving(false); }
  }
  return <><PageHeading title="Add an airline" description="Bring a new airline into your network." action={<Link className="admin-button secondary" to="/admin/airlinemanagement">← All airlines</Link>} /><section className="admin-panel admin-form-panel">{airlines.loading || airlines.error ? <DataState {...airlines} /> : <form className="admin-form" onSubmit={submit}><label className="admin-field">Airline name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Air India" disabled={saving} /></label><label className="admin-field">Airline code<input required pattern="[A-Z0-9]{2}" minLength={2} maxLength={2} value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="e.g. AI" disabled={saving} /></label>{(error || duplicate) && <p className="admin-form-error admin-form-full" role="alert">{error || 'An airline with this name or code already exists.'}</p>}<div className="admin-form-actions admin-form-full"><button className="admin-button" disabled={saving || duplicate}>{saving ? 'Saving…' : 'Add airline'}</button><Link className="admin-button secondary" to="/admin/airlinemanagement">Cancel</Link></div></form>}</section></>;
}
