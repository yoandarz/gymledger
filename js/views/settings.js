import { cloudIsConfigured, currentSession, getCloudConfig, signIn, signOut, signUp } from '../auth.js';
import { getSetting, setSetting } from '../db.js';
import { exportFullBackup, exportGptContext, importFullBackup } from '../import-export.js';
import { getSyncSummary, syncAll } from '../sync.js';
import { formatDateTime, readFileAsText, safeJsonParse } from '../utils.js';

export async function renderSettings(ctx) {
  const config=await getCloudConfig();
  const configured=await cloudIsConfigured();
  const session=await currentSession();
  const summary=await getSyncSummary();
  const theme=await getSetting('theme','system');
  const installPrompt=ctx.getInstallPrompt();

  ctx.root.innerHTML=`
    <div class="page-head"><div><h1>Ajustes</h1><p>Nube, copias, contexto GPT e instalación.</p></div></div>
    <div class="grid two">
      <section class="card flat">
        <h2>Nube · Supabase</h2>
        <p class="muted small">Con sesión iniciada, Supabase es la fuente compartida; IndexedDB mantiene la copia local y permite trabajar sin conexión.</p>
        <div class="form-grid">
          <label>Project URL<input id="cloud-url" value="${config.url||''}" placeholder="https://xxxx.supabase.co"></label>
          <label>Publishable / Anon Key<input id="cloud-key" value="${config.anonKey||''}" type="password" autocomplete="off"></label>
        </div>
        <div class="form-actions"><button class="btn" id="save-cloud">Guardar configuración</button></div>
        <div class="divider"></div>
        ${session?`<p><strong>Sesión:</strong> ${session.user?.email||session.user?.id||'activa'}</p><p class="muted small">Última sincronización: ${summary.lastSyncAt?formatDateTime(summary.lastSyncAt):'—'} · Pendientes locales: ${summary.pending}</p><div class="page-actions"><button class="btn primary" id="sync-now">Sincronizar ahora</button><button class="btn danger" id="logout">Cerrar sesión</button></div>`:`<div class="grid"><label>Correo<input id="auth-email" type="email" autocomplete="email"></label><label>Contraseña<input id="auth-password" type="password" autocomplete="current-password"></label><div class="page-actions"><button class="btn primary" id="login" ${configured?'':'disabled'}>Iniciar sesión</button><button class="btn" id="signup" ${configured?'':'disabled'}>Crear cuenta</button></div>${configured?'':'<p class="notice warn small">Guarda primero la URL y la clave pública del proyecto.</p>'}</div>`}
      </section>

      <section class="card flat">
        <h2>Contexto para el GPT</h2>
        <p class="muted small">Exporta el catálogo canónico con exercise_code, rutinas y planes. Sustituye el archivo anterior en el GPT personalizado cuando cambie la biblioteca.</p>
        <button class="btn primary" id="export-gpt">Exportar contexto GPT (.json)</button>
        <p class="notice small" style="margin-top:12px">GymLedger, no el GPT, asigna los códigos EX. Un ejercicio nuevo creado sin conexión puede mostrar «código pendiente» hasta sincronizar.</p>
      </section>

      <section class="card flat">
        <h2>Copias completas</h2>
        <p class="muted small">La copia incluye ejercicios, rutinas, planes, sesiones e ilustraciones. No incluye tokens de inicio de sesión.</p>
        <div class="page-actions"><button class="btn" id="export-backup">Exportar copia JSON</button><label class="btn" style="display:inline-flex">Importar copia<input id="import-backup" type="file" accept="application/json,.json" hidden></label></div>
      </section>

      <section class="card flat">
        <h2>Apariencia e instalación</h2>
        <label>Tema<select id="theme"><option value="system" ${theme==='system'?'selected':''}>Sistema</option><option value="light" ${theme==='light'?'selected':''}>Claro</option><option value="dark" ${theme==='dark'?'selected':''}>Oscuro</option></select></label>
        <div class="form-actions">${installPrompt?'<button class="btn primary" id="install-app">Instalar GymLedger</button>':'<span class="muted small">Si no aparece el botón de instalación, usa «Instalar aplicación» o «Añadir a pantalla de inicio» desde el menú del navegador.</span>'}</div>
      </section>
    </div>`;

  ctx.root.querySelector('#save-cloud')?.addEventListener('click',async()=>{
    const url=ctx.root.querySelector('#cloud-url').value.trim().replace(/\/+$/,'');
    const anonKey=ctx.root.querySelector('#cloud-key').value.trim();
    await setSetting('cloudConfig',{url,anonKey});ctx.toast('Configuración de nube guardada.','ok');await ctx.rerender();
  });
  ctx.root.querySelector('#login')?.addEventListener('click',async()=>{try{const email=ctx.root.querySelector('#auth-email').value.trim();const password=ctx.root.querySelector('#auth-password').value;await signIn(email,password);await syncAll();ctx.toast('Sesión iniciada y datos sincronizados.','ok');await ctx.rerender();}catch(error){ctx.toast(error.message,'error');}});
  ctx.root.querySelector('#signup')?.addEventListener('click',async()=>{try{const email=ctx.root.querySelector('#auth-email').value.trim();const password=ctx.root.querySelector('#auth-password').value;const result=await signUp(email,password);ctx.toast(result.session?'Cuenta creada e iniciada.':'Cuenta creada. Revisa el correo si Supabase exige confirmación.','ok');if(result.session)await syncAll();await ctx.rerender();}catch(error){ctx.toast(error.message,'error');}});
  ctx.root.querySelector('#logout')?.addEventListener('click',async()=>{await signOut();ctx.toast('Sesión cerrada. Los datos locales permanecen en este dispositivo.','ok');await ctx.rerender();});
  ctx.root.querySelector('#sync-now')?.addEventListener('click',async()=>{try{await syncAll();ctx.toast('Sincronización completada.','ok');await ctx.rerender();}catch(error){ctx.toast(error.message,'error');}});
  ctx.root.querySelector('#export-gpt')?.addEventListener('click',async()=>{await exportGptContext();ctx.toast('Contexto GPT exportado.','ok');});
  ctx.root.querySelector('#export-backup')?.addEventListener('click',async()=>{await exportFullBackup();ctx.toast('Copia exportada.','ok');});
  ctx.root.querySelector('#import-backup')?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=safeJsonParse(await readFileAsText(file));if(!parsed.ok)throw new Error('El archivo no contiene JSON válido.');const result=await importFullBackup(parsed.value);ctx.toast(`${result.imported} registros importados. Sincroniza para subirlos a la nube.`,'ok');await ctx.rerender();}catch(error){ctx.toast(error.message,'error');}finally{event.target.value='';}});
  ctx.root.querySelector('#theme')?.addEventListener('change',async event=>{await setSetting('theme',event.target.value);if(event.target.value==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=event.target.value;ctx.toast('Tema actualizado.','ok');});
  ctx.root.querySelector('#install-app')?.addEventListener('click',async()=>{const prompt=ctx.getInstallPrompt();if(!prompt)return;await prompt.prompt();await prompt.userChoice;ctx.clearInstallPrompt();await ctx.rerender();});
}
