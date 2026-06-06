import { initAuth, signIn, signOut, getProfile, isAdmin, updatePassword, getUserEmail, getToken } from './auth.js';
import { loadAllData } from './api.js';
import { getArea, setArea, getView, setView, getCursorDate, setCursorDate } from './state.js';
import { parseDate, formatDate } from './utils.js';

// Import renders so they execute and we can call them
import { 
  renderSidebar, renderSchedule, renderDashboard, renderEmployeesGrid, 
  renderTausch, renderTime 
} from './render.js';

import './modals.js'; // to attach globals

export async function boot() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('reset-view').style.display = 'none';

  const authState = await initAuth();

  if (authState && authState.needsPasswordSet) {
    document.getElementById('reset-view').style.display = 'flex';
    setupResetForm();
    return;
  }

  if (!authState) {
    document.getElementById('login-view').style.display = 'flex';
    setupLoginForm();
  } else {
    await enterApp();
  }
}

function setupLoginForm() {
  const form = document.getElementById('login-form');
  const errDiv = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    errDiv.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Lädt...';
    
    try {
      await signIn(document.getElementById('email').value, document.getElementById('password').value);
      document.getElementById('login-view').style.display = 'none';
      await enterApp();
    } catch (err) {
      errDiv.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Anmelden';
    }
  };
}

function setupResetForm() {
  const form = document.getElementById('reset-form');
  const errDiv = document.getElementById('reset-error');
  const btn = document.getElementById('reset-btn');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errDiv.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Speichere...';

    const p1 = document.getElementById('new-password').value;
    const p2 = document.getElementById('new-password-confirm').value;

    if (p1 !== p2) {
      errDiv.textContent = 'Passwörter stimmen nicht überein.';
      btn.disabled = false;
      btn.textContent = 'Speichern';
      return;
    }

    try {
      await updatePassword(p1);
      window.location.hash = ''; // clear hash
      window.location.href = '/'; // reload fresh
    } catch (err) {
      errDiv.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Speichern';
    }
  };
}

async function enterApp() {
  document.getElementById('app').style.display = 'block';
  
  // Hide admin elements if needed
  if (!isAdmin()) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }

  // Set up UI state
  document.querySelectorAll('.area-btn').forEach(btn => {
    if (btn.dataset.area === getArea()) btn.classList.add('active');
  });

  // Load all DB data
  await loadAllData();
  
  // Render
  renderAll();
}

export function renderAll() {
  renderSidebar();
  renderSchedule();
  
  const activeTab = document.querySelector('.nav-tab.active');
  const activeView = activeTab ? activeTab.dataset.view : 'schedule';
  
  if (activeView === 'dashboard') renderDashboard();
  if (activeView === 'employees') renderEmployeesGrid();
  if (activeView === 'tausch') renderTausch();
  if (activeView === 'time') renderTime();
  if (activeView === 'profile' && window.viewingProfileId) window.viewProfile(window.viewingProfileId);
}

export function switchView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(n => n.classList.remove('active'));
  
  const viewMap = {
    'dashboard': 'view-dashboard',
    'schedule': 'view-schedule',
    'employees': 'view-employees',
    'tausch': 'view-tausch',
    'time': 'view-time',
    'profile': 'view-profile'
  };

  const tgtView = viewMap[id] || id;
  const v = document.getElementById(tgtView);
  if (v) v.classList.add('active');
  
  // Highlight nav
  const tab = document.querySelector(`.nav-tab[data-view="${id}"]`);
  if (tab) tab.classList.add('active');

  renderAll();
}

// Attach globals for HTML handlers
window.switchView = switchView;
window.renderAll = renderAll;
window.getToken = getToken;
window.switchArea = (area) => {
  setArea(area);
  document.querySelectorAll('#area-service, #area-kueche').forEach(btn => {
    if (btn.dataset.area === area) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  renderAll();
};
window.setView = (view) => {
  setView(view);
  const vtm = document.getElementById('vt-month');
  const vtw = document.getElementById('vt-week');
  if (vtm) vtm.classList.toggle('active', view === 'month');
  if (vtw) vtw.classList.toggle('active', view === 'week');
  const vt = document.getElementById('view-toggle');
  if (vt) {
    vt.innerHTML = view === 'month'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>';
  }
  renderSchedule();
};
window.navigateDate = (delta) => {
  const cd = parseDate(getCursorDate());
  if (getView() === 'month') cd.setMonth(cd.getMonth() + delta);
  else cd.setDate(cd.getDate() + (delta * 7));
  setCursorDate(formatDate(cd));
  renderAll();
};
window.goToToday = () => {
  setCursorDate(formatDate(new Date()));
  renderAll();
};
window.deleteShift = () => {
  if (window.deleteShiftAction) window.deleteShiftAction();
};
window.openPasswordModal = (id) => {
  alert('Passwort ändern bald verfügbar');
};
window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
};
window.setTimeMode = (mode) => {
  import('./render.js').then(r => {
    document.querySelectorAll('#time-mode-list, #time-mode-person').forEach(b => b.classList.remove('active'));
    document.getElementById(`time-mode-${mode}`)?.classList.add('active');
    r.renderTime(mode);
  });
};
window.showUserMenu = (e) => {
  e.stopPropagation();
  const menu = document.getElementById('context-menu');
  const profile = getProfile();
  const email = getUserEmail();
  
  menu.innerHTML = `
    <div style="padding:10px 12px;border-bottom:1px solid var(--border-soft);margin-bottom:4px;">
      <div style="font-weight:600;">${profile?.firstname || 'Admin'} ${profile?.lastname || ''}</div>
      <div style="font-size:12px;color:var(--text-mute);">${email || ''}</div>
    </div>
    ${profile && profile.role !== 'admin' ? `<button onclick="window.viewProfile('${profile.id}');window.hideContextMenu()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Mein Profil
    </button>` : ''}
    <button onclick="window.changePassword();window.hideContextMenu()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Passwort ändern
    </button>
    <hr>
    <button class="danger" onclick="window.logout();window.hideContextMenu()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Abmelden
    </button>
  `;
  
  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.top = (rect.bottom + 8) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  menu.style.left = 'auto';
  menu.classList.add('show');
};

window.hideContextMenu = () => {
  const menu = document.getElementById('context-menu');
  if (menu) {
    menu.classList.remove('show');
    menu.style.display = '';
  }
};

window.logout = async () => {
  await signOut();
  window.location.reload();
};
window.exportData = () => alert('Export nicht mehr verfügbar (Daten sind jetzt in der Cloud)');
window.changePassword = () => alert('Bald verfügbar');
window.copyShift = () => alert('Nutze bitte die "Zeitraum kopieren" Funktion');
window.updateEmpField = () => {};


document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
  if (!e.target.closest('.context-menu') && !e.target.closest('.shift') && !e.target.closest('.user-pill') && !e.target.closest('.card-menu')) {
    if (window.hideContextMenu) window.hideContextMenu();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    if (window.hideContextMenu) window.hideContextMenu();
  }
});

boot();
