import { archiveRecord, deleteRecord, getPlan, listRecords, savePlan, setActivePlan } from '../gym-service.js';
import { escapeHtml } from '../utils.js';

function planRow(plan, routineMap) {
  const cycle = plan.routineIds.map(id => routineMap.get(id)?.name).filter(Boolean);
  return `<div class="list-row">
    <div class="list-main"><strong>${escapeHtml(plan.name)}</strong><small>${cycle.length ? escapeHtml(cycle.join(' → ')) : 'Sin rutinas'}</small></div>
    ${plan.active ? '<span class="badge brand">Activo</span>' : ''}${plan.archivedAt ? '<span class="badge warn">Archivado</span>' : ''}
    <div class="row-actions">${!plan.active && !plan.archivedAt ? `<button class="btn small primary activate-plan" data-id="${plan.id}">Activar</button>` : ''}<a class="btn small" href="#plan-edit/${plan.id}">Editar</a></div>
  </div>`;
}

export async function renderPlans(ctx) {
  const showArchived = ctx.route.query.get('archived') === '1';
  const plans = (await listRecords('plan',{includeArchived:true})).filter(p => showArchived ? p.archivedAt : !p.archivedAt);
  const routineMap = new Map((await listRecords('routine',{includeArchived:true})).map(r=>[r.id,r]));
  ctx.root.innerHTML = `
    <div class="page-head"><div><h1>Planes</h1><p>Un plan es un ciclo de rutinas. Puede tener tres, cuatro o las que necesites; no está atado a una semana.</p></div><div class="page-actions"><a class="btn primary" href="#plans/new">+ Nuevo plan</a></div></div>
    <div class="toolbar"><a class="btn small" href="#plans${showArchived?'':'?archived=1'}">${showArchived?'Ver activos':'Ver archivados'}</a></div>
    <div class="list">${plans.length?plans.map(p=>planRow(p,routineMap)).join(''):'<div class="empty">No hay planes en esta vista.</div>'}</div>`;
  ctx.root.querySelectorAll('.activate-plan').forEach(btn=>btn.addEventListener('click',async()=>{await setActivePlan(btn.dataset.id);ctx.toast('Plan activado.','ok');await ctx.afterWrite();}));
}

export async function renderPlanEditor(ctx,id) {
  const existing=id?await getPlan(id):null;
  const plan=existing||{name:'',description:'',routineIds:[],active:false,currentRoutineIndex:0};
  const routines=(await listRecords('routine')).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const routineMap=new Map(routines.map(r=>[r.id,r]));
  let ids=[...(plan.routineIds||[])];
  ctx.root.innerHTML=`
    <div class="page-head"><div><h1>${existing?'Editar plan':'Nuevo plan'}</h1><p>El orden define qué rutina toca después. La aplicación conserva el índice del siguiente paso del ciclo.</p></div></div>
    <form id="plan-form" class="card flat">
      <div class="form-grid">
        <label>Nombre<input name="name" required value="${escapeHtml(plan.name)}"></label>
        <label>Descripción<input name="description" value="${escapeHtml(plan.description||'')}"></label>
      </div>
      <div class="form-section"><h3>Ciclo de rutinas</h3><div class="toolbar"><select id="add-routine"><option value="">Añadir rutina…</option>${routines.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}</select><button type="button" class="btn" id="add-routine-btn">Añadir</button></div><div id="plan-items" class="drag-list"></div></div>
      <div class="form-section"><label style="display:flex;grid-template-columns:auto 1fr;align-items:center"><input name="active" type="checkbox" style="width:auto" ${plan.active?'checked':''}><span>Usar como plan activo</span></label></div>
      <div class="form-actions">${existing?`<button type="button" class="btn ${existing.archivedAt?'':'danger'}" id="archive-plan">${existing.archivedAt?'Restaurar':'Archivar'}</button><button type="button" class="btn danger" id="delete-plan">Eliminar</button>`:''}<a class="btn" href="#plans">Cancelar</a><button class="btn primary" type="submit">Guardar plan</button></div>
    </form>`;
  const root=ctx.root.querySelector('#plan-items');
  const renderItems=()=>{
    root.innerHTML=ids.length?ids.map((rid,index)=>`<div class="drag-item" data-index="${index}"><span class="drag-handle">☰</span><div><strong>${escapeHtml(routineMap.get(rid)?.name||'Rutina no disponible')}</strong><small class="muted" style="display:block">Paso ${index+1}</small></div><div class="row-actions"><button type="button" class="btn small up" ${index===0?'disabled':''}>↑</button><button type="button" class="btn small down" ${index===ids.length-1?'disabled':''}>↓</button><button type="button" class="btn small danger remove">Quitar</button></div></div>`).join(''):'<div class="empty">Añade al menos una rutina.</div>';
    root.querySelectorAll('.drag-item').forEach(row=>{const i=Number(row.dataset.index);row.querySelector('.up')?.addEventListener('click',()=>{[ids[i-1],ids[i]]=[ids[i],ids[i-1]];renderItems();});row.querySelector('.down')?.addEventListener('click',()=>{[ids[i+1],ids[i]]=[ids[i],ids[i+1]];renderItems();});row.querySelector('.remove')?.addEventListener('click',()=>{ids.splice(i,1);renderItems();});});
  };
  renderItems();
  ctx.root.querySelector('#add-routine-btn').addEventListener('click',()=>{const rid=ctx.root.querySelector('#add-routine').value;if(!rid)return;ids.push(rid);renderItems();});
  const form=ctx.root.querySelector('#plan-form');
  form.addEventListener('submit',async e=>{e.preventDefault();if(!ids.length){ctx.toast('Añade al menos una rutina.','error');return;}try{await savePlan({id:existing?.id,name:form.name.value,description:form.description.value,routineIds:ids,active:form.active.checked,currentRoutineIndex:existing?Math.min(existing.currentRoutineIndex,Math.max(0,ids.length-1)):0,archivedAt:existing?.archivedAt||null});ctx.toast('Plan guardado.','ok');await ctx.afterWrite();ctx.navigate('plans');}catch(error){ctx.toast(error.message,'error');}});
  ctx.root.querySelector('#archive-plan')?.addEventListener('click',async()=>{await archiveRecord(existing.id,!existing.archivedAt);ctx.toast(existing.archivedAt?'Plan restaurado.':'Plan archivado.','ok');await ctx.afterWrite();ctx.navigate('plans');});
  ctx.root.querySelector('#delete-plan')?.addEventListener('click',async()=>{const ok=await ctx.confirmDialog('Las sesiones históricas conservarán el nombre de la rutina, pero este plan desaparecerá de la biblioteca. ¿Continuar?',{title:'Eliminar plan',danger:true});if(!ok)return;await deleteRecord(existing.id);ctx.toast('Plan eliminado.','ok');await ctx.afterWrite();ctx.navigate('plans');});
}
