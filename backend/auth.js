const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');

const PROFILE_FIELDS = ['title', 'firstName', 'lastName', 'mobileNumber', 'birthday', 'gender', 'maritalStatus', 'address'];
function publicUser(user, role = 'user') {
  return { email: user.email, role, ...Object.fromEntries(PROFILE_FIELDS.map(key => [key, user[key] || ''])) };
}

function createAuth({ users, sessionCollection, clientId, adminEmails = '', production = false, verifyToken, now = Date.now }) {
  const google = new OAuth2Client();
  const verify = verifyToken || (async credential => (await google.verifyIdToken({ idToken: credential, audience: clientId })).getPayload());
  const administrators = new Set(adminEmails.split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
  const sessions = new Map();
  const cookieName = 'flyhigh_session';
  const lifetime = 8 * 60 * 60 * 1000;
  const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${production ? '; Secure' : ''}`;
  const digest = id => crypto.createHash('sha256').update(id).digest('hex');
  function sessionId(req) {
    return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  }
  async function deleteSession(id) {
    if (!id) return;
    if (sessionCollection) await sessionCollection.deleteOne({ _id: digest(id) });
    else sessions.delete(id);
  }
  async function getSession(req) {
    const id = sessionId(req);
    if (!/^[a-f0-9]{64}$/.test(id || '')) return null;
    const stored = sessionCollection ? await sessionCollection.findOne({ _id: digest(id) }) : sessions.get(id);
    const session = stored && { user: stored.user, expires: sessionCollection ? stored.expiresAt.getTime() : stored.expires };
    if (!session || session.expires <= now()) { await deleteSession(id); return null; }
    // Re-evaluate the allowlist instead of trusting a role supplied by a browser.
    if (session.user.role === 'admin' && !administrators.has(session.user.email.toLowerCase())) return null;
    return session;
  }
  async function startSession(req, res, user, role = 'user') {
    await deleteSession(sessionId(req));
    for (const [id, session] of sessions) if (session.expires <= now()) sessions.delete(id);
    const id = crypto.randomBytes(32).toString('hex');
    const profile = publicUser(user, role);
    if (sessionCollection) await sessionCollection.insertOne({ _id: digest(id), user: profile, expiresAt: new Date(now() + lifetime) });
    else sessions.set(id, { user: profile, expires: now() + lifetime });
    res.setHeader('Set-Cookie', `${cookieName}=${id}; Max-Age=${lifetime / 1000}; ${cookieFlags}`);
    return profile;
  }
  async function requireUser(req, res, next) {
    try {
      const session = await getSession(req);
      if (!session) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
      req.authUser = session.user;
      return next();
    } catch { return res.status(503).json({ success: false, message: 'Unable to verify your session. Please try again shortly.' }); }
  }
  function requireAdmin(req, res, next) {
    return requireUser(req, res, () => {
      if (req.authUser.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' });
      next();
    });
  }
  async function googleLogin(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!clientId || clientId.includes('YOUR_')) return res.status(503).json({ success: false, message: 'Google sign-in is not configured yet. Add the Google client ID on the server.' });
    const { credential, role = 'user' } = req.body || {};
    if (!['user', 'admin'].includes(role) || typeof credential !== 'string' || credential.length > 10000 || !credential) return res.status(400).json({ success: false, message: 'A valid Google credential is required.' });
    let payload;
    try { payload = await verify(credential); }
    catch { return res.status(401).json({ success: false, message: 'Google could not verify this sign-in. Please try again.' }); }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) return res.status(401).json({ success: false, message: 'Please use a verified Google email address.' });
    const email = payload.email.toLowerCase();
    // Google is authoritative for Gmail and Google Workspace addresses only.
    if (!email.endsWith('@gmail.com') && !payload.hd) return res.status(403).json({ success: false, message: 'Please use Gmail or a Google Workspace account.' });
    if (role === 'admin' && !administrators.has(email)) return res.status(403).json({ success: false, message: 'This Google account does not have administrator access.' });
    try {
      let user = await users.findOne({ googleSub: payload.sub });
      if (user && user.email.toLowerCase() !== email) return res.status(409).json({ success: false, message: 'This Google account’s email has changed. Please contact support.' });
      if (!user) user = await users.findOne({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      if (user?.googleSub && user.googleSub !== payload.sub) return res.status(409).json({ success: false, message: 'This email is linked to a different Google account.' });
      if (user) {
        await users.updateOne({ _id: user._id }, { $set: { googleSub: payload.sub, status: 1 } });
      } else {
        user = { email, googleSub: payload.sub, firstName: payload.given_name || payload.name || '', lastName: payload.family_name || '', title: '', mobileNumber: '', status: 1 };
        await users.insertOne(user);
      }
      return res.json({ success: true, user: await startSession(req, res, user, role) });
    } catch {
      return res.status(503).json({ success: false, message: 'Unable to reach the account database. Please try again shortly.' });
    }
  }
  async function logout(req, res) {
    res.setHeader('Set-Cookie', `${cookieName}=; Max-Age=0; ${cookieFlags}`);
    try {
      const session = await getSession(req);
      await deleteSession(sessionId(req));
      if (session) await users.updateOne({ email: session.user.email }, { $set: { status: 0 } });
      return res.json({ success: true });
    } catch { return res.status(503).json({ success: false, message: 'Unable to finish signing out. Please try again.' }); }
  }
  async function session(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try { return res.json({ user: (await getSession(req))?.user || null }); }
    catch { return res.status(503).json({ success: false, message: 'Unable to verify your session. Please try again shortly.' }); }
  }
  return { googleLogin, session, logout, getSession, startSession, requireUser, requireAdmin };
}

module.exports = { createAuth, publicUser, PROFILE_FIELDS };
