import { currentSession } from './auth.js';
import { getAllRecords, putRecord, putRecords, removeRecordLocal, getSetting, setSetting } from './db.js';
import { listRemoteRecords, getRemoteRecord, upsertRemoteRecord, softDeleteRemoteRecord } from './cloud.js';
import { normalizeRecord } from './schema.js';
import { nowIso, uuid } from './utils.js';

let syncing = false;
const listeners = new Set();

export function onSyncStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(status) {
  listeners.forEach(listener => {
    try { listener(status); } catch { /* La UI no debe romper la sincronización. */ }
  });
}

function remoteIsDifferent(local, remote) {
  if (!remote?.server_updated_at) return false;
  if (!local?._sync?.syncedServerUpdatedAt) return true;
  return remote.server_updated_at !== local._sync.syncedServerUpdatedAt;
}

function localWinsStructuralConflict(local) {
  if (!local) return false;
  if (local.type === 'routine' || local.type === 'plan') return true;
  return String(local.id || '').startsWith('seed-');
}

async function preserveConflict(local) {
  const suffix = ' (copia por conflicto)';
  const conflict = normalizeRecord({
    ...local,
    id: uuid(),
    name: local.name ? `${local.name}${suffix}` : local.name,
    sourceKey: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _sync: { dirty: true, deleted: false, syncedServerUpdatedAt: null, seed: false },
  });
  // Un ejercicio copiado por conflicto no puede conservar el mismo código canónico.
  if (conflict.type === 'exercise') conflict.exerciseCode = null;
  await putRecord(conflict);
  return conflict;
}

async function uploadLocal(local, userId, remote = null) {
  if (local._sync?.deleted) {
    if (remote) await softDeleteRemoteRecord(local.id);
    await removeRecordLocal(local.id);
    return;
  }
  const uploaded = await upsertRemoteRecord(local, userId);
  // El servidor puede completar exerciseCode mediante trigger.
  const serverPayload = uploaded?.payload ? normalizeRecord(uploaded.payload) : local;
  serverPayload._sync = {
    dirty: false,
    deleted: false,
    syncedServerUpdatedAt: uploaded?.server_updated_at || null,
    seed: false,
  };
  await putRecord(serverPayload);
}

export async function markRecordDirty(record) {
  record._sync = record._sync || {};
  record._sync.dirty = true;
  record._sync.deleted = false;
  record._sync.seed = false;
  record.updatedAt = nowIso();
  await putRecord(record);
  return record;
}

export async function markRecordDeleted(record) {
  record._sync = record._sync || {};
  record._sync.dirty = true;
  record._sync.deleted = true;
  record._sync.seed = false;
  record.updatedAt = nowIso();
  await putRecord(record);
}

export async function syncAll({ silent = false } = {}) {
  if (syncing) return { ok: false, reason: 'busy' };
  if (!navigator.onLine) {
    emit({ state: 'offline', message: 'Sin conexión' });
    return { ok: false, reason: 'offline' };
  }
  const session = await currentSession();
  if (!session?.user?.id) {
    emit({ state: 'local', message: 'Solo en este dispositivo' });
    return { ok: false, reason: 'no-session' };
  }

  syncing = true;
  emit({ state: 'syncing', message: 'Sincronizando…' });
  try {
    const localRecords = await getAllRecords({ includeDeleted: true });
    // Los ejercicios iniciales tienen códigos EX reservados. Se sincronizan primero
    // para que cualquier ejercicio nuevo sin código reciba EX-0023 o superior.
    const dirtyRecords = localRecords.filter(record => record._sync?.dirty).sort((a, b) => {
      const priority = record => {
        if (record.type === 'exercise' && record.exerciseCode) return 0;
        if (record.type === 'exercise') return 1;
        return 2;
      };
      return priority(a) - priority(b) || String(a.id).localeCompare(String(b.id));
    });

    for (const local of dirtyRecords) {
      const remote = await getRemoteRecord(local.id);
      if (remote && remoteIsDifferent(local, remote)) {
        // Rutinas, planes y registros seed usan identidad estable. Crear una segunda
        // rutina/plan con "(copia por conflicto)" rompe la estructura y confunde al
        // usuario. En esos registros gana la edición local que acaba de disparar
        // esta sincronización y se conserva el mismo id.
        if (localWinsStructuralConflict(local)) {
          await uploadLocal(local, session.user.id, remote);
          continue;
        }

        // Para otros registros no deterministas se conserva la estrategia prudente:
        // guardar una copia local antes de aceptar la versión remota.
        if (!local._sync?.seed) await preserveConflict(local);
        if (remote.deleted_at) await removeRecordLocal(local.id);
        else {
          const remoteRecord = normalizeRecord(remote.payload);
          remoteRecord._sync = { dirty: false, deleted: false, syncedServerUpdatedAt: remote.server_updated_at, seed: false };
          await putRecord(remoteRecord);
        }
        continue;
      }

      await uploadLocal(local, session.user.id, remote);
    }

    const remoteRows = await listRemoteRecords();
    const latestLocal = new Map((await getAllRecords({ includeDeleted: true })).map(record => [record.id, record]));
    const toPut = [];

    for (const row of remoteRows || []) {
      const local = latestLocal.get(row.record_id);
      if (row.deleted_at) {
        if (local && !local._sync?.dirty) await removeRecordLocal(row.record_id);
        continue;
      }
      if (local?._sync?.dirty) continue;
      if (!local || local._sync?.syncedServerUpdatedAt !== row.server_updated_at) {
        const record = normalizeRecord(row.payload);
        record._sync = { dirty: false, deleted: false, syncedServerUpdatedAt: row.server_updated_at, seed: false };
        toPut.push(record);
      }
    }
    if (toPut.length) await putRecords(toPut);
    await setSetting('lastSyncAt', nowIso());
    emit({ state: 'synced', message: 'Sincronizado' });
    return { ok: true };
  } catch (error) {
    emit({ state: 'error', message: error.message || 'Error de sincronización' });
    if (!silent) throw error;
    return { ok: false, error };
  } finally {
    syncing = false;
  }
}

export async function getSyncSummary() {
  const records = await getAllRecords({ includeDeleted: true });
  return {
    pending: records.filter(record => record._sync?.dirty).length,
    lastSyncAt: await getSetting('lastSyncAt', null),
  };
}
