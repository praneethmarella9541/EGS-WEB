import { supabase } from './supabase';
import { callEdge } from './edge';
import type { AdminAssignmentRow, AssignmentWithVisits, LocationVisit } from './types';

function sortVisits(visits: LocationVisit[]): LocationVisit[] {
  return [...visits].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
}

/**
 * Admin: every area assignment for a date, with its visits + assignee — includes no-shows.
 * `assignments.user_id` has no FK to `profiles` (both reference `auth.users`
 * independently), so PostgREST can't embed `profiles` directly — join it client-side.
 */
export async function listAdminAssignmentsForDate(dateKey: string): Promise<AdminAssignmentRow[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, visits:location_visits(*, photos:visit_photos(*))')
    .eq('assigned_date', dateKey)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({ ...row, visits: sortVisits(row.visits ?? []) }));

  const userIds = Array.from(new Set(rows.map((r) => r.user_id as string)));
  const profileById = new Map<string, { display_name: string | null; email: string }>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds);
    if (profileErr) throw profileErr;
    for (const p of profiles ?? []) {
      profileById.set(p.id, { display_name: p.display_name, email: p.email });
    }
  }

  return rows.map((row) => ({ ...row, profile: profileById.get(row.user_id) ?? null }));
}

/** Admin: one user's area-assignment/visit history, most recent first. */
export async function listAdminAssignmentsForUser(
  userId: string,
  limit = 30
): Promise<AssignmentWithVisits[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, visits:location_visits(*, photos:visit_photos(*))')
    .eq('user_id', userId)
    .order('assigned_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, visits: sortVisits(row.visits ?? []) }));
}

/**
 * Short-lived signed URLs to view uploaded visit photos.
 *
 * Photos live in a **private Google Cloud Storage bucket**, not Supabase
 * Storage — the Supabase `visit-photos` bucket was deleted at cutover (see
 * docs/GCS_SETUP.md), so signing against it returns nothing and every photo
 * renders blank. GCS can't evaluate a Supabase JWT, so the `gcs-sign` Edge
 * Function holds the service-account key and issues V4 signed GET URLs after
 * checking the caller owns the photo or is an admin.
 *
 * Batched, because a visit usually has several and each one would otherwise be
 * its own round trip. Entries the caller isn't allowed to see come back as null.
 */
export async function getPhotoUrls(photoPaths: string[]): Promise<(string | null)[]> {
  const wanted = photoPaths.filter(Boolean);
  if (wanted.length === 0) return photoPaths.map(() => null);
  const { urls } = await callEdge<{ urls: (string | null)[] }>('gcs-sign', {
    action: 'read',
    paths: wanted,
  });
  const byPath = new Map(wanted.map((p, i) => [p, urls[i] ?? null]));
  return photoPaths.map((p) => (p ? byPath.get(p) ?? null : null));
}

/** Short-lived signed URL to view one uploaded visit photo. */
export async function getPhotoUrl(photoPath: string | null | undefined): Promise<string | null> {
  if (!photoPath) return null;
  const [url] = await getPhotoUrls([photoPath]);
  return url ?? null;
}

/**
 * Save a visit photo to the admin's machine.
 *
 * A plain `<a download>` on the storage.googleapis.com view URL is ignored —
 * the `download` attribute only applies to same-origin links — and fetching the
 * bytes ourselves would need the GCS bucket's CORS config to allow this origin,
 * which merely *displaying* the photo in an <img> never requires. Instead, ask
 * `gcs-sign` for a URL with `response-content-disposition: attachment` baked
 * into the signature: GCS itself sends that header back, so the browser
 * downloads on plain navigation — no fetch, no CORS needed.
 */
export async function downloadPhoto(photoPath: string, filename: string): Promise<void> {
  const { url } = await callEdge<{ url: string }>('gcs-sign', {
    action: 'download',
    path: photoPath,
    filename,
  });
  window.location.href = url;
}
