import { buildSessionFromRoutine, deleteRecord, getActivePlanContext, getRoutine, getSessionRecord, listRecords, saveSession } from '../gym-service.js';
import { exampleSessionJson, importSessionJson } from '../import-export.js';
import { WEIGHT_UNITS } from '../constants.js';
import { clearActiveSessionDraft, draftProgress, getActiveSessionDraft, saveActiveSessionDraft } from '../session-draft.js';
import { escapeHtml, formatDateTime, formatLoad, kgToUnit, numberOrNull, safeJsonParse, unitToKg } from '../utils.js';

function sessionRow(session) {
  return `<div class="list-row"><div class="list-main"><strong>${formatDateTime(session.performedAt)} · ${escapeHtml(session.routineNameSnapshot || 'Rutina')}</strong><small>${session.entries.length} ejercicios · ${session.source === 'json' ? 'Importada por JSON' : 'Registro manual'}${session.notes ? ` · ${escapeHtml(session.notes)}` : ''}</small></div><div class="row-actions"><a class="btn small" href="#session-edit/${session.id}">Ver / editar</a></div></div>`;
}

function activeDraftCard(draft) {
  if (!draft) return '';
  const { completed, total } = draftProgress(draft);
  const session = draft.session;
  const planQuery = session.planId ? `?plan=${encodeURIComponent(session.planId)}` : '';
  return `<section class="card active-session-card" style="margin-bottom:16px">
    <div class="card-head">
      <div>
        <div class="kicker">Sesión en curso</div>
        <h2>${escapeHtml(session.routineNameSnapshot || 'Rutina')}</h2>
        <p class="muted small">Iniciada ${escapeHtml(formatDateTime(draft.startedAt || session.performedAt))} · ${completed}/${total} completados</p>
      </div>
      <a class="btn primary" href="#session-new/${encodeURIComponent(session.routineId)}${planQuery}">Continuar sesión</a>
    </div>
  </section>`;
}

export async function renderSessions(ctx) {
  const sessions = (await listRecords('session',{includeArchived:true})).sort((a,b)=>String(b.performedAt).localeCompare(String(a.performedAt)));
  const showImport = ctx.route.query.get('import') === '1';
  const { plan, nextRoutine } = await getActivePlanContext();
  const activeDraft = await getActiveSessionDraft();
  ctx.root.innerHTML = `
    <div class="page-head"><div><h1>Sesiones</h1><p>Cada sesión es un hecho histórico. Importarla o guardarla actualiza la carga de referencia de cada ejercicio.</p></div><div class="page-actions">${nextRoutine?`<a class="btn primary" href="#session-new/${nextRoutine.id}?plan=${plan?.id||''}">+ ${escapeHtml(nextRoutine.name)}</a>`:''}<a class="btn" href="#sessions?import=1">Importar JSON</a></div></div>
    ${activeDraftCard(activeDraft)}
    ${showImport?`<section class="card flat" id="import-panel"><div class="card-head"><div><h2>Importar sesión JSON</h2><p class="muted small">El JSON usa exercise_code estables. Si el GPT tiene un catálogo viejo, la app rechazará códigos desconocidos en vez de adivinar.</p></div><a class="btn small" href="#sessions">Cerrar</a></div><label style="margin-top:12px">Pega el JSON<textarea id="session-json" spellcheck="false" style="min-height:260px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea></label><div class="form-actions"><button class="btn" id="fill-example">Ejemplo</button><button class="btn primary" id="import-session">Importar</button></div></section>`:''}
    <section class="card flat" style="margin-top:${showImport?'16px':'0'}"><h2>Historial</h2><div class="list">${sessions.length?sessions.map(sessionRow).join(''):'<div class="empty">Todavía no hay sesiones guardadas.</div>'}</div></section>`;

  if(showImport){
    const text=ctx.root.querySelector('#session-json');
    ctx.root.querySelector('#fill-example').addEventListener('click',()=>{text.value=JSON.stringify(exampleSessionJson({planId:plan?.id||'PLAN_ID',routineId:nextRoutine?.id||'ROUTINE_ID'}),null,2);});
    ctx.root.querySelector('#import-session').addEventListener('click',async()=>{
      const parsed=safeJsonParse(text.value);
      if(!parsed.ok){ctx.toast('El JSON no se puede leer. Revisa comas y comillas.','error');return;}
      try{const result=await importSessionJson(parsed.value,{advancePlan:true});ctx.toast(result.bundle?`${result.imported} sesiones importadas.`:'Sesión importada.','ok');await ctx.afterWrite();ctx.navigate('sessions');}catch(error){ctx.toast(error.message,'error');}
    });
  }
}

export async function renderSessionEditor(ctx, routineId = null, sessionId = null) {
  const existing = sessionId ? await getSessionRecord(sessionId) : null;
  const queryPlanId = ctx.route.query.get('plan') || null;
  let activeDraft = !existing ? await getActiveSessionDraft() : null;
  let completedIndexes = new Set();
  let startedAt = null;
  let session;

  if(existing){
    session={...existing,entries:existing.entries.map(e=>({...e}))};
  } else {
    if(!routineId) throw new Error('Falta rutina para crear la sesión.');
    if(activeDraft && activeDraft.session.routineId !== routineId){
      const body=document.createElement('div');
      const { completed, total } = draftProgress(activeDraft);
      body.innerHTML=`<p>Ya hay una sesión de <strong>${escapeHtml(activeDraft.session.routineNameSnapshot || 'otra rutina')}</strong> en curso, iniciada ${escapeHtml(formatDateTime(activeDraft.startedAt || activeDraft.session.performedAt))}.</p><p class="muted small">Progreso guardado: ${completed}/${total} ejercicios completados.</p>`;
      const choice=await ctx.modal({
        title:'Ya hay una sesión en curso',
        body,
        dismissible:false,
        actions:[
          {label:'Volver',value:'cancel'},
          {label:'Descartar e iniciar esta',value:'discard',className:'danger'},
          {label:'Continuar sesión anterior',value:'resume',className:'primary'},
        ],
      });
      if(choice==='resume'){
        const old=activeDraft.session;
        const planQuery=old.planId?`?plan=${encodeURIComponent(old.planId)}`:'';
        ctx.navigate(`session-new/${old.routineId}${planQuery}`);
        return;
      }
      if(choice==='discard'){
        await clearActiveSessionDraft();
        activeDraft=null;
      } else {
        ctx.navigate('home');
        return;
      }
    }

    if(activeDraft && activeDraft.session.routineId === routineId){
      session={...activeDraft.session,entries:(activeDraft.session.entries||[]).map(e=>({...e}))};
      completedIndexes=new Set(activeDraft.completedIndexes||[]);
      startedAt=activeDraft.startedAt || session.performedAt;
    } else {
      session=await buildSessionFromRoutine(routineId,{planId:queryPlanId});
      startedAt=session.performedAt;
    }
  }

  const routine=await getRoutine(session.routineId);
  const exMap=new Map((await listRecords('exercise',{includeArchived:true})).map(ex=>[ex.id,ex]));
  const totalEntries=session.entries.length;

  ctx.root.innerHTML=`
    <div class="page-head"><div><h1>${existing?'Sesión':'Nueva sesión'} · ${escapeHtml(session.routineNameSnapshot||routine?.name||'')}</h1><p>${existing?'Puedes corregir un registro histórico.':'La sesión se guarda como borrador mientras entrenas. Puedes cambiar el orden de trabajo y marcar cada ejercicio al terminarlo.'}</p></div></div>
    <form id="session-form" class="card flat" autocomplete="off">
      ${existing?'':`<div class="active-session-status"><div><span class="badge ok">Borrador automático</span><strong>Inicio · ${escapeHtml(formatDateTime(startedAt))}</strong></div><strong id="session-progress">0/${totalEntries} completados</strong></div>`}
      <div class="form-grid"><label>Fecha y hora<input name="performedAt" type="datetime-local"></label><label>Notas<input name="notes" value="${escapeHtml(session.notes||'')}"></label></div>
      <div class="form-section"><div class="session-section-head"><h3>Ejercicios</h3>${existing?'':'<span class="muted small">Toca ✓ Hecho cuando termines cada ejercicio.</span>'}</div><div id="session-entries"></div></div>
      <div class="form-actions">${existing?'<button type="button" class="btn danger" id="delete-session">Eliminar sesión</button>':'<button type="button" class="btn danger" id="cancel-active-session">Cancelar sesión</button>'}<button class="btn primary" type="submit">Guardar sesión</button></div>
    </form>`;

  const dateInput=ctx.root.querySelector('[name="performedAt"]');
  const date=new Date(session.performedAt||Date.now());
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  dateInput.value=local;

  const entriesRoot=ctx.root.querySelector('#session-entries');
  entriesRoot.innerHTML=session.entries.map((entry,index)=>{
    const ex=exMap.get(entry.exerciseId);
    const isBody=entry.loadMode==='bodyweight';
    const weighted=['external_kg','bodyweight_plus_kg','assistance_kg'].includes(entry.loadMode);
    const unit=entry.weightUnit||ex?.weightUnit||'kg';
    const displayValue=weighted && entry.loadValue!=null ? kgToUnit(entry.loadValue,unit) : entry.loadValue;
    const label=entry.loadMode==='bodyweight_plus_kg'?'Carga añadida':entry.loadMode==='time_seconds'?'Segundos':entry.loadMode==='untracked'?'Sin carga':'Carga';
    const unitSelect=weighted?`<select class="entry-unit" data-previous="${unit}">${WEIGHT_UNITS.map(item=>`<option value="${item.value}" ${unit===item.value?'selected':''}>${item.value}</option>`).join('')}</select>`:'';
    const imageControl=ex?.imageDataUrl
      ? `<button type="button" class="btn small entry-image-button" aria-label="Ver imagen de ${escapeHtml(ex.name)}">Ver imagen</button>`
      : '<span class="badge entry-image-missing">Sin imagen</span>';
    const isCompleted=!existing && completedIndexes.has(index);
    const completeControl=existing?'':`<button type="button" class="entry-complete-toggle ${isCompleted?'completed':''}" aria-pressed="${isCompleted?'true':'false'}" title="Marcar ejercicio como realizado"><span class="check-icon">${isCompleted?'✓':'○'}</span><span class="check-label">${isCompleted?'Hecho':'Pendiente'}</span></button>`;
    return `<div class="session-entry ${isCompleted?'completed':''}" data-index="${index}"><div class="entry-name"><div class="entry-title-row"><div class="entry-title-with-check">${completeControl}<strong>${escapeHtml(ex?.name||entry.exerciseNameSnapshot)}</strong></div>${imageControl}</div><small>${escapeHtml(ex?.exerciseCode||entry.exerciseCodeSnapshot||'')} · ${escapeHtml(formatLoad(ex||entry,{withBasis:true}))}</small></div><label class="load-field">${label}<div class="load-with-unit ${weighted?'':'single'}"><input class="entry-load" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" pattern="[0-9]*[\\.,]?[0-9]*" ${isBody||entry.loadMode==='untracked'?'disabled':''} value="${displayValue??(entry.loadMode==='bodyweight_plus_kg'?0:'')}">${unitSelect}</div></label><label class="sets">Series<input class="entry-sets" type="number" min="1" max="30" value="${entry.sets??3}"></label><label class="reps">Reps<input class="entry-reps" type="number" min="1" max="200" value="${entry.reps??12}"></label></div>`;
  }).join('');

  entriesRoot.querySelectorAll('.entry-image-button').forEach(button=>button.addEventListener('click',()=>{
    const row=button.closest('.session-entry');
    const entry=session.entries[Number(row?.dataset.index)];
    const ex=entry ? exMap.get(entry.exerciseId) : null;
    if(!ex?.imageDataUrl){ ctx.toast('Este ejercicio no tiene imagen guardada.','error'); return; }
    const body=document.createElement('div');
    body.className='session-image-preview';
    const img=document.createElement('img');
    img.src=ex.imageDataUrl;
    img.alt=ex.imageAlt || ex.name || 'Ilustración del ejercicio';
    body.appendChild(img);
    ctx.modal({title:ex.name||'Ejercicio',body,actions:[{label:'Volver a la sesión',value:null,className:'primary'}]});
  }));

  entriesRoot.querySelectorAll('.entry-unit').forEach(select=>select.addEventListener('change',()=>{
    const row=select.closest('.session-entry');
    const input=row.querySelector('.entry-load');
    const oldUnit=select.dataset.previous||'kg';
    const raw=numberOrNull(input.value);
    if(raw!=null){ const kg=unitToKg(raw,oldUnit); input.value=kgToUnit(kg,select.value)?.toFixed(2).replace(/\.00$/,'') ?? ''; }
    select.dataset.previous=select.value;
  }));

  const syncEntries=()=>{
    entriesRoot.querySelectorAll('.session-entry').forEach(row=>{
      const i=Number(row.dataset.index), entry=session.entries[i];
      if(!entry)return;
      if(entry.loadMode==='bodyweight') entry.loadValue=null;
      else if(entry.loadMode==='untracked') entry.loadValue=null;
      else {
        const raw=numberOrNull(row.querySelector('.entry-load')?.value);
        const unit=row.querySelector('.entry-unit')?.value || entry.weightUnit || 'kg';
        entry.weightUnit=unit;
        entry.loadValue=['external_kg','bodyweight_plus_kg','assistance_kg'].includes(entry.loadMode) ? unitToKg(raw,unit) : raw;
      }
      entry.sets=Number(row.querySelector('.entry-sets')?.value||3);
      entry.reps=Number(row.querySelector('.entry-reps')?.value||12);
    });
  };

  const form=ctx.root.querySelector('#session-form');
  let draftTimer=null;
  let draftSaveChain=Promise.resolve();

  const updateProgress=()=>{
    if(existing)return;
    const valid=[...completedIndexes].filter(index=>index>=0&&index<totalEntries);
    const progress=ctx.root.querySelector('#session-progress');
    if(progress) progress.textContent=`${new Set(valid).size}/${totalEntries} completados`;
  };

  const captureFormState=()=>{
    syncEntries();
    if(form.performedAt.value){
      const parsed=new Date(form.performedAt.value);
      if(!Number.isNaN(parsed.getTime())) session.performedAt=parsed.toISOString();
    }
    session.notes=form.notes.value;
  };

  const persistDraft=()=>{
    if(existing)return Promise.resolve();
    captureFormState();
    const snapshot={...session,entries:session.entries.map(entry=>({...entry}))};
    const completed=[...completedIndexes];
    draftSaveChain=draftSaveChain.catch(()=>{}).then(()=>saveActiveSessionDraft({session:snapshot,startedAt,completedIndexes:completed}));
    return draftSaveChain.catch(error=>console.warn('No se pudo guardar el borrador de sesión:',error));
  };

  const scheduleDraftSave=()=>{
    if(existing)return;
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{ persistDraft(); },180);
  };

  if(!existing){
    entriesRoot.querySelectorAll('.entry-complete-toggle').forEach(button=>button.addEventListener('click',()=>{
      const row=button.closest('.session-entry');
      const index=Number(row.dataset.index);
      if(completedIndexes.has(index)) completedIndexes.delete(index); else completedIndexes.add(index);
      const completed=completedIndexes.has(index);
      row.classList.toggle('completed',completed);
      button.classList.toggle('completed',completed);
      button.setAttribute('aria-pressed',completed?'true':'false');
      button.querySelector('.check-icon').textContent=completed?'✓':'○';
      button.querySelector('.check-label').textContent=completed?'Hecho':'Pendiente';
      updateProgress();
      persistDraft();
    }));
    form.addEventListener('input',scheduleDraftSave);
    form.addEventListener('change',()=>{ clearTimeout(draftTimer); void persistDraft(); });
    updateProgress();
    await persistDraft();

    ctx.setNavigationGuard(async()=>{
      await persistDraft();
      const body=document.createElement('div');
      body.innerHTML='<p>Hay una sesión en curso. Si sales ahora, GymLedger conservará el borrador, la hora de inicio, las cargas y los ejercicios marcados.</p><p class="muted small">Puedes continuarla después desde Inicio o Sesiones.</p>';
      const answer=await ctx.modal({
        title:'¿Salir de la sesión?',
        body,
        dismissible:false,
        actions:[
          {label:'Seguir entrenando',value:false,className:'primary'},
          {label:'Salir y conservar',value:true},
        ],
      });
      return answer===true;
    });
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    captureFormState();
    try{
      await saveSession({...session,source:existing?session.source:'manual'},{advancePlan:!existing});
      if(!existing){
        clearTimeout(draftTimer);
        await clearActiveSessionDraft();
        ctx.clearNavigationGuard();
      }
      ctx.toast(existing?'Sesión actualizada.':'Sesión guardada; el ciclo avanzó si correspondía.','ok');
      await ctx.afterWrite({render:false});
      ctx.navigate('sessions');
    }catch(error){ctx.toast(error.message,'error');}
  });

  ctx.root.querySelector('#cancel-active-session')?.addEventListener('click',async()=>{
    const ok=await ctx.modal({
      title:'Cancelar sesión',
      body:'<p>¿Quieres descartar esta sesión en curso? Se eliminará el borrador y no se guardará en el historial.</p>',
      dismissible:false,
      actions:[
        {label:'Seguir entrenando',value:false},
        {label:'Descartar sesión',value:true,className:'danger'},
      ],
    });
    if(!ok)return;
    clearTimeout(draftTimer);
    await clearActiveSessionDraft();
    ctx.clearNavigationGuard();
    ctx.toast('Sesión cancelada.','ok');
    ctx.navigate('sessions');
  });

  ctx.root.querySelector('#delete-session')?.addEventListener('click',async()=>{const ok=await ctx.confirmDialog('Eliminar esta sesión recalculará las referencias de carga a partir del historial restante. ¿Continuar?',{title:'Eliminar sesión',danger:true});if(!ok)return;await deleteRecord(existing.id);ctx.toast('Sesión eliminada.','ok');await ctx.afterWrite();ctx.navigate('sessions');});
}
