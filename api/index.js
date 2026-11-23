import backend from '../backend/server.js';

// One shared function keeps API requests on the website's own origin, including
// session cookies and Stripe's signed raw-body webhook.
export default async function handler(req, res) {
  try {
    await backend.ready();
    return backend.app(req, res);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'The flight database is unavailable. Please try again shortly.' }));
  }
}
