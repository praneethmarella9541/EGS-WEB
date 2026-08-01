import { supabase } from './supabase';

/**
 * Identity + Google Forms (create/edit), responses (read), and Drive.
 * Full (not readonly/file) Drive scope: we need to list ALL of the admin's
 * existing forms (not just ones this app created) AND change sharing
 * permissions on those forms/linked sheets so field users can open them
 * without a Google sign-in of their own.
 *
 * Kept identical to the mobile app's lib/google-sign-in.ts — the same consent
 * covers both clients, and a narrower grant here would silently break Forms.
 */
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive',
].join(' ');

/** Where Supabase sends the browser back with `?code=`. Must be allowlisted in
 *  Supabase → Authentication → URL Configuration → Redirect URLs. */
export function getOAuthRedirect(): string {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Start Google sign-in.
 *
 * Far simpler than mobile: no deep links, no HTTPS bridge, no polling for the
 * callback — the browser is the thing being redirected, so we hand control to
 * Supabase and pick the code back up at /auth/callback.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirect(),
      queryParams: {
        scope: GOOGLE_SCOPES,
        access_type: 'offline', // ask Google for a refresh token
        prompt: 'consent', // force refresh-token issuance on re-consent
      },
    },
  });
  if (error) throw error;
  // On success the browser is navigating to Google; nothing after this runs.
}
