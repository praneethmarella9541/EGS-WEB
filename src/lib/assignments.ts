import { supabase } from './supabase';
import type { Assignment } from './types';

export interface AssignableUser {
  id: string;
  email: string;
  display_name: string | null;
}

/** Format a Date as YYYY-MM-DD in local time (for assigned_date). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Users (role 'user') an admin can assign work to. */
export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('role', 'user')
    .order('display_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** All assignments for a given date (admin view, every user). */
export async function listAssignmentsForDate(dateKey: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('assigned_date', dateKey)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Create one area assignment. `form` overrides the global field form for this area, if given. */
export async function createAssignment(input: {
  userId: string;
  dateKey: string;
  areaLabel: string;
  form?: { id: string; url: string } | null;
}): Promise<Assignment> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      user_id: input.userId,
      assigned_date: input.dateKey,
      area_label: input.areaLabel.trim(),
      form_id: input.form?.id ?? null,
      form_url: input.form?.url ?? null,
      created_by: auth.user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Create several area assignments for one user/date in one pass. */
export async function createAssignments(input: {
  userId: string;
  dateKey: string;
  items: { areaLabel: string; form?: { id: string; url: string } | null }[];
}): Promise<{ created: number; failed: { areaLabel: string; error: string }[] }> {
  let created = 0;
  const failed: { areaLabel: string; error: string }[] = [];
  for (const item of input.items) {
    try {
      await createAssignment({
        userId: input.userId,
        dateKey: input.dateKey,
        areaLabel: item.areaLabel,
        form: item.form,
      });
      created += 1;
    } catch (e: any) {
      failed.push({ areaLabel: item.areaLabel, error: e?.message ?? 'Failed' });
    }
  }
  return { created, failed };
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}
