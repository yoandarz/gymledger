import { APP_NAME, APP_VERSION, GPT_CONTEXT_VERSION, SESSION_SCHEMA_VERSION } from './constants.js';
import { exportLocalDatabase, getAllRecords, getRecord, putRecord, putRecords, setSetting } from './db.js';
import { normalizeRecord } from './schema.js';
import { listRecords, resolveExerciseCode, saveSession } from './gym-service.js';
import { downloadText, kgToUnit, nowIso, unitToKg, uuid } from './utils.js';

export async function exportFullBackup() {
  const data = await exportLocalDatabase();
  const payload = {
    kind: 'gymledger_backup', schema_version: '2.0', app_version: APP_VERSION,
    exported_at: nowIso(), ...data,
  };
  downloadText(`GymLedger_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
  return payload;
}

export async function importFullBackup(payload) {
  if (!payload || payload.kind !== 'gymledger_backup' || !Array.isArray(payload.records)) {
    throw new Error('El archivo no es una copia completa válida de GymLedger 2.0.');
  }
  const normalized = payload.records.map(item => {
    const record = normalizeRecord(item);
    record._sync = { dirty: true, deleted: false, syncedServerUpdatedAt: null, seed: false };
    return record;
  });
  await putRecords(normalized);
  if (payload.settings?.theme) await setSetting('theme', payload.settings.theme);
  return { imported: normalized.length };
}

export async function buildGptContext() {
  const exercises = (await listRecords('exercise', { includeArchived: true }))
    .filter(item => item.exerciseCode)
    .sort((a, b) => String(a.exerciseCode).localeCompare(String(b.exerciseCode)));
  const routines = await listRecords('routine', { includeArchived: true });
  const plans = await listRecords('plan', { includeArchived: true });
  const exMap = new Map(exercises.map(item => [item.id, item]));
  return {
    kind: 'gymledger_gpt_context',
    schema_version: GPT_CONTEXT_VERSION,
    app_version: APP_VERSION,
    generated_at: nowIso(),
    instructions: {
      session_schema: SESSION_SCHEMA_VERSION,
      exercise_key: 'exercise_code',
      rule: 'No inventar exercise_code. Si el ejercicio no existe en este catálogo, proponer un alta nueva sin asignar código canónico; GymLedger lo asignará al sincronizar.',
    },
    exercises: exercises.map(ex => ({
      exercise_code: ex.exerciseCode,
      name: ex.name,
      load_mode: ex.loadMode,
      load_basis: ex.loadBasis,
      weight_unit: ex.weightUnit || 'kg',
      primary_muscles: ex.primaryMuscles,
      secondary_muscles: ex.secondaryMuscles,
      equipment: ex.equipment,
      notes: ex.notes,
      current_reference_load: ex.referenceLoad == null ? null : kgToUnit(ex.referenceLoad, ex.weightUnit || 'kg'),
      archived: Boolean(ex.archivedAt),
    })),
    routines: routines.map(routine => ({
      routine_id: routine.id,
      name: routine.name,
      default_sets: routine.defaultSets,
      default_reps: routine.defaultReps,
      archived: Boolean(routine.archivedAt),
      exercises: routine.exerciseItems.map(item => ({
        exercise_code: exMap.get(item.exerciseId)?.exerciseCode || null,
        exercise_name: exMap.get(item.exerciseId)?.name || null,
        target_sets: item.targetSets,
        target_reps: item.targetReps,
        note: item.note,
      })).filter(item => item.exercise_code),
    })),
    plans: plans.map(plan => ({
      plan_id: plan.id,
      name: plan.name,
      active: plan.active,
      archived: Boolean(plan.archivedAt),
      routine_ids: plan.routineIds,
      current_routine_index: plan.currentRoutineIndex,
    })),
  };
}

export async function exportGptContext() {
  const context = await buildGptContext();
  downloadText(`GymLedger_contexto_GPT_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(context, null, 2));
  return context;
}

function normalizeSessionPayload(payload) {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  return {
    schemaVersion: String(payload.schema_version || payload.schemaVersion || ''),
    sourceKey: payload.source_key || payload.sourceKey || null,
    performedAt: payload.performed_at || payload.performedAt || payload.date || null,
    planId: payload.plan_id || payload.planId || null,
    routineId: payload.routine_id || payload.routineId || null,
    routineName: payload.routine_name || payload.routineName || '',
    notes: payload.notes || '',
    entries: entries.map(item => ({
      exerciseCode: item.exercise_code || item.exerciseCode || null,
      loadValue: item.load_value ?? item.loadValue ?? item.weight ?? null,
      loadMode: item.load_mode || item.loadMode || null,
      loadBasis: item.load_basis || item.loadBasis || null,
      weightUnit: item.weight_unit || item.weightUnit || null,
      sets: item.sets ?? null,
      reps: item.reps ?? null,
      note: item.note || item.notes || '',
    })),
  };
}

export async function importSessionJson(payload, { advancePlan = true } = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('JSON de sesión no válido.');
  if (payload.kind === 'session_bundle' && Array.isArray(payload.sessions)) {
    const results = [];
    for (const item of payload.sessions) results.push(await importSessionJson(item, { advancePlan }));
    return { bundle: true, imported: results.length, results };
  }
  const data = normalizeSessionPayload(payload);
  if (data.schemaVersion && !['2.0', SESSION_SCHEMA_VERSION].includes(data.schemaVersion)) {
    throw new Error(`Versión de sesión no compatible: ${data.schemaVersion}. Se espera ${SESSION_SCHEMA_VERSION}.`);
  }
  if (!data.routineId) throw new Error('Falta routine_id.');
  const routine = await getRecord(data.routineId);
  if (!routine || routine.type !== 'routine') throw new Error('routine_id no existe en esta aplicación. Exporta un contexto GPT actualizado.');
  if (data.planId) {
    const plan = await getRecord(data.planId);
    if (!plan || plan.type !== 'plan') throw new Error('plan_id no existe en esta aplicación.');
  }
  if (!data.entries.length) throw new Error('La sesión no contiene ejercicios.');

  const routineTargets = new Map(routine.exerciseItems.map(item => [item.exerciseId, item]));
  const resolvedEntries = [];
  const missing = [];
  for (const item of data.entries) {
    const ex = await resolveExerciseCode(item.exerciseCode);
    if (!ex) {
      missing.push(item.exerciseCode || '(sin código)');
      continue;
    }
    const target = routineTargets.get(ex.id);
    resolvedEntries.push({
      exerciseId: ex.id,
      exerciseCodeSnapshot: ex.exerciseCode,
      exerciseNameSnapshot: ex.name,
      loadMode: item.loadMode || ex.loadMode,
      loadBasis: item.loadBasis || ex.loadBasis,
      weightUnit: item.weightUnit || ex.weightUnit || 'kg',
      loadValue: item.loadValue == null ? null : (['external_kg','bodyweight_plus_kg','assistance_kg'].includes(item.loadMode || ex.loadMode) ? unitToKg(item.loadValue, item.weightUnit || ex.weightUnit || 'kg') : item.loadValue),
      sets: item.sets ?? target?.targetSets ?? routine.defaultSets ?? 3,
      reps: item.reps ?? target?.targetReps ?? routine.defaultReps ?? 12,
      note: item.note || target?.note || '',
    });
  }
  if (missing.length) throw new Error(`No se reconocen estos exercise_code: ${missing.join(', ')}. Actualiza el catálogo/GPT antes de importar.`);

  const session = normalizeRecord({
    id: uuid(), type: 'session',
    performedAt: data.performedAt || nowIso(),
    planId: data.planId,
    routineId: routine.id,
    routineNameSnapshot: routine.name,
    source: 'json', sourceKey: data.sourceKey,
    entries: resolvedEntries, notes: data.notes,
    _sync: { dirty: true, deleted: false, syncedServerUpdatedAt: null, seed: false },
  });
  await saveSession(session, { advancePlan });
  return session;
}

export function exampleSessionJson({ planId = 'PLAN_ID', routineId = 'ROUTINE_ID' } = {}) {
  return {
    schema_version: SESSION_SCHEMA_VERSION,
    source_key: '2026-08-15T10:00:00_empuje',
    performed_at: '2026-08-15T10:00:00+02:00',
    plan_id: planId,
    routine_id: routineId,
    entries: [
      { exercise_code: 'EX-0001', load_value: 8.75, weight_unit: 'kg', sets: 3, reps: 12 },
      { exercise_code: 'EX-0002', load_value: 8.75, weight_unit: 'kg', sets: 3, reps: 12 }
    ],
    notes: ''
  };
}
