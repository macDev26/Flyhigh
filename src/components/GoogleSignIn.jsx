import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function GoogleSignIn({ role = 'user', onSuccess }) {
  const container = useRef(null);
  const callback = useRef(onSuccess);
  callback.current = onSuccess;
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const configured = clientId.endsWith('.apps.googleusercontent.com') && !clientId.includes('YOUR_');

  useEffect(() => {
    if (!configured) return;
    let active = true;
    setError(''); setStatus('loading');
    const started = Date.now();
    const timer = setInterval(() => {
      if (!window.google?.accounts?.id) {
        if (Date.now() - started > 12000) { clearInterval(timer); setStatus('error'); setError('Google sign-in could not load. Check your connection and try again.'); }
        return;
      }
      clearInterval(timer);
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          callback: async response => {
            if (!active) return;
            setStatus('signing-in'); setError('');
            try {
              const result = await apiFetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential, role }) });
              const data = await result.json();
              if (!result.ok || !data.success) throw new Error(data.message || 'Unable to sign in with Google.');
              if (active) callback.current(data.user);
            } catch (err) { if (active) setError(err.message || 'Unable to reach the server. Please try again.'); }
            finally { if (active) setStatus('ready'); }
          },
        });
        window.google.accounts.id.renderButton(container.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: Math.max(200, Math.min(360, container.current.clientWidth)) });
        setStatus('ready');
      } catch { setStatus('error'); setError('Google sign-in is unavailable. Please try again.'); }
    }, 100);
    return () => { active = false; clearInterval(timer); };
  }, [role, attempt, configured]);

  return <div className="w-full flex flex-col items-center gap-3">
    <div ref={container} className="w-full flex justify-center" style={status === 'signing-in' ? { pointerEvents: 'none', opacity: .5 } : undefined} />
    {!configured && <><button disabled type="button" className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-slate-300">Continue with Google</button><p className="text-xs text-slate-400" role="status">Google sign-in isn’t configured yet.</p></>}
    {configured && status === 'loading' && <p className="text-sm text-slate-400" role="status">Loading Google sign-in…</p>}
    {status === 'signing-in' && <p className="text-sm text-slate-300" role="status">Verifying your account…</p>}
    {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
    {status === 'error' && <button type="button" className="text-sm text-violet-300 underline" onClick={() => setAttempt(value => value + 1)}>Retry Google sign-in</button>}
  </div>;
}
