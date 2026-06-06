import { getArea, getView, getCursorDate } from './state.js';
import { isAdmin, getUserId, getUserEmail } from './auth.js';
import { 
  getEmployees, getShifts, getShiftTemplates, getSwapRequests,
  getEmployeesForArea, getTemplatesForArea, findEmployee, findTemplate, findShift
} from './api.js';
import { 
  MONTHS, DAYS_SHORT, DAYS_LONG, getHoliday, parseDate, formatDate, todayStr,
  getWeekGrid, getMonthGrid, getWeekNumber, avatarColor, initials, fullName, shortName,
  diffHours, escapeHtml 
} from './utils.js';
import { openShiftModal, openEmployeeModal } from './modals.js';
import { switchView } from './main.js';

// ===== SIDEBAR =====
export function renderSidebar() {
  const list = document.getElementById('employee-list');
  const searchInput = document.getElementById('emp-search');
  if (!list || !searchInput) return;
  const search = (searchInput.value || '').toLowerCase();
  
  const area = getArea();
  const empsForArea = getEmployeesForArea(area);
  const filtered = empsForArea.filter(e => fullName(e).toLowerCase().includes(search));
  const myId = getUserId();

  if (filtered.length === 0) {
    list.innerHTML = `<div style="padding:24px 12px;text-align:center;color:var(--text-mute);font-size:13px;">
      ${empsForArea.length === 0 ? 'Noch keine Mitarbeiter.' : 'Keine Treffer.'}
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(e => {
    const planned = plannedHoursForEmployee(e.id);
    const target = e.hours || 0;
    const status = target > 0 ? (planned >= target ? 'ok' : 'warn') : '';
    const isMe = e.id === myId;
    return `
      <div class="employee-row ${isMe?'you':''}" onclick="window.viewProfile('${e.id}')">
        <div class="avatar online" style="background:${avatarColor(fullName(e))};">${initials(e)}</div>
        <div class="emp-info">
          <div class="emp-name">${escapeHtml(shortName(e))}${isMe?' <span style="color:var(--accent-dark);font-size:11px;">(Du)</span>':''}</div>
          ${isAdmin() || isMe ? `<div class="emp-hours"><span class="${status}">${planned.toFixed(2).replace('.', ',')}</span> / ${target.toFixed(2).replace('.', ',')}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function plannedHoursForEmployee(empId) {
  const cursorDate = getCursorDate();
  const d = parseDate(cursorDate);
  const month = d.getMonth(), year = d.getFullYear();
  let total = 0;
  getShifts().forEach(s => {
    if (s.employee_id !== empId) return;
    if (s.area !== getArea()) return;
    const sd = parseDate(s.date);
    if (sd.getMonth() === month && sd.getFullYear() === year) {
      total += diffHours(s.start_time, s.end_time);
    }
  });
  return total;
}

// ===== SCHEDULE =====
export function renderSchedule() {
  const cursorDate = getCursorDate();
  const view = getView();
  const d = parseDate(cursorDate);
  const container = document.getElementById('schedule-container');
  if (!container) return;
  container.className = 'schedule-container ' + (view === 'month' ? 'schedule-month' : 'schedule-week');

  if (view === 'month') {
    document.getElementById('date-label').textContent = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    renderMonthView(container, cursorDate);
  } else {
    const week = getWeekGrid(cursorDate);
    const first = parseDate(week[0].date);
    const last = parseDate(week[6].date);
    document.getElementById('date-label').textContent =
      `KW ${getWeekNumber(cursorDate)} · ${first.getDate()}.${first.getMonth()+1}. – ${last.getDate()}.${last.getMonth()+1}.${last.getFullYear()}`;
    renderWeekView(container, week);
  }
}

function renderMonthView(container, cursorDate) {
  const days = getMonthGrid(cursorDate);
  const today = todayStr();
  let html = '<div class="schedule-grid">';

  DAYS_SHORT.forEach((d, i) => {
    html += `<div class="day-header ${i>=5?'weekend':''}" style="min-height:auto;padding:8px;">${d}</div>`;
  });

  days.forEach(d => {
    const isToday = d.date === today;
    const dateObj = parseDate(d.date);
    const shifts = getShiftsForDay(d.date);
    const isWeekend = d.dow >= 5;
    const holiday = getHoliday(d.date);
    const cellClass = holiday ? 'holiday-cell' : (isWeekend ? 'weekend-cell' : '');

    html += `<div class="day-cell ${d.inMonth ? '' : 'other-month'} ${isToday?'today-cell':''} ${cellClass}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-weight:700;font-size:13px;color:${isToday ? 'var(--accent-dark)' : (isWeekend || holiday)?'var(--text)':'var(--text)'};">${dateObj.getDate()}.</span>
        ${isToday ? '<span style="font-size:10px;color:var(--accent-dark);font-weight:700;letter-spacing:0.3px;">HEUTE</span>' : ''}
        ${holiday && !isToday ? `<span style="font-size:9px;color:#8A6628;font-weight:700;letter-spacing:0.3px;" title="${escapeHtml(holiday)}">FEIERTAG</span>` : ''}
      </div>
      ${holiday ? `<div style="font-size:10px;color:var(--text-soft);font-weight:600;margin-bottom:2px;line-height:1.2;">${escapeHtml(holiday)}</div>` : ''}
      ${shifts.map(s => renderShiftCard(s)).join('')}
      ${isAdmin() ? `<div class="add-shift" onclick="window.openShiftModal(null, '${d.date}')">Schicht</div>` : ''}
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

function renderWeekView(container, week) {
  const today = todayStr();
  let html = '<div class="schedule-grid">';

  week.forEach(d => {
    const isToday = d.date === today;
    const dateObj = parseDate(d.date);
    const isWeekend = d.dow >= 5;
    const holiday = getHoliday(d.date);
    const headerClass = holiday ? 'holiday' : (isWeekend ? 'weekend' : '');
    html += `<div class="day-header ${isToday ? 'today' : ''} ${headerClass}">
      ${DAYS_LONG[d.dow]}<br>
      <span class="date-num">${String(dateObj.getDate()).padStart(2,'0')}.${String(dateObj.getMonth()+1).padStart(2,'0')}.</span>
      ${holiday ? `<span class="holiday-name">${escapeHtml(holiday)}</span>` : ''}
    </div>`;
  });

  html += `<div class="section-label">${getArea() === 'service' ? 'Service' : 'Küche'}</div>`;

  week.forEach(d => {
    const shifts = getShiftsForDay(d.date);
    const isWeekend = d.dow >= 5;
    const isToday = d.date === today;
    const holiday = getHoliday(d.date);
    const cellClass = holiday ? 'holiday-cell' : (isWeekend ? 'weekend-cell' : '');
    html += `<div class="day-cell ${cellClass} ${isToday?'today-cell':''}" style="min-height:300px;">
      ${shifts.map(s => renderShiftCard(s)).join('')}
      ${isAdmin() ? `<div class="add-shift" onclick="window.openShiftModal(null, '${d.date}')">Schicht erstellen</div>` : ''}
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

function getShiftsForDay(date) {
  const area = getArea();
  return getShifts()
    .filter(s => s.date === date && s.area === area)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
}

function isShiftMine(s) {
  const myId = getUserId();
  return myId && s.employee_id === myId;
}

function isShiftOnSwap(s) {
  return getSwapRequests().some(r => r.shift_id === s.id && r.status === 'open');
}

export function renderShiftCard(s) {
  const tpl = findTemplate(s.template_id);
  const bgColor = tpl?.color || '#E0DDD2';
  const label = s.custom_label || s.label || (tpl ? tpl.label : 'Schicht');
  const emp = findEmployee(s.employee_id);
  const empLabel = emp ? escapeHtml(shortName(emp)) : '<em style="opacity:.7;">Unbesetzt</em>';
  const mine = isShiftMine(s);
  const swap = isShiftOnSwap(s);
  const isDraft = s.status === 'draft' || s.status === 'modified';
  const statusTag = s.status === 'draft' ? 'ENTWURF' : (s.status === 'modified' ? 'GEÄNDERT' : '');

  let tags = '';
  if (mine) tags += '<span class="shift-tag mine">DU</span>';
  if (swap) tags += '<span class="shift-tag tausch">TAUSCH</span>';
  if (isDraft && isAdmin()) tags += `<span class="shift-tag draft">${statusTag}</span>`;

  // Person icon for own shifts
  const personIcon = mine ? `<div class="shift-mine-icon" title="Deine Schicht">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
  </div>` : '';

  // Click handler: admin → edit modal, employee own shift → swap menu, other → nothing
  const clickHandler = isAdmin()
    ? `window.openShiftModal('${s.id}')`
    : (mine ? `window.showMyShiftOptions(event,'${s.id}')` : '');

  return `<div class="shift ${s.employee_id ? '' : 'unassigned'} ${mine?'mine':''} ${isDraft&&isAdmin()?'draft':''}"
       style="background:${bgColor};"
       title="${escapeHtml(label)} · ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)} · ${emp ? escapeHtml(fullName(emp)) : 'Unbesetzt'}${isDraft?' · '+statusTag:''}"
       onclick="event.stopPropagation();${clickHandler}"
       oncontextmenu="event.preventDefault();window.showShiftContextMenu(event,'${s.id}')">
    ${personIcon}
    <div class="shift-title">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(label)}${tags}</span>
      <span class="shift-slot">${s.employee_id ? '1/1' : '0/1'}</span>
    </div>
    <div class="shift-time">
      <span>${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}</span>
    </div>
    <div class="shift-employee">${empLabel}</div>
  </div>`;
}

// ===== DASHBOARD =====
export function renderDashboard() {
  const cursorDate = getCursorDate();
  const cursor = parseDate(cursorDate);
  const wcDiv = document.getElementById('week-cards');
  if (!wcDiv) return;

  const weeks = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() + i * 7);
    const strD = formatDate(d);
    const wn = getWeekNumber(strD);
    const weekShifts = getShiftsInWeek(strD);
    const totalSlots = weekShifts.length;
    const filledSlots = weekShifts.filter(s => s.employee_id).length;
    const pct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    weeks.push({ wn, pct, filled: filledSlots, total: totalSlots });
  }

  wcDiv.innerHTML = weeks.map(w => `
    <div class="week-card">
      <div class="week-card-head">
        <div class="week-card-title">KW ${w.wn}</div>
        <div class="week-card-pct">${w.pct} %</div>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${w.pct}%"></div></div>
      <div style="font-size:12px;color:var(--text-soft);margin-top:8px;">${w.filled} / ${w.total} Schichten besetzt</div>
    </div>
  `).join('');

  const area = getArea();
  const empsForArea = getEmployeesForArea(area);
  const shiftsForArea = getShifts().filter(s => s.area === area);
  const unassigned = shiftsForArea.filter(s => !s.employee_id).length;
  const openSwaps = getSwapRequests().filter(r => r.status === 'open').length;

  const statsRow = document.getElementById('stats-row');
  if (statsRow) {
    statsRow.innerHTML = `
      <div class="stat-card"><div class="stat-number">${empsForArea.length}</div><div class="stat-label">Mitarbeiter</div></div>
      <div class="stat-card"><div class="stat-number">${shiftsForArea.length}</div><div class="stat-label">Schichten gesamt</div></div>
      <div class="stat-card"><div class="stat-number">${unassigned}</div><div class="stat-label">Unbesetzt</div></div>
      <div class="stat-card"><div class="stat-number">${openSwaps}</div><div class="stat-label">Offene Tauschanfragen</div></div>
    `;
  }

  const myId = getUserId();
  const today = todayStr();
  const myUpcomingShifts = getShifts()
    .filter(s => s.employee_id === myId && s.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''))
    .slice(0, 10); // next 10 shifts

  const myShiftsContainer = document.getElementById('dashboard-my-shifts');
  if (myShiftsContainer) {
    if (myUpcomingShifts.length === 0) {
      myShiftsContainer.innerHTML = `<div style="color:var(--text-soft); font-size:13px; background:var(--surface-2); padding:16px; border-radius:12px; text-align:center;">Keine anstehenden Schichten.</div>`;
    } else {
      myShiftsContainer.innerHTML = myUpcomingShifts.map(s => {
        const d = parseDate(s.date);
        const tpl = findTemplate(s.template_id);
        const label = s.custom_label || s.label || (tpl ? tpl.label : 'Schicht');
        const isSwap = isShiftOnSwap(s);
        
        return `
          <div class="dashboard-shift-item">
            <div style="background:var(--accent-dark); color:white; width:44px; height:44px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0;">
              <div style="font-weight:700; font-size:12px; line-height:1;">${DAYS_SHORT[d.getDay()]}</div>
              <div style="font-size:10px; font-weight:600; line-height:1.2; opacity:0.9;">${('0'+d.getDate()).slice(-2)}.${('0'+(d.getMonth()+1)).slice(-2)}</div>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:13px; color:var(--text); margin-bottom:2px;">${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}</div>
              <div style="font-size:13px; font-weight:600;">${escapeHtml(label)}</div>
              <div style="font-size:12px; color:var(--text-mute); margin-top:2px;">${s.area === 'kueche' ? 'Küche' : 'Service'} | Tushita</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">
              <button class="btn dashboard-shift-btn" onclick="event.stopPropagation(); window.showMyShiftOptions(event, '${s.id}')" title="Schicht tauschen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function getShiftsInWeek(dateStr) {
  const week = getWeekGrid(dateStr).map(d => d.date);
  return getShifts().filter(s => s.area === getArea() && week.includes(s.date));
}

// ===== EMPLOYEES GRID =====
export function renderEmployeesGrid() {
  const grid = document.getElementById('employees-grid');
  if (!grid) return;
  const search = (document.getElementById('emp-search-2').value || '').toLowerCase();
  
  const area = getArea();
  const myId = getUserId();
  const filtered = getEmployees().filter(e =>
    (e.area === area || e.area === 'both') &&
    (fullName(e).toLowerCase().includes(search) || (e.email || '').toLowerCase().includes(search))
  );

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <div>Noch keine Mitarbeiter im Bereich ${area === 'service' ? 'Service' : 'Küche'}.</div>
      ${isAdmin() ? '<button class="btn-primary" style="margin-top:16px;" onclick="window.openEmployeeModal()">+ Mitarbeiter anlegen</button>' : ''}
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(e => `
    <div class="employee-card ${e.id===myId?'is-you':''}" onclick="window.viewProfile('${e.id}')">
      ${isAdmin() ? `<button class="card-menu" onclick="event.stopPropagation();window.openEmployeeModal('${e.id}')" title="Bearbeiten">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </button>` : ''}
      <div class="avatar online" style="background:${avatarColor(fullName(e))};">${initials(e)}</div>
      <div class="emp-name">${escapeHtml(fullName(e))}${e.id===myId?' <span style="color:var(--accent-dark);">(Du)</span>':''}</div>
      <div class="emp-role">${e.area === 'kueche' ? 'Küche' : e.area === 'both' ? 'Service & Küche' : 'Service'}</div>
      <div class="emp-badge">${e.area === 'kueche' ? 'Kü' : 'Ser'}</div>
      ${e.email ? `<div style="margin-top:14px;font-size:13px;color:var(--accent-dark);">${escapeHtml(e.email)}</div>` : ''}
    </div>
  `).join('');
}

// ===== TAUSCH =====
export function renderTausch() {
  const content = document.getElementById('tausch-content');
  if (!content) return;
  const swaps = getSwapRequests();
  const open = swaps.filter(r => r.status === 'open');
  const taken = swaps.filter(r => r.status === 'taken').slice(-10);

  // Badge update
  const badge = document.getElementById('tausch-badge');
  if (badge) {
    if (open.length > 0) {
      badge.textContent = open.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  if (open.length === 0 && taken.length === 0) {
    content.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      <div>Aktuell keine Tauschanfragen.</div>
    </div>`;
    return;
  }

  const myId = getUserId();
  let html = '';

  if (open.length > 0) {
    html += '<h3 style="margin-bottom:12px;font-size:15px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">Offen</h3>';
    open.forEach(r => {
      const shift = findShift(r.shift_id);
      if (!shift) return;
      const emp = findEmployee(r.from_employee_id);
      const tpl = findTemplate(shift.template_id);
      const isMine = r.from_employee_id === myId;
      const canTake = !isMine && (!isAdmin());

      html += `<div class="tausch-card">
        <div class="avatar" style="width:48px;height:48px;font-size:14px;background:${avatarColor(fullName(emp))};">${initials(emp)}</div>
        <div class="tausch-info">
          <div style="font-weight:600;">${escapeHtml(fullName(emp) || 'Unbekannt')} sucht Tausch</div>
          <div class="tausch-shift-info">
            <div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg> ${new Date(shift.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}</div>
            <div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${shift.start_time.slice(0,5)} – ${shift.end_time.slice(0,5)}</div>
            <div><span class="shift-tag" style="background:${tpl?tpl.color:'var(--surface-2)'};color:var(--text);">${escapeHtml(tpl?tpl.label:'Schicht')}</span></div>
            <div><span style="color:var(--text-mute);">Bereich: ${shift.area === 'kueche' ? 'Küche' : 'Service'}</span></div>
          </div>
          ${r.note?`<div style="margin-top:8px;font-size:13px;background:var(--surface-2);padding:8px 12px;border-radius:8px;color:var(--text-soft);">"${escapeHtml(r.note)}"</div>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${isMine ? `<button class="btn btn-secondary" onclick="window.cancelSwap('${r.id}')">Zurückziehen</button>` : ''}
          ${canTake ? `<button class="btn btn-primary" style="background:var(--accent);color:white;" onclick="window.takeSwap('${r.id}')">Übernehmen</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-secondary" onclick="window.cancelSwap('${r.id}')">Ablehnen</button>` : ''}
        </div>
      </div>`;
    });
  }

  if (taken.length > 0) {
    html += '<h3 style="margin:24px 0 12px;font-size:15px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">Erledigt</h3>';
    taken.forEach(r => {
      const shift = findShift(r.shift_id);
      if (!shift) return;
      const emp = findEmployee(r.from_employee_id);
      const taker = findEmployee(r.taken_by);
      html += `<div class="tausch-card taken">
        <div class="avatar" style="width:48px;height:48px;font-size:14px;background:${avatarColor(fullName(taker))};">${initials(taker)}</div>
        <div class="tausch-info">
          <div style="font-weight:600;">${escapeHtml(shortName(emp) || '?')} → ${escapeHtml(shortName(taker) || '?')}</div>
          <div class="tausch-shift-info">
            <div>${new Date(shift.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}</div>
            <div>${shift.start_time.slice(0,5)} – ${shift.end_time.slice(0,5)}</div>
          </div>
        </div>
      </div>`;
    });
  }

  content.innerHTML = html;
}

// ===== TIME =====
export function renderTime(timeMode = 'list') {
  const cursorDate = getCursorDate();
  const area = getArea();
  const cursor = parseDate(cursorDate);
  const month = cursor.getMonth(), year = cursor.getFullYear();
  
  let monthShifts = getShifts().filter(s => {
    if (s.area !== area) return false;
    const d = parseDate(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  if (!isAdmin()) {
    const myId = getUserId();
    monthShifts = monthShifts.filter(s => s.employee_id === myId);
  }

  const total = monthShifts.reduce((a, s) => a + diffHours(s.start_time, s.end_time), 0);
  const timeTotalEl = document.getElementById('time-total');
  if (timeTotalEl) timeTotalEl.textContent = total.toFixed(1).replace('.', ',') + 'h';
  
  const timeLabelEl = document.getElementById('time-label');
  if (timeLabelEl) timeLabelEl.textContent = `Geplante Stunden in ${MONTHS[month]} ${year} (${area === 'kueche' ? 'Küche' : 'Service'})`;

  if (!isAdmin()) {
    const timeModeList = document.getElementById('time-mode-list');
    if (timeModeList && timeModeList.parentElement) timeModeList.parentElement.style.display = 'none';
  }

  if (timeMode === 'person' && isAdmin()) {
    renderTimePerPerson(monthShifts, month, year);
  } else {
    renderTimeList(monthShifts, month, year);
  }
}

function renderTimeList(monthShifts, month, year) {
  const timeList = document.getElementById('time-list');
  if (!timeList) return;

  if (monthShifts.length === 0) {
    timeList.innerHTML = `<div class="empty-state" style="background:var(--surface);border-radius:14px;">
      <div>Keine geplanten Zeiten in ${MONTHS[month]} ${year}.</div>
    </div>`;
    return;
  }

  const sorted = [...monthShifts].sort((a,b) => a.date.localeCompare(b.date) || (a.start_time||'').localeCompare(b.start_time||''));
  timeList.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;overflow:hidden;border:1px solid var(--border-soft);">
      <div style="display:grid;grid-template-columns:1.5fr 1fr 1.5fr 1fr 1fr;padding:14px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-soft);font-weight:700;border-bottom:1px solid var(--border-soft);">
        <div>Mitarbeiter</div><div>Datum</div><div>Uhrzeit</div><div>Schicht</div><div>Stunden</div>
      </div>
      ${sorted.map(s => {
        const emp = findEmployee(s.employee_id);
        const tpl = findTemplate(s.template_id);
        return `<div style="display:grid;grid-template-columns:1.5fr 1fr 1.5fr 1fr 1fr;padding:11px 16px;border-bottom:1px solid var(--border-soft);align-items:center;font-size:13px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${emp ? `<div class="avatar" style="width:28px;height:28px;font-size:10.5px;background:${avatarColor(fullName(emp))};">${initials(emp)}</div>` : '<div style="width:28px;height:28px;border-radius:50%;background:var(--surface-2);"></div>'}
            <span>${emp ? escapeHtml(shortName(emp)) : '<em style="color:var(--text-mute);">Unbesetzt</em>'}</span>
          </div>
          <div>${new Date(s.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}</div>
          <div>${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}</div>
          <div><span style="padding:2px 8px;border-radius:5px;font-size:11.5px;font-weight:600;background:${tpl?.color || 'var(--surface-2)'};">${escapeHtml(s.custom_label || s.label || '')}</span></div>
          <div><b>${diffHours(s.start_time,s.end_time).toFixed(2).replace('.', ',')}</b></div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderTimePerPerson(monthShifts, month, year) {
  const timeList = document.getElementById('time-list');
  if (!timeList) return;
  const area = getArea();
  const empsForArea = getEmployeesForArea(area);

  if (empsForArea.length === 0) {
    timeList.innerHTML = `<div class="empty-state" style="background:var(--surface);border-radius:14px;">
      <div>Keine Mitarbeiter in diesem Bereich.</div>
    </div>`;
    return;
  }

  const cards = empsForArea.map(emp => {
    const empShifts = monthShifts.filter(s => s.employee_id === emp.id)
      .sort((a,b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const total = empShifts.reduce((a, s) => a + diffHours(s.start_time, s.end_time), 0);
    const target = emp.hours || 0;
    const diff = total - target;
    const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    const statusColor = target === 0 ? 'var(--text-mute)' : (diff >= 0 ? 'var(--accent-dark)' : 'var(--danger-dark)');

    return `<div style="background:var(--surface);border-radius:14px;border:1px solid var(--border-soft);overflow:hidden;">
      <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border-soft);">
        <div class="avatar online" style="background:${avatarColor(fullName(emp))};">${initials(emp)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:15px;">${escapeHtml(fullName(emp))}</div>
          <div style="font-size:12px;color:var(--text-mute);">${emp.area === 'kueche' ? 'Küche' : emp.area === 'both' ? 'Service & Küche' : 'Service'} ${emp.email ? '· ' + escapeHtml(emp.email) : ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:700;color:${statusColor};line-height:1;">${total.toFixed(2).replace('.', ',')}h</div>
          <div style="font-size:11.5px;color:var(--text-soft);margin-top:2px;">${target > 0 ? `von ${target.toFixed(2).replace('.', ',')}h Soll` : 'Kein Soll definiert'}</div>
          ${target > 0 ? `<div style="font-size:11px;font-weight:700;margin-top:4px;color:${statusColor};">${diff >= 0 ? '+' : ''}${diff.toFixed(2).replace('.', ',')}h</div>` : ''}
        </div>
      </div>
      ${target > 0 ? `<div style="height:4px;background:var(--surface-2);">
        <div style="height:100%;background:${statusColor};width:${pct}%;transition:width 0.3s;"></div>
      </div>` : ''}
      ${empShifts.length === 0
        ? `<div style="padding:14px 18px;color:var(--text-mute);font-size:13px;">Keine Schichten in diesem Monat.</div>`
        : `<div style="padding:8px 12px;">
            ${empShifts.map(s => {
              const tpl = findTemplate(s.template_id);
              const d = new Date(s.date);
              return `<div style="display:grid;grid-template-columns:30px 90px 1fr 100px 60px;align-items:center;padding:6px 8px;border-radius:8px;font-size:12.5px;gap:6px;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                <div style="width:8px;height:8px;border-radius:2px;background:${tpl?.color || 'var(--surface-2)'};margin-left:8px;"></div>
                <div style="color:var(--text-soft);font-weight:600;">${d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}</div>
                <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.custom_label || s.label || '')}</div>
                <div style="color:var(--text-soft);">${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}</div>
                <div style="text-align:right;font-weight:700;">${diffHours(s.start_time, s.end_time).toFixed(2).replace('.', ',')}h</div>
              </div>`;
            }).join('')}
          </div>`
      }
    </div>`;
  }).join('');

  timeList.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px;">${cards}</div>`;
}

// ===== PROFILE =====
export function viewProfile(empId) {
  window.viewingProfileId = empId;
  const emp = findEmployee(empId);
  if (!emp) return;
  const myId = getUserId();
  const isMine = empId === myId;
  const canEdit = isAdmin() || isMine;
  const planned = plannedHoursForEmployee(empId);

  document.getElementById('profile-card-content').innerHTML = `
    <div class="avatar online" style="background:${avatarColor(fullName(emp))};">${initials(emp)}</div>
    <div class="name">${escapeHtml(fullName(emp))}${isMine?' <span style="color:var(--accent-dark);font-size:14px;">(Du)</span>':''}</div>
    <div class="role">${emp.area === 'kueche' ? 'Küche' : emp.area === 'both' ? 'Service & Küche' : 'Service'}</div>
    <div style="font-size:12px;color:var(--text-mute);margin-top:8px;">
      Angelegt am ${emp.created_at ? new Date(emp.created_at).toLocaleDateString('de-DE') : '—'}
    </div>
    ${isAdmin() || isMe ? `<div style="margin-top:16px;padding:12px;background:var(--surface-2);border-radius:10px;">
      <div style="font-size:11px;color:var(--text-mute);text-transform:uppercase;letter-spacing:0.5px;">Geplante Stunden (${MONTHS[parseDate(getCursorDate()).getMonth()]})</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">${planned.toFixed(2).replace('.', ',')}h</div>
      <div style="font-size:12px;color:var(--text-soft);">von ${(emp.hours || 0).toFixed(2).replace('.', ',')}h / Monat</div>
    </div>` : ''}
    ${canEdit ? `<div class="profile-actions">
      ${isAdmin() ? `<button class="action-circle green" onclick="window.openEmployeeModal('${emp.id}')" title="Bearbeiten">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>` : ''}
      <button class="action-circle gray" onclick="window.openPasswordModal(${isMine?"'self'":`'${emp.id}'`})" title="Passwort">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </button>
      ${isAdmin() && !isMine ? `<button class="action-circle red" onclick="window.deleteEmployeeProfile('${emp.id}')" title="Löschen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>` : ''}
    </div>` : ''}
  `;

  const readOnly = !canEdit;
  document.getElementById('profile-details-content').innerHTML = `
    <h3 style="margin-bottom:20px;font-size:18px;">Stammdaten</h3>
    <div class="profile-form-grid">
      <div class="form-group">
        <label>Vorname</label>
        <input type="text" value="${escapeHtml(emp.firstname || '')}" ${readOnly?'readonly':''} onchange="window.updateEmpField('${emp.id}','firstname',this.value)">
      </div>
      <div class="form-group">
        <label>Nachname</label>
        <input type="text" value="${escapeHtml(emp.lastname || '')}" ${readOnly?'readonly':''} onchange="window.updateEmpField('${emp.id}','lastname',this.value)">
      </div>
      <div class="form-group">
        <label>E-Mail</label>
        <input type="email" value="${isMine ? escapeHtml(getUserEmail()) : '(nur für den Nutzer selbst sichtbar)'}" readonly title="E-Mail kann nur vom Support geändert werden">
      </div>
      <div class="form-group">
        <label>Telefon</label>
        <input type="tel" value="${escapeHtml(emp.phone || '')}" ${readOnly?'readonly':''} onchange="window.updateEmpField('${emp.id}','phone',this.value)">
      </div>
      <div class="form-group">
        <label>Bereich</label>
        <select ${isAdmin()?'':'disabled'} onchange="window.updateEmpField('${emp.id}','area',this.value)">
          <option value="service" ${emp.area==='service'?'selected':''}>Service</option>
          <option value="kueche" ${emp.area==='kueche'?'selected':''}>Küche</option>
          <option value="both" ${emp.area==='both'?'selected':''}>Beides</option>
        </select>
      </div>
      ${isAdmin() || isMe ? `<div class="form-group">
        <label>Soll-Stunden / Monat</label>
        <input type="number" value="${emp.hours || 0}" ${isAdmin()?'':'readonly'} onchange="window.updateEmpField('${emp.id}','hours',parseFloat(this.value)||0)">
      </div>` : ''}
    </div>
    <div class="form-group" style="margin-top:18px;">
      <label>Notiz</label>
      <textarea rows="3" ${readOnly?'readonly':''} onchange="window.updateEmpField('${emp.id}','note',this.value)">${escapeHtml(emp.note || '')}</textarea>
    </div>
    <h3 style="margin:24px 0 12px;font-size:16px;">Schichten (${MONTHS[parseDate(getCursorDate()).getMonth()]} ${parseDate(getCursorDate()).getFullYear()})</h3>
    <div id="profile-shifts"></div>
  `;

  const d = parseDate(getCursorDate());
  const month = d.getMonth(), year = d.getFullYear();
  const empShifts = getShifts()
    .filter(s => s.employee_id === empId && parseDate(s.date).getMonth()===month && parseDate(s.date).getFullYear()===year)
    .sort((a, b) => a.date.localeCompare(b.date));

  const psDiv = document.getElementById('profile-shifts');
  if (empShifts.length === 0) {
    psDiv.innerHTML = '<div style="color:var(--text-mute);font-size:13px;padding:12px 0;">Keine Schichten in diesem Monat.</div>';
  } else {
    psDiv.innerHTML = empShifts.map(s => `
      <div style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:8px;background:var(--surface-2);margin-bottom:6px;">
        <span><b>${new Date(s.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}</b> · ${escapeHtml(s.custom_label || s.label || 'Schicht')}</span>
        <span>${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)} · <span style="color:var(--text-mute);">${diffHours(s.start_time,s.end_time).toFixed(1)}h</span></span>
      </div>
    `).join('');
  }

  switchView('profile');
}

window.viewProfile = viewProfile;
