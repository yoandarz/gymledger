import { deleteSetting, getSetting, setSetting } from './db.js';
import { nowIso } from './utils.js';

export const ACTIVE_SESSION_DRAFT_KEY = 'activeSessionDraft';
export const ACTIVE_SESSION_DRAFT_VERSION = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export async function getActiveSessionDraft() {
  const draft = await getSetting(ACTIVE_SESSION_DRAFT_KEY, null);
  if (!draft || draft.version !== ACTIVE_SESSION_DRAFT_VERSION || !draft.session?.routineId) return null;
  return draft;
}

export async function saveActiveSessionDraft({ session, startedAt = null, completedIndexes = [] } = {}) {
  if (!session?.routineId) throw new Error('No se puede guardar un borrador sin rutina.');
  const uniqueCompleted = [...new Set((completedIndexes || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const draft = {
    version: ACTIVE_SESSION_DRAFT_VERSION,
    startedAt: startedAt || session.performedAt || nowIso(),
    savedAt: nowIso(),
    completedIndexes: uniqueCompleted,
    session: clone(session),
  };
  await setSetting(ACTIVE_SESSION_DRAFT_KEY, draft);
  return draft;
}

export async function clearActiveSessionDraft() {
  await deleteSetting(ACTIVE_SESSION_DRAFT_KEY);
}

export function draftProgress(draft) {
  const total = draft?.session?.entries?.length || 0;
  const completed = new Set((draft?.completedIndexes || []).map(Number).filter(index => index >= 0 && index < total)).size;
  return { completed, total };
}
