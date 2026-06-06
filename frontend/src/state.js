// Local UI state — persisted in localStorage (not in database)
const UI_STATE_KEY = 'tushita-ui-state';

const DEFAULT_UI_STATE = {
  area: 'service',
  view: 'month',
  cursorDate: new Date().toISOString().slice(0, 10),
  scheduleFilter: 'all'
};

let uiState = loadUIState();

function loadUIState() {
  try {
    const saved = localStorage.getItem(UI_STATE_KEY);
    if (saved) return { ...DEFAULT_UI_STATE, ...JSON.parse(saved) };
  } catch (e) {}
  return { ...DEFAULT_UI_STATE };
}

function saveUIState() {
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
  } catch (e) {}
}

export function getArea() { return uiState.area; }
export function getView() { return uiState.view; }
export function getCursorDate() { return uiState.cursorDate; }
export function getScheduleFilter() { return uiState.scheduleFilter || 'all'; }

export function setArea(area) {
  uiState.area = area;
  saveUIState();
}

export function setView(view) {
  uiState.view = view;
  saveUIState();
}

export function setCursorDate(date) {
  uiState.cursorDate = date;
  saveUIState();
}

export function setScheduleFilter(filter) {
  uiState.scheduleFilter = filter;
  saveUIState();
}
