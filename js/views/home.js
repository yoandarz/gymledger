import { getActivePlanContext, listRecords, setPlanNextRoutine } from '../gym-service.js';
import { draftProgress, getActiveSessionDraft } from '../session-draft.js';
import { formatDateTime, formatLoad, escapeHtml } from '../utils.js';

export async function renderHome(ctx) {
  const { plan, routines, nextRoutine } = await getActivePlanContext();
  const sessions = (await listRecords('session', { includeArchived: true }))
    .sort((a,b) => String(b.performedAt).localeCompare(String(a.performedAt)));
  const recent = sessions[0] || null;
  const exercises = await listRecords('exercise');
  const pendingCodes = exercises.filter(ex => !ex.exerciseCode).length;
  const activeDraft = await getActiveSessionDraft();
  const activeProgress = draftProgress(activeDraft);

  ctx.root.innerHTML = `
    <div class="page-head">
      <div><h1>Entrenar</h1><p>Tu ciclo sigue donde lo dejaste; no depende del calendario.</p></div>
      <div class="page-actions"><a class="btn" href="#sessions?import=1">Importar JSON</a></div>
    </div>

    ${activeDraft ? `
      <section class="card active-session-card" style="margin-bottom:16px">
        <div class="kicker">Sesión en curso</div>
        <h2>${escapeHtml(activeDraft.session.routineNameSnapshot || 'Rutina')}</h2>
        <p class="muted">Iniciada ${escapeHtml(formatDateTime(activeDraft.startedAt || activeDraft.session.performedAt))} · ${activeProgress.completed}/${activeProgress.total} completados</p>
        <div class="page-actions" style="margin-top:14px"><a class="btn primary" href="#session-new/${encodeURIComponent(activeDraft.session.routineId)}${activeDraft.session.planId ? `?plan=${encodeURIComponent(activeDraft.session.planId)}` : ''}">Continuar sesión</a></div>
      </section>` : ''}

    ${plan && nextRoutine ? `
      <section class="card hero-plan">
        <div class="kicker">Siguiente rutina · ${escapeHtml(plan.name)}</div>
        <h2>${escapeHtml(nextRoutine.name)}</h2>
        <p class="muted">${escapeHtml(nextRoutine.description || `${nextRoutine.exerciseItems.length} ejercicios`)}</p>
        <div class="page-actions" style="margin-top:16px">
          <a class="btn dark" href="#session-new/${nextRoutine.id}?plan=${plan.id}">Comenzar sesión</a>
          <a class="btn ghost" href="#routine-edit/${nextRoutine.id}">Ver rutina</a>
        </div>
        <div class="cycle">
          ${routines.map((routine,index) => `<button class="cycle-chip ${index === plan.currentRoutineIndex ? 'current' : ''}" data-index="${index}">${escapeHtml(routine.name)}</button>`).join('')}
        </div>
      </section>` : `
      <section class="card"><h2>No hay plan activo</h2><p class="muted">Activa un plan para que GymLedger sepa qué rutina toca a continuación.</p><a class="btn primary" href="#plans">Elegir plan</a></section>`}

    <div class="grid two" style="margin-top:16px">
      <section class="card flat">
        <div class="card-head"><div><div class="kicker">Biblioteca</div><div class="big-number">${exercises.length}</div><span class="muted">ejercicios activos</span></div><a class="btn small" href="#exercises">Abrir</a></div>
        ${pendingCodes ? `<p class="notice warn small" style="margin-bottom:0">${pendingCodes} ejercicio(s) nuevo(s) aún no tienen código EX canónico. Sincroniza para asignarlo.</p>` : ''}
      </section>
      <section class="card flat">
        <div class="card-head"><div><div class="kicker">Última sesión</div>${recent ? `<strong style="font-size:1.15rem">${escapeHtml(recent.routineNameSnapshot)}</strong><div class="muted small">${formatDateTime(recent.performedAt)} · ${recent.entries.length} ejercicios</div>` : `<span class="muted">Todavía no hay sesiones.</span>`}</div>${recent ? `<a class="btn small" href="#session-edit/${recent.id}">Ver</a>` : ''}</div>
      </section>
    </div>

    <section class="card flat" style="margin-top:16px">
      <div class="card-head"><div><h3>Referencia rápida</h3><p class="muted small">Los pesos se actualizan automáticamente al guardar o importar sesiones.</p></div></div>
      <div class="list" style="margin-top:12px">
        ${exercises.slice(0,8).map(ex => `<a class="list-row" href="#exercise/${ex.id}" style="text-decoration:none"><div class="list-main"><strong>${escapeHtml(ex.name)}</strong><small>${escapeHtml(ex.exerciseCode || 'Código pendiente')}</small></div><span class="badge brand">${escapeHtml(formatLoad(ex))}</span></a>`).join('')}
      </div>
    </section>`;

  if (plan) {
    ctx.root.querySelectorAll('.cycle-chip').forEach(button => {
      button.addEventListener('click', async () => {
        const index = Number(button.dataset.index);
        await setPlanNextRoutine(plan.id, index);
        ctx.toast(`La siguiente rutina ahora es ${routines[index]?.name || ''}.`, 'ok');
        await ctx.afterWrite();
      });
    });
  }
}
