import { supabase } from './supabase';

/**
 * Call a Supabase Edge Function via plain fetch, attaching the signed-in user's
 * JWT. Mirrors the mobile app's lib/edge.ts so both clients surface the
 * function's JSON `{ error }` message identically.
 */
export async function callEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You are not signed in.');

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'request failed';
    throw new Error(`Network error reaching ${name}: ${msg}`);
  }

  let payload: { error?: string } | null = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new Error(payload?.error || `${name} failed (HTTP ${res.status})`);
  }
  return payload as T;
}
