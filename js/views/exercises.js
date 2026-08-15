import { IMAGE_MAX_BYTES, LOAD_BASES, LOAD_MODES, WEIGHT_UNITS } from '../constants.js';
import { archiveRecord, deleteRecord, getExercise, getExerciseHistory, listRecords, saveExercise } from '../gym-service.js';
import { escapeHtml, formatDate, formatLoad, formatNumber, kgToUnit, shortId, unitToKg } from '../utils.js';
import { EQUIPMENT_GROUPS, EXERCISE_CATALOG, EXERCISE_CATEGORIES, MUSCLE_ZONES } from '../exercise-catalog.js';

function exerciseCard(ex) {
  const muscles = [...(ex.primaryMuscles || []), ...(ex.secondaryMuscles || [])].slice(0,4);
  return `<article class="card flat exercise-card" data-id="${ex.id}">
    <a class="exercise-image" href="#exercise/${ex.id}" aria-label="Abrir ${escapeHtml(ex.name)}">
      ${ex.imageDataUrl ? `<img src="${ex.imageDataUrl}" alt="${escapeHtml(ex.imageAlt || ex.name)}">` : '<span class="placeholder-person">◯</span>'}
    </a>
    <div>
      <div class="exercise-code">${escapeHtml(ex.exerciseCode || `ID local · ${shortId(ex.id)}`)}</div>
      <h3 style="margin:.18rem 0 .3rem"><a href="#exercise/${ex.id}" style="text-decoration:none">${escapeHtml(ex.name)}</a></h3>
      <div class="muted small">Referencia: <strong>${escapeHtml(formatLoad(ex, { withBasis:true }))}</strong></div>
      ${muscles.length ? `<div class="muscle-tags">${muscles.map(m => `<span class="muscle-tag">${escapeHtml(m)}</span>`).join('')}</div>` : ''}
    </div>
  </article>`;
}

export async function renderExercises(ctx) {
  const all = await listRecords('exercise', { includeArchived: true });
  const showArchived = ctx.route.query.get('archived') === '1';
  const exercises = all.filter(ex => showArchived ? Boolean(ex.archivedAt) : !ex.archivedAt)
    .sort((a,b) => String(a.exerciseCode || 'ZZZ').localeCompare(String(b.exerciseCode || 'ZZZ')));

  ctx.root.innerHTML = `
    <div class="page-head">
      <div><h1>Ejercicios</h1><p>Una ficha por movimiento real. El historial sigue al ejercicio aunque cambies de rutina o de plan.</p></div>
      <div class="page-actions"><a class="btn primary" href="#exercises/new">+ Nuevo ejercicio</a></div>
    </div>
    <div class="toolbar">
      <div class="search"><input id="exercise-search" placeholder="Buscar por nombre, músculo, equipo o código" autocomplete="off"></div>
      <a class="btn small" href="#exercises${showArchived ? '' : '?archived=1'}">${showArchived ? 'Ver activos' : 'Ver archivados'}</a>
    </div>
    <div id="exercise-grid" class="grid two">
      ${exercises.length ? exercises.map(exerciseCard).join('') : '<div class="empty">No hay ejercicios en esta vista.</div>'}
    </div>`;

  const input = ctx.root.querySelector('#exercise-search');
  const grid = ctx.root.querySelector('#exercise-grid');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLocaleLowerCase('es');
    const filtered = exercises.filter(ex => {
      const haystack = [ex.exerciseCode, ex.name, ...(ex.primaryMuscles||[]), ...(ex.secondaryMuscles||[]), ...(ex.equipment||[])].join(' ').toLocaleLowerCase('es');
      return haystack.includes(q);
    });
    grid.innerHTML = filtered.length ? filtered.map(exerciseCard).join('') : '<div class="empty">No hay coincidencias.</div>';
  });
}

function historyChart(rows) {
  const numeric = rows.filter(row => Number.isFinite(Number(row.loadValue)) && row.loadMode !== 'bodyweight');
  if (numeric.length < 2) return '<div class="empty">Todavía no hay suficientes puntos para dibujar evolución.</div>';
  const values = numeric.map(row => Number(row.loadValue));
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(1, max-min);
  const w = 600, h = 180, pad = 20;
  const points = numeric.map((row,i) => {
    const x = pad + (i * (w-pad*2) / Math.max(1,numeric.length-1));
    const y = h-pad - ((Number(row.loadValue)-min)/span)*(h-pad*2);
    return {x,y,row};
  });
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución de carga">
    <line class="gridline" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"></line>
    <line class="gridline" x1="${pad}" y1="${pad}" x2="${w-pad}" y2="${pad}"></line>
    <polyline class="line" points="${points.map(p=>`${p.x},${p.y}`).join(' ')}"></polyline>
    ${points.map(p=>`<circle class="dot" cx="${p.x}" cy="${p.y}" r="4"><title>${formatDate(p.row.performedAt)} · ${formatNumber(p.row.loadValue)}</title></circle>`).join('')}
  </svg></div>`;
}

export async function renderExerciseDetail(ctx, id) {
  const ex = await getExercise(id);
  if (!ex || ex.type !== 'exercise') throw new Error('Ejercicio no encontrado.');
  const history = await getExerciseHistory(id);
  ctx.root.innerHTML = `
    <div class="page-head">
      <div><div class="exercise-code">${escapeHtml(ex.exerciseCode || `ID local · ${shortId(ex.id)}`)}</div><h1>${escapeHtml(ex.name)}</h1><p>${escapeHtml(ex.notes || 'Sin notas técnicas.')}</p></div>
      <div class="page-actions"><a class="btn" href="#exercise-edit/${ex.id}">Editar ficha</a><a class="btn" href="#exercises">Volver</a></div>
    </div>
    <div class="detail-layout">
      <section class="detail-image">${ex.imageDataUrl ? `<img src="${ex.imageDataUrl}" alt="${escapeHtml(ex.imageAlt || ex.name)}">` : '<div class="empty" style="border:0">Sin ilustración<br><span class="small">Añádela desde Editar ficha.</span></div>'}</section>
      <section class="card flat">
        <div class="stat-strip">
          <div class="stat"><small>Carga de referencia</small><strong>${escapeHtml(formatLoad(ex,{withBasis:true}))}</strong></div>
          <div class="stat"><small>Sesiones registradas</small><strong>${history.length}</strong></div>
          <div class="stat"><small>Última actualización</small><strong>${ex.referenceLoadUpdatedAt ? formatDate(ex.referenceLoadUpdatedAt) : '—'}</strong></div>
        </div>
        <h3>Músculos principales</h3>
        <div class="muscle-tags">${(ex.primaryMuscles||[]).map(m=>`<span class="muscle-tag">${escapeHtml(m)}</span>`).join('') || '<span class="muted">Sin especificar</span>'}</div>
        <h3 style="margin-top:18px">Músculos secundarios</h3>
        <div class="muscle-tags">${(ex.secondaryMuscles||[]).map(m=>`<span class="muscle-tag">${escapeHtml(m)}</span>`).join('') || '<span class="muted">Sin especificar</span>'}</div>
        <h3 style="margin-top:18px">Equipo</h3>
        <p class="muted">${escapeHtml((ex.equipment||[]).join(' · ') || 'Sin especificar')}</p>
      </section>
    </div>
    <section class="card flat" style="margin-top:18px"><h2>Evolución</h2>${historyChart(history)}</section>
    <section class="card flat" style="margin-top:18px"><h2>Historial</h2>
      <div class="list">${history.length ? [...history].reverse().map(row=>`<div class="list-row"><div class="list-main"><strong>${formatDate(row.performedAt)} · ${escapeHtml(row.routineName || '')}</strong><small>${row.sets ?? '—'} × ${row.reps ?? '—'}${row.note ? ` · ${escapeHtml(row.note)}` : ''}</small></div><span class="badge brand">${escapeHtml(formatLoad({loadMode:row.loadMode,loadBasis:row.loadBasis,referenceLoad:row.loadValue}))}</span></div>`).join('') : '<div class="empty">Todavía no hay sesiones de este ejercicio.</div>'}</div>
    </section>`;
}

async function imageFileToDataUrl(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
  const rawUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve,reject)=>{ img.onload=resolve; img.onerror=()=>reject(new Error('No se pudo leer la imagen.')); img.src=rawUrl; });
    const max = 900;
    const scale = Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth*scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', .86);
    if (dataUrl.length > IMAGE_MAX_BYTES * 1.37) throw new Error('La ilustración sigue siendo demasiado grande. Usa una imagen más simple o pequeña.');
    return dataUrl;
  } finally { URL.revokeObjectURL(rawUrl); }
}

function groupedOptions(groups, groupKey='group', itemsKey='items') {
  return groups.map(group => `<optgroup label="${escapeHtml(group[groupKey])}">${group[itemsKey].map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}</optgroup>`).join('');
}

function digitParts(value) {
  const safe = Math.max(0, Math.min(999.99, Number(value || 0)));
  const scaled = Math.round(safe * 100);
  const integer = Math.floor(scaled / 100);
  const decimals = scaled % 100;
  return {
    hundreds: Math.floor(integer / 100) % 10,
    tens: Math.floor(integer / 10) % 10,
    ones: integer % 10,
    tenths: Math.floor(decimals / 10),
    hundredths: decimals % 10,
  };
}

function digitOptions(selected) {
  return Array.from({length:10},(_,i)=>`<option value="${i}" ${Number(selected)===i?'selected':''}>${i}</option>`).join('');
}

export async function renderExerciseEditor(ctx, id) {
  const existing = id ? await getExercise(id) : null;
  const ex = existing || {
    name:'', primaryMuscles:[], secondaryMuscles:[], equipment:[], loadMode:'external_kg', loadBasis:'total_load', weightUnit:'kg', notes:'', imageDataUrl:null, imageAlt:'', baselineLoad:null, referenceLoad:null
  };
  const displayReference = ex.referenceLoad == null ? 0 : (kgToUnit(ex.referenceLoad, ex.weightUnit || 'kg') ?? 0);
  const digits = digitParts(displayReference);
  const noReference = ex.referenceLoad == null;
  const catalogByCategory = Object.fromEntries(EXERCISE_CATEGORIES.map(category => [category, EXERCISE_CATALOG.filter(item => item.category === category)]));

  ctx.root.innerHTML = `
    <div class="page-head"><div><h1>${existing ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h1><p>${existing?.exerciseCode ? `Código de catálogo: ${escapeHtml(existing.exerciseCode)}` : (existing?.id ? `ID local: ${escapeHtml(shortId(existing.id))}. El código EX-#### se asignará al sincronizar con Supabase.` : 'El ID interno se generará al guardar. El código EX-#### se asignará al sincronizar con Supabase para que no se repita entre dispositivos.')}</p></div></div>
    <form id="exercise-form" class="card flat">
      ${!existing ? `<section class="guided-panel">
        <div class="card-head"><div><h2>Catálogo de ejercicios</h2><p class="muted small">Si no recuerdas el nombre, elige una zona y un ejercicio típico. La ficha se precarga y puedes corregirla antes de guardar.</p></div></div>
        <div class="form-grid catalog-picker">
          <label>Zona<select id="catalog-category"><option value="">Selecciona una zona…</option>${EXERCISE_CATEGORIES.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select></label>
          <label>Ejercicio<select id="catalog-exercise" disabled><option value="">Primero elige una zona</option></select></label>
        </div>
        <div class="form-actions compact"><button type="button" class="btn primary" id="load-template" disabled>Usar esta ficha</button><span class="muted small">Si no aparece, deja el catálogo vacío y crea una ficha personalizada.</span></div>
      </section>` : ''}

      <div class="form-grid">
        <label>Nombre<input name="name" required value="${escapeHtml(ex.name)}"></label>
        <label>Modo de carga<select name="loadMode">${LOAD_MODES.map(item=>`<option value="${item.value}" ${ex.loadMode===item.value?'selected':''}>${item.label}</option>`).join('')}</select></label>
        <label>Cómo se registra la carga<select name="loadBasis">${LOAD_BASES.map(item=>`<option value="${item.value}" ${ex.loadBasis===item.value?'selected':''}>${item.label}</option>`).join('')}</select></label>
      </div>

      <section class="form-section selector-section">
        <h3>Músculos principales</h3>
        <div class="picker-row"><select id="primary-zone"><option value="">Zona…</option>${MUSCLE_ZONES.map(z=>`<option value="${escapeHtml(z.zone)}">${escapeHtml(z.zone)}</option>`).join('')}</select><select id="primary-muscle" disabled><option value="">Músculo…</option></select><button type="button" class="btn" id="add-primary">Añadir</button></div>
        <input name="primaryMuscles" class="selection-summary" readonly value="${escapeHtml((ex.primaryMuscles||[]).join(', '))}" aria-label="Músculos principales seleccionados">
        <div id="primary-chips" class="selection-chips"></div>
      </section>

      <section class="form-section selector-section">
        <h3>Músculos secundarios</h3>
        <div class="picker-row"><select id="secondary-zone"><option value="">Zona…</option>${MUSCLE_ZONES.map(z=>`<option value="${escapeHtml(z.zone)}">${escapeHtml(z.zone)}</option>`).join('')}</select><select id="secondary-muscle" disabled><option value="">Músculo…</option></select><button type="button" class="btn" id="add-secondary">Añadir</button></div>
        <input name="secondaryMuscles" class="selection-summary" readonly value="${escapeHtml((ex.secondaryMuscles||[]).join(', '))}" aria-label="Músculos secundarios seleccionados">
        <div id="secondary-chips" class="selection-chips"></div>
      </section>

      <section class="form-section selector-section">
        <h3>Equipo</h3>
        <div class="picker-row"><select id="equipment-choice"><option value="">Selecciona equipo…</option>${groupedOptions(EQUIPMENT_GROUPS)}</select><button type="button" class="btn" id="add-equipment">Añadir</button></div>
        <input name="equipment" class="selection-summary" readonly value="${escapeHtml((ex.equipment||[]).join(', '))}" aria-label="Equipo seleccionado">
        <div id="equipment-chips" class="selection-chips"></div>
        <details class="custom-add"><summary>Equipo no incluido en la lista</summary><div class="picker-row"><input id="custom-equipment" placeholder="Nombre del equipo"><button type="button" class="btn" id="add-custom-equipment">Añadir</button></div></details>
      </section>

      <section class="form-section weight-panel" id="weight-panel">
        <div class="card-head"><div><h3>Carga inicial / de referencia</h3><p class="muted small">Elige la unidad y cada cifra. Internamente GymLedger normaliza el peso para poder comparar kg y lb correctamente.</p></div><label class="inline-check"><input type="checkbox" id="reference-unset" ${noReference?'checked':''}> Sin carga registrada todavía</label></div>
        <div class="weight-picker">
          <label>Unidad<select name="weightUnit">${WEIGHT_UNITS.map(item=>`<option value="${item.value}" ${(ex.weightUnit||'kg')===item.value?'selected':''}>${item.label}</option>`).join('')}</select></label>
          <div class="digit-group" aria-label="Selector de carga">
            <label>Centenas<select id="weight-hundreds">${digitOptions(digits.hundreds)}</select></label>
            <label>Decenas<select id="weight-tens">${digitOptions(digits.tens)}</select></label>
            <label>Unidades<select id="weight-ones">${digitOptions(digits.ones)}</select></label>
            <label>Décimas<select id="weight-tenths">${digitOptions(digits.tenths)}</select></label><label>Centésimas<select id="weight-hundredths">${digitOptions(digits.hundredths)}</select></label>
          </div>
          <div class="weight-readout">Valor: <strong id="weight-readout">${escapeHtml(formatNumber(displayReference))} ${escapeHtml(ex.weightUnit||'kg')}</strong></div>
        </div>
      </section>

      <div class="form-section"><label>Notas técnicas<textarea name="notes">${escapeHtml(ex.notes || '')}</textarea></label></div>
      <div class="form-section">
        <h3>Ilustración</h3>
        <div class="grid two">
          <div class="detail-image" id="image-preview">${ex.imageDataUrl ? `<img src="${ex.imageDataUrl}" alt="">` : '<span class="muted">Sin ilustración</span>'}</div>
          <div class="grid">
            <label>Imagen<input name="image" type="file" accept="image/*"></label>
            <label>Texto alternativo<input name="imageAlt" value="${escapeHtml(ex.imageAlt || '')}" placeholder="Descripción breve de la ilustración"></label>
            ${ex.imageDataUrl ? '<button type="button" class="btn danger" id="remove-image">Quitar ilustración</button>' : ''}
            <p class="notice small">Las ilustraciones sencillas se comprimen dentro de la ficha y se sincronizan junto al ejercicio.</p>
          </div>
        </div>
      </div>
      <div class="form-actions">
        ${existing ? `<button type="button" class="btn ${existing.archivedAt?'':'danger'}" id="archive-exercise">${existing.archivedAt?'Restaurar':'Archivar'}</button>` : ''}
        ${existing ? '<button type="button" class="btn danger" id="delete-exercise">Eliminar</button>' : ''}
        <a class="btn" href="${existing ? `#exercise/${existing.id}` : '#exercises'}">Cancelar</a>
        <button class="btn primary" type="submit">Guardar</button>
      </div>
    </form>`;

  let imageDataUrl = ex.imageDataUrl || null;
  let primaryMuscles = [...(ex.primaryMuscles || [])];
  let secondaryMuscles = [...(ex.secondaryMuscles || [])];
  let equipment = [...(ex.equipment || [])];
  const form = ctx.root.querySelector('#exercise-form');

  const renderSelections = () => {
    const renderChips = (rootId, values, kind) => {
      const root = ctx.root.querySelector(rootId);
      root.innerHTML = values.map((value,index)=>`<button type="button" class="selection-chip" data-kind="${kind}" data-index="${index}" title="Quitar ${escapeHtml(value)}">${escapeHtml(value)} <span>×</span></button>`).join('');
    };
    form.primaryMuscles.value = primaryMuscles.join(', ');
    form.secondaryMuscles.value = secondaryMuscles.join(', ');
    form.equipment.value = equipment.join(', ');
    renderChips('#primary-chips',primaryMuscles,'primary');
    renderChips('#secondary-chips',secondaryMuscles,'secondary');
    renderChips('#equipment-chips',equipment,'equipment');
  };

  const addUnique = (array, value) => {
    const clean=String(value||'').trim(); if(!clean)return;
    if(!array.some(item=>item.toLocaleLowerCase('es')===clean.toLocaleLowerCase('es'))) array.push(clean);
    renderSelections();
  };

  ctx.root.addEventListener('click', event => {
    const chip=event.target.closest('.selection-chip'); if(!chip)return;
    const index=Number(chip.dataset.index);
    if(chip.dataset.kind==='primary') primaryMuscles.splice(index,1);
    if(chip.dataset.kind==='secondary') secondaryMuscles.splice(index,1);
    if(chip.dataset.kind==='equipment') equipment.splice(index,1);
    renderSelections();
  });

  const wireMusclePicker=(zoneId,muscleId,buttonId,target)=>{
    const zone=ctx.root.querySelector(zoneId), muscle=ctx.root.querySelector(muscleId);
    zone.addEventListener('change',()=>{
      const found=MUSCLE_ZONES.find(item=>item.zone===zone.value);
      muscle.disabled=!found;
      muscle.innerHTML=found?`<option value="">Selecciona músculo…</option>${found.muscles.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}`:'<option value="">Músculo…</option>';
    });
    ctx.root.querySelector(buttonId).addEventListener('click',()=>addUnique(target,muscle.value));
  };
  wireMusclePicker('#primary-zone','#primary-muscle','#add-primary',primaryMuscles);
  wireMusclePicker('#secondary-zone','#secondary-muscle','#add-secondary',secondaryMuscles);
  ctx.root.querySelector('#add-equipment').addEventListener('click',()=>addUnique(equipment,ctx.root.querySelector('#equipment-choice').value));
  ctx.root.querySelector('#add-custom-equipment').addEventListener('click',()=>{const input=ctx.root.querySelector('#custom-equipment');addUnique(equipment,input.value);input.value='';});

  const catCategory=ctx.root.querySelector('#catalog-category');
  const catExercise=ctx.root.querySelector('#catalog-exercise');
  const loadTemplate=ctx.root.querySelector('#load-template');
  catCategory?.addEventListener('change',()=>{
    const options=catalogByCategory[catCategory.value]||[];
    catExercise.disabled=!options.length; loadTemplate.disabled=true;
    catExercise.innerHTML=options.length?`<option value="">Selecciona ejercicio…</option>${options.map((item,index)=>`<option value="${index}">${escapeHtml(item.name)}</option>`).join('')}`:'<option value="">Primero elige una zona</option>';
  });
  catExercise?.addEventListener('change',()=>{loadTemplate.disabled=catExercise.value==='';});
  loadTemplate?.addEventListener('click',()=>{
    const template=(catalogByCategory[catCategory.value]||[])[Number(catExercise.value)]; if(!template)return;
    form.name.value=template.name;
    primaryMuscles=[...template.primaryMuscles]; secondaryMuscles=[...template.secondaryMuscles]; equipment=[...template.equipment];
    form.loadMode.value=template.loadMode; form.loadBasis.value=template.loadBasis; form.notes.value=template.notes||'';
    if(template.loadMode==='bodyweight_plus_kg'){ refUnset.checked=false; setDigitWeight(0); }
    else if(['bodyweight','time_seconds','untracked'].includes(template.loadMode)){ refUnset.checked=true; }
    renderSelections(); updateWeightVisibility();
    ctx.toast('Ficha precargada desde el catálogo. Revísala antes de guardar.','ok');
  });

  const refUnset=ctx.root.querySelector('#reference-unset');
  const digitSelects=['#weight-hundreds','#weight-tens','#weight-ones','#weight-tenths','#weight-hundredths'].map(sel=>ctx.root.querySelector(sel));
  const currentDisplayWeight=()=>Number(ctx.root.querySelector('#weight-hundreds').value)*100+Number(ctx.root.querySelector('#weight-tens').value)*10+Number(ctx.root.querySelector('#weight-ones').value)+Number(ctx.root.querySelector('#weight-tenths').value)/10+Number(ctx.root.querySelector('#weight-hundredths').value)/100;
  const updateWeightReadout=()=>{
    const unit=form.weightUnit.value;
    ctx.root.querySelector('#weight-readout').textContent=refUnset.checked?'Sin registrar':`${formatNumber(currentDisplayWeight())} ${unit}`;
    digitSelects.forEach(el=>el.disabled=refUnset.checked);
  };
  const setDigitWeight=(value)=>{
    const d=digitParts(value); ctx.root.querySelector('#weight-hundreds').value=d.hundreds;ctx.root.querySelector('#weight-tens').value=d.tens;ctx.root.querySelector('#weight-ones').value=d.ones;ctx.root.querySelector('#weight-tenths').value=d.tenths;ctx.root.querySelector('#weight-hundredths').value=d.hundredths;updateWeightReadout();
  };
  refUnset.addEventListener('change',updateWeightReadout);
  digitSelects.forEach(el=>el.addEventListener('change',updateWeightReadout));
  form.weightUnit.addEventListener('change',()=>{
    const oldUnit=form.weightUnit.dataset.previous||ex.weightUnit||'kg';
    const oldValue=currentDisplayWeight();
    const kg=unitToKg(oldValue,oldUnit);
    const converted=kgToUnit(kg,form.weightUnit.value)||0;
    form.weightUnit.dataset.previous=form.weightUnit.value;
    setDigitWeight(Math.round(converted*100)/100);
  });
  form.weightUnit.dataset.previous=form.weightUnit.value;

  const updateWeightVisibility=()=>{
    const weighted=!['bodyweight','time_seconds','untracked'].includes(form.loadMode.value);
    ctx.root.querySelector('#weight-panel').classList.toggle('soft-disabled',!weighted);
    form.weightUnit.disabled=!weighted;
    refUnset.disabled=!weighted;
    if(!weighted) digitSelects.forEach(el=>el.disabled=true); else updateWeightReadout();
  };
  form.loadMode.addEventListener('change',updateWeightVisibility);
  updateWeightVisibility(); updateWeightReadout(); renderSelections();

  form.image?.addEventListener('change', async () => {
    try {
      imageDataUrl = await imageFileToDataUrl(form.image.files?.[0]);
      ctx.root.querySelector('#image-preview').innerHTML = imageDataUrl ? `<img src="${imageDataUrl}" alt="">` : '<span class="muted">Sin ilustración</span>';
    } catch (error) { ctx.toast(error.message,'error'); form.image.value=''; }
  });
  ctx.root.querySelector('#remove-image')?.addEventListener('click', () => {
    imageDataUrl = null; ctx.root.querySelector('#image-preview').innerHTML = '<span class="muted">Sin ilustración</span>';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const duplicates=(await listRecords('exercise',{includeArchived:true})).filter(item=>item.id!==existing?.id && item.name.trim().toLocaleLowerCase('es')===form.name.value.trim().toLocaleLowerCase('es'));
      if(duplicates.length) throw new Error(`Ya existe una ficha llamada “${duplicates[0].name}”. Abre esa ficha en vez de crear un duplicado.`);
      const weighted=!['bodyweight','time_seconds','untracked'].includes(form.loadMode.value);
      let ref=null;
      if(weighted && !refUnset.checked) ref=unitToKg(currentDisplayWeight(),form.weightUnit.value);
      if(form.loadMode.value==='bodyweight_plus_kg' && !refUnset.checked && ref==null) ref=0;
      const saved = await saveExercise({
        id: existing?.id,
        name: form.name.value,
        primaryMuscles,
        secondaryMuscles,
        equipment,
        loadMode: form.loadMode.value,
        loadBasis: form.loadBasis.value,
        weightUnit: form.weightUnit.value || ex.weightUnit || 'kg',
        notes: form.notes.value,
        imageDataUrl,
        imageAlt: form.imageAlt.value,
        baselineLoad: existing ? existing.baselineLoad : ref,
        referenceLoad: ref,
        referenceLoadUpdatedAt: ref == null ? existing?.referenceLoadUpdatedAt || null : new Date().toISOString(),
        archivedAt: existing?.archivedAt || null,
      });
      ctx.toast(existing ? 'Ficha actualizada.' : 'Ejercicio creado. Ya tiene ID interno; el código EX llegará al sincronizar con Supabase.', 'ok');
      await ctx.afterWrite();
      ctx.navigate(`exercise/${saved.id}`);
    } catch (error) { ctx.toast(error.message,'error'); }
  });
  ctx.root.querySelector('#archive-exercise')?.addEventListener('click', async () => {
    await archiveRecord(existing.id, !existing.archivedAt); ctx.toast(existing.archivedAt?'Ejercicio restaurado.':'Ejercicio archivado.','ok'); await ctx.afterWrite(); ctx.navigate('exercises');
  });
  ctx.root.querySelector('#delete-exercise')?.addEventListener('click', async () => {
    const ok = await ctx.confirmDialog('Eliminar la ficha puede dejar referencias históricas sin ficha visible. Archivar suele ser mejor. ¿Eliminar de todos modos?', { title:'Eliminar ejercicio', danger:true });
    if (!ok) return; await deleteRecord(existing.id); ctx.toast('Ejercicio eliminado.','ok'); await ctx.afterWrite(); ctx.navigate('exercises');
  });
}
