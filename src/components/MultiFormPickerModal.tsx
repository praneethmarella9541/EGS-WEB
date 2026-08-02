'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, FileText, Search, Square, Star } from 'lucide-react';
import { forms as formsApi, type FormListItem } from '@/lib/forms';
import { CenteredSpinner, EmptyState, Modal, errMsg } from '@/components/ui';

/** Searchable, multi-select list of the admin's Google Forms — check any number to attach to an area. */
export function MultiFormPickerModal({
  open,
  onClose,
  initialSelectedIds,
  defaultFormId,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** Form ids already selected for this area (pre-checked when the list loads). */
  initialSelectedIds: string[];
  /** Shown next to the starred/default form so it's clear why it's pre-checked. */
  defaultFormId?: string | null;
  onConfirm: (selected: FormListItem[]) => void;
}) {
  const [items, setItems] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuery('');
    setError(null);
    setSelectedIds(new Set(initialSelectedIds));
    setLoading(true);
    formsApi
      .list()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Could not load forms from Google.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when the modal opens, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Starred/default form first, then everything else as returned.
  const ordered = useMemo(() => {
    if (!defaultFormId) return items;
    const idx = items.findIndex((f) => f.id === defaultFormId);
    if (idx <= 0) return items;
    const copy = items.slice();
    const [def] = copy.splice(idx, 1);
    copy.unshift(def);
    return copy;
  }, [items, defaultFormId]);

  const filtered = query.trim()
    ? ordered.filter((f) => f.title.toLowerCase().includes(query.trim().toLowerCase()))
    : ordered;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    onConfirm(items.filter((f) => selectedIds.has(f.id)));
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Forms for this area">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="field pl-9"
            placeholder="Search forms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <CenteredSpinner />
        ) : error ? (
          <p className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-[13px] text-danger">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No forms found" />
        ) : (
          <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((f) => {
              const checked = selectedIds.has(f.id);
              const isDefault = f.id === defaultFormId;
              return (
                <li key={f.id}>
                  <button
                    onClick={() => toggle(f.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                      checked
                        ? 'border-copper bg-copper-light'
                        : 'border-line hover:border-copper hover:bg-copper-light'
                    }`}
                  >
                    {checked ? (
                      <Check className="size-4.5 shrink-0 text-copper" />
                    ) : (
                      <Square className="size-4.5 shrink-0 text-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{f.title}</span>
                    {isDefault ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-md bg-copper/15 px-1.5 py-0.5 text-[10px] font-bold text-copper">
                        <Star className="size-3 fill-copper" />
                        Default
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button className="btn-primary w-full py-3" onClick={confirm}>
          {selectedIds.size > 0
            ? `Attach ${selectedIds.size} form${selectedIds.size > 1 ? 's' : ''}`
            : 'Attach no forms'}
        </button>
      </div>
    </Modal>
  );
}
