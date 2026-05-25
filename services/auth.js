'use strict';

async function signInWithGoogle() {
  try {
    const client = SupabaseService.getClient();

    if (!client) {
      throw new Error('Supabase not configured');
    }

    const redirectUri = chrome.identity.getRedirectURL();

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
      },
    });

    if (error) {
      console.error('OAuth URL generation failed:', error);
      return null;
    }

    const authUrl = data?.url;

    if (!authUrl) {
      console.error('No OAuth URL returned');
      return null;
    }

    const redirectedTo = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!redirectUrl) {
            reject(new Error('Authentication was not completed'));
            return;
          }

          resolve(redirectUrl);
        }
      );
    }).catch((err) => {
      console.warn('Login cancelled or failed:', err.message || err);
      return null;
    });

    if (!redirectedTo) {
      return null;
    }

    const redirected = new URL(redirectedTo);

    const accessToken =
      redirected.hash.match(/access_token=([^&]*)/)?.[1];

    const refreshToken =
      redirected.hash.match(/refresh_token=([^&]*)/)?.[1];

    if (!accessToken || !refreshToken) {
      console.error('No auth tokens found in redirect URL');
      return null;
    }

    const {
      data: sessionData,
      error: sessionError,
    } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.error('Failed to establish session:', sessionError);
      return null;
    }

    return sessionData;
  } catch (err) {
    console.error('Google sign-in failed:', err);
    return null;
  }
}

async function signOut() {
  try {
    const client = SupabaseService.getClient();

    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();

    if (error) {
      console.warn('Sign out failed:', error);
    }

    try {
      await chrome.storage.local.remove([
        'supabase.auth.token',
        'csvNotesSync',
      ]);
    } catch (_) {}
  } catch (err) {
    console.error('Logout failed:', err);
  }
}

async function getCurrentUser() {
  try {
    const client = SupabaseService.getClient();

    if (!client) {
      return null;
    }

    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (err) {
    console.error('Failed to fetch current user:', err);
    return null;
  }
}

async function getSession() {
  try {
    const client = SupabaseService.getClient();

    if (!client) {
      return null;
    }

    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error) {
      return null;
    }

    return session;
  } catch (err) {
    console.error('Failed to fetch session:', err);
    return null;
  }
}

function onAuthStateChange(callback) {
  try {
    const client = SupabaseService.getClient();

    if (!client) {
      return null;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return subscription;
  } catch (err) {
    console.error('Auth listener failed:', err);
    return null;
  }
}

const AuthService = {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  getSession,
  onAuthStateChange,
};