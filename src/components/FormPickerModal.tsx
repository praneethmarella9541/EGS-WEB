'use client';

import { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { forms as formsApi, type FormListItem } from '@/lib/forms';
import { CenteredSpinner, EmptyState, Modal, errMsg } from '@/components/ui';

/** Picks one Google Form from the linked Drive account. */
export function FormPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (form: FormListItem) => void;
}) {
  const [items, setItems] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
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
  }, [open]);

  const filtered = query.trim()
    ? items.filter((f) => f.title.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <Modal open={open} onClose={onClose} title="Choose a form">
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
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => {
                    onPick(f);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition hover:border-copper hover:bg-copper-light"
                >
                  <FileText className="size-4 shrink-0 text-copper" />
                  <span className="truncate text-sm font-medium text-ink">{f.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
