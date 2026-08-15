import { getAuthSession, setAuthSession, clearAuthSession, getSetting } from './db.js';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './cloud-config.js';

function cleanUrl(value = '') {
  return String(value).trim().replace(/\/+$/, '');
}

export async function getCloudConfig() {
  const stored = await getSetting('cloudConfig', {});
  return {
    url: cleanUrl(stored?.url || DEFAULT_SUPABASE_URL),
    anonKey: String(stored?.anonKey || DEFAULT_SUPABASE_ANON_KEY || '').trim(),
  };
}

export async function cloudIsConfigured() {
  const { url, anonKey } = await getCloudConfig();
  return Boolean(url && anonKey);
}

async function authRequest(path, body, accessToken = '') {
  const { url, anonKey } = await getCloudConfig();
  if (!url || !anonKey) throw new Error('La nube todavía no está configurada.');
  const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST', headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.msg || data.message || data.error_description || data.error || `Error ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function sessionFromResponse(data) {
  if (!data?.access_token) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000,
    tokenType: data.token_type || 'bearer',
    user: data.user || null,
  };
}

export async function signIn(email, password) {
  const data = await authRequest('token?grant_type=password', { email, password });
  const session = sessionFromResponse(data);
  await setAuthSession(session);
  return session;
}

export async function signUp(email, password) {
  const data = await authRequest('signup', { email, password });
  const session = sessionFromResponse(data);
  if (session) await setAuthSession(session);
  return { session, user: data.user || null };
}

export async function signOut() {
  const session = await getAuthSession();
  try {
    if (session?.accessToken) await authRequest('logout', null, session.accessToken);
  } catch {
    // El cierre local debe funcionar incluso sin red.
  }
  await clearAuthSession();
}

export async function refreshSession(force = false) {
  const session = await getAuthSession();
  if (!session) return null;
  if (!force && session.expiresAt > Date.now()) return session;
  if (!session.refreshToken) {
    await clearAuthSession();
    return null;
  }
  try {
    const data = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refreshToken });
    const refreshed = sessionFromResponse(data);
    await setAuthSession(refreshed);
    return refreshed;
  } catch (error) {
    await clearAuthSession();
    throw error;
  }
}

export async function currentSession() {
  try { return await refreshSession(false); }
  catch { return null; }
}
