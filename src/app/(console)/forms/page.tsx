'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { FileText, Link2, Pencil, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import {
  CenteredSpinner,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
  errMsg,
  useToast,
} from '@/components/ui';
import { copyToClipboard } from '@/lib/forms-actions';
import { forms, type FormListItem } from '@/lib/forms';
import { getFieldForm, setFieldForm } from '@/lib/settings';

export default function FormsPage() {
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fieldFormId, setFieldFormId] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<string | null>(null);
  // Public responder URLs by form id (from public.forms) — lets copy-link skip
  // the Google round-trip for app-created forms.
  const [responderCache, setResponderCache] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FormListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const [list, fieldForm, responderMap] = await Promise.all([
          forms.list(),
          getFieldForm(),
          forms.cachedResponderUris(),
        ]);
        setItems(list);
        setFieldFormId(fieldForm?.id ?? null);
        setResponderCache(responderMap);
      } catch (e) {
        toast('error', 'Could not load forms', errMsg(e, 'Is the Google account still linked?'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast('error', 'Enter a form title.');
    setCreating(true);
    try {
      const { form, titleWarning } = await forms.create(title.trim());
      setCreateOpen(false);
      setTitle('');
      if (titleWarning) {
        toast(
          'error',
          'Title may not show correctly',
          `Google rejected setting the Drive file name: ${titleWarning}`
        );
      }
      // Jump straight into the editor, same as the mobile app.
      router.push(`/forms/${form.id}`);
    } catch (e) {
      toast('error', 'Could not create form', errMsg(e, 'Failed'));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(form: FormListItem) {
    try {
      // Fast path: use the cached public URL (no Google call) if we have it.
      const cached = responderCache[form.id];
      if (cached) {
        await copyToClipboard(cached);
        return toast('success', 'Responder link copied');
      }
      const { uri, shareWarning } = await forms.responderUri(form.id);
      if (!uri) throw new Error('No responder link found.');
      await copyToClipboard(uri);
      setResponderCache((prev) => ({ ...prev, [form.id]: uri }));
      if (shareWarning) {
        toast(
          'error',
          'Copied, but may need sign-in',
          `Google would not make it sign-in-free: ${shareWarning}`
        );
      } else {
        toast('success', 'Responder link copied');
      }
    } catch (e) {
      toast('error', 'Could not get link', errMsg(e, 'Please try again.'));
    }
  }

  async function makeFieldForm(form: FormListItem) {
    // Shift the star immediately (optimistic) — the actual work (responder link,
    // public sharing, no-login prep, DB write) makes several Google round-trips
    // and would otherwise leave the star "stuck" on the old form until it's done.
    const prevId = fieldFormId;
    if (prevId === form.id) return;
    setFieldFormId(form.id);
    setSettingId(form.id);
    try {
      const { uri, shareWarning } = await forms.responderUri(form.id);
      if (!uri) throw new Error('No responder link found.');
      setResponderCache((prev) => ({ ...prev, [form.id]: uri }));
      await setFieldForm(form.id, uri);
      if (shareWarning) {
        toast(
          'error',
          'Set, but may need sign-in',
          `"${form.title}" is now the field form. Google would not make it sign-in-free: ${shareWarning}`
        );
      } else {
        toast('success', 'Field form updated', form.title);
      }
    } catch (e) {
      setFieldFormId(prevId); // revert the star on failure
      toast('error', 'Could not set as field form', errMsg(e, 'Please try again.'));
    } finally {
      setSettingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const form = deleteTarget;
    setDeleteBusy(true);
    // Optimistic: remove it from the list immediately, delete in the background,
    // and restore it if the delete fails.
    const prevItems = items;
    const prevFieldFormId = fieldFormId;
    setItems((prev) => prev.filter((f) => f.id !== form.id));
    if (fieldFormId === form.id) setFieldFormId(null);
    setDeleteTarget(null);
    try {
      await forms.remove(form.id);
      toast('success', 'Form deleted', form.title);
    } catch (e) {
      setItems(prevItems);
      setFieldFormId(prevFieldFormId);
      toast('error', 'Delete failed', errMsg(e, 'Please try again.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Forms"
        subtitle="Google Forms in the linked Drive account. The starred one is what field users get by default."
        actions={
          <>
            <button className="btn-ghost" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New form
            </button>
          </>
        }
      />

      <div className="p-5 sm:p-8">
        {loading ? (
          <CenteredSpinner />
        ) : items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={FileText}
              title="No forms yet"
              body="Create one — it's built here and saved straight to Google Forms."
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="card overflow-hidden">
                <button
                  onClick={() => router.push(`/forms/${item.id}`)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-line-soft"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-copper-light">
                    <FileText className="size-5 text-copper" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{item.title}</span>
                      {fieldFormId === item.id ? (
                        <span className="shrink-0 rounded-md bg-copper-light px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-copper">
                          FIELD FORM
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {item.modifiedTime
                        ? `Edited ${format(new Date(item.modifiedTime), 'MMM d, yyyy')}`
                        : 'Click to edit'}
                    </span>
                  </span>
                </button>

                <div className="grid grid-cols-4 divide-x divide-line border-t border-line">
                  <button
                    onClick={() => void makeFieldForm(item)}
                    disabled={settingId === item.id || fieldFormId === item.id}
                    className="flex items-center justify-center py-3 transition hover:bg-line-soft disabled:opacity-50"
                    title={fieldFormId === item.id ? 'Current field form' : 'Set as field form'}
                    aria-label={fieldFormId === item.id ? 'Current field form' : 'Set as field form'}
                  >
                    <Star
                      className={`size-4.5 ${
                        fieldFormId === item.id ? 'fill-copper text-copper' : 'text-ink-soft'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => void copyLink(item)}
                    className="flex items-center justify-center py-3 text-ink-soft transition hover:bg-line-soft"
                    title="Copy responder link"
                    aria-label="Copy responder link"
                  >
                    <Link2 className="size-4.5" />
                  </button>
                  <button
                    onClick={() => router.push(`/forms/${item.id}`)}
                    className="flex items-center justify-center py-3 text-ink-soft transition hover:bg-line-soft"
                    title="Edit"
                    aria-label="Edit form"
                  >
                    <Pencil className="size-4.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="flex items-center justify-center py-3 text-danger transition hover:bg-danger/10"
                    title="Delete"
                    aria-label="Delete form"
                  >
                    <Trash2 className="size-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => !creating && setCreateOpen(false)} title="New form">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <label className="label" htmlFor="form-title">
              Form title
            </label>
            <input
              id="form-title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. School visit report"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={creating}>
              {creating ? <Spinner className="size-4 text-white" /> : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete form"
        message={deleteTarget?.title}
        warning="This deletes the form from Google Drive too, along with every response it collected."
        confirmLabel="Delete form"
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
