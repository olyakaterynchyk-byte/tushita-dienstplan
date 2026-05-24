import { getArea, getCursorDate } from './state.js';
import { isAdmin, getUserId } from './auth.js';
import { 
  getEmployeesForArea, getTemplatesForArea, getShifts, findTemplate, findShift, findEmployee,
  createSwapRequest, loadAllData, updateOwnProfile
} from './api.js';
import {
  createShift, updateShift, deleteShift, publishShifts, copyPeriod, createEmployee,
  createTemplate, updateTemplate, deleteTemplate, updateEmployee, deleteEmployee
} from './api-backend.js';
import { todayStr, MONTHS, parseDate, getWeekNumber, getWeekGrid, getMonthGrid, formatDate, escapeHtml, fullName, diffHours, formatTime } from './utils.js';
import { renderAll } from './main.js';

let editingId = null;
let currentModalDate = null;
let templateEditingArea = 'service';

// ===== SHIFT MODAL =====
export function openShiftModal(id = null, date = null) {
  if (!isAdmin()) return;
  editingId = id;
  const modal = document.getElementById('shift-modal');
  const title = document.getElementById('shift-modal-title');
  const body = document.getElementById('shift-modal-body');
  
  const area = getArea();
  const tpls = getTemplatesForArea(area);
  const emps = getEmployeesForArea(area);

  let shift = null;
  if (id) {
    title.textContent = 'Schicht bearbeiten';
    shift = findShift(id);
  } else {
    title.textContent = 'Neue Schicht';
  }

  const dVal = shift ? shift.date : (date || getCursorDate() || todayStr());
  const tVal = shift ? (shift.template_id || '') : '';
  const stVal = shift ? shift.start_time.slice(0,5) : '09:00';
  const enVal = shift ? shift.end_time.slice(0,5) : '17:00';
  const lVal = shift ? (shift.custom_label || '') : '';
  const eVal = shift ? (shift.employee_id || '') : '';

  const tplOptions = '<option value="">Individuell</option>' + 
    tpls.map(t => `<option value="${t.id}" ${t.id === tVal ? 'selected' : ''}>${escapeHtml(t.label)} (${formatTime(t.start_time)} – ${formatTime(t.end_time)})</option>`).join('');
    
  const empOptions = '<option value="">Unbesetzt</option>' + 
    emps.map(e => `<option value="${e.id}" ${e.id === eVal ? 'selected' : ''}>${escapeHtml(fullName(e))}</option>`).join('');

  body.innerHTML = `
    <div class="form-group">
      <label>Datum</label>
      <input type="date" id="shift-date" value="${dVal}">
    </div>
    <div class="form-group">
      <label>Schicht-Typ</label>
      <select id="shift-template">${tplOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Von</label>
        <input type="time" id="shift-start" value="${stVal}">
      </div>
      <div class="form-group">
        <label>Bis</label>
        <input type="time" id="shift-end" value="${enVal}">
      </div>
    </div>
    <div class="form-group">
      <label>Eigener Titel (optional)</label>
      <input type="text" id="shift-label" placeholder="Zusatzinfo..." value="${escapeHtml(lVal)}">
    </div>
    <div class="form-group">
      <label>Mitarbeiter</label>
      <select id="shift-emp">${empOptions}</select>
    </div>
  `;

  document.getElementById('shift-modal-footer').innerHTML = `
    ${shift ? '<button class="btn btn-danger" onclick="window.deleteShiftAction()" style="margin-right:auto;">Löschen</button>' : ''}
    <button class="btn btn-secondary" onclick="window.closeModal('shift-modal')">Abbrechen</button>
    <button class="btn btn-primary" onclick="window.saveShift()" style="background:var(--accent);color:white;">Speichern</button>
  `;

  const tSel = document.getElementById('shift-template');
  const stSel = document.getElementById('shift-start');
  const enSel = document.getElementById('shift-end');

  tSel.onchange = () => {
    if (!tSel.value) return;
    const t = tpls.find(x => x.id === tSel.value);
    if (t) {
      stSel.value = t.start_time.slice(0,5);
      enSel.value = t.end_time.slice(0,5);
    }
  };

  modal.classList.add('show');
}

export async function saveShift() {
  const dSel = document.getElementById('shift-date');
  const tSel = document.getElementById('shift-template');
  const stSel = document.getElementById('shift-start');
  const enSel = document.getElementById('shift-end');
  const lSel = document.getElementById('shift-label');
  const eSel = document.getElementById('shift-emp');

  if (!dSel.value || !stSel.value || !enSel.value) return;

  const data = {
    area: getArea(),
    date: dSel.value,
    template_id: tSel.value || null,
    start_time: stSel.value,
    end_time: enSel.value,
    custom_label: lSel.value.trim(),
    employee_id: eSel.value || null
  };

  document.getElementById('shift-modal').classList.remove('show');
  
  try {
    if (editingId) {
      await updateShift(editingId, data);
    } else {
      await createShift(data);
    }
    await loadAllData();
    renderAll();
  } catch (err) {
    alert(err.message);
  }
}

export async function deleteShiftAction() {
  if (!editingId) return;
  const confirmed = await window.appConfirm('Schicht wirklich löschen?');
  if (!confirmed) return;
  
  document.getElementById('shift-modal').classList.remove('show');
  try {
    await deleteShift(editingId);
    await loadAllData();
    renderAll();
  } catch (err) {
    alert(err.message);
  }
}

window.openShiftModal = openShiftModal;
window.saveShift = saveShift;
window.deleteShiftAction = deleteShiftAction;

// ===== PUBLISH MODAL =====
export function openPublishModal() {
  if (!isAdmin()) return;
  const d = parseDate(getCursorDate());
  document.getElementById('pub-month').textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  document.getElementById('pub-week').textContent = `KW ${getWeekNumber(getCursorDate())}`;
  document.getElementById('publish-modal').classList.add('show');
}

export async function doPublish(type) {
  document.getElementById('publish-modal').classList.remove('show');
  const cursor = parseDate(getCursorDate());
  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const weekDays = getWeekGrid(getCursorDate()).map(x => x.date);
  const area = getArea();

  const toPublish = getShifts().filter(s => {
    if (s.status === 'published' || s.area !== area) return false;
    if (type === 'month') {
      const sd = parseDate(s.date);
      return sd.getMonth() === month && sd.getFullYear() === year;
    } else {
      return weekDays.includes(s.date);
    }
  });

  if (toPublish.length === 0) {
    alert('Keine Entwürfe in diesem Zeitraum.');
    return;
  }

  const shiftIds = toPublish.map(s => s.id);
  
  try {
    await publishShifts(shiftIds);
    await loadAllData();
    renderAll();
    
    const confirmed = await window.appConfirm(`${shiftIds.length} Schichten veröffentlicht!\nMöchtest du eine E-Mail an das Team senden?`);
    if (confirmed) {
      sendMailtoNotification(toPublish, type, cursor);
    }
  } catch (err) {
    alert(err.message);
  }
}

function sendMailtoNotification(publishedShifts, type, cursorDate) {
  // Collect emails for affected employees
  const emps = new Set();
  publishedShifts.forEach(s => {
    if (s.employee_id) emps.add(s.employee_id);
  });
  
  const bcc = Array.from(emps).map(id => {
    const e = findEmployee(id);
    // Note: If email is private, admin might not have it in state. 
    // Usually it's in the profile if we load it. For now, rely on what we have.
    // If not available, mailto might not have all addresses.
    return e && e.email ? e.email : null;
  }).filter(Boolean);
  
  if (bcc.length === 0) {
    alert('Für die betroffenen Schichten sind keine E-Mail-Adressen hinterlegt.');
    return;
  }

  const periodLabel = type === 'month' ? `${MONTHS[cursorDate.getMonth()]} ${cursorDate.getFullYear()}` : `KW ${getWeekNumber(getCursorDate())}`;
  const areaLabel = getArea() === 'kueche' ? 'Küche' : 'Service';
  const subject = encodeURIComponent(`Neuer Dienstplan veröffentlicht – ${periodLabel} (${areaLabel})`);
  const body = encodeURIComponent(
    `Hallo zusammen,\n\nder Dienstplan für ${periodLabel} (${areaLabel}) wurde soeben veröffentlicht.\n\n` +
    `Bitte prüft eure Schichten im Tool. Bei Fragen oder wenn ihr tauschen müsst, nutzt bitte die Tauschbörse.\n\n` +
    `Liebe Grüße\nTushita Teahouse`
  );

  window.location.href = `mailto:?bcc=${bcc.join(',')}&subject=${subject}&body=${body}`;
}

window.openPublishModal = openPublishModal;
window.doPublish = doPublish;

// ===== EMPLOYEE MODAL =====
export function openEmployeeModal(id = null) {
  if (!isAdmin()) return;
  editingId = id;
  const modal = document.getElementById('employee-modal');
  const t = document.getElementById('employee-modal-title');
  const fFirst = document.getElementById('emp-firstname');
  const fLast = document.getElementById('emp-lastname');
  const fEmail = document.getElementById('emp-email');
  const fArea = document.getElementById('emp-area');
  const fPhone = document.getElementById('emp-phone');
  const fHours = document.getElementById('emp-hours');
  const fNote = document.getElementById('emp-note');
  
  if (id) {
    t.textContent = 'Mitarbeiter bearbeiten';
    const emp = findEmployee(id);
    fFirst.value = emp.firstname || '';
    fLast.value = emp.lastname || '';
    fEmail.value = ''; // Email can't be easily changed in Supabase without sending conf email
    fEmail.disabled = true;
    fEmail.placeholder = '(E-Mail ändern z.Zt. nicht unterstützt)';
    fArea.value = emp.area || 'service';
    fPhone.value = emp.phone || '';
    fHours.value = emp.hours || 0;
    if (fNote) fNote.value = emp.note || '';
    document.getElementById('emp-delete-btn').style.display = 'block';
  } else {
    t.textContent = 'Neuer Mitarbeiter';
    fFirst.value = '';
    fLast.value = '';
    fEmail.value = '';
    fEmail.disabled = false;
    fEmail.placeholder = 'E-Mail Adresse für Login';
    fArea.value = 'service';
    fPhone.value = '';
    fHours.value = 0;
    if (fNote) fNote.value = '';
    document.getElementById('emp-delete-btn').style.display = 'none';
  }
  
  modal.classList.add('show');
}

export async function saveEmployee() {
  const fFirst = document.getElementById('emp-firstname').value.trim();
  const fLast = document.getElementById('emp-lastname').value.trim();
  const fEmail = document.getElementById('emp-email').value.trim();
  const fArea = document.getElementById('emp-area').value;
  const fPhone = document.getElementById('emp-phone').value.trim();
  const fHours = parseFloat(document.getElementById('emp-hours').value) || 0;
  const fNote = document.getElementById('emp-note') ? document.getElementById('emp-note').value.trim() : '';
  
  if (!fFirst) { alert('Vorname fehlt'); return; }
  
  document.getElementById('employee-modal').classList.remove('show');
  
  try {
    if (editingId) {
      await updateEmployee(editingId, { 
        firstname: fFirst, 
        lastname: fLast, 
        area: fArea, 
        phone: fPhone, 
        hours: fHours, 
        note: fNote 
      });
    } else {
      if (!fEmail) { alert('E-Mail erforderlich zum Einladen'); return; }
      await createEmployee({ 
        firstname: fFirst, 
        lastname: fLast, 
        email: fEmail, 
        area: fArea, 
        phone: fPhone, 
        hours: fHours, 
        note: fNote 
      });
      alert(`Einladung an ${fEmail} versendet!`);
    }
    await loadAllData();
    renderAll();
  } catch (err) {
    alert(err.message || 'Fehler beim Speichern');
  }
}

window.openEmployeeModal = openEmployeeModal;
window.saveEmployee = saveEmployee;

export async function deleteEmployeeAction() {
  if (!editingId) return;
  const confirmed = await window.appConfirm('Mitarbeiter wirklich löschen? Zugewiesene Schichten werden auf "Unbesetzt" gesetzt.');
  if (!confirmed) return;
  
  document.getElementById('employee-modal').classList.remove('show');
  try {
    await deleteEmployee(editingId);
    await loadAllData();
    if (window.viewingProfileId === editingId) {
      window.switchView('employees');
    }
    renderAll();
    window.toast('Mitarbeiter gelöscht');
  } catch (err) {
    alert(err.message || 'Fehler beim Löschen');
  }
}
window.deleteEmployee = deleteEmployeeAction;


// ===== COPY PERIOD MODAL =====
export function openCopyPeriodModal() {
  if (!isAdmin()) return;
  document.getElementById('copy-period-modal').classList.add('show');
  const cd = parseDate(getCursorDate());
  document.getElementById('copy-source').textContent = getView() === 'month' 
    ? `${MONTHS[cd.getMonth()]} ${cd.getFullYear()}` 
    : `KW ${getWeekNumber(getCursorDate())}`;
}

export async function doCopyPeriod() {
  const keepEmps = document.getElementById('copy-keep-emps').checked;
  const view = getView();
  const area = getArea();
  const cd = parseDate(getCursorDate());
  
  document.getElementById('copy-period-modal').classList.remove('show');
  
  // Logic to calculate mapping
  let mapping = {};
  let sourceShifts = [];
  
  if (view === 'month') {
    // Next month
    const nextMonth = new Date(cd.getFullYear(), cd.getMonth() + 1, 1);
    const sourceDays = getMonthGrid(getCursorDate()).filter(d => d.inMonth);
    const targetDays = getMonthGrid(formatDate(nextMonth)).filter(d => d.inMonth);
    
    sourceShifts = getShifts().filter(s => s.area === area && parseDate(s.date).getMonth() === cd.getMonth() && parseDate(s.date).getFullYear() === cd.getFullYear());
    
    // Map by day of month (e.g. 1st to 1st)
    for (let i = 0; i < Math.min(sourceDays.length, targetDays.length); i++) {
      mapping[sourceDays[i].date] = targetDays[i].date;
    }
  } else {
    // Next week
    const sourceWeek = getWeekGrid(getCursorDate());
    const nextWeekDate = new Date(cd);
    nextWeekDate.setDate(cd.getDate() + 7);
    const targetWeek = getWeekGrid(formatDate(nextWeekDate));
    
    const weekDays = sourceWeek.map(d => d.date);
    sourceShifts = getShifts().filter(s => s.area === area && weekDays.includes(s.date));
    
    for (let i = 0; i < 7; i++) {
      mapping[sourceWeek[i].date] = targetWeek[i].date;
    }
  }
  
  if (sourceShifts.length === 0) {
    alert('Keine Schichten im Ursprungszeitraum.');
    return;
  }
  
  try {
    await copyPeriod({
      sourceShiftIds: sourceShifts.map(s => s.id),
      dateMapping: mapping,
      keepEmployees: keepEmps,
      area
    });
    
    // Move cursor to target
    if (view === 'month') {
      const nextMonth = new Date(cd.getFullYear(), cd.getMonth() + 1, 1);
      window.setCursorDate(formatDate(nextMonth));
    } else {
      const nextWeek = new Date(cd);
      nextWeek.setDate(cd.getDate() + 7);
      window.setCursorDate(formatDate(nextWeek));
    }
    
    await loadAllData();
    renderAll();
  } catch (err) {
    alert(err.message);
  }
}

window.openCopyPeriodModal = openCopyPeriodModal;
window.doCopyPeriod = doCopyPeriod;

// ===== CONTEXT MENU =====
export function showShiftContextMenu(e, id) {
  const shift = findShift(id);
  if (!shift) return;
  const myId = getUserId();
  const isMine = shift.employee_id === myId;
  const menu = document.getElementById('context-menu');
  
  let html = '';
  if (isAdmin()) {
    html += `<div class="context-item" onclick="window.openShiftModal('${id}')">Bearbeiten</div>`;
    html += `<div class="context-item" style="color:var(--danger-dark);" onclick="window.deleteShiftActionCtx('${id}')">Löschen</div>`;
  }
  
  if (isMine) {
    if (isAdmin()) html += '<div class="context-divider"></div>';
    html += `<div class="context-item" onclick="window.requestSwap('${id}')">Zum Tausch anbieten</div>`;
  }
  
  if (!html) return;
  
  menu.innerHTML = html;
  menu.style.display = 'block';
  let x = e.pageX, y = e.pageY;
  if (x + 180 > window.innerWidth) x = window.innerWidth - 180;
  if (y + menu.offsetHeight > window.innerHeight) y = window.innerHeight - menu.offsetHeight;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

window.showShiftContextMenu = showShiftContextMenu;
window.hideContextMenu = () => { document.getElementById('context-menu').classList.remove('show'); };

// Delete shift directly from context menu (by passed-in ID)
window.deleteShiftActionCtx = async (id) => {
  window.hideContextMenu();
  const confirmed = await window.appConfirm('Schicht wirklich löschen?');
  if (!confirmed) return;
  try {
    await deleteShift(id);
    await loadAllData();
    renderAll();
  } catch (err) { alert(err.message); }
};

// Custom Confirm Dialog
window.appConfirm = (message) => {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-body').textContent = message;
    
    const btnOk = document.getElementById('confirm-modal-ok');
    const btnCancel = document.getElementById('confirm-modal-cancel');
    
    // Clean up old listeners
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    modal.classList.add('show');
    
    newBtnOk.addEventListener('click', () => {
      modal.classList.remove('show');
      resolve(true);
    });
    
    newBtnCancel.addEventListener('click', () => {
      modal.classList.remove('show');
      resolve(false);
    });
  });
};

// Delete employee from profile page (by passed-in ID)
window.deleteEmployeeProfile = async (id) => {
  const confirmed = await window.appConfirm('Mitarbeiter wirklich löschen?');
  if (!confirmed) return;
  try {
    await deleteEmployee(id);
    await loadAllData();
    window.switchView('employees');
    renderAll();
    window.toast('Mitarbeiter gelöscht');
  } catch (err) { alert(err.message || 'Fehler beim Löschen'); }
};

// Tausch actions
window.requestSwap = async (shiftId) => {
  window.hideContextMenu();
  const note = prompt('Optional: Warum möchtest du tauschen?', '');
  if (note === null) return;
  try {
    await createSwapRequest(shiftId, getUserId(), note);
    renderAll();
    window.toast('Tauschanfrage erstellt');
  } catch (err) { alert(err.message); }
};

window.cancelSwap = async (swapId) => {
  try {
    const { cancelSwapRequest } = await import('./api.js');
    await cancelSwapRequest(swapId);
    renderAll();
  } catch (err) { alert(err.message); }
};

window.takeSwap = async (swapId) => {
  try {
    const { takeSwapRequest } = await import('./api.js');
    await takeSwapRequest(swapId, getUserId());
    renderAll();
    window.toast('Schicht übernommen!');
  } catch (err) { alert(err.message); }
};

// ===== TEMPLATES MODAL =====
export function openTemplatesModal() {
  if (!isAdmin()) return;
  templateEditingArea = getArea();
  switchTemplateArea(templateEditingArea);
  document.getElementById('templates-modal').classList.add('show');
}

export function switchTemplateArea(area) {
  templateEditingArea = area;
  document.getElementById('tpl-area-service').classList.toggle('active', area === 'service');
  document.getElementById('tpl-area-kueche').classList.toggle('active', area === 'kueche');
  renderTemplatesList();
}

export function renderTemplatesList() {
  const list = document.getElementById('templates-list');
  const templates = getTemplatesForArea(templateEditingArea);

  if (templates.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-mute);padding:24px 0;font-size:13px;">Noch keine Schicht-Typen für diesen Bereich.</div>';
    return;
  }

  list.innerHTML = templates.map((t, idx) => `
    <div class="tpl-row" data-idx="${idx}">
      <label class="tpl-color-swatch" style="background:${t.color};" title="Farbe ändern">
        <input type="color" value="${t.color}" onchange="window.updateTemplateAction('${t.id}', 'color', this.value); this.parentElement.style.background=this.value;">
      </label>
      <input type="text" class="tpl-name" value="${escapeHtml(t.label)}" placeholder="Bezeichnung" onchange="window.updateTemplateAction('${t.id}', 'label', this.value)">
      <input type="time" class="tpl-time" value="${t.start_time.slice(0,5)}" onchange="window.updateTemplateAction('${t.id}', 'start_time', this.value)">
      <input type="time" class="tpl-time" value="${t.end_time.slice(0,5)}" onchange="window.updateTemplateAction('${t.id}', 'end_time', this.value)">
      <button class="tpl-delete" onclick="window.deleteTemplateAction('${t.id}')" title="Löschen">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `).join('');
}

export async function updateTemplateAction(id, field, value) {
  try {
    const updates = { [field]: value };
    await updateTemplate(id, updates);
    await loadAllData();
    renderAll();
  } catch (err) {
    alert('Fehler beim Aktualisieren des Templates: ' + err.message);
  }
}

export async function addNewTemplate() {
  try {
    await createTemplate({
      area: templateEditingArea,
      label: 'Neue Schicht',
      start_time: '09:00',
      end_time: '12:00',
      color: '#DDD9C7'
    });
    await loadAllData();
    renderTemplatesList();
    window.toast('Neuer Schicht-Typ hinzugefügt');
    renderAll();
  } catch (err) {
    alert('Fehler beim Erstellen des Templates: ' + err.message);
  }
}

export async function deleteTemplateAction(id) {
  try {
    const shiftsUsingTemplate = getShifts().filter(s => s.template_id === id);
    if (shiftsUsingTemplate.length > 0) {
      const confirmed = await window.appConfirm(`Achtung! Dieser Schicht-Typ wird noch in ${shiftsUsingTemplate.length} Schichten verwendet. Wirklich löschen?`);
      if (!confirmed) {
        return;
      }
    } else {
      const confirmed = await window.appConfirm('Schicht-Typ löschen?');
      if (!confirmed) return;
    }
    
    await deleteTemplate(id);
    await loadAllData();
    renderTemplatesList();
    renderAll();
  } catch (err) {
    alert('Fehler beim Löschen des Templates: ' + err.message);
  }
}

window.openTemplatesModal = openTemplatesModal;
window.switchTemplateArea = switchTemplateArea;
window.updateTemplateAction = updateTemplateAction;
window.addNewTemplate = addNewTemplate;
window.deleteTemplateAction = deleteTemplateAction;
