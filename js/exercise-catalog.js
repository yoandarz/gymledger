export const EQUIPMENT_GROUPS = [
  { group: 'Pesos libres', items: ['Mancuernas','Barra olímpica','Barra recta larga','Barra recta corta','Barra Z','Discos','Kettlebell'] },
  { group: 'Poleas y agarres', items: ['Polea alta','Polea baja','Polea ajustable','Cuerda','Asa individual','Agarre neutro doble','Barra de jalón','Barra recta larga','Barra recta corta'] },
  { group: 'Bancos y soportes', items: ['Banco plano','Banco inclinado','Banco ajustable','Rack / jaula','Máquina Smith','Escalón o plataforma estable','Roman Chair / soporte','Barra de dominadas','Paralelas'] },
  { group: 'Máquinas de tren superior', items: ['Máquina de press de pecho','Máquina de press de hombros','Máquina pec deck','Máquina de remo','Máquina de jalón','Máquina de fondos asistidos'] },
  { group: 'Máquinas de tren inferior', items: ['Prensa de piernas','Máquina hack squat','Máquina de extensión de piernas','Máquina de curl femoral','Máquina abductora','Máquina aductora','Máquina de gemelos','Máquina de glúteos'] },
  { group: 'Otros', items: ['Esterilla','Peso corporal','Banda elástica'] },
];

export const MUSCLE_ZONES = [
  { zone: 'Pecho', muscles: ['Pectoral mayor','Pectoral mayor (porción clavicular)','Pectoral menor'] },
  { zone: 'Espalda', muscles: ['Dorsal ancho','Trapecio superior','Trapecio medio','Trapecio inferior','Romboides','Redondo mayor','Erectores espinales'] },
  { zone: 'Hombros', muscles: ['Deltoides anterior','Deltoides lateral','Deltoides posterior','Supraespinoso','Manguito rotador'] },
  { zone: 'Brazos y antebrazos', muscles: ['Bíceps braquial','Braquial','Braquiorradial','Tríceps','Tríceps (cabeza larga)','Flexores del antebrazo','Extensores del antebrazo'] },
  { zone: 'Glúteos y cadera', muscles: ['Glúteo mayor','Glúteo medio','Glúteo menor','Tensor de la fascia lata','Flexores de cadera','Aductores'] },
  { zone: 'Muslos', muscles: ['Cuádriceps','Isquiotibiales'] },
  { zone: 'Pantorrilla', muscles: ['Gastrocnemio','Sóleo','Tibial anterior'] },
  { zone: 'Core', muscles: ['Recto abdominal','Oblicuos','Transverso abdominal','Erectores espinales'] },
];

function ex(category, name, primaryMuscles, secondaryMuscles, equipment, loadBasis='total_load', loadMode='external_kg', notes='') {
  return { category, name, primaryMuscles, secondaryMuscles, equipment, loadBasis, loadMode, notes };
}

export const EXERCISE_CATALOG = [
  // Pecho
  ex('Pecho','Press de banca plano con barra',['Pectoral mayor'],['Tríceps','Deltoides anterior'],['Banco plano','Barra olímpica','Discos'],'per_side_disc'),
  ex('Pecho','Press de banca inclinado con barra',['Pectoral mayor (porción clavicular)'],['Tríceps','Deltoides anterior'],['Banco inclinado','Barra olímpica','Discos'],'per_side_disc'),
  ex('Pecho','Press de banca plano con mancuernas',['Pectoral mayor'],['Tríceps','Deltoides anterior'],['Banco plano','Mancuernas'],'per_dumbbell'),
  ex('Pecho','Press de banca inclinado con mancuernas',['Pectoral mayor (porción clavicular)'],['Tríceps','Deltoides anterior'],['Banco inclinado','Mancuernas'],'per_dumbbell'),
  ex('Pecho','Press de pecho en máquina',['Pectoral mayor'],['Tríceps','Deltoides anterior'],['Máquina de press de pecho'],'machine_stack'),
  ex('Pecho','Pec deck',['Pectoral mayor'],['Deltoides anterior'],['Máquina pec deck'],'machine_stack'),
  ex('Pecho','Cruce de poleas',['Pectoral mayor'],['Deltoides anterior'],['Polea ajustable','Asa individual'],'machine_stack'),
  ex('Pecho','Flexiones',['Pectoral mayor'],['Tríceps','Deltoides anterior'],['Peso corporal'],'bodyweight','bodyweight'),

  // Espalda
  ex('Espalda','Jalón al pecho en polea alta',['Dorsal ancho'],['Bíceps braquial','Redondo mayor'],['Polea alta','Barra de jalón'],'machine_stack'),
  ex('Espalda','Dominadas',['Dorsal ancho'],['Bíceps braquial','Romboides'],['Barra de dominadas'],'bodyweight','bodyweight'),
  ex('Espalda','Remo sentado en polea baja con barra recta',['Dorsal ancho','Romboides','Trapecio medio'],['Deltoides posterior','Bíceps braquial'],['Polea baja','Barra recta larga'],'machine_stack', 'external_kg','Agarre prono si se desea enfatizar la posición actual.'),
  ex('Espalda','Remo sentado en polea baja con agarre neutro',['Dorsal ancho','Romboides'],['Bíceps braquial','Deltoides posterior'],['Polea baja','Agarre neutro doble'],'machine_stack'),
  ex('Espalda','Remo unilateral en polea baja con agarre neutro',['Dorsal ancho','Romboides'],['Bíceps braquial','Deltoides posterior'],['Polea baja','Asa individual'],'machine_stack'),
  ex('Espalda','Remo con mancuerna a una mano',['Dorsal ancho','Romboides'],['Bíceps braquial','Deltoides posterior'],['Mancuernas','Banco plano'],'per_dumbbell'),
  ex('Espalda','Remo en máquina',['Dorsal ancho','Romboides','Trapecio medio'],['Bíceps braquial','Deltoides posterior'],['Máquina de remo'],'machine_stack'),
  ex('Espalda','Pullover en polea con barra corta',['Dorsal ancho'],['Redondo mayor','Tríceps (cabeza larga)'],['Polea alta','Barra recta corta'],'machine_stack'),

  // Hombros
  ex('Hombros','Press de hombros con mancuernas',['Deltoides anterior','Deltoides lateral'],['Tríceps'],['Mancuernas','Banco ajustable'],'per_dumbbell'),
  ex('Hombros','Press de hombros en máquina',['Deltoides anterior','Deltoides lateral'],['Tríceps'],['Máquina de press de hombros'],'machine_stack'),
  ex('Hombros','Elevaciones laterales con mancuernas',['Deltoides lateral'],['Supraespinoso','Trapecio superior'],['Mancuernas'],'per_dumbbell'),
  ex('Hombros','Elevaciones laterales en polea',['Deltoides lateral'],['Supraespinoso'],['Polea baja','Asa individual'],'machine_stack'),
  ex('Hombros','Elevaciones frontales con mancuernas',['Deltoides anterior'],['Pectoral mayor (porción clavicular)'],['Mancuernas'],'per_dumbbell'),
  ex('Hombros','Pájaros con mancuernas',['Deltoides posterior'],['Romboides','Trapecio medio'],['Mancuernas','Banco ajustable'],'per_dumbbell'),
  ex('Hombros','Peck deck inverso',['Deltoides posterior'],['Romboides','Trapecio medio'],['Máquina pec deck'],'machine_stack'),
  ex('Hombros','Face pull en polea con cuerda',['Deltoides posterior','Trapecio medio'],['Romboides','Manguito rotador'],['Polea alta','Cuerda'],'machine_stack'),

  // Bíceps
  ex('Bíceps','Curl de bíceps con barra Z',['Bíceps braquial'],['Braquial','Braquiorradial'],['Barra Z','Discos'],'per_side_disc'),
  ex('Bíceps','Curl de bíceps con barra recta',['Bíceps braquial'],['Braquial','Braquiorradial'],['Barra recta corta','Discos'],'total_load'),
  ex('Bíceps','Curl alternado de bíceps con mancuernas',['Bíceps braquial'],['Braquial','Braquiorradial'],['Mancuernas'],'per_dumbbell'),
  ex('Bíceps','Curl martillo con mancuernas',['Braquial','Braquiorradial'],['Bíceps braquial'],['Mancuernas'],'per_dumbbell'),
  ex('Bíceps','Curl de bíceps en polea baja',['Bíceps braquial'],['Braquial'],['Polea baja','Barra recta corta'],'machine_stack'),

  // Tríceps
  ex('Tríceps','Extensión de tríceps en polea alta con cuerda',['Tríceps'],[],['Polea alta','Cuerda'],'machine_stack'),
  ex('Tríceps','Extensión de tríceps en polea alta con barra',['Tríceps'],[],['Polea alta','Barra recta corta'],'machine_stack'),
  ex('Tríceps','Extensión de tríceps sobre la cabeza con cuerda',['Tríceps (cabeza larga)'],['Tríceps'],['Polea alta','Cuerda'],'machine_stack'),
  ex('Tríceps','Extensión de tríceps sobre la cabeza con mancuerna',['Tríceps (cabeza larga)'],['Tríceps'],['Mancuernas'],'per_dumbbell'),
  ex('Tríceps','Fondos asistidos en máquina',['Tríceps'],['Pectoral mayor','Deltoides anterior'],['Máquina de fondos asistidos'],'machine_stack','assistance_kg'),

  // Cuádriceps y pierna
  ex('Cuádriceps','Sentadilla con barra',['Cuádriceps','Glúteo mayor'],['Isquiotibiales','Erectores espinales'],['Rack / jaula','Barra olímpica','Discos'],'per_side_disc'),
  ex('Cuádriceps','Sentadilla en máquina Smith',['Cuádriceps','Glúteo mayor'],['Isquiotibiales'],['Máquina Smith','Discos'],'per_side_disc'),
  ex('Cuádriceps','Sentadilla goblet',['Cuádriceps','Glúteo mayor'],['Isquiotibiales'],['Mancuernas'],'total_load'),
  ex('Cuádriceps','Prensa de piernas en máquina',['Cuádriceps','Glúteo mayor'],['Isquiotibiales'],['Prensa de piernas'],'machine_stack'),
  ex('Cuádriceps','Hack squat en máquina',['Cuádriceps','Glúteo mayor'],['Isquiotibiales'],['Máquina hack squat'],'machine_stack'),
  ex('Cuádriceps','Extensión de cuádriceps en máquina',['Cuádriceps'],[],['Máquina de extensión de piernas'],'machine_stack'),
  ex('Cuádriceps','Zancadas con mancuernas',['Cuádriceps','Glúteo mayor'],['Isquiotibiales'],['Mancuernas'],'per_dumbbell'),

  // Isquios y glúteos
  ex('Isquiotibiales y glúteos','Curl femoral en máquina',['Isquiotibiales'],['Gastrocnemio'],['Máquina de curl femoral'],'machine_stack'),
  ex('Isquiotibiales y glúteos','Peso muerto rumano con barra',['Isquiotibiales','Glúteo mayor'],['Erectores espinales'],['Barra olímpica','Discos'],'per_side_disc'),
  ex('Isquiotibiales y glúteos','Peso muerto rumano con mancuernas',['Isquiotibiales','Glúteo mayor'],['Erectores espinales'],['Mancuernas'],'per_dumbbell'),
  ex('Isquiotibiales y glúteos','Hip thrust con barra',['Glúteo mayor'],['Isquiotibiales'],['Banco plano','Barra olímpica','Discos'],'per_side_disc'),
  ex('Isquiotibiales y glúteos','Puente de glúteos',['Glúteo mayor'],['Isquiotibiales'],['Peso corporal'],'bodyweight','bodyweight'),
  ex('Isquiotibiales y glúteos','Patada de glúteo en polea',['Glúteo mayor'],['Isquiotibiales'],['Polea baja','Asa individual'],'machine_stack'),
  ex('Isquiotibiales y glúteos','Abducción de cadera en máquina',['Glúteo medio','Glúteo menor'],['Tensor de la fascia lata'],['Máquina abductora'],'machine_stack'),
  ex('Isquiotibiales y glúteos','Aducción de cadera en máquina',['Aductores'],[],['Máquina aductora'],'machine_stack'),

  // Gemelos
  ex('Gemelos','Elevación de talones de pie con mancuernas',['Gastrocnemio','Sóleo'],[],['Mancuernas','Escalón o plataforma estable'],'per_dumbbell'),
  ex('Gemelos','Elevación de talones en prensa de piernas',['Gastrocnemio','Sóleo'],[],['Prensa de piernas'],'machine_stack'),
  ex('Gemelos','Elevación de talones de pie en máquina Smith',['Gastrocnemio','Sóleo'],[],['Máquina Smith','Escalón o plataforma estable'],'per_side_disc'),
  ex('Gemelos','Elevación de talones sentado',['Sóleo'],['Gastrocnemio'],['Máquina de gemelos'],'machine_stack'),

  // Core
  ex('Core','Crunch abdominal en máquina',['Recto abdominal'],['Oblicuos'],['Máquina abdominal'],'machine_stack'),
  ex('Core','Crunch en polea alta',['Recto abdominal'],['Oblicuos'],['Polea alta','Cuerda'],'machine_stack'),
  ex('Core','Elevación de rodillas',['Recto abdominal','Flexores de cadera'],['Oblicuos'],['Roman Chair / soporte'],'added_weight','bodyweight_plus_kg'),
  ex('Core','Elevación de piernas colgado',['Recto abdominal','Flexores de cadera'],['Oblicuos'],['Barra de dominadas'],'added_weight','bodyweight_plus_kg'),
  ex('Core','Plancha frontal',['Transverso abdominal','Recto abdominal'],['Oblicuos','Glúteo mayor'],['Esterilla'],'bodyweight','bodyweight'),
  ex('Core','Dead bug',['Transverso abdominal','Recto abdominal'],['Flexores de cadera'],['Esterilla'],'bodyweight','bodyweight'),
  ex('Core','Pallof press en polea',['Oblicuos','Transverso abdominal'],['Recto abdominal'],['Polea ajustable','Asa individual'],'machine_stack'),
];

export const EXERCISE_CATEGORIES = [...new Set(EXERCISE_CATALOG.map(item => item.category))];
