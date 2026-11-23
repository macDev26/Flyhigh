import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export async function adminRequest(path, options = {}) {
  const response = await apiFetch(path, { ...options, signal: options.signal || AbortSignal.timeout(12000) });
  if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message || `The request failed (${response.status}). Please try again.`); }
  return response.json();
}

export function useAdminData(path) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError('');
    adminRequest(path, { signal: controller.signal }).then(result => {
      if (!Array.isArray(result)) throw new Error('The server returned an unexpected response.');
      if (!cancelled) setData(result);
    }).catch(() => {
      if (!cancelled) setError('Unable to load data. Check that the server is running, then try again.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
      clearTimeout(timeout);
    });
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [path, version]);
  return { data, loading, error, retry };
}
