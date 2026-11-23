import { useState } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';

export default function Feedbacks() {
  const state = useAdminData('/api/feedback');
  const [query, setQuery] = useState('');
  const ratings = state.data.map(row => Number(row.rating)).filter(Number.isFinite);
  const average = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : '—';
  const rows = state.data.filter(row => `${row.email} ${row.firstImpression} ${row.missingAnything}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [
    { key: 'email', label: 'Traveler' }, { key: 'firstImpression', label: 'First impression' },
    { key: 'hearAbout', label: 'Discovery' }, { key: 'missingAnything', label: 'Suggestions' },
    { key: 'rating', label: 'Rating', render: row => <span className="admin-badge purple">★ {row.rating ?? '—'}</span> },
  ];
  return <><PageHeading title="Traveler feedback" description="Listen to your travelers and make every journey better." action={<div className="admin-rating"><span>★</span><strong>{state.loading || state.error ? '—' : average}</strong><small>Average rating</small></div>} /><DataTable {...state} columns={columns} rows={rows} query={query} onQuery={setQuery} searchLabel="Search traveler or feedback" empty="No feedback received yet" /></>;
}
