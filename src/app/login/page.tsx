'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/google-sign-in';
import { useAuth } from '@/components/AuthProvider';
import { Spinner, errMsg } from '@/components/ui';

const FEATURES = [
  { n: '01', label: 'Assign field areas + forms to your team by date' },
  { n: '02', label: 'Review photo and geo-verified attendance at every site' },
  { n: '03', label: 'Build Google Forms and read responses without leaving the console' },
  { n: '04', label: 'Create field accounts, reset passwords, revoke access' },
];

/** Google's brand mark, inlined so the button works with no external requests. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { loading: authLoading, session, profile, isAdmin } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The console is admin-only. A Google sign-in always lands as admin (the
  // handle_new_user trigger promotes provider='google'), but an account that
  // Supabase linked to an existing *field user* keeps role 'user' — sign them
  // straight back out and say why.
  useEffect(() => {
    if (authLoading || !session || !profile) return;
    if (isAdmin) router.replace('/assignments');
    else {
      void supabase.auth.signOut();
      setError('That account is a field user. The admin console is for admins only.');
    }
  }, [authLoading, session, profile, isAdmin, router]);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On success the browser navigates to Google — keep the spinner up.
    } catch (e) {
      setError(errMsg(e, 'Google sign-in failed'));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-copper">
            The Nucleus - Marketing
          </p>
          <h1 className="mt-3 max-w-md text-4xl font-bold leading-tight">
            Marketing field operations, run from one console.
          </h1>
        </div>
        <ul className="space-y-5">
          {FEATURES.map((f) => (
            <li key={f.n} className="flex gap-4">
              <span className="text-sm font-bold text-copper">{f.n}</span>
              <span className="max-w-sm text-[15px] leading-snug text-white/70">{f.label}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/40">Admin access only · Field staff use the mobile app</p>
      </section>

      {/* Sign-in panel */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-copper lg:hidden">
            The Nucleus - Marketing
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Admin sign in</h2>
          <p className="mt-1 text-sm text-muted">
            Use the Google account that owns the workspace&apos;s Forms and Drive.
          </p>

          <button
            onClick={() => void handleGoogle()}
            disabled={busy || authLoading}
            className="btn-ghost mt-8 w-full py-3.5 text-[15px] text-ink"
          >
            {busy ? (
              <Spinner className="size-5" />
            ) : (
              <>
                <GoogleMark className="size-5" />
                Continue with Google
              </>
            )}
          </button>

          {error ? (
            <div className="mt-4 flex gap-2.5 rounded-xl border border-danger/30 bg-danger/5 p-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-[13px] leading-snug text-danger">{error}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
