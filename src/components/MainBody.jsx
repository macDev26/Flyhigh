import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import GoogleSignIn from './GoogleSignIn';
import { apiFetch } from '../lib/api';

const MainBody = ({ setUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const { search } = useLocation();
  function complete(user) {
    setUser(user);
    const target = new URLSearchParams(search).get('returnTo');
    navigate(target && (target.startsWith('/eticket?') || target.startsWith('/payment/cancel?')) ? target : '/');
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try {
      const response = await apiFetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Login failed.');
      complete(data.user);
    } catch (err) { setError(err.message || 'Unable to reach the server. Please try again.'); }
    finally { setPending(false); }
  }
  return (
    <>
      <div className='content min-h-screen flex flex-col md:flex-row pt-[80px] pb-16 gap-[40px] justify-center items-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white px-4'>
        {/* Login Box */}
        <div className='login w-full max-w-lg bg-white/10 border border-white/15 rounded-[32px] p-8 text-center shadow-2xl backdrop-blur-xl'>
          <h1 className='text-3xl font-extrabold tracking-tight text-white'>Login to Flyhigh</h1>
          <p className='mt-2 text-slate-400 text-sm'>Continue with Google or sign in with your email</p>

          <div className='info flex flex-col mt-6 items-center w-full'>
            <GoogleSignIn onSuccess={complete} />
            <div className='my-5 flex items-center justify-center text-slate-400 gap-3 w-full'>
              <span className='h-px flex-1 bg-white/15'></span>
              <span className='text-xs font-semibold uppercase tracking-wider text-slate-400'>OR</span>
              <span className='h-px flex-1 bg-white/15'></span>
            </div>

            <form className='w-full space-y-4' onSubmit={handleSubmit}>
              <div className="text-left">
                <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 ml-1">Email Address</label>
                <input
                  className='w-full h-12 rounded-2xl border border-white/20 bg-white px-4 text-base font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all shadow-inner'
                  type='email'
                  id='login-email'
                  autoComplete='email'
                  placeholder='name@example.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="text-left">
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 ml-1">Password</label>
                <input
                  className="w-full h-12 rounded-2xl border border-white/20 bg-white px-4 text-base font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all shadow-inner"
                  type='password'
                  id='login-password'
                  autoComplete='current-password'
                  placeholder='Enter your password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p role='alert' className='text-sm font-semibold text-rose-300 text-left pt-1'>{error}</p>}

              <button
                className='w-full mt-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-lg font-bold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-all duration-200'
                type='submit'
                id='log'
                disabled={pending}
              >
                {pending ? 'Signing in…' : 'Login'}
              </button>
            </form>
          </div>
          <Link to="/admin/login" className="mt-6 inline-block text-xs text-violet-300 hover:underline">Administrator sign-in ↗</Link>
        </div>

        {/* Divider */}
        <div className='separation hidden md:block w-[2px] h-[50vh] rounded-full bg-gradient-to-b from-indigo-500 via-fuchsia-500 to-transparent opacity-40'>
        </div>

        {/* Register CTA Box */}
        <div className='register w-full max-w-lg bg-white/5 border border-white/10 rounded-[32px] p-8 text-center shadow-2xl backdrop-blur-xl flex flex-col justify-between min-h-[450px]'>
          <div>
            <h1 className='text-3xl font-bold text-white'>Don’t Have An Account Yet?</h1>
            <p className='mt-3 text-slate-400 text-sm'>Join Flyhigh today and start planning your travels effortlessly.</p>

            <div className='mt-8 space-y-4 text-left'>
              <div className='flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10'>
                <span className='text-2xl'>✈️</span>
                <div>
                  <p className='font-bold text-white text-sm'>Instant Flight Bookings</p>
                  <p className='text-slate-400 text-xs'>Reserve seats in seconds with stored traveller details.</p>
                </div>
              </div>
              <div className='flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10'>
                <span className='text-2xl'>🎫</span>
                <div>
                  <p className='font-bold text-white text-sm'>Digital E-Tickets</p>
                  <p className='text-slate-400 text-xs'>Access and manage your bookings anytime, anywhere.</p>
                </div>
              </div>
            </div>
          </div>

          <Link to='/register' className='mt-8 block w-full'>
            <button className='w-full py-3.5 text-lg rounded-2xl border border-indigo-400/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-white font-semibold transition-all duration-200'>
              Create New Account
            </button>
          </Link>
        </div>
      </div>
    </>
  )
}

export default MainBody;
