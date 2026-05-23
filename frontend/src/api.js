import { supabase } from './supabase.js';
import { getArea } from './state.js';

// ===== In-memory data cache =====
let employees = [];
let shifts = [];
let shiftTemplates = [];
let swapRequests = [];

// ===== DATA LOADING (sync-on-load) =====

export async function loadAllData() {
  await Promise.all([
    loadEmployees(),
    loadShifts(),
    loadTemplates(),
    loadSwapRequests()
  ]);
}

export async function loadEmployees() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at');
  if (error) { console.error('Load employees error:', error); return; }
  employees = data || [];
}

export async function loadShifts() {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('date')
    .order('start_time');
  if (error) { console.error('Load shifts error:', error); return; }
  shifts = data || [];
}

export async function loadTemplates() {
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .order('area')
    .order('sort_order');
  if (error) { console.error('Load templates error:', error); return; }
  shiftTemplates = data || [];
}

export async function loadSwapRequests() {
  const { data, error } = await supabase
    .from('swap_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Load swaps error:', error); return; }
  swapRequests = data || [];
}

// ===== GETTERS (from cache) =====

export function getEmployees() { return employees; }
export function getShifts() { return shifts; }
export function getShiftTemplates() { return shiftTemplates; }
export function getSwapRequests() { return swapRequests; }

export function getEmployeesForArea(area) {
  return employees.filter(e => e.area === area || e.area === 'both');
}

export function getTemplatesForArea(area) {
  return shiftTemplates.filter(t => t.area === area);
}

export function getShiftsForDay(date, area) {
  return shifts.filter(s => s.date === date && s.area === area);
}

export function findEmployee(id) {
  return employees.find(e => e.id === id) || null;
}

export function findTemplate(id) {
  return shiftTemplates.find(t => t.id === id) || null;
}

export function findShift(id) {
  return shifts.find(s => s.id === id) || null;
}

// ===== SWAP REQUESTS (direct Supabase calls with RLS) =====

export async function createSwapRequest(shiftId, fromEmployeeId, note) {
  const { data, error } = await supabase
    .from('swap_requests')
    .insert({
      shift_id: shiftId,
      from_employee_id: fromEmployeeId,
      note: note || '',
      status: 'open'
    })
    .select()
    .single();

  if (error) throw error;
  await loadSwapRequests();
  return data;
}

export async function cancelSwapRequest(swapId) {
  const { error } = await supabase
    .from('swap_requests')
    .delete()
    .eq('id', swapId);

  if (error) throw error;
  await loadSwapRequests();
}

export async function takeSwapRequest(swapId, takenByUserId) {
  // Get the swap request
  const swap = swapRequests.find(r => r.id === swapId);
  if (!swap) throw new Error('Tauschanfrage nicht gefunden');

  // Update the shift's employee
  const { error: shiftError } = await supabase
    .from('shifts')
    .update({ employee_id: takenByUserId })
    .eq('id', swap.shift_id);

  // Note: employees can't update shifts directly via RLS,
  // but taking a swap is a special case. We'll handle this via
  // a more permissive policy or use the backend.
  // For now, we try directly — if RLS blocks it, we'll adjust.

  // Update the swap request
  const { error: swapError } = await supabase
    .from('swap_requests')
    .update({
      status: 'taken',
      taken_by: takenByUserId,
      taken_at: new Date().toISOString()
    })
    .eq('id', swapId);

  if (shiftError) throw shiftError;
  if (swapError) throw swapError;

  await Promise.all([loadShifts(), loadSwapRequests()]);
}

// ===== PROFILE UPDATE (own profile) =====

export async function updateOwnProfile(updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', updates.id || (await supabase.auth.getUser()).data.user.id)
    .select()
    .single();

  if (error) throw error;
  await loadEmployees();
  return data;
}
