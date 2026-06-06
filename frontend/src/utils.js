// ===== CONSTANTS =====
export const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export const DAYS_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];
export const DAYS_LONG = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

// Deutsche gesetzliche Feiertage (bundesweit) 2025-2028
export const HOLIDAYS = {
  '2025-01-01': 'Neujahr', '2025-04-18': 'Karfreitag', '2025-04-21': 'Ostermontag',
  '2025-05-01': 'Tag der Arbeit', '2025-05-29': 'Christi Himmelfahrt', '2025-06-09': 'Pfingstmontag',
  '2025-10-03': 'Tag der Deutschen Einheit', '2025-12-25': '1. Weihnachtstag', '2025-12-26': '2. Weihnachtstag',
  '2026-01-01': 'Neujahr', '2026-04-03': 'Karfreitag', '2026-04-06': 'Ostermontag',
  '2026-05-01': 'Tag der Arbeit', '2026-05-14': 'Christi Himmelfahrt', '2026-05-25': 'Pfingstmontag',
  '2026-10-03': 'Tag der Deutschen Einheit', '2026-12-25': '1. Weihnachtstag', '2026-12-26': '2. Weihnachtstag',
  '2027-01-01': 'Neujahr', '2027-03-26': 'Karfreitag', '2027-03-29': 'Ostermontag',
  '2027-05-01': 'Tag der Arbeit', '2027-05-06': 'Christi Himmelfahrt', '2027-05-17': 'Pfingstmontag',
  '2027-10-03': 'Tag der Deutschen Einheit', '2027-12-25': '1. Weihnachtstag', '2027-12-26': '2. Weihnachtstag',
  '2028-01-01': 'Neujahr', '2028-04-14': 'Karfreitag', '2028-04-17': 'Ostermontag',
  '2028-05-01': 'Tag der Arbeit', '2028-05-25': 'Christi Himmelfahrt', '2028-06-05': 'Pfingstmontag',
  '2028-10-03': 'Tag der Deutschen Einheit', '2028-12-25': '1. Weihnachtstag', '2028-12-26': '2. Weihnachtstag'
};

// ===== DATE FUNCTIONS =====
export function getHoliday(dateStr) { return HOLIDAYS[dateStr] || null; }

export function parseDate(s) { return new Date(s + 'T00:00:00'); }

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return formatDate(new Date());
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export function getMonthGrid(dateStr) {
  const d = parseDate(dateStr);
  const year = d.getFullYear(), month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - startDay);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push({ date: formatDate(day), inMonth: day.getMonth() === month, dow: (day.getDay() + 6) % 7 });
  }
  return days;
}

export function getWeekGrid(dateStr) {
  const d = parseDate(dateStr);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push({ date: formatDate(day), inMonth: true, dow: i });
  }
  return days;
}

export function getWeekNumber(dateStr) {
  const d = parseDate(dateStr);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

// ===== DISPLAY HELPERS =====
export function avatarColor(name) {
  const colors = ['#F2C8D2','#B8DAE4','#E8C9A8','#D4B8C9','#C5D9C0','#D9C5A8','#C9B8D9','#E2BFA0'];
  let h = 0;
  for (const c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

export function initials(emp) {
  if (!emp) return '?';
  const f = (emp.firstname || '').trim();
  const l = (emp.lastname || '').trim();
  return ((f[0] || '') + (l[0] || '')).toUpperCase() || '?';
}

export function fullName(emp) {
  if (!emp) return '';
  return [emp.firstname, emp.lastname].filter(Boolean).join(' ');
}

export function shortName(emp) {
  if (!emp) return '';
  const last = (emp.lastname || '').trim();
  return [emp.firstname, last ? last[0] + '.' : ''].filter(Boolean).join(' ');
}

export function diffHours(start, end) {
  if (!start || !end) return 0;
  // Handle both "HH:MM" and "HH:MM:SS" formats
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export function formatTime(timeStr) {
  if (!timeStr) return '--:--';
  return timeStr.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}

export function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

window.toast = toast;
