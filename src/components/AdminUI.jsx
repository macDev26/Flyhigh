export function PageHeading({ eyebrow = 'WORKSPACE', title, description, action }) {
  return <div className="admin-page-heading"><div><p className="admin-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function DataState({ loading, error, retry }) {
  if (loading) return <div className="admin-empty" role="status"><span className="admin-spinner" />Loading your data…</div>;
  if (error) return <div className="admin-empty admin-error" role="alert"><strong>We couldn’t load this information</strong><p>{error}</p><button className="admin-button secondary" onClick={retry}>Try again</button></div>;
  return null;
}

export function DataTable({ columns, rows, loading, error, retry, empty = 'No records yet.', query, onQuery, searchLabel = 'Search records', toolbar }) {
  return <section className="admin-panel">
    {(onQuery || toolbar) && <div className="admin-table-toolbar">{onQuery && <div className="admin-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={event => onQuery(event.target.value)} /></div>}<span className="admin-table-count">{!loading && !error && `${rows.length} ${rows.length === 1 ? 'record' : 'records'}`}</span>{toolbar}</div>}
    {loading || error ? <DataState loading={loading} error={error} retry={retry} /> : rows.length === 0 ? <div className="admin-empty"><span className="admin-empty-symbol" aria-hidden="true">✧</span><strong>{query ? 'No matching records' : empty}</strong><p>{query ? 'Try another search.' : 'Records will appear here when they are available.'}</p></div> : <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="Data table"><table><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row._id || `${row.flightNumber || row.email || 'row'}-${index}`}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row, index) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}

export function MissingSelection({ to, label }) {
  return <section className="admin-panel admin-empty"><strong>Select a record first</strong><p>Open this page from {label} to see its details.</p><a className="admin-button" href={to}>Go to {label}</a></section>;
}
