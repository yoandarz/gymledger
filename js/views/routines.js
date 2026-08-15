import { archiveRecord, deleteRecord, getRoutine, listRecords, saveRoutine } from '../gym-service.js';
import { escapeHtml, formatLoad } from '../utils.js';

function routineRow(routine, exMap) {
  const names = routine.exerciseItems.slice(0,4).map(item => exMap.get(item.exerciseId)?.name).filter(Boolean);
  return `<div class="list-row">
    <div class="list-main"><strong>${escapeHtml(routine.name)}</strong><small>${routine.exerciseItems.length} ejercicios${names.length ? ` · ${escapeHtml(names.join(' · '))}${routine.exerciseItems.length>4?'…':''}` : ''}</small></div>
    ${routine.archivedAt ? '<span class="badge warn">Archivada</span>' : ''}
    <div class="row-actions"><a class="btn small" href="#routine-edit/${routine.id}">Editar</a><a class="btn small primary" href="#session-new/${routine.id}">Entrenar</a></div>
  </div>`;
}

export async function renderRoutines(ctx) {
  const showArchived = ctx.route.query.get('archived') === '1';
  const routines = (await listRecords('routine',{includeArchived:true})).filter(r => showArchived ? r.archivedAt : !r.archivedAt);
  const exMap = new Map((await listRecords('exercise',{includeArchived:true})).map(ex=>[ex.id,ex]));
  ctx.root.innerHTML = `
    <div class="page-head"><div><h1>Rutinas</h1><p>Una rutina es una sesión tipo: ejercicios, orden y objetivos de series/repeticiones.</p></div><div class="page-actions"><a class="btn primary" href="#routines/new">+ Nueva rutina</a></div></div>
    <div class="toolbar"><a class="btn small" href="#routines${showArchived?'':'?archived=1'}">${showArchived?'Ver activas':'Ver archivadas'}</a></div>
    <div class="list">${routines.length?routines.map(r=>routineRow(r,exMap)).join(''):'<div class="empty">No hay rutinas en esta vista.</div>'}</div>`;
}

export async function renderRoutineEditor(ctx, id) {
  const existing = id ? await getRoutine(id) : null;
  const routine = existing || { name:'', description:'', defaultSets:3, defaultReps:12, exerciseItems:[] };
  const exercises = (await listRecords('exercise')).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const exMap = new Map(exercises.map(ex=>[ex.id,ex]));
  let items = routine.exerciseItems.map(item=>({...item}));

  ctx.root.innerHTML = `
    <div class="page-head"><div><h1>${existing?'Editar rutina':'Nueva rutina'}</h1><p>Los ejercicios se enlazan a la biblioteca; el peso histórico no vive dentro de la rutina.</p></div></div>
    <form class="card flat" id="routine-form">
      <div class="form-grid">
        <label>Nombre<input name="name" required value="${escapeHtml(routine.name)}"></label>
        <label>Descripción<input name="description" value="${escapeHtml(routine.description||'')}"></label>
        <label>Series predeterminadas<input name="defaultSets" type="number" min="1" max="20" value="${routine.defaultSets||3}"></label>
        <label>Repeticiones predeterminadas<input name="defaultReps" type="number" min="1" max="100" value="${routine.defaultReps||12}"></label>
      </div>
      <div class="form-section"><div class="card-head"><div><h3>Ejercicios</h3><p class="muted small">Puedes cambiar series y repeticiones para un ejercicio concreto.</p></div></div>
        <div class="toolbar"><select id="add-exercise"><option value="">Añadir ejercicio…</option>${exercises.map(ex=>`<option value="${ex.id}">${escapeHtml(ex.exerciseCode||'—')} · ${escapeHtml(ex.name)}</option>`).join('')}</select><button type="button" class="btn" id="add-exercise-btn">Añadir</button></div>
        <div id="routine-items" class="drag-list"></div>
      </div>
      <div class="form-actions">
        ${existing?`<button type="button" class="btn ${existing.archivedAt?'':'danger'}" id="archive-routine">${existing.archivedAt?'Restaurar':'Archivar'}</button><button type="button" class="btn danger" id="delete-routine">Eliminar</button>`:''}
        <a class="btn" href="#routines">Cancelar</a><button class="btn primary" type="submit">Guardar rutina</button>
      </div>
    </form>`;

  const itemsRoot = ctx.root.querySelector('#routine-items');
  const renderItems = () => {
    itemsRoot.innerHTML = items.length ? items.map((item,index)=>{
      const ex=exMap.get(item.exerciseId); return `<div class="drag-item" data-index="${index}"><span class="drag-handle">☰</span><div><strong>${escapeHtml(ex?.name||'Ejercicio no disponible')}</strong><small class="muted" style="display:block">${escapeHtml(ex?.exerciseCode||'')} · ${escapeHtml(formatLoad(ex||{}))}</small><input class="item-note" placeholder="Nota de esta rutina" value="${escapeHtml(item.note||'')}" style="margin-top:6px"></div><div><div class="mini-fields"><label><small>Series</small><input class="item-sets" type="number" min="1" max="20" value="${item.targetSets||routine.defaultSets||3}"></label><label><small>Reps</small><input class="item-reps" type="number" min="1" max="100" value="${item.targetReps||routine.defaultReps||12}"></label></div><div class="row-actions" style="margin-top:6px"><button type="button" class="btn small up" ${index===0?'disabled':''}>↑</button><button type="button" class="btn small down" ${index===items.length-1?'disabled':''}>↓</button><button type="button" class="btn small danger remove">Quitar</button></div></div></div>`;
    }).join('') : '<div class="empty">Añade al menos un ejercicio.</div>';
    itemsRoot.querySelectorAll('.drag-item').forEach(row=>{
      const index=Number(row.dataset.index);
      row.querySelector('.up')?.addEventListener('click',()=>{ syncItemValues(); [items[index-1],items[index]]=[items[index],items[index-1]]; renderItems(); });
      row.querySelector('.down')?.addEventListener('click',()=>{ syncItemValues(); [items[index+1],items[index]]=[items[index],items[index+1]]; renderItems(); });
      row.querySelector('.remove')?.addEventListener('click',()=>{ syncItemValues(); items.splice(index,1); renderItems(); });
    });
  };
  const syncItemValues = () => {
    itemsRoot.querySelectorAll('.drag-item').forEach(row=>{
      const index=Number(row.dataset.index);
      if(!items[index]) return;
      items[index].targetSets=Number(row.querySelector('.item-sets')?.value||3);
      items[index].targetReps=Number(row.querySelector('.item-reps')?.value||12);
      items[index].note=row.querySelector('.item-note')?.value||'';
    });
  };
  renderItems();

  ctx.root.querySelector('#add-exercise-btn').addEventListener('click',()=>{
    syncItemValues(); const id=ctx.root.querySelector('#add-exercise').value; if(!id) return;
    if(items.some(item=>item.exerciseId===id)){ctx.toast('Ese ejercicio ya está en la rutina.','error');return;}
    items.push({exerciseId:id,targetSets:Number(ctx.root.querySelector('[name="defaultSets"]').value||3),targetReps:Number(ctx.root.querySelector('[name="defaultReps"]').value||12),note:'',order:items.length}); renderItems();
  });

  const form=ctx.root.querySelector('#routine-form');
  form.addEventListener('submit',async event=>{
    event.preventDefault(); syncItemValues();
    if(!items.length){ctx.toast('Añade al menos un ejercicio.','error');return;}
    try{
      const saved=await saveRoutine({id:existing?.id,name:form.name.value,description:form.description.value,defaultSets:Number(form.defaultSets.value||3),defaultReps:Number(form.defaultReps.value||12),exerciseItems:items.map((item,order)=>({...item,order})),archivedAt:existing?.archivedAt||null});
      ctx.toast('Rutina guardada.','ok'); await ctx.afterWrite(); ctx.navigate('routines');
    }catch(error){ctx.toast(error.message,'error');}
  });
  ctx.root.querySelector('#archive-routine')?.addEventListener('click',async()=>{await archiveRecord(existing.id,!existing.archivedAt);ctx.toast(existing.archivedAt?'Rutina restaurada.':'Rutina archivada.','ok');await ctx.afterWrite();ctx.navigate('routines');});
  ctx.root.querySelector('#delete-routine')?.addEventListener('click',async()=>{const ok=await ctx.confirmDialog('Eliminar una rutina no borra las sesiones históricas, pero puede afectar planes que todavía la referencien. ¿Continuar?',{title:'Eliminar rutina',danger:true});if(!ok)return;await deleteRecord(existing.id);ctx.toast('Rutina eliminada.','ok');await ctx.afterWrite();ctx.navigate('routines');});
}
