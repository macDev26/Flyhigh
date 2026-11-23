export function formatDateTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
export function flightStatus(row) {
  const departure = new Date(row.newdepTime || row.departureTime).getTime();
  const arrival = new Date(row.newarrTime || row.arrivalTime).getTime();
  if (!Number.isFinite(departure) || !Number.isFinite(arrival)) return 'Unavailable';
  if (Date.now() < departure) return 'Scheduled';
  return Date.now() < arrival ? 'In flight' : 'Arrived';
}
