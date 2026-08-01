import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Same Supabase project as the mobile app. Everything the admin console does is
 * a direct client-side call guarded by the project's RLS policies (admins can
 * read/write every profile, assignment, visit and photo row) plus the Edge
 * Functions, which re-check the caller's role server-side. That's why this app
 * needs no backend of its own and drops onto Vercel as a static/SSR frontend.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Browser session lives in localStorage; no deep-link callback to parse.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
