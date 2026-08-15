export function nowIso() {
  return new Date().toISOString();
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

export function parseCsvText(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const clean = String(value || '').trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export function sortByName(items = []) {
  return [...items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
}

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });
}

export function clampInt(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}


export function kgToUnit(valueKg, unit = 'kg') {
  if (valueKg === null || valueKg === undefined || valueKg === '') return null;
  const n = Number(valueKg);
  if (!Number.isFinite(n)) return null;
  return unit === 'lb' ? n * 2.2046226218 : n;
}

export function unitToKg(value, unit = 'kg') {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return unit === 'lb' ? n / 2.2046226218 : n;
}

export function shortId(value = '') {
  const text = String(value || '');
  return text.length <= 12 ? text : `${text.slice(0, 8)}…${text.slice(-4)}`;
}

export function formatLoad(recordOrEntry, { withBasis = false, unit = null } = {}) {
  const mode = recordOrEntry?.loadMode || 'external_kg';
  const value = recordOrEntry?.loadValue ?? recordOrEntry?.referenceLoad ?? null;
  const basis = recordOrEntry?.loadBasis || '';
  if (mode === 'bodyweight') return 'Peso corporal';
  const weightUnit = unit || recordOrEntry?.weightUnit || 'kg';
  if (mode === 'bodyweight_plus_kg') {
    const amountKg = Number(value || 0);
    const amount = kgToUnit(amountKg, weightUnit) || 0;
    return amount > 0 ? `Peso corporal + ${formatNumber(amount)} ${weightUnit}` : 'Peso corporal';
  }
  if (mode === 'time_seconds') return value == null ? '—' : `${formatNumber(value)} s`;
  if (mode === 'untracked') return 'Sin carga';
  if (value == null) return 'Sin registrar';
  const suffix = withBasis && basis ? ` · ${basisLabelShort(basis)}` : '';
  const displayValue = kgToUnit(value, weightUnit);
  return `${formatNumber(displayValue)} ${weightUnit}${suffix}`;
}

export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export function basisLabelShort(value) {
  return ({
    machine_stack: 'máquina/polea',
    per_dumbbell: 'por mancuerna',
    per_side_disc: 'por lado',
    total_load: 'total',
    added_weight: 'añadido',
    bodyweight: 'corporal',
    time: 'tiempo',
    none: '',
  })[value] || value;
}

export function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function safeJsonParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (error) { return { ok: false, error }; }
}
