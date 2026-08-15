import { getCloudConfig, refreshSession } from './auth.js';

async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const config = await getCloudConfig();
  const session = await refreshSession(false);
  if (!config.url || !config.anonKey) throw new Error('La nube no está configurada.');
  if (!session?.accessToken) throw new Error('Inicia sesión para sincronizar.');

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.hint || data.details || `Error de nube ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function listRemoteRecords() {
  return apiRequest('gymledger_records?select=record_id,record_type,payload,server_updated_at,deleted_at&order=server_updated_at.asc');
}

export async function getRemoteRecord(id) {
  const rows = await apiRequest(`gymledger_records?record_id=eq.${encodeURIComponent(id)}&select=record_id,record_type,payload,server_updated_at,deleted_at&limit=1`);
  return rows?.[0] || null;
}

export async function upsertRemoteRecord(record, userId) {
  const rows = await apiRequest('gymledger_records?on_conflict=user_id,record_id&select=record_id,record_type,payload,server_updated_at,deleted_at', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: {
      record_id: record.id,
      user_id: userId,
      record_type: record.type,
      payload: record,
      client_updated_at: record.updatedAt,
      deleted_at: null,
    },
  });
  return rows?.[0] || null;
}

export async function softDeleteRemoteRecord(id) {
  const rows = await apiRequest(`gymledger_records?record_id=eq.${encodeURIComponent(id)}&select=record_id,server_updated_at,deleted_at`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { deleted_at: new Date().toISOString() },
  });
  return rows?.[0] || null;
}
