import { deleteSetting, getSetting, setSetting } from './db.js';
import { nowIso } from './utils.js';

export const ACTIVE_SESSION_DRAFT_KEY = 'activeSessionDraft';
export const ACTIVE_SESSION_DRAFT_VERSION = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeCompletedSetCounts(input = {}) {
  const output = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    const index = Number(key);
    const count = Number(value);
    if (Number.isInteger(index) && index >= 0 && Number.isFinite(count)) {
      output[index] = Math.max(0, Math.floor(count));
    }
  });
  return output;
}

export async function getActiveSessionDraft() {
  const draft = await getSetting(ACTIVE_SESSION_DRAFT_KEY, null);
  if (!draft || draft.version !== ACTIVE_SESSION_DRAFT_VERSION || !draft.session?.routineId) return null;
  return draft;
}

export async function saveActiveSessionDraft({
  session,
  startedAt = null,
  completedIndexes = [],
  completedSetCounts = {},
  restTimer = null,
  restSeconds = null,
} = {}) {
  if (!session?.routineId) throw new Error('No se puede guardar un borrador sin rutina.');
  const counts = normalizeCompletedSetCounts(completedSetCounts);
  const completedFromCounts = (session.entries || []).reduce((indexes, entry, index) => {
    const total = Math.max(1, Number(entry?.sets) || 3);
    if ((counts[index] || 0) >= total) indexes.push(index);
    return indexes;
  }, []);
  const legacyCompleted = [...new Set((completedIndexes || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const uniqueCompleted = completedFromCounts.length || Object.keys(counts).length ? completedFromCounts : legacyCompleted;
  const normalizedRestSeconds = restSeconds == null
    ? null
    : Math.max(0, Math.min(3599, Math.floor(Number(restSeconds) || 0)));
  const draft = {
    version: ACTIVE_SESSION_DRAFT_VERSION,
    startedAt: startedAt || session.performedAt || nowIso(),
    savedAt: nowIso(),
    completedIndexes: uniqueCompleted,
    completedSetCounts: counts,
    restTimer: restTimer?.endsAt ? clone(restTimer) : null,
    restSeconds: normalizedRestSeconds,
    session: clone(session),
  };
  await setSetting(ACTIVE_SESSION_DRAFT_KEY, draft);
  return draft;
}

export async function clearActiveSessionDraft() {
  await deleteSetting(ACTIVE_SESSION_DRAFT_KEY);
}

export function draftProgress(draft) {
  const entries = draft?.session?.entries || [];
  const total = entries.length;
  const counts = normalizeCompletedSetCounts(draft?.completedSetCounts);
  if (Object.keys(counts).length) {
    const completed = entries.reduce((sum, entry, index) => {
      const required = Math.max(1, Number(entry?.sets) || 3);
      return sum + ((counts[index] || 0) >= required ? 1 : 0);
    }, 0);
    return { completed, total };
  }
  const completed = new Set((draft?.completedIndexes || []).map(Number).filter(index => index >= 0 && index < total)).size;
  return { completed, total };
}
