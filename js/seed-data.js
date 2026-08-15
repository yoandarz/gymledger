const stamp = '2026-08-15T12:30:00.000Z';
const seedSync = { dirty: true, deleted: false, syncedServerUpdatedAt: null, seed: true };

function exercise(id, exerciseCode, name, config = {}) {
  return {
    id, type: 'exercise', exerciseCode, name,
    primaryMuscles: config.primaryMuscles || [],
    secondaryMuscles: config.secondaryMuscles || [],
    equipment: config.equipment || [],
    loadMode: config.loadMode || 'external_kg',
    loadBasis: config.loadBasis || 'total_load',
    notes: config.notes || '',
    imageDataUrl: null,
    imageAlt: '',
    baselineLoad: config.baselineLoad ?? null,
    referenceLoad: config.baselineLoad ?? null,
    referenceLoadUpdatedAt: config.baselineLoad == null ? null : stamp,
    archivedAt: null,
    createdAt: stamp, updatedAt: stamp, _sync: { ...seedSync },
  };
}

export const SEED_EXERCISES = [
  exercise('seed-ex-0001', 'EX-0001', 'Press de banca plano con barra', {
    primaryMuscles: ['Pectoral mayor'], secondaryMuscles: ['Tríceps', 'Deltoides anterior'], equipment: ['Banco plano', 'Barra'], loadBasis: 'per_side_disc', baselineLoad: 8.75,
    notes: 'La carga se registra como discos por lado.'
  }),
  exercise('seed-ex-0002', 'EX-0002', 'Press de banca inclinado con barra', {
    primaryMuscles: ['Pectoral mayor (porción clavicular)'], secondaryMuscles: ['Tríceps', 'Deltoides anterior'], equipment: ['Banco inclinado', 'Barra'], loadBasis: 'per_side_disc', baselineLoad: 8.75,
    notes: 'La carga se registra como discos por lado.'
  }),
  exercise('seed-ex-0003', 'EX-0003', 'Press de hombros con mancuernas', {
    primaryMuscles: ['Deltoides anterior', 'Deltoides lateral'], secondaryMuscles: ['Tríceps'], equipment: ['Mancuernas'], loadBasis: 'per_dumbbell', baselineLoad: 10,
    notes: 'Sustituye al press militar con barra. Usar el agarre que resulte cómodo para el antebrazo; preferencia actual: neutro.'
  }),
  exercise('seed-ex-0004', 'EX-0004', 'Extensión de tríceps en polea alta con cuerda', {
    primaryMuscles: ['Tríceps'], equipment: ['Polea alta', 'Cuerda'], loadBasis: 'machine_stack', baselineLoad: 14,
  }),
  exercise('seed-ex-0005', 'EX-0005', 'Extensión de tríceps sobre la cabeza con cuerda', {
    primaryMuscles: ['Tríceps (cabeza larga)'], secondaryMuscles: ['Tríceps'], equipment: ['Polea', 'Cuerda'], loadBasis: 'machine_stack', baselineLoad: 9,
  }),
  exercise('seed-ex-0006', 'EX-0006', 'Pec deck', {
    primaryMuscles: ['Pectoral mayor'], secondaryMuscles: ['Deltoides anterior'], equipment: ['Máquina pec deck'], loadBasis: 'machine_stack', baselineLoad: 43,
  }),
  exercise('seed-ex-0007', 'EX-0007', 'Elevaciones laterales con mancuernas', {
    primaryMuscles: ['Deltoides lateral'], secondaryMuscles: ['Supraespinoso', 'Trapecio superior'], equipment: ['Mancuernas'], loadBasis: 'per_dumbbell', baselineLoad: null,
    notes: 'Añadido para trabajar directamente la anchura visual del hombro.'
  }),
  exercise('seed-ex-0008', 'EX-0008', 'Remo sentado en polea baja con barra recta', {
    primaryMuscles: ['Dorsal ancho', 'Romboides', 'Trapecio medio'], secondaryMuscles: ['Deltoides posterior', 'Bíceps'], equipment: ['Polea baja', 'Barra recta larga'], loadBasis: 'machine_stack', baselineLoad: 39,
    notes: 'Agarre prono: palmas hacia abajo.'
  }),
  exercise('seed-ex-0009', 'EX-0009', 'Remo unilateral en polea baja con agarre neutro', {
    primaryMuscles: ['Dorsal ancho', 'Romboides'], secondaryMuscles: ['Bíceps', 'Deltoides posterior'], equipment: ['Polea baja', 'Asa individual'], loadBasis: 'machine_stack', baselineLoad: 18,
    notes: 'Mano en posición vertical mediante asa individual.'
  }),
  exercise('seed-ex-0010', 'EX-0010', 'Jalón al pecho en polea alta', {
    primaryMuscles: ['Dorsal ancho'], secondaryMuscles: ['Bíceps', 'Redondo mayor'], equipment: ['Polea alta'], loadBasis: 'machine_stack', baselineLoad: 39,
  }),
  exercise('seed-ex-0011', 'EX-0011', 'Pullover en polea con barra corta', {
    primaryMuscles: ['Dorsal ancho'], secondaryMuscles: ['Redondo mayor', 'Tríceps (cabeza larga)'], equipment: ['Polea', 'Barra corta'], loadBasis: 'machine_stack', baselineLoad: 18,
    notes: 'Se usa barra corta por estabilidad.'
  }),
  exercise('seed-ex-0012', 'EX-0012', 'Face pull en polea con cuerda', {
    primaryMuscles: ['Deltoides posterior', 'Trapecio medio'], secondaryMuscles: ['Romboides', 'Manguito rotador'], equipment: ['Polea', 'Cuerda'], loadBasis: 'machine_stack', baselineLoad: 23,
  }),
  exercise('seed-ex-0013', 'EX-0013', 'Curl de bíceps con barra Z', {
    primaryMuscles: ['Bíceps braquial'], secondaryMuscles: ['Braquial', 'Braquiorradial'], equipment: ['Barra Z'], loadBasis: 'per_side_disc', baselineLoad: 6.25,
    notes: 'La carga se registra como discos por lado.'
  }),
  exercise('seed-ex-0014', 'EX-0014', 'Curl alternado de bíceps con mancuernas', {
    primaryMuscles: ['Bíceps braquial'], secondaryMuscles: ['Braquial', 'Braquiorradial'], equipment: ['Mancuernas'], loadBasis: 'per_dumbbell', baselineLoad: 10,
  }),
  exercise('seed-ex-0015', 'EX-0015', 'Extensión de cuádriceps en máquina', {
    primaryMuscles: ['Cuádriceps'], equipment: ['Máquina de extensión de piernas'], loadBasis: 'machine_stack', baselineLoad: 29,
  }),
  exercise('seed-ex-0016', 'EX-0016', 'Curl femoral en máquina', {
    primaryMuscles: ['Isquiotibiales'], secondaryMuscles: ['Gastrocnemio'], equipment: ['Máquina de curl femoral'], loadBasis: 'machine_stack', baselineLoad: 27,
  }),
  exercise('seed-ex-0017', 'EX-0017', 'Prensa de piernas en máquina', {
    primaryMuscles: ['Cuádriceps', 'Glúteo mayor'], secondaryMuscles: ['Isquiotibiales'], equipment: ['Prensa de piernas'], loadBasis: 'machine_stack', baselineLoad: 86,
    notes: 'El valor se registra según la indicación de carga de la máquina actual.'
  }),
  exercise('seed-ex-0018', 'EX-0018', 'Elevación de rodillas', {
    primaryMuscles: ['Recto abdominal', 'Flexores de cadera'], secondaryMuscles: ['Oblicuos'], equipment: ['Roman Chair / soporte'], loadMode: 'bodyweight_plus_kg', loadBasis: 'added_weight', baselineLoad: 0,
    notes: '0 kg significa peso corporal sin carga externa añadida. En el futuro se puede registrar carga adicional.'
  }),
  exercise('seed-ex-0019', 'EX-0019', 'Crunch abdominal en máquina', {
    primaryMuscles: ['Recto abdominal'], secondaryMuscles: ['Oblicuos'], equipment: ['Máquina abdominal'], loadBasis: 'machine_stack', baselineLoad: 43,
  }),
  exercise('seed-ex-0020', 'EX-0020', 'Hip thrust con barra', {
    primaryMuscles: ['Glúteo mayor'], secondaryMuscles: ['Isquiotibiales'], equipment: ['Banco', 'Barra'], loadBasis: 'per_side_disc', baselineLoad: 7.5,
    notes: 'La carga se registra como discos por lado.'
  }),
  exercise('seed-ex-0021', 'EX-0021', 'Abducción de cadera en máquina', {
    primaryMuscles: ['Glúteo medio', 'Glúteo menor'], secondaryMuscles: ['Tensor de la fascia lata'], equipment: ['Máquina abductora'], loadBasis: 'machine_stack', baselineLoad: 50,
  }),
  exercise('seed-ex-0022', 'EX-0022', 'Elevación de talones de pie con mancuernas', {
    primaryMuscles: ['Gastrocnemio', 'Sóleo'], equipment: ['Mancuernas', 'Escalón o plataforma estable'], loadBasis: 'per_dumbbell', baselineLoad: null,
    notes: 'Antepié sobre una superficie elevada; bajar el talón de forma controlada y subir completamente.'
  }),
];

function routine(id, name, exerciseIds, description) {
  return {
    id, type: 'routine', name, description,
    defaultSets: 3, defaultReps: 12,
    exerciseItems: exerciseIds.map((exerciseId, order) => ({ exerciseId, targetSets: 3, targetReps: 12, note: '', order })),
    archivedAt: null, createdAt: stamp, updatedAt: stamp, _sync: { ...seedSync },
  };
}

export const SEED_ROUTINES = [
  routine('seed-routine-push', 'Empuje', ['seed-ex-0001','seed-ex-0002','seed-ex-0003','seed-ex-0004','seed-ex-0005','seed-ex-0006','seed-ex-0007'], 'Pecho, hombros y tríceps.'),
  routine('seed-routine-pull', 'Jalón', ['seed-ex-0008','seed-ex-0009','seed-ex-0010','seed-ex-0011','seed-ex-0012','seed-ex-0013','seed-ex-0014'], 'Espalda, deltoides posterior y bíceps.'),
  routine('seed-routine-legs-core', 'Piernas-Core', ['seed-ex-0015','seed-ex-0016','seed-ex-0017','seed-ex-0018','seed-ex-0019','seed-ex-0020','seed-ex-0021','seed-ex-0022'], 'Piernas, glúteos, gemelos y trabajo de core del gimnasio.'),
];

export const SEED_PLANS = [
  {
    id: 'seed-plan-current', type: 'plan', name: 'Plan actual',
    description: 'Ciclo continuo de tres rutinas. No depende de días de la semana.',
    routineIds: ['seed-routine-push','seed-routine-pull','seed-routine-legs-core'],
    active: true, currentRoutineIndex: 0,
    archivedAt: null, createdAt: stamp, updatedAt: stamp, _sync: { ...seedSync },
  },
];

export const ALL_SEED_RECORDS = [...SEED_EXERCISES, ...SEED_ROUTINES, ...SEED_PLANS];
