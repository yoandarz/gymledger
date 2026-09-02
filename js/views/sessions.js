import { buildSessionFromRoutine, deleteRecord, getActivePlanContext, getRoutine, getSessionRecord, listRecords, saveSession } from '../gym-service.js';
import { exampleSessionJson, importSessionJson } from '../import-export.js';
import { WEIGHT_UNITS } from '../constants.js';
import { getSetting, setSetting } from '../db.js';
import { clearActiveSessionDraft, draftProgress, getActiveSessionDraft, saveActiveSessionDraft } from '../session-draft.js';
import { escapeHtml, formatDateTime, formatLoad, kgToUnit, numberOrNull, safeJsonParse, unitToKg } from '../utils.js';

const DEFAULT_REST_SECONDS = 90;
let restAudioContext = null;

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

function targetSets(entry) {
  return Math.max(1, Math.min(30, Number(entry?.sets) || 3));
}

function normalizedSetCounts(input = {}) {
  const output = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    const index = Number(key);
    const count = Number(value);
    if (Number.isInteger(index) && index >= 0 && Number.isFinite(count)) {
      output[index] = Math.max(0, Math.floor(count));
    }
  });
  return output;
}

function formatCountdown(totalSeconds) {
  const value = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function primeRestAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!restAudioContext) restAudioContext = new AudioContextClass();
    if (restAudioContext.state === 'suspended') await restAudioContext.resume();
  } catch {
    // El sonido es una ayuda; nunca debe bloquear el registro.
  }
}

function soundRestFinished() {
  try {
    if (!restAudioContext || restAudioContext.state !== 'running') return;
    const now = restAudioContext.currentTime;
    [0, 0.22].forEach(offset => {
      const oscillator = restAudioContext.createOscillator();
      const gain = restAudioContext.createGain();
      oscillator.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      oscillator.connect(gain);
      gain.connect(restAudioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.18);
    });
  } catch {
    // Algunos navegadores pueden bloquear audio si perdieron el gesto de usuario.
  }
  try { navigator.vibrate?.([120, 80, 120]); } catch { /* opcional */ }
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
  let completedSetCounts = {};
  let startedAt = null;
  let restSecondsTotal = Number(await getSetting('sessionRestSeconds', DEFAULT_REST_SECONDS));
  if (!Number.isFinite(restSecondsTotal) || restSecondsTotal < 0) restSecondsTotal = DEFAULT_REST_SECONDS;
  restSecondsTotal = Math.min(3599, Math.floor(restSecondsTotal));
  let restTimerState = null;
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
      completedSetCounts=normalizedSetCounts(activeDraft.completedSetCounts);
      if(!Object.keys(completedSetCounts).length && Array.isArray(activeDraft.completedIndexes)){
        activeDraft.completedIndexes.forEach(index=>{
          const i=Number(index);
          if(Number.isInteger(i) && session.entries[i]) completedSetCounts[i]=targetSets(session.entries[i]);
        });
      }
      startedAt=activeDraft.startedAt || session.performedAt;
      if(Number.isFinite(Number(activeDraft.restSeconds))) restSecondsTotal=Math.max(0,Math.min(3599,Math.floor(Number(activeDraft.restSeconds))));
      restTimerState=activeDraft.restTimer?.endsAt ? {...activeDraft.restTimer} : null;
    } else {
      session=await buildSessionFromRoutine(routineId,{planId:queryPlanId});
      startedAt=session.performedAt;
    }
  }

  const routine=await getRoutine(session.routineId);
  const exMap=new Map((await listRecords('exercise',{includeArchived:true})).map(ex=>[ex.id,ex]));
  const totalEntries=session.entries.length;

  const initialMinutes=Math.floor(restSecondsTotal/60);
  const initialSeconds=restSecondsTotal%60;

  ctx.root.innerHTML=`
    <div class="page-head"><div><h1>${existing?'Sesión':'Nueva sesión'} · ${escapeHtml(session.routineNameSnapshot||routine?.name||'')}</h1><p>${existing?'Puedes corregir un registro histórico.':'Marca cada serie al terminarla. GymLedger contará las series y controlará automáticamente el descanso.'}</p></div></div>
    <form id="session-form" class="card flat" autocomplete="off">
      ${existing?'':`
        <div class="active-session-status">
          <div><span class="badge ok">Borrador automático</span><strong>Inicio · ${escapeHtml(formatDateTime(startedAt))}</strong></div>
          <strong id="session-progress">0/${totalEntries} completados</strong>
        </div>
        <div class="rest-workflow">
          <div class="rest-duration-control">
            <div>
              <strong>Descanso entre series</strong>
              <span class="muted small">Empieza al marcar una serie, excepto la última.</span>
            </div>
            <div class="rest-duration-fields" aria-label="Duración del descanso">
              <label><small>min</small><input id="rest-minutes" type="number" inputmode="numeric" min="0" max="59" value="${initialMinutes}"></label>
              <span>:</span>
              <label><small>seg</small><input id="rest-seconds" type="number" inputmode="numeric" min="0" max="59" value="${initialSeconds}"></label>
            </div>
          </div>
          <div class="rest-timer-panel" id="rest-timer-panel" hidden>
            <div>
              <span class="kicker">Descanso</span>
              <strong class="rest-timer-value" id="rest-timer-value">0:00</strong>
              <small id="rest-timer-context"></small>
            </div>
            <button type="button" class="btn small" id="cancel-rest-timer">Cancelar</button>
          </div>
        </div>`}
      <div class="form-grid"><label>Fecha y hora<input name="performedAt" type="datetime-local"></label><label>Notas<input name="notes" value="${escapeHtml(session.notes||'')}"></label></div>
      <div class="form-section"><div class="session-section-head"><h3>Ejercicios</h3>${existing?'':'<span class="muted small">Cada marcador corresponde a una serie.</span>'}</div><div id="session-entries"></div></div>
      <div class="form-actions">${existing?'<button type="button" class="btn danger" id="delete-session">Eliminar sesión</button>':'<button type="button" class="btn danger" id="cancel-active-session">Cancelar sesión</button>'}<button class="btn primary" type="submit">Guardar sesión</button></div>
    </form>`;

  const dateInput=ctx.root.querySelector('[name="performedAt"]');
  const date=new Date(session.performedAt||Date.now());
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  dateInput.value=local;

  const setTrackerHtml=(entry,index)=>{
    if(existing)return '';
    const total=targetSets(entry);
    const done=Math.max(0,Math.min(total,Number(completedSetCounts[index])||0));
    const chips=Array.from({length:total},(_,offset)=>{
      const setNumber=offset+1;
      const completed=setNumber<=done;
      const next=setNumber===done+1;
      const disabled=setNumber>done+1;
      return `<button type="button" class="set-chip ${completed?'done':''} ${next?'next':''}" data-set="${setNumber}" aria-pressed="${completed?'true':'false'}" ${disabled?'disabled':''}><span>${completed?'✓':setNumber}</span><small>Serie ${setNumber}</small></button>`;
    }).join('');
    return `<div class="set-tracker" data-index="${index}"><div class="set-tracker-head"><strong>Series realizadas</strong><span>${done}/${total}</span></div><div class="set-chips">${chips}</div></div>`;
  };

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
    const done=!existing ? Math.min(targetSets(entry),Number(completedSetCounts[index])||0) : 0;
    const isCompleted=!existing && done>=targetSets(entry);
    const inProgress=!existing && done>0 && !isCompleted;
    return `<div class="session-entry ${isCompleted?'completed':''} ${inProgress?'in-progress':''}" data-index="${index}">
      <div class="entry-name">
        <div class="entry-title-row">
          <div class="entry-title-block"><span class="exercise-index">Ejercicio ${index+1}</span><strong>${escapeHtml(ex?.name||entry.exerciseNameSnapshot)}</strong></div>
          ${imageControl}
        </div>
        <small>${escapeHtml(ex?.exerciseCode||entry.exerciseCodeSnapshot||'')} · ${escapeHtml(formatLoad(ex||entry,{withBasis:true}))}</small>
      </div>
      <label class="load-field">${label}<div class="load-with-unit ${weighted?'':'single'}"><input class="entry-load" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" pattern="[0-9]*[\\.,]?[0-9]*" ${isBody||entry.loadMode==='untracked'?'disabled':''} value="${displayValue??(entry.loadMode==='bodyweight_plus_kg'?0:'')}">${unitSelect}</div></label>
      <label class="sets">${existing?'Series':'Series objetivo'}<input class="entry-sets" type="number" min="1" max="30" value="${entry.sets??3}"></label>
      <label class="reps">Reps<input class="entry-reps" type="number" min="1" max="200" value="${entry.reps??12}"></label>
      ${setTrackerHtml(entry,index)}
    </div>`;
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
      if(!existing){
        const total=targetSets(entry);
        completedSetCounts[i]=Math.max(0,Math.min(total,Number(completedSetCounts[i])||0));
      }
    });
  };

  const form=ctx.root.querySelector('#session-form');
  let draftTimer=null;
  let draftSaveChain=Promise.resolve();
  let restTickTimer=null;
  let restFinishedNotified=false;

  const completedIndexesNow=()=>session.entries.reduce((indexes,entry,index)=>{
    if((Number(completedSetCounts[index])||0)>=targetSets(entry)) indexes.push(index);
    return indexes;
  },[]);

  const updateProgress=()=>{
    if(existing)return;
    const progress=ctx.root.querySelector('#session-progress');
    if(progress) progress.textContent=`${completedIndexesNow().length}/${totalEntries} completados`;
  };

  const refreshSetTracker=(index)=>{
    if(existing)return;
    const row=entriesRoot.querySelector(`.session-entry[data-index="${index}"]`);
    const entry=session.entries[index];
    if(!row||!entry)return;
    const total=targetSets(entry);
    const done=Math.max(0,Math.min(total,Number(completedSetCounts[index])||0));
    completedSetCounts[index]=done;
    row.classList.toggle('completed',done>=total);
    row.classList.toggle('in-progress',done>0&&done<total);
    const tracker=row.querySelector('.set-tracker');
    if(tracker) tracker.outerHTML=setTrackerHtml(entry,index);
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
    const completed=completedIndexesNow();
    const counts={...completedSetCounts};
    const timer=restTimerState?{...restTimerState}:null;
    draftSaveChain=draftSaveChain.catch(()=>{}).then(()=>saveActiveSessionDraft({
      session:snapshot,
      startedAt,
      completedIndexes:completed,
      completedSetCounts:counts,
      restTimer:timer,
      restSeconds:restSecondsTotal,
    }));
    return draftSaveChain.catch(error=>console.warn('No se pudo guardar el borrador de sesión:',error));
  };

  const scheduleDraftSave=()=>{
    if(existing)return;
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{ persistDraft(); },180);
  };

  const restPanel=ctx.root.querySelector('#rest-timer-panel');
  const restValue=ctx.root.querySelector('#rest-timer-value');
  const restContext=ctx.root.querySelector('#rest-timer-context');

  const clearRestTick=()=>{
    if(restTickTimer){ clearInterval(restTickTimer); restTickTimer=null; }
  };

  const hideRestTimer=()=>{
    if(restPanel) restPanel.hidden=true;
    clearRestTick();
  };

  const finishRestTimer=()=>{
    if(!restTimerState)return;
    restTimerState=null;
    hideRestTimer();
    if(!restFinishedNotified){
      restFinishedNotified=true;
      soundRestFinished();
      ctx.toast('Descanso terminado. Toca la siguiente serie.','ok');
    }
    void persistDraft();
  };

  const updateRestTimer=()=>{
    if(!restTimerState?.endsAt){ hideRestTimer(); return; }
    const endsAt=Date.parse(restTimerState.endsAt);
    if(!Number.isFinite(endsAt)){ restTimerState=null; hideRestTimer(); return; }
    const remaining=Math.ceil((endsAt-Date.now())/1000);
    if(remaining<=0){ finishRestTimer(); return; }
    if(restPanel) restPanel.hidden=false;
    if(restValue) restValue.textContent=formatCountdown(remaining);
    if(restContext){
      const entry=session.entries[Number(restTimerState.entryIndex)];
      restContext.textContent=`${entry?.exerciseNameSnapshot||'Ejercicio'} · después de la serie ${Number(restTimerState.afterSet)||''}`;
    }
  };

  const armRestTick=()=>{
    clearRestTick();
    updateRestTimer();
    if(restTimerState) restTickTimer=setInterval(updateRestTimer,250);
  };

  const cancelRestTimer=({save=true}={})=>{
    restTimerState=null;
    restFinishedNotified=false;
    hideRestTimer();
    if(save) void persistDraft();
  };

  const startRestTimer=async(index,afterSet)=>{
    if(restSecondsTotal<=0){ cancelRestTimer({save:false}); return; }
    await primeRestAudio();
    restFinishedNotified=false;
    restTimerState={
      endsAt:new Date(Date.now()+restSecondsTotal*1000).toISOString(),
      durationSeconds:restSecondsTotal,
      entryIndex:index,
      afterSet,
    };
    armRestTick();
  };

  if(!existing){
    entriesRoot.addEventListener('click',async event=>{
      const chip=event.target.closest('.set-chip');
      if(!chip||chip.disabled)return;
      const tracker=chip.closest('.set-tracker');
      const row=chip.closest('.session-entry');
      const index=Number(tracker?.dataset.index ?? row?.dataset.index);
      const entry=session.entries[index];
      if(!entry)return;
      syncEntries();
      const total=targetSets(entry);
      const current=Math.max(0,Math.min(total,Number(completedSetCounts[index])||0));
      const selected=Number(chip.dataset.set);
      let next=current;
      let advanced=false;

      if(selected===current+1){
        next=selected;
        advanced=true;
      } else if(selected<=current){
        next=Math.max(0,selected-1);
      } else {
        return;
      }

      completedSetCounts[index]=next;
      if(advanced){
        if(next<total) await startRestTimer(index,next);
        else cancelRestTimer({save:false});
      } else if(restTimerState && Number(restTimerState.entryIndex)===index && Number(restTimerState.afterSet)>next){
        cancelRestTimer({save:false});
      }
      refreshSetTracker(index);
      updateProgress();
      await persistDraft();
    });

    entriesRoot.addEventListener('change',event=>{
      const setsInput=event.target.closest('.entry-sets');
      if(!setsInput)return;
      const row=setsInput.closest('.session-entry');
      const index=Number(row?.dataset.index);
      syncEntries();
      refreshSetTracker(index);
      updateProgress();
      void persistDraft();
    });

    const restMinutesInput=ctx.root.querySelector('#rest-minutes');
    const restSecondsInput=ctx.root.querySelector('#rest-seconds');
    const updateRestDuration=async()=>{
      let minutes=Math.max(0,Math.min(59,Number(restMinutesInput?.value)||0));
      let seconds=Math.max(0,Math.min(59,Number(restSecondsInput?.value)||0));
      minutes=Math.floor(minutes);
      seconds=Math.floor(seconds);
      if(restMinutesInput) restMinutesInput.value=String(minutes);
      if(restSecondsInput) restSecondsInput.value=String(seconds);
      restSecondsTotal=minutes*60+seconds;
      await setSetting('sessionRestSeconds',restSecondsTotal);
      await persistDraft();
    };
    restMinutesInput?.addEventListener('change',updateRestDuration);
    restSecondsInput?.addEventListener('change',updateRestDuration);
    ctx.root.querySelector('#cancel-rest-timer')?.addEventListener('click',()=>cancelRestTimer());

    form.addEventListener('input',scheduleDraftSave);
    form.addEventListener('change',event=>{
      if(event.target.matches('#rest-minutes,#rest-seconds,.entry-sets'))return;
      clearTimeout(draftTimer);
      void persistDraft();
    });
    updateProgress();
    await persistDraft();

    if(restTimerState?.endsAt) armRestTick();

    ctx.setNavigationGuard(async()=>{
      await persistDraft();
      const body=document.createElement('div');
      body.innerHTML='<p>Hay una sesión en curso. Si sales ahora, GymLedger conservará el borrador, la hora de inicio, las cargas y el avance de cada serie.</p><p class="muted small">Puedes continuarla después desde Inicio o Sesiones.</p>';
      const answer=await ctx.modal({
        title:'¿Salir de la sesión?',
        body,
        dismissible:false,
        actions:[
          {label:'Seguir entrenando',value:false,className:'primary'},
          {label:'Salir y conservar',value:true},
        ],
      });
      if(answer===true) clearRestTick();
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
        clearRestTick();
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
    clearRestTick();
    await clearActiveSessionDraft();
    ctx.clearNavigationGuard();
    ctx.toast('Sesión cancelada.','ok');
    ctx.navigate('sessions');
  });

  ctx.root.querySelector('#delete-session')?.addEventListener('click',async()=>{const ok=await ctx.confirmDialog('Eliminar esta sesión recalculará las referencias de carga a partir del historial restante. ¿Continuar?',{title:'Eliminar sesión',danger:true});if(!ok)return;await deleteRecord(existing.id);ctx.toast('Sesión eliminada.','ok');await ctx.afterWrite();ctx.navigate('sessions');});
}
