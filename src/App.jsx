import { useEffect, useState } from 'react'
import './App.css'
import { BrowserRouter as Router, Route, Navigate, Routes } from 'react-router-dom'
import Login from './pages/Login' 
import Home from './pages/Home'
import Register from './pages/Register'
import FlightList from './pages/FlightList'
import Feedback from './pages/Feedback'
import PassengerForm from './pages/PassengerForm'
import Preview from './pages/Preview'
import PaymentCancel from './pages/PaymentCancel'
import Eticket from './pages/Eticket'
import Eticket_ from './pages/Eticket_'
import MyFlights from './pages/MyFlights'
import FlightStatus from './pages/FlightStatus'
import UserProfile from './pages/UserProfile'
import Bookings from './sso/Bookings'
import Update from './sso/Update'
import Feedbacks from './sso/Feedbacks'
import AddFlight from './sso/AddFlight'
import FlightsManagement from './sso/FlightsManagement'
import Schedule from './sso/Schedule'
import Profile from './sso/Profile'
import AdminDashboard from './sso/AdminDashboard'
import About from './pages/About'
import UserInfo from './sso/UserInfo'
import PassInfo from './sso/PassInfo'
import PassList from './sso/PassList'
import AdminLayout from './components/AdminLayout'
import AdminLogin from './pages/AdminLogin'
import { apiFetch, signOut } from './lib/api'

function App() {

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/session').then(response => {
      if (!response.ok) throw new Error('Unable to check session');
      return response.json();
    }).then(result => {
      if (active) {
        setUser(result.user);
        if (result.user) sessionStorage.setItem('user', JSON.stringify(result.user));
        else sessionStorage.removeItem('user');
      }
    }).catch(() => { if (active) sessionStorage.removeItem('user'); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  const handleSetUser = (nextUser) => {
    setUser(nextUser);
    if (nextUser) sessionStorage.setItem('user', JSON.stringify(nextUser));
    else sessionStorage.removeItem('user');
  };
  const handleLogout = async () => {
    await signOut();
    handleSetUser(null);
  };
  // Navbar callers use setUser(null) to log out; profile edits only update local display data.
  const updateUser = nextUser => nextUser ? handleSetUser(nextUser) : handleLogout();

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300" role="status">Checking your session…</div>;

  return (
    <>
      <Router>
      <Routes>
        {/* Client Website Routes */}

        <Route path='/' element={<Home user={user} setUser={updateUser}/>}/>
        <Route path='/login' element={<Login user={user} setUser={updateUser}/>}/>
        <Route path='/register' element={<Register/>}/>
        <Route path='/feedback' element={<Feedback user={user}/>}/>
        <Route path='/passform' element={<PassengerForm user={user}/>}/>
        <Route path='/preview' element={<Preview user={user}/>}/>
        <Route path='/payment/cancel' element={<PaymentCancel user={user}/>}/>
        <Route path='/eticket' element={<Eticket user={user}/>}/>
        <Route path='/eticket_' element={<Eticket_ user={user}/>}/>
        <Route path='/user' element={<UserProfile user={user} setUser={updateUser}/>}/>
        <Route path='/fltstatus/:originAirport/:destinationAirport/:selectedDate' element={<FlightStatus user={user} setUser={updateUser}/>}/>
        <Route path='/fltlist/:originAirport/:destinationAirport/:selectedDate/:passengers' element={<FlightList user={user} setUser={updateUser}/>}/>
        <Route path='/myflts' element={<MyFlights user={user}/>}/>
        <Route path='/about' element={<About user={user} setUser={updateUser}/>}/>

        {/* Admin Portal Routes */}

        <Route path='/admin/login' element={<AdminLogin user={user} setUser={handleSetUser} authLoading={authLoading} />} />
        <Route path='/admin' element={<AdminLayout user={user} setUser={updateUser} authLoading={authLoading} />} >
        <Route index element={<Navigate to='dashboard' replace />} />
        <Route path='/admin/airlinemanagement' element={<Navigate to='/admin/fltmanagement' replace />}/>
        <Route path='/admin/bookings' element={<Bookings/>}/>
        <Route path='/admin/scheduleflt' element={<Schedule/>}/>
        <Route path='/admin/viewflt' element={<Navigate to='/admin/fltmanagement' replace />}/>
        <Route path='/admin/feedback' element={<Feedbacks/>}/>
        <Route path='/admin/fltmanagement' element={<FlightsManagement/>}/>
        <Route path='/admin/addflt' element={<AddFlight/>}/>
        <Route path='/admin/scheduled' element={<Update/>}/>
        <Route path='/admin/addairline' element={<Navigate to='/admin/fltmanagement' replace />}/>
        <Route path='/admin/profile' element={<Profile/>}/>
        <Route path='/admin/dashboard' element={<AdminDashboard/>}/>
        <Route path='/admin/userinfo' element={<UserInfo/>}/>
        <Route path='/admin/passinfo' element={<PassInfo/>}/>
        <Route path='/admin/passlist' element={<PassList/>}/>
        <Route path='*' element={<Navigate to='/admin/dashboard' replace />} />
        </Route>
      </Routes>
      </Router>
    </>
  )
}

export default App;
