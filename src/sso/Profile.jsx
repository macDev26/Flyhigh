import { Link, useOutletContext } from 'react-router-dom';
import { PageHeading } from '../components/AdminUI';

export default function Profile() {
  const { user } = useOutletContext();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';
  return <><PageHeading eyebrow="ACCOUNT" title="My profile" description="Your account details in one place." /><section className="admin-panel admin-profile"><div className="admin-profile-banner"><span className="admin-eyebrow">FLYHIGH WORKSPACE</span><h2>A little about you.</h2><span className="admin-profile-plane" aria-hidden="true">✈</span></div><div className="admin-profile-body"><span className="admin-avatar large">{name.slice(0, 1)}</span><h2>{name}</h2><p>Administration workspace</p><dl><div><dt>Full name</dt><dd>{name}</dd></div><div><dt>Email address</dt><dd>{user?.email || 'No signed-in account'}</dd></div><div><dt>Phone number</dt><dd>{user?.mobileNumber || 'Not provided'}</dd></div></dl>{!user && <Link className="admin-button secondary" to="/login">Sign in to your account ↗</Link>}</div></section></>;
}
