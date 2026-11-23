const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiFetch(path, options = {}) {
  return fetch(`${API_URL}${path}`, { ...options, credentials: 'include', signal: options.signal || AbortSignal.timeout(15000) });
}

export async function signOut() {
  const response = await apiFetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error('Unable to log out. Please try again.');
}
