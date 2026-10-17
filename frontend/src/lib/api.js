const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
export function getToken() { return localStorage.getItem('cloudpulse_token'); }
export function setToken(token) { token ? localStorage.setItem('cloudpulse_token', token) : localStorage.removeItem('cloudpulse_token'); }
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...options.headers };
  const response = await fetch(`${BASE}${path}`, { ...options, headers, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401) { setToken(null); window.dispatchEvent(new Event('auth-expired')); } throw new Error(data.message || `Request failed (${response.status})`); }
  return data;
}
