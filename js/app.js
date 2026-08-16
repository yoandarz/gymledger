import { APP_NAME, APP_VERSION } from './constants.js';
import { ensureSeedData, syncAfterWrite } from './gym-service.js';
import { getSetting, setSetting } from './db.js';
import { onSyncStatus, syncAll } from './sync.js';
import { cloudIsConfigured, currentSession } from './auth.js';
import { renderHome } from './views/home.js';
import { renderExercises, renderExerciseDetail, renderExerciseEditor } from './views/exercises.js';
import { renderRoutines, renderRoutineEditor } from './views/routines.js';
import { renderPlans, renderPlanEditor } from './views/plans.js';
import { renderSessions, renderSessionEditor } from './views/sessions.js';
import { renderSettings } from './views/settings.js';

const app = document.querySelector('#app');
const startup = document.querySelector('#startup');
let installPrompt = null;
let syncState = { state: 'local', message: 'Local' };
let availableUpdateVersion = null;
let lastUpdateCheckAt = 0;
let navigationGuard = null;
let acceptedHash = location.hash || '#home';
let guardDialogOpen = false;

function toast(message, kind = '') {
  const root = document.querySelector('#toast-root');
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

function mountUpdateBanner(version) {
  availableUpdateVersion = version;
  let banner = document.querySelector('#app-update-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'app-update-banner';
    banner.className = 'update-banner';
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    topbar.insertAdjacentElement('afterend', banner);
  }
  banner.innerHTML = `
    <div class="update-banner-inner" role="status">
      <div class="update-banner-copy">
        <strong>Nueva actualización disponible · v${version}</strong>
        <span>Instálala para usar la versión más reciente de GymLedger.</span>
      </div>
      <button class="btn primary small" id="apply-app-update" type="button">Actualizar ahora</button>
    </div>`;
  banner.querySelector('#apply-app-update')?.addEventListener('click', applyAppUpdate);
}

async function applyAppUpdate() {
  const button = document.querySelector('#apply-app-update');
  if (button) { button.disabled = true; button.textContent = 'Actualizando…'; }
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) await registration.update();
  } catch (error) {
    console.warn('No se pudo forzar la comprobación del service worker:', error);
  }
  const next = new URL(location.href);
  next.searchParams.set('v', availableUpdateVersion || Date.now().toString());
  setTimeout(() => location.replace(next.toString()), 450);
}

function isNewerVersion(candidate, current) {
  const a = String(candidate).split('.').map(part => Number.parseInt(part, 10) || 0);
  const b = String(current).split('.').map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

async function checkForAppUpdate({ force = false } = {}) {
  if (['localhost', '127.0.0.1'].includes(location.hostname) || !navigator.onLine) return;
  const now = Date.now();
  if (!force && now - lastUpdateCheckAt < 60_000) return;
  lastUpdateCheckAt = now;
  try {
    const response = await fetch(`./VERSION.txt?check=${now}`, { cache: 'no-store' });
    if (!response.ok) return;
    const remoteVersion = (await response.text()).trim();
    if (remoteVersion && isNewerVersion(remoteVersion, APP_VERSION)) mountUpdateBanner(remoteVersion);
  } catch (error) {
    // Estar offline o perder la red no debe interrumpir la aplicación.
  }
}

function modal({ title, body, actions = [], dismissible = true }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = `<h2>${title}</h2><div class="modal-body"></div><div class="form-actions modal-actions"></div>`;
    box.querySelector('.modal-body').append(body instanceof Node ? body : document.createRange().createContextualFragment(String(body || '')));
    const actionsRoot = box.querySelector('.modal-actions');
    const finalActions = actions.length ? actions : [{ label: 'Cerrar', value: null }];
    finalActions.forEach(action => {
      const button = document.createElement('button');
      button.className = `btn ${action.className || ''}`;
      button.textContent = action.label;
      button.addEventListener('click', () => { backdrop.remove(); resolve(action.value); });
      actionsRoot.appendChild(button);
    });
    backdrop.addEventListener('click', event => {
      if (dismissible && event.target === backdrop) { backdrop.remove(); resolve(null); }
    });
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
  });
}

function confirmDialog(message, { title = 'Confirmar', danger = false } = {}) {
  const body = document.createElement('p');
  body.textContent = message;
  return modal({
    title, body,
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Continuar', value: true, className: danger ? 'danger' : 'primary' },
    ],
  });
}

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || 'home';
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  return { page: parts[0] || 'home', id: parts[1] || null, query: new URLSearchParams(queryPart || '') };
}

function normalizeTargetHash(target) {
  const value = String(target || '#home');
  return value.startsWith('#') ? value : `#${value}`;
}

function setNavigationGuard(handler) {
  navigationGuard = typeof handler === 'function' ? handler : null;
}

function clearNavigationGuard() {
  navigationGuard = null;
}

async function requestNavigation(target) {
  const targetHash = normalizeTargetHash(target);
  const currentHash = location.hash || '#home';
  if (targetHash === currentHash) return true;
  if (!navigationGuard) {
    location.hash = targetHash;
    return true;
  }
  if (guardDialogOpen) return false;
  guardDialogOpen = true;
  let allowed = false;
  try {
    allowed = await navigationGuard({ from: acceptedHash, to: targetHash });
  } catch (error) {
    console.error('Protección de navegación:', error);
  } finally {
    guardDialogOpen = false;
  }
  if (!allowed) return false;
  navigationGuard = null;
  location.hash = targetHash;
  return true;
}

function navigate(target) {
  void requestNavigation(target);
}

async function applyTheme() {
  const theme = await getSetting('theme', 'system');
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

function shell() {
  const route = parseRoute();
  const nav = [
    ['home','⌂','Inicio'],
    ['exercises','◉','Ejercicios'],
    ['routines','▤','Rutinas'],
    ['plans','⟳','Planes'],
    ['sessions','↗','Sesiones'],
    ['settings','⚙','Ajustes'],
  ];
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="#home" aria-label="GymLedger inicio">
            <img src="./assets/icons/icon-96.png" alt="">
            <span class="brand-text"><strong>${APP_NAME}</strong><small>v${APP_VERSION}</small></span>
          </a>
          <div class="topbar-actions">
            <button class="sync-pill" id="sync-pill" data-state="${syncState.state}" title="Sincronizar">
              <span class="sync-dot"></span><span>${syncState.message}</span>
            </button>
          </div>
        </div>
      </header>
      <main class="main" id="view"></main>
      <nav class="bottom-nav" aria-label="Navegación principal">
        <div class="nav-inner">
          ${nav.map(([page, ico, label]) => `<a class="nav-link ${route.page === page ? 'active' : ''}" href="#${page}"><span class="ico">${ico}</span><span>${label}</span></a>`).join('')}
        </div>
      </nav>
    </div>`;
  if (availableUpdateVersion) mountUpdateBanner(availableUpdateVersion);
  document.querySelector('#sync-pill')?.addEventListener('click', async () => {
    try {
      const result = await syncAll();
      if (result.ok) { toast('Datos sincronizados.', 'ok'); await renderRoute(); }
    } catch (error) { toast(error.message, 'error'); }
  });
}

function viewContext() {
  return {
    root: document.querySelector('#view'),
    route: parseRoute(), navigate, toast, modal, confirmDialog, setNavigationGuard, clearNavigationGuard,
    rerender: renderRoute,
    afterWrite: async ({ sync = true, render = true } = {}) => {
      if (sync) await syncAfterWrite();
      if (render) await renderRoute();
    },
    getInstallPrompt: () => installPrompt,
    clearInstallPrompt: () => { installPrompt = null; },
  };
}

async function renderRoute() {
  shell();
  const ctx = viewContext();
  const { page, id } = ctx.route;
  try {
    if (page === 'home') await renderHome(ctx);
    else if (page === 'exercises' && id === 'new') await renderExerciseEditor(ctx, null);
    else if (page === 'exercise' && id) await renderExerciseDetail(ctx, id);
    else if (page === 'exercise-edit' && id) await renderExerciseEditor(ctx, id);
    else if (page === 'exercises') await renderExercises(ctx);
    else if (page === 'routines' && id === 'new') await renderRoutineEditor(ctx, null);
    else if (page === 'routine-edit' && id) await renderRoutineEditor(ctx, id);
    else if (page === 'routines') await renderRoutines(ctx);
    else if (page === 'plans' && id === 'new') await renderPlanEditor(ctx, null);
    else if (page === 'plan-edit' && id) await renderPlanEditor(ctx, id);
    else if (page === 'plans') await renderPlans(ctx);
    else if (page === 'session-new' && id) await renderSessionEditor(ctx, id);
    else if (page === 'session-edit' && id) await renderSessionEditor(ctx, null, id);
    else if (page === 'sessions') await renderSessions(ctx);
    else if (page === 'settings') await renderSettings(ctx);
    else { navigate('home'); }
  } catch (error) {
    console.error(error);
    ctx.root.innerHTML = `<div class="card"><h2>No se pudo abrir esta pantalla</h2><p class="muted">${String(error.message || error)}</p><a class="btn" href="#home">Volver al inicio</a></div>`;
  }
}

async function boot() {
  await applyTheme();
  await ensureSeedData();
  app.hidden = false;
  startup.remove();

  onSyncStatus(status => {
    syncState = status;
    const pill = document.querySelector('#sync-pill');
    if (pill) {
      pill.dataset.state = status.state;
      const text = pill.querySelector('span:last-child');
      if (text) text.textContent = status.message;
    }
  });

  window.addEventListener('hashchange', async () => {
    const requestedHash = location.hash || '#home';
    if (navigationGuard && requestedHash !== acceptedHash) {
      const previousHash = acceptedHash;
      history.replaceState(null, '', previousHash);
      const allowed = await requestNavigation(requestedHash);
      if (!allowed && (location.hash || '#home') !== previousHash) history.replaceState(null, '', previousHash);
      return;
    }
    acceptedHash = requestedHash;
    await renderRoute();
  });
  document.addEventListener('click', event => {
    if (!navigationGuard || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    void requestNavigation(link.getAttribute('href'));
  }, true);
  window.addEventListener('beforeunload', event => {
    if (!navigationGuard) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.addEventListener('online', () => syncAll({ silent: true }).then(renderRoute));
  window.addEventListener('offline', () => { syncState = { state: 'offline', message: 'Sin conexión' }; shell(); renderRoute(); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });

  if ('serviceWorker' in navigator && !['localhost','127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => registration.update().catch(() => {}))
      .catch(error => console.warn('Service worker:', error));
  }

  await renderRoute();
  const configured = await cloudIsConfigured();
  const session = configured ? await currentSession() : null;
  if (session) await syncAll({ silent: true }).then(renderRoute);

  if (!['localhost','127.0.0.1'].includes(location.hostname)) {
    setTimeout(() => checkForAppUpdate({ force: true }), 900);
    window.addEventListener('focus', () => checkForAppUpdate());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForAppUpdate(); });
    setInterval(() => checkForAppUpdate(), 15 * 60 * 1000);
  }
}

boot().catch(error => {
  console.error(error);
  startup.innerHTML = `<strong>GymLedger no pudo iniciar</strong><span>${String(error.message || error)}</span>`;
});
