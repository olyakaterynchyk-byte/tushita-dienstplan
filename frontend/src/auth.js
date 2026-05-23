import { supabase } from './supabase.js';
import { toast } from './utils.js';

let currentSession = null;
let currentProfile = null;

/**
 * Initialize auth — check for existing session
 * Returns { session, profile } or null
 */
export async function initAuth() {
  // Handle password reset / invite redirect
  const hash = window.location.hash;
  if (hash && (hash.includes('type=recovery') || hash.includes('type=invite') || hash.includes('type=signup'))) {
    // Supabase will handle the token exchange automatically
    // Show the set-password form
    return { needsPasswordSet: true };
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    currentSession = null;
    currentProfile = null;
    return null;
  }

  currentSession = session;
  await loadProfile();
  return { session: currentSession, profile: currentProfile };
}

/**
 * Listen for auth state changes
 */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    currentSession = session;
    if (session) {
      await loadProfile();
    } else {
      currentProfile = null;
    }
    callback(event, session, currentProfile);
  });
}

/**
 * Sign in with email + password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    if (error.message?.includes('Invalid login')) {
      throw new Error('E-Mail oder Passwort falsch.');
    }
    throw new Error(error.message);
  }

  currentSession = data.session;
  await loadProfile();
  return { session: currentSession, profile: currentProfile };
}

/**
 * Sign out
 */
export async function signOut() {
  await supabase.auth.signOut();
  currentSession = null;
  currentProfile = null;
}

/**
 * Update own password (for password set / reset flow)
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Change own password (requires current session)
 */
export async function changeOwnPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  toast('Passwort aktualisiert.');
  return true;
}

/**
 * Load the current user's profile from the DB
 */
async function loadProfile() {
  if (!currentSession?.user?.id) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentSession.user.id)
    .single();

  if (error) {
    console.error('Failed to load profile:', error);
    currentProfile = null;
    return;
  }

  currentProfile = data;
}

// Getters
export function getSession() { return currentSession; }
export function getProfile() { return currentProfile; }
export function getToken() { return currentSession?.access_token || ''; }
export function isAdmin() { return currentProfile?.role === 'admin'; }
export function getUserId() { return currentSession?.user?.id || null; }
export function getUserEmail() { return currentSession?.user?.email || ''; }
