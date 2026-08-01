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
 * Short-lived signed URLs to view uploaded visit photos. Batched, because a
 * visit usually has several and each one would otherwise be its own round trip.
 * Entries the caller isn't allowed to see come back as null.
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

/**
 * Save a visit photo to the admin's machine.
 *
 * The signed URL is cross-origin, so a plain `download` attribute would be
 * ignored and the browser would navigate to the image instead. Fetch the bytes
 * first and hand the anchor a same-origin blob: URL.
 */
export async function downloadPhoto(photoUrl: string, filename: string): Promise<void> {
  const res = await fetch(photoUrl);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'This photo is not in cloud storage. Photos logged before the move to Google Cloud Storage were not carried over.'
        : `Could not fetch the photo (HTTP ${res.status}). Reopen the visit — view links expire after an hour.`
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
