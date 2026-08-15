import { DB_NAME, DB_VERSION, STORES } from './constants.js';

let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.records)) {
        const store = db.createObjectStore(STORES.records, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('exerciseCode', 'exerciseCode', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.auth)) {
        db.createObjectStore(STORES.auth, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de datos local está bloqueada por otra pestaña.'));
  });
  return dbPromise;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeTx(storeName, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let callbackResult;
    let requestValue;
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error || new Error('No se pudo completar la operación local.'));
    };
    try {
      callbackResult = callback(store);
      if (callbackResult instanceof IDBRequest) {
        callbackResult.onsuccess = () => { requestValue = callbackResult.result; };
        callbackResult.onerror = () => fail(callbackResult.error);
      }
    } catch (error) {
      fail(error);
      return;
    }
    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(callbackResult instanceof IDBRequest ? requestValue : callbackResult);
    };
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error || new Error('Operación local cancelada.'));
  });
}

export async function getAllRecords({ includeDeleted = false, type = null } = {}) {
  const db = await openDb();
  const tx = db.transaction(STORES.records, 'readonly');
  const store = tx.objectStore(STORES.records);
  let records;
  if (type) records = await requestPromise(store.index('type').getAll(type));
  else records = await requestPromise(store.getAll());
  return includeDeleted ? records : records.filter(record => !record._sync?.deleted);
}

export async function getRecord(id) {
  return storeTx(STORES.records, 'readonly', store => store.get(id));
}

export async function findExerciseByCode(code) {
  if (!code) return null;
  const db = await openDb();
  const tx = db.transaction(STORES.records, 'readonly');
  const store = tx.objectStore(STORES.records);
  const matches = await requestPromise(store.index('exerciseCode').getAll(String(code).trim().toUpperCase()));
  return (matches || []).find(item => item.type === 'exercise' && !item._sync?.deleted) || null;
}

export async function putRecord(record) {
  await storeTx(STORES.records, 'readwrite', store => store.put(record));
  return record;
}

export async function putRecords(records) {
  if (!records?.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.records, 'readwrite');
    const store = tx.objectStore(STORES.records);
    records.forEach(record => store.put(record));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el lote local.'));
  });
}

export async function removeRecordLocal(id) {
  await storeTx(STORES.records, 'readwrite', store => store.delete(id));
}

export async function clearRecords() {
  await storeTx(STORES.records, 'readwrite', store => store.clear());
}

export async function getSetting(key, fallback = null) {
  const item = await storeTx(STORES.settings, 'readonly', store => store.get(key));
  return item ? item.value : fallback;
}

export async function setSetting(key, value) {
  await storeTx(STORES.settings, 'readwrite', store => store.put({ key, value }));
  return value;
}

export async function deleteSetting(key) {
  await storeTx(STORES.settings, 'readwrite', store => store.delete(key));
}

export async function getAuthSession() {
  const item = await storeTx(STORES.auth, 'readonly', store => store.get('session'));
  return item?.value || null;
}

export async function setAuthSession(value) {
  await storeTx(STORES.auth, 'readwrite', store => store.put({ key: 'session', value }));
}

export async function clearAuthSession() {
  await storeTx(STORES.auth, 'readwrite', store => store.delete('session'));
}

export async function exportLocalDatabase() {
  return {
    records: await getAllRecords({ includeDeleted: false }),
    settings: {
      theme: await getSetting('theme', 'system'),
      cloudConfig: await getSetting('cloudConfig', {}),
      lastSyncAt: await getSetting('lastSyncAt', null),
    },
  };
}
