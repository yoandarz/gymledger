import { MUSCLE_ZONES } from './exercise-catalog.js';
import { escapeHtml } from './utils.js';

export const EXERCISE_SORTS = [
  { value: 'code-asc', label: 'Código EX: menor a mayor' },
  { value: 'code-desc', label: 'Código EX: mayor a menor' },
  { value: 'name-asc', label: 'Nombre: A–Z' },
  { value: 'name-desc', label: 'Nombre: Z–A' },
  { value: 'zone-asc', label: 'Grupo muscular: A–Z' },
];

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export function exerciseZones(exercise) {
  const muscles = [...(exercise.primaryMuscles || []), ...(exercise.secondaryMuscles || [])];
  return MUSCLE_ZONES.filter(zone => zone.muscles.some(muscle => muscles.includes(muscle))).map(zone => zone.zone);
}

export function filterAndSortExercises(exercises, { query = '', zone = '', sort = 'code-asc' } = {}) {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return exercises.filter(exercise => {
    if (zone && !exerciseZones(exercise).includes(zone)) return false;
    const searchable = normalize([
      exercise.name, exercise.exerciseCode, ...(exercise.primaryMuscles || []),
      ...(exercise.secondaryMuscles || []), ...(exercise.equipment || []),
      ...exerciseZones(exercise),
    ].join(' '));
    return words.every(word => searchable.includes(word));
  }).sort((a, b) => {
    const codes = collator.compare(a.exerciseCode || 'ZZZZ', b.exerciseCode || 'ZZZZ');
    const names = collator.compare(a.name || '', b.name || '');
    if (sort === 'code-desc') return -codes || names;
    if (sort === 'name-asc') return names || codes;
    if (sort === 'name-desc') return -names || codes;
    if (sort === 'zone-asc') return collator.compare(exerciseZones(a)[0] || 'ZZZZ', exerciseZones(b)[0] || 'ZZZZ') || names || codes;
    return codes || names;
  });
}

export function exerciseFilterControls(prefix, placeholder = 'Buscar nombre, código, músculo o equipo…') {
  return `<div class="exercise-filters" role="group" aria-label="Buscar y ordenar ejercicios">
    <label class="exercise-filter-search">Buscar ejercicio
      <input id="${prefix}-query" type="search" placeholder="${escapeHtml(placeholder)}" autocomplete="off" spellcheck="false">
    </label>
    <label>Grupo muscular
      <select id="${prefix}-zone"><option value="">Todos los grupos</option>${MUSCLE_ZONES.map(item => `<option value="${escapeHtml(item.zone)}">${escapeHtml(item.zone)}</option>`).join('')}</select>
    </label>
    <label>Ordenar por
      <select id="${prefix}-sort">${EXERCISE_SORTS.map(item => `<option value="${item.value}">${item.label}</option>`).join('')}</select>
    </label>
  </div>`;
}

export function wireExerciseFilters(root, prefix, exercises, onChange) {
  const query = root.querySelector(`#${prefix}-query`);
  const zone = root.querySelector(`#${prefix}-zone`);
  const sort = root.querySelector(`#${prefix}-sort`);
  const refresh = () => onChange(filterAndSortExercises(exercises, {
    query: query.value, zone: zone.value, sort: sort.value,
  }));
  query.addEventListener('input', refresh);
  zone.addEventListener('change', refresh);
  sort.addEventListener('change', refresh);
  refresh();
}
