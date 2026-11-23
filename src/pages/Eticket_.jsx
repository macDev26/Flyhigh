import { Link, Navigate, useLocation } from 'react-router-dom';
export default function EticketLegacy() {
  const { state } = useLocation();
  const id = state?.data?._id;
  if (id) return <Navigate to={`/eticket?booking_id=${encodeURIComponent(id)}`} replace />;
  return <main className="min-h-screen bg-slate-950 px-6 py-20 text-center text-white"><h1 className="text-2xl font-bold">Open a saved booking</h1><Link to="/myflts" className="mt-6 inline-block text-violet-300">Go to My Flights</Link></main>;
}
