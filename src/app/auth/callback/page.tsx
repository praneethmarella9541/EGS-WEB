'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { captureGoogleRefreshToken } from '@/lib/google-credentials';
import { CenteredSpinner, errMsg } from '@/components/ui';

/**
 * Landing page for `…/auth/callback?code=…`.
 *
 * The client runs with `detectSessionInUrl: false`, so the PKCE exchange is done
 * here explicitly. Doing it by hand is what lets us capture the Google refresh
 * token in the same breath — it exists only on the session Supabase mints right
 * now, and the Forms Edge Functions need it stored server-side.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // React 18 StrictMode double-invokes effects in dev; a second exchange of the
  // same code fails, so run it once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const oauthError = params.get('error');
      const oauthErrorDescription = params.get('error_description');
      if (oauthError) {
        setError(oauthErrorDescription?.trim() || oauthError);
        return;
      }

      const code = params.get('code');
      if (!code) {
        // Nothing to exchange — an existing session still counts as signed in.
        const { data } = await supabase.auth.getSession();
        router.replace(data.session ? '/overview' : '/login');
        return;
      }

      try {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) throw exchangeErr;
        await captureGoogleRefreshToken();
        router.replace('/overview');
      } catch (e) {
        setError(errMsg(e, 'Google sign-in did not finish. Please try again.'));
      }
    })();
  }, [params, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-sm space-y-4 p-6 text-center">
          <ShieldAlert className="mx-auto size-8 text-danger" />
          <div>
            <h1 className="font-bold text-ink">Sign-in failed</h1>
            <p className="mt-1 text-[13px] leading-snug text-ink-soft">{error}</p>
          </div>
          <button className="btn-primary w-full" onClick={() => router.replace('/login')}>
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return <CenteredSpinner label="Signing you in…" />;
}

export default function AuthCallbackPage() {
  // useSearchParams needs a Suspense boundary to prerender this route.
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <CallbackInner />
    </Suspense>
  );
}
