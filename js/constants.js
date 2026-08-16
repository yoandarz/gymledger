export const APP_NAME = 'GymLedger';
export const APP_VERSION = '2.0.8';
export const DB_NAME = 'gymledger-db';
export const DB_VERSION = 1;
export const STORES = {
  records: 'records',
  settings: 'settings',
  auth: 'auth',
};

export const RECORD_TYPES = ['exercise', 'routine', 'plan', 'session'];

export const LOAD_MODES = [
  { value: 'external_kg', label: 'Carga externa' },
  { value: 'bodyweight', label: 'Peso corporal' },
  { value: 'bodyweight_plus_kg', label: 'Peso corporal + carga' },
  { value: 'time_seconds', label: 'Tiempo (segundos)' },
  { value: 'assistance_kg', label: 'Asistencia de máquina' },
  { value: 'untracked', label: 'Sin registrar carga' },
];

export const LOAD_BASES = [
  { value: 'machine_stack', label: 'Pila de máquina/polea' },
  { value: 'per_dumbbell', label: 'Por mancuerna' },
  { value: 'per_side_disc', label: 'Discos por lado' },
  { value: 'total_load', label: 'Carga total' },
  { value: 'added_weight', label: 'Carga añadida al peso corporal' },
  { value: 'bodyweight', label: 'Peso corporal' },
  { value: 'time', label: 'Tiempo' },
  { value: 'none', label: 'No aplica' },
];

export const THEME_OPTIONS = ['system', 'light', 'dark'];
export const SESSION_SCHEMA_VERSION = '2.1';
export const GPT_CONTEXT_VERSION = '2.2';
export const IMAGE_MAX_BYTES = 1_500_000;

export const WEIGHT_UNITS = [
  { value: 'kg', label: 'kg · kilogramos' },
  { value: 'lb', label: 'lb · libras' },
];
