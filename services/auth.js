'use strict';

/**
 * Authentication Service
 * Handles Google OAuth login/logout and auth state management
 */

/**
 * Sign in with Google OAuth
 * Returns the session if successful, null otherwise
 */
async function signInWithGoogle() {
  try {
    const client = SupabaseService.getClient();
    if (!client) {
      throw new Error('Supabase not configured');
    }

    // Use chrome.identity to handle OAuth in Manifest V3
    const redirectUri = chrome.identity.getRedirectURL('supabase');

    // Ask Supabase for the provider URL (will include redirect)
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUri },
    });

    if (error) {
      console.error('Sign in error (requesting URL):', error);
      return null;
    }

    const url = data?.url;

    if (!url) {
      console.error('No OAuth URL returned by Supabase');
      return null;
    }

    // Launch the browser auth flow. This opens a window managed by Chrome.
    const redirectedTo = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url, interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }

          if (!redirectUrl) {
            return reject(new Error('Auth flow did not complete'));
          }

          resolve(redirectUrl);
        }
      );
    }).catch((err) => {
      console.warn('Auth flow cancelled or failed:', err.message || err);
      return null;
    });

    if (!redirectedTo) {
      // User cancelled or an error occurred
      return null;
    }

    // After redirect, attempt to read the session from the client.
    // Supabase SDK should exchange the code and persist the session for this origin.
    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      console.warn('Failed to obtain session after OAuth redirect:', sessionError);
      return null;
    }

    return sessionData;
  } catch (err) {
    console.error('Sign in failed:', err);
    return null;
  }
}

/**
 * Sign out current user
 * Clears local cache of files and auth state
 */
async function signOut() {
  try {
    const client = SupabaseService.getClient();
    if (!client) {
      return;
    }
    const { error } = await client.auth.signOut();
    if (error) {
      console.warn('Sign out error:', error);
    }

    // Best-effort clear of local auth/session keys used by supabase-js
    try {
      await chrome.storage.local.remove(['supabase.auth.token', 'csvNotesSync']);
    } catch (e) {
      // ignore
    }
  } catch (err) {
    console.error('Sign out failed:', err);
  }
}

/**
 * Get the current logged-in user
 * Returns user object or null
 */
async function getCurrentUser() {
  try {
    const client = SupabaseService.getClient();
    if (!client) {
      return null;
    }

    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      return null;
    }

    return user;
  } catch (err) {
    console.error('Get user failed:', err);
    return null;
  }
}

/**
 * Get current session
 */
async function getSession() {
  try {
    const client = SupabaseService.getClient();
    if (!client) {
      return null;
    }

    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      return null;
    }

    return session;
  } catch (err) {
    console.error('Get session failed:', err);
    return null;
  }
}

/**
 * Listen for auth state changes
 * Calls callback whenever auth state changes (login/logout)
 */
function onAuthStateChange(callback) {
  try {
    const client = SupabaseService.getClient();
    if (!client) {
      return null;
    }

    const { data: { subscription } } = client.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );

    return subscription;
  } catch (err) {
    console.error('Auth state listener failed:', err);
    return null;
  }
}

// Export auth functions
const AuthService = {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  getSession,
  onAuthStateChange,
};
