import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortExercises, exerciseZones } from '../js/exercise-search.js';

const exercises = [
  { id: 'a', exerciseCode: 'EX-0018', name: 'Elevación de rodillas', primaryMuscles: ['Recto abdominal'], secondaryMuscles: ['Flexores de cadera'], equipment: [] },
  { id: 'b', exerciseCode: 'EX-0002', name: 'Press de banca inclinado', primaryMuscles: ['Pectoral mayor'], secondaryMuscles: ['Deltoides anterior'], equipment: ['Barra'] },
  { id: 'c', exerciseCode: 'EX-0010', name: 'Jalón al pecho', primaryMuscles: ['Dorsal ancho'], secondaryMuscles: [], equipment: ['Polea alta'] },
];
test('busca por fragmento sin acentos y por código', () => {
  assert.deepEqual(filterAndSortExercises(exercises, { query: 'elevacion' }).map(x => x.id), ['a']);
  assert.deepEqual(filterAndSortExercises(exercises, { query: 'EX-0010' }).map(x => x.id), ['c']);
});
test('combina términos con filtro muscular', () => {
  assert.deepEqual(filterAndSortExercises(exercises, { query: 'press', zone: 'Pecho' }).map(x => x.id), ['b']);
  assert.deepEqual(filterAndSortExercises(exercises, { zone: 'Core' }).map(x => x.id), ['a']);
  assert.ok(exerciseZones(exercises[1]).includes('Hombros'));
});
test('ordena por código y nombre sin modificar el catálogo', () => {
  assert.deepEqual(filterAndSortExercises(exercises).map(x => x.id), ['b','c','a']);
  assert.deepEqual(filterAndSortExercises(exercises,{sort:'code-desc'}).map(x => x.id), ['a','c','b']);
  assert.deepEqual(filterAndSortExercises(exercises,{sort:'name-asc'}).map(x => x.id), ['a','c','b']);
  assert.deepEqual(exercises.map(x => x.id), ['a','b','c']);
});
