import { RECORD_TYPES } from './constants.js';
import { nowIso, uniqueStrings, uuid } from './utils.js';

function syncState(input = {}) {
  return {
    dirty: input?.dirty ?? true,
    deleted: input?.deleted ?? false,
    syncedServerUpdatedAt: input?.syncedServerUpdatedAt ?? null,
    seed: input?.seed ?? false,
  };
}

export function normalizeRecord(input = {}) {
  const type = RECORD_TYPES.includes(input.type) ? input.type : 'exercise';
  const base = {
    ...input,
    id: String(input.id || uuid()),
    type,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
    archivedAt: input.archivedAt || null,
    _sync: syncState(input._sync),
  };

  if (type === 'exercise') {
    // `aliases` existed briefly in 2.0.0, but are intentionally not part of
    // the exercise model. Destructuring removes the legacy field from old
    // backups or remote records when they are normalized.
    const { aliases: _legacyAliases, ...exerciseBase } = base;
    return {
      ...exerciseBase,
      exerciseCode: input.exerciseCode ? String(input.exerciseCode).trim().toUpperCase() : null,
      name: String(input.name || '').trim(),
      primaryMuscles: uniqueStrings(input.primaryMuscles || []),
      secondaryMuscles: uniqueStrings(input.secondaryMuscles || []),
      equipment: uniqueStrings(input.equipment || []),
      loadMode: input.loadMode || 'external_kg',
      loadBasis: input.loadBasis || 'total_load',
      weightUnit: input.weightUnit === 'lb' ? 'lb' : 'kg',
      notes: String(input.notes || '').trim(),
      imageDataUrl: input.imageDataUrl || null,
      imageAlt: String(input.imageAlt || '').trim(),
      baselineLoad: input.baselineLoad ?? null,
      referenceLoad: input.referenceLoad ?? input.baselineLoad ?? null,
      referenceLoadUpdatedAt: input.referenceLoadUpdatedAt || null,
    };
  }

  if (type === 'routine') {
    return {
      ...base,
      name: String(input.name || '').trim(),
      description: String(input.description || '').trim(),
      defaultSets: Number.isFinite(Number(input.defaultSets)) ? Number(input.defaultSets) : 3,
      defaultReps: Number.isFinite(Number(input.defaultReps)) ? Number(input.defaultReps) : 12,
      exerciseItems: Array.isArray(input.exerciseItems) ? input.exerciseItems.map((item, index) => ({
        exerciseId: String(item.exerciseId || ''),
        targetSets: Number.isFinite(Number(item.targetSets)) ? Number(item.targetSets) : 3,
        targetReps: Number.isFinite(Number(item.targetReps)) ? Number(item.targetReps) : 12,
        note: String(item.note || '').trim(),
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      })).filter(item => item.exerciseId) : [],
    };
  }

  if (type === 'plan') {
    return {
      ...base,
      name: String(input.name || '').trim(),
      description: String(input.description || '').trim(),
      routineIds: Array.isArray(input.routineIds) ? input.routineIds.map(String).filter(Boolean) : [],
      active: Boolean(input.active),
      currentRoutineIndex: Math.max(0, Number.parseInt(input.currentRoutineIndex || 0, 10) || 0),
    };
  }

  return {
    ...base,
    performedAt: input.performedAt || nowIso(),
    planId: input.planId || null,
    routineId: input.routineId || null,
    routineNameSnapshot: String(input.routineNameSnapshot || '').trim(),
    source: input.source || 'manual',
    sourceKey: input.sourceKey || null,
    entries: Array.isArray(input.entries) ? input.entries.map(item => ({
      exerciseId: String(item.exerciseId || ''),
      exerciseCodeSnapshot: item.exerciseCodeSnapshot ? String(item.exerciseCodeSnapshot).trim().toUpperCase() : null,
      exerciseNameSnapshot: String(item.exerciseNameSnapshot || '').trim(),
      loadMode: item.loadMode || 'external_kg',
      loadBasis: item.loadBasis || 'total_load',
      weightUnit: item.weightUnit === 'lb' ? 'lb' : 'kg',
      loadValue: item.loadValue ?? null,
      sets: Number.isFinite(Number(item.sets)) ? Number(item.sets) : null,
      reps: Number.isFinite(Number(item.reps)) ? Number(item.reps) : null,
      note: String(item.note || '').trim(),
    })).filter(item => item.exerciseId) : [],
    notes: String(input.notes || '').trim(),
  };
}

export function cloneAsDirty(record, patch = {}) {
  return normalizeRecord({
    ...record,
    ...patch,
    updatedAt: nowIso(),
    _sync: { ...(record._sync || {}), dirty: true, deleted: false, seed: false },
  });
}

export function validateRecord(record) {
  const errors = [];
  if (!record?.id) errors.push('Falta id.');
  if (!RECORD_TYPES.includes(record?.type)) errors.push('Tipo de registro no válido.');
  if (record?.type === 'exercise' && !record.name) errors.push('El ejercicio necesita nombre.');
  if (record?.type === 'routine' && !record.name) errors.push('La rutina necesita nombre.');
  if (record?.type === 'plan' && !record.name) errors.push('El plan necesita nombre.');
  if (record?.type === 'session') {
    if (!record.routineId) errors.push('La sesión necesita rutina.');
    if (!record.entries?.length) errors.push('La sesión necesita al menos un ejercicio.');
  }
  return errors;
}
