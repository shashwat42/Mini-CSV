'use strict';

/**
 * Supabase client configuration and initialization.
 */

const SUPABASE_URL = 'https://rujkoncettencrejriba.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Vmy-L_q5WyF609suddbRHg_LEAw8Wvm';

let supabaseClient = null;

/**
 * Initializes the Supabase client after supabase.min.js loads.
 */
function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded.');
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    console.log('Supabase initialized');
    return supabaseClient;
  } catch (err) {
    console.error('Supabase initialization failed:', err);
    return null;
  }
}

/**
 * Returns the active Supabase client instance.
 */
function getClient() {
  if (!supabaseClient) {
    return initSupabase();
  }

  return supabaseClient;
}

/**
 * Checks whether Supabase credentials are configured.
 */
function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

const SupabaseService = {
  initSupabase,
  getClient,
  isConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};