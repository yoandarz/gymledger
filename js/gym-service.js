import { ALL_SEED_RECORDS } from './seed-data.js';
import { getAllRecords, getRecord, putRecord, putRecords, findExerciseByCode } from './db.js';
import { cloneAsDirty, normalizeRecord, validateRecord } from './schema.js';
import { nowIso, uuid } from './utils.js';
import { markRecordDeleted, syncAll } from './sync.js';

export async function ensureSeedData() {
  const records = await getAllRecords({ includeDeleted: true });
  if (records.length) {
    // Limpieza única para instalaciones que llegaron a abrir la versión 2.0.0.
    // normalizeRecord elimina el antiguo campo no canónico de las fichas.
    const legacyExercises = records.filter(record =>
      record.type === 'exercise' && Object.prototype.hasOwnProperty.call(record, 'aliases')
    );
    if (legacyExercises.length) {
      const cleaned = legacyExercises.map(record => normalizeRecord({
        ...record,
        updatedAt: nowIso(),
        _sync: { ...(record._sync || {}), dirty: true },
      }));
      await putRecords(cleaned);
    }
    return false;
  }
  await putRecords(ALL_SEED_RECORDS.map(item => normalizeRecord(item)));
  return true;
}

export async function listRecords(type, { includeArchived = false } = {}) {
  const items = await getAllRecords({ type });
  return includeArchived ? items : items.filter(item => !item.archivedAt);
}

export async function getExercise(id) { return getRecord(id); }
export async function getRoutine(id) { return getRecord(id); }
export async function getPlan(id) { return getRecord(id); }
export async function getSessionRecord(id) { return getRecord(id); }

export async function saveExercise(input) {
  const existing = input.id ? await getRecord(input.id) : null;
  const record = normalizeRecord({
    ...(existing || {}), ...input,
    id: input.id || uuid(), type: 'exercise',
    exerciseCode: existing?.exerciseCode || input.exerciseCode || null,
    createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso(),
    _sync: { ...(existing?._sync || {}), dirty: true, deleted: false, seed: false },
  });
  const errors = validateRecord(record);
  if (errors.length) throw new Error(errors.join(' '));
  await putRecord(record);
  return record;
}

export async function saveRoutine(input) {
  const existing = input.id ? await getRecord(input.id) : null;
  const record = normalizeRecord({
    ...(existing || {}), ...input,
    id: input.id || uuid(), type: 'routine',
    createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso(),
    _sync: { ...(existing?._sync || {}), dirty: true, deleted: false, seed: false },
  });
  const errors = validateRecord(record);
  if (errors.length) throw new Error(errors.join(' '));
  await putRecord(record);
  return record;
}

export async function savePlan(input) {
  const existing = input.id ? await getRecord(input.id) : null;
  let record = normalizeRecord({
    ...(existing || {}), ...input,
    id: input.id || uuid(), type: 'plan',
    createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso(),
    _sync: { ...(existing?._sync || {}), dirty: true, deleted: false, seed: false },
  });
  const errors = validateRecord(record);
  if (errors.length) throw new Error(errors.join(' '));

  if (record.active) {
    const plans = await listRecords('plan', { includeArchived: true });
    for (const plan of plans) {
      if (plan.id !== record.id && plan.active) {
        const changed = cloneAsDirty(plan, { active: false });
        await putRecord(changed);
      }
    }
  }
  await putRecord(record);
  return record;
}

export async function setActivePlan(planId) {
  const plans = await listRecords('plan', { includeArchived: true });
  for (const plan of plans) {
    const shouldBeActive = plan.id === planId;
    if (plan.active !== shouldBeActive) await putRecord(cloneAsDirty(plan, { active: shouldBeActive }));
  }
}

export async function setPlanNextRoutine(planId, routineIndex) {
  const plan = await getRecord(planId);
  if (!plan || plan.type !== 'plan') throw new Error('Plan no encontrado.');
  const max = Math.max(0, plan.routineIds.length - 1);
  const index = Math.min(max, Math.max(0, Number(routineIndex) || 0));
  await putRecord(cloneAsDirty(plan, { currentRoutineIndex: index }));
}

export async function archiveRecord(id, archived = true) {
  const record = await getRecord(id);
  if (!record) throw new Error('Registro no encontrado.');
  await putRecord(cloneAsDirty(record, { archivedAt: archived ? nowIso() : null }));
}

export async function deleteRecord(id) {
  const record = await getRecord(id);
  if (!record) return false;
  await markRecordDeleted(record);
  if (record.type === 'session') await recalculateReferenceLoads();
  return true;
}

export async function getActivePlanContext() {
  const plans = await listRecords('plan');
  const plan = plans.find(item => item.active) || null;
  if (!plan) return { plan: null, routines: [], nextRoutine: null };
  const allRoutines = new Map((await listRecords('routine', { includeArchived: true })).map(item => [item.id, item]));
  const routines = plan.routineIds.map(id => allRoutines.get(id)).filter(Boolean);
  const nextRoutine = routines.length ? routines[plan.currentRoutineIndex % routines.length] : null;
  return { plan, routines, nextRoutine };
}

export async function buildSessionFromRoutine(routineId, { planId = null, performedAt = nowIso() } = {}) {
  const routine = await getRecord(routineId);
  if (!routine || routine.type !== 'routine') throw new Error('Rutina no encontrada.');
  const exercises = new Map((await listRecords('exercise', { includeArchived: true })).map(item => [item.id, item]));
  return normalizeRecord({
    id: uuid(), type: 'session', performedAt, planId, routineId,
    routineNameSnapshot: routine.name, source: 'manual', sourceKey: null,
    entries: routine.exerciseItems.map(item => {
      const ex = exercises.get(item.exerciseId);
      return {
        exerciseId: item.exerciseId,
        exerciseCodeSnapshot: ex?.exerciseCode || null,
        exerciseNameSnapshot: ex?.name || 'Ejercicio',
        loadMode: ex?.loadMode || 'external_kg',
        loadBasis: ex?.loadBasis || 'total_load',
        weightUnit: ex?.weightUnit || 'kg',
        loadValue: ex?.referenceLoad ?? null,
        sets: item.targetSets ?? routine.defaultSets ?? 3,
        reps: item.targetReps ?? routine.defaultReps ?? 12,
        note: item.note || '',
      };
    }),
    notes: '',
    _sync: { dirty: true, deleted: false, syncedServerUpdatedAt: null, seed: false },
  });
}

export async function saveSession(input, { advancePlan = true } = {}) {
  const existing = input.id ? await getRecord(input.id) : null;
  const session = normalizeRecord({
    ...(existing || {}), ...input,
    id: input.id || uuid(), type: 'session',
    createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso(),
    _sync: { ...(existing?._sync || {}), dirty: true, deleted: false, seed: false },
  });
  const errors = validateRecord(session);
  if (errors.length) throw new Error(errors.join(' '));

  if (session.sourceKey) {
    const sessions = await listRecords('session', { includeArchived: true });
    const duplicate = sessions.find(item => item.id !== session.id && item.sourceKey === session.sourceKey);
    if (duplicate) throw new Error(`Ya existe una sesión con source_key ${session.sourceKey}.`);
  }

  await putRecord(session);
  await updateReferenceLoadsFromSession(session);
  if (advancePlan && session.planId) await advancePlanIfExpected(session.planId, session.routineId);
  return session;
}

async function updateReferenceLoadsFromSession(session) {
  for (const entry of session.entries || []) {
    const exercise = await getRecord(entry.exerciseId);
    if (!exercise || exercise.type !== 'exercise') continue;
    if (entry.loadMode === 'untracked') continue;
    const next = cloneAsDirty(exercise, {
      referenceLoad: entry.loadValue ?? null,
      referenceLoadUpdatedAt: session.performedAt || nowIso(),
    });
    await putRecord(next);
  }
}

async function advancePlanIfExpected(planId, routineId) {
  const plan = await getRecord(planId);
  if (!plan || plan.type !== 'plan' || !plan.routineIds.length) return false;
  const expected = plan.routineIds[plan.currentRoutineIndex % plan.routineIds.length];
  if (expected !== routineId) return false;
  const nextIndex = (plan.currentRoutineIndex + 1) % plan.routineIds.length;
  await putRecord(cloneAsDirty(plan, { currentRoutineIndex: nextIndex }));
  return true;
}

export async function recalculateReferenceLoads() {
  const exercises = await listRecords('exercise', { includeArchived: true });
  const sessions = (await listRecords('session', { includeArchived: true }))
    .sort((a, b) => String(a.performedAt).localeCompare(String(b.performedAt)));
  const latest = new Map();
  for (const session of sessions) {
    for (const entry of session.entries || []) latest.set(entry.exerciseId, { entry, performedAt: session.performedAt });
  }
  for (const exercise of exercises) {
    const item = latest.get(exercise.id);
    const changed = cloneAsDirty(exercise, {
      referenceLoad: item ? item.entry.loadValue ?? null : exercise.baselineLoad ?? null,
      referenceLoadUpdatedAt: item ? item.performedAt : (exercise.baselineLoad == null ? null : exercise.referenceLoadUpdatedAt),
    });
    await putRecord(changed);
  }
}

export async function getExerciseHistory(exerciseId) {
  const sessions = await listRecords('session', { includeArchived: true });
  const rows = [];
  for (const session of sessions) {
    for (const entry of session.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;
      rows.push({
        sessionId: session.id,
        performedAt: session.performedAt,
        routineName: session.routineNameSnapshot,
        loadValue: entry.loadValue,
        loadMode: entry.loadMode,
        loadBasis: entry.loadBasis,
        weightUnit: entry.weightUnit || 'kg',
        sets: entry.sets,
        reps: entry.reps,
        note: entry.note,
      });
    }
  }
  return rows.sort((a, b) => String(a.performedAt).localeCompare(String(b.performedAt)));
}

export async function resolveExerciseCode(code) {
  return findExerciseByCode(String(code || '').trim().toUpperCase());
}

export async function syncAfterWrite() {
  try { return await syncAll({ silent: true }); }
  catch { return { ok: false }; }
}
