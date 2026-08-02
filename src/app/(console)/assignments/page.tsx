'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FilePlus2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MultiFormPickerModal } from '@/components/MultiFormPickerModal';
import {
  Avatar,
  CenteredSpinner,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Modal,
  Spinner,
  errMsg,
  useToast,
} from '@/components/ui';
import {
  createAssignments,
  deleteAssignment,
  listAssignableUsers,
  listAssignmentsForDate,
  toDateKey,
  type AssignableUser,
} from '@/lib/assignments';
import { forms as formsApi, type FormListItem } from '@/lib/forms';
import { getFieldForm } from '@/lib/settings';
import { notifyAssignmentCreated } from '@/lib/notify';
import type { Assignment } from '@/lib/types';

type AreaFormSel = { id: string; title: string; url: string };
// forms === null → not customized (defaults to the starred field form at read
// time); an array (even empty) → the admin explicitly picked this exact set.
type AreaRow = { areaLabel: string; forms: AreaFormSel[] | null };
const emptyAreaRow = (): AreaRow => ({ areaLabel: '', forms: null });

export default function AssignmentsPage() {
  const toast = useToast();
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formUser, setFormUser] = useState<AssignableUser | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([emptyAreaRow()]);
  const [saving, setSaving] = useState(false);
  const [multiPickerRow, setMultiPickerRow] = useState<number | null>(null);
  const [resolvingFormsRow, setResolvingFormsRow] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // The global "field form" (starred default) — shown on areas with no override.
  const [defaultForm, setDefaultForm] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const [u, a] = await Promise.all([listAssignableUsers(), listAssignmentsForDate(dateKey)]);
        setUsers(u);
        setAssignments(a);
      } catch (e) {
        toast('error', 'Could not load assignments', errMsg(e, 'Please try again.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateKey, toast]
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Resolve the starred/default field form's name once, so each area row with no
  // per-area override can show what will actually be assigned to the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ff = await getFieldForm();
        if (cancelled) return;
        if (!ff) return setDefaultForm(null);
        let title = 'Default field form';
        try {
          const list = await formsApi.list();
          if (!cancelled) title = list.find((f) => f.id === ff.id)?.title ?? title;
        } catch {
          /* Google not linked / offline — keep the generic label */
        }
        if (!cancelled) setDefaultForm({ id: ff.id, title });
      } catch {
        /* no default configured or fetch failed — leave as null */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byUser = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const arr = map.get(a.user_id) ?? [];
      arr.push(a);
      map.set(a.user_id, arr);
    }
    return map;
  }, [assignments]);

  function openAssign(user: AssignableUser) {
    setFormUser(user);
    setAreas([emptyAreaRow()]);
  }

  /** Resolve each checked form's public responder URL (cache first, then a per-form call) and store the set on the row. */
  async function confirmAreaForms(i: number, selected: FormListItem[]) {
    setResolvingFormsRow(i);
    try {
      const cache = await formsApi.cachedResponderUris();
      const resolved = await Promise.all(
        selected.map(async (f): Promise<AreaFormSel> => {
          const cached = cache[f.id];
          if (cached) return { id: f.id, title: f.title, url: cached };
          const { uri } = await formsApi.responderUri(f.id);
          return { id: f.id, title: f.title, url: uri };
        })
      );
      setAreas((prev) => prev.map((a, idx) => (idx === i ? { ...a, forms: resolved } : a)));
    } catch (e) {
      toast('error', 'Could not load form links', errMsg(e, 'Please try again.'));
    } finally {
      setResolvingFormsRow(null);
    }
  }

  async function save() {
    if (!formUser) return;
    const items = areas.filter((a) => a.areaLabel.trim());
    if (items.length === 0) return toast('error', 'Add at least one area.');
    setSaving(true);
    try {
      const { created, failed } = await createAssignments({
        userId: formUser.id,
        dateKey,
        items: items.map((a) => ({ areaLabel: a.areaLabel, forms: a.forms })),
      });
      // Best-effort push to the assigned user, naming the area(s) that saved.
      const failedLabels = new Set(failed.map((f) => f.areaLabel));
      const okLabels = items.map((a) => a.areaLabel).filter((l) => !failedLabels.has(l));
      if (okLabels.length) void notifyAssignmentCreated(formUser.id, okLabels, dateKey);
      setFormUser(null);
      await load();
      if (failed.length) {
        toast(
          'error',
          created ? 'Partly saved' : 'Could not save',
          `${created} added. Failed: ${failed.map((f) => `${f.areaLabel || '(blank)'} — ${f.error}`).join('; ')}`
        );
      } else {
        toast('success', `${created} area${created === 1 ? '' : 's'} assigned`, formUser.email);
      }
    } catch (e) {
      toast('error', 'Could not save', errMsg(e, 'Failed to create assignments'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteAssignment(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      toast('success', 'Assignment removed');
    } catch (e) {
      toast('error', 'Delete failed', errMsg(e, 'Please try again.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const prettyDate = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={prettyDate}
        actions={
          <>
            <DatePicker value={dateKey} onChange={setDateKey} ariaLabel="Assignment date" />
            <button className="btn-ghost" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      <div className="p-5 sm:p-8">
        {loading ? (
          <CenteredSpinner />
        ) : users.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Users}
              title="No field users yet"
              body="Add them in Team before assigning areas."
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {users.map((u) => {
              const items = byUser.get(u.id) ?? [];
              return (
                <div key={u.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.display_name || u.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {u.display_name || u.email.split('@')[0]}
                      </p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                    <button className="btn-primary px-3 py-2 text-[13px]" onClick={() => openAssign(u)}>
                      <Plus className="size-4" />
                      Assign
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="mt-3 text-[13px] italic text-muted">
                      No areas assigned for this date.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line">
                      {items.map((a, i) => (
                        <li key={a.id} className="flex items-start gap-2.5 py-2.5">
                          <span className="text-[13px] font-bold text-muted">{i + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink">{a.area_label}</p>
                            {a.forms_customized ? (
                              <p className="mt-0.5 truncate text-xs text-muted">
                                {a.forms && a.forms.length > 0
                                  ? `Forms: ${a.forms.map((f) => f.form_title).join(', ')}`
                                  : 'No form attached'}
                              </p>
                            ) : null}
                          </div>
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="rounded-lg p-1.5 text-danger transition hover:bg-danger/10"
                            aria-label={`Remove ${a.area_label}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign modal */}
      <Modal
        open={!!formUser}
        onClose={() => !saving && setFormUser(null)}
        title={`Assign · ${formUser?.display_name || formUser?.email.split('@')[0] || ''}`}
        width="max-w-2xl"
      >
        <div className="space-y-3">
          {areas.map((area, i) => (
            <div key={i} className="rounded-xl border border-line bg-bg p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">Area {i + 1}</p>
                {areas.length > 1 ? (
                  <button
                    onClick={() => setAreas((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted transition hover:text-danger"
                    aria-label={`Remove area ${i + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <input
                className="field"
                value={area.areaLabel}
                onChange={(e) =>
                  setAreas((prev) =>
                    prev.map((a, idx) => (idx === i ? { ...a, areaLabel: e.target.value } : a))
                  )
                }
                placeholder="e.g. Sector 4-7, Gurgaon"
              />
              <p className="mt-1.5 text-xs text-muted">
                The user picks their exact place(s) within this area when they check in.
              </p>

              {resolvingFormsRow === i ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] font-semibold text-copper">
                  <Spinner className="size-4" />
                  Loading form links…
                </div>
              ) : area.forms !== null ? (
                <>
                  {area.forms.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {area.forms.map((f) => (
                        <span
                          key={f.id}
                          className="flex max-w-full items-center gap-1.5 truncate rounded-lg border border-copper bg-copper-light px-2.5 py-1.5 text-[13px] font-medium text-ink"
                        >
                          {f.title}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted">No forms will be assigned for this area.</p>
                  )}
                  <button
                    onClick={() => setMultiPickerRow(i)}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] font-semibold text-copper transition hover:bg-copper-light"
                  >
                    <Pencil className="size-4" />
                    Edit forms for this area
                  </button>
                </>
              ) : (
                <>
                  {defaultForm ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-copper-light px-3 py-2.5">
                      <Star className="size-3.5 shrink-0 fill-copper text-copper" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                        {defaultForm.title}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-muted">
                        will be assigned
                      </span>
                    </div>
                  ) : null}
                  <button
                    onClick={() => setMultiPickerRow(i)}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] font-semibold text-copper transition hover:bg-copper-light"
                  >
                    <FilePlus2 className="size-4" />
                    Add more forms for this area
                  </button>
                </>
              )}
            </div>
          ))}

          <button
            onClick={() => setAreas((prev) => [...prev, emptyAreaRow()])}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-copper py-3 text-sm font-semibold text-copper transition hover:bg-copper-light"
          >
            <Plus className="size-4" />
            Add another area
          </button>

          <button className="btn-primary w-full py-3" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Spinner className="size-4 text-white" />
            ) : areas.length > 1 ? (
              `Add ${areas.length} areas`
            ) : (
              'Add area'
            )}
          </button>
        </div>
      </Modal>

      <MultiFormPickerModal
        open={multiPickerRow !== null}
        onClose={() => setMultiPickerRow(null)}
        initialSelectedIds={
          multiPickerRow !== null && areas[multiPickerRow]
            ? (areas[multiPickerRow].forms
                ? areas[multiPickerRow].forms!.map((f) => f.id)
                : defaultForm
                  ? [defaultForm.id]
                  : [])
            : []
        }
        defaultFormId={defaultForm?.id ?? null}
        onConfirm={(selected) => {
          if (multiPickerRow !== null) void confirmAreaForms(multiPickerRow, selected);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove assignment"
        message={deleteTarget?.area_label}
        warning="Visits the user already logged against this area are deleted with it."
        confirmLabel="Remove"
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
