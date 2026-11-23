import { useState } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import { PageHeading, DataTable } from '../components/AdminUI';

export default function UserInfo() {
  const state = useAdminData('/api/users');
  const [query, setQuery] = useState('');
  const rows = state.data.filter(row => `${row.firstName} ${row.lastName} ${row.email} ${row.mobileNumber}`.toLowerCase().includes(query.toLowerCase()));
  const columns = [
    { key: 'name', label: 'Name', render: row => <strong>{[row.title, row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}</strong> },
    { key: 'email', label: 'Email' }, { key: 'mobileNumber', label: 'Phone' },
    { key: 'address', label: 'Address' }, { key: 'birthday', label: 'Date of birth' }, { key: 'gender', label: 'Gender' },
    { key: 'status', label: 'Status', render: row => <span className={`admin-badge ${row.status ? 'success' : ''}`}>{row.status ? 'Online' : 'Offline'}</span> },
  ];
  return <><PageHeading title="Users" description="Find registered travelers and view their account details." action={<button className="admin-button secondary" onClick={state.retry}>Refresh users</button>} /><DataTable {...state} columns={columns} rows={rows} query={query} onQuery={setQuery} searchLabel="Search name, email or phone" empty="No registered users yet" /></>;
}
