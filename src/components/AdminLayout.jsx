import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import AdminMenu from './AdminMenu';
import AdminNav from './AdminNav';
import './admin.css';

export default function AdminLayout({ user, setUser, authLoading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  if (authLoading) return <div className="admin-shell admin-empty" role="status">Checking your session…</div>;
  if (user?.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return (
    <div className="admin-shell">
      {menuOpen && <button className="admin-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <AdminMenu open={menuOpen} onClose={() => setMenuOpen(false)} setUser={setUser} />
      <div className="admin-workspace">
        <AdminNav user={user} onMenu={() => setMenuOpen(!menuOpen)} menuOpen={menuOpen} />
        <main className="admin-content" key={pathname} id="admin-main"><Outlet context={{ user }} /></main>
        <footer className="admin-footer"><span>Flyhigh · Administration</span><Link to="/">Visit booking website ↗</Link></footer>
      </div>
    </div>
  );
}
