import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NavbarM from '../components/NavbarM';
import { apiFetch } from '../lib/api';

export default function PaymentCancel({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = new URLSearchParams(location.search).get('order_id');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(''); setResult(null);
    if (!user || !orderId) return;
    apiFetch('/api/payments/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to check this payment.');
      if (!active) return;
      if (data.status === 'confirmed') navigate(`/eticket?booking_id=${encodeURIComponent(data.booking._id)}`, { replace: true });
      else setResult(data);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [user, orderId, attempt, navigate]);
  return <div className="min-h-screen bg-slate-950 text-white"><NavbarM user={user} /><main className="mx-auto max-w-xl px-6 py-20 text-center"><span className="text-5xl text-violet-300">↩</span><h1 className="mt-6 text-3xl font-bold">{result ? 'Test checkout canceled' : 'Checking your checkout'}</h1><p className="mt-4 leading-relaxed text-slate-400" role={error ? 'alert' : 'status'}>{!user ? 'Sign in to check this checkout.' : !orderId ? 'Open a saved booking or search for a new departure.' : error || result?.message || 'Checking Stripe before updating your checkout.'}</p><div className="mt-8 flex flex-wrap justify-center gap-4">{!user && <Link className="rounded-xl bg-violet-600 px-5 py-3" to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>Sign in</Link>}{result?.selection && <button onClick={() => navigate('/preview', { state: result.selection })} className="rounded-xl bg-violet-600 px-5 py-3">Return to booking</button>}{error && <button className="rounded-xl bg-violet-600 px-5 py-3" onClick={() => setAttempt(value => value + 1)}>Try again</button>}<Link className="rounded-xl border border-white/20 px-5 py-3" to="/">Search Flyhigh flights</Link></div></main></div>;
}
