import { getToken } from './auth.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

async function apiCall(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BACKEND_URL}${path}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

// ===== EMPLOYEES (admin operations) =====

export async function createEmployee({ firstname, lastname, email, area, hours, phone, note }) {
  return apiCall('POST', '/api/employees', { firstname, lastname, email, area, hours, phone, note });
}

export async function updateEmployee(id, updates) {
  return apiCall('PUT', `/api/employees/${id}`, updates);
}

export async function deleteEmployee(id) {
  return apiCall('DELETE', `/api/employees/${id}`);
}

export async function resetEmployeePassword(id) {
  return apiCall('POST', `/api/employees/${id}/reset-password`);
}

// ===== SHIFTS (admin operations) =====

export async function createShift(shiftData) {
  return apiCall('POST', '/api/shifts', shiftData);
}

export async function updateShift(id, updates) {
  return apiCall('PUT', `/api/shifts/${id}`, updates);
}

export async function deleteShift(id) {
  return apiCall('DELETE', `/api/shifts/${id}`);
}

export async function publishShifts(shiftIds) {
  return apiCall('POST', '/api/shifts/publish', { shiftIds });
}

export async function copyPeriod({ sourceShiftIds, dateMapping, keepEmployees, area }) {
  return apiCall('POST', '/api/shifts/copy-period', { sourceShiftIds, dateMapping, keepEmployees, area });
}

// ===== TEMPLATES (admin operations) =====

export async function createTemplate(templateData) {
  return apiCall('POST', '/api/templates', templateData);
}

export async function updateTemplate(id, updates) {
  return apiCall('PUT', `/api/templates/${id}`, updates);
}

export async function deleteTemplate(id) {
  return apiCall('DELETE', `/api/templates/${id}`);
}

// ===== NOTIFICATIONS =====

export async function sendPublishNotification({ shiftIds, periodLabel, area }) {
  return apiCall('POST', '/api/notifications/publish', { shiftIds, periodLabel, area });
}
