'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday as isDateToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';

/* ---------------------------------------------------------------- spinner */

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-copper`} aria-hidden />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner className="size-6" />
      {label ? <p className="text-sm text-muted">{label}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ toast */

type Toast = { id: number; kind: 'success' | 'error'; title: string; body?: string };

const ToastCtx = createContext<{
  toast: (kind: Toast['kind'], title: string, body?: string) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx).toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((kind: Toast['kind'], title: string, body?: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, title, body }]);
    // Errors carry detail worth reading, so they linger a little longer.
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-ink/10 ${
              t.kind === 'success'
                ? 'border-ok/30 bg-white'
                : 'border-danger/30 bg-white'
            }`}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{t.body}</p> : null}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted transition hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Stop the page behind the dialog from scrolling with it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px] sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${width} shadow-2xl shadow-ink/20`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted transition hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- confirm dialog */

export function ConfirmDialog({
  open,
  title,
  message,
  warning,
  confirmLabel = 'Confirm',
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message?: string;
  warning?: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onCancel()} title={title} width="max-w-md">
      <div className="space-y-4">
        {message ? <p className="text-[15px] font-semibold text-ink">{message}</p> : null}
        {warning ? (
          <div className="flex gap-3 rounded-xl border border-danger/35 bg-danger/5 p-3.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
            <p className="text-[13px] font-medium leading-relaxed text-danger">{warning}</p>
          </div>
        ) : null}
        <div className="flex gap-3 pt-1">
          <button className="btn-ghost flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn-danger flex-1" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner className="size-4 text-white" /> : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------- popover close hook */

/** Closes an open popover on outside click or Escape — shared by Select/DatePicker. */
function useCloseOnOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

/* ------------------------------------------------------------------ select */

/** Styled dropdown replacing native <select> — same trigger look as `.field`. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  className = '',
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="field flex w-full items-center justify-between gap-2 py-2 text-left text-[15px]"
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-muted'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full min-w-max overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">No options</li>
          ) : (
            options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${
                    o.value === value ? 'bg-copper-light text-copper' : 'text-ink hover:bg-line-soft'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- date picker */

function dateKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Styled calendar popover replacing native <input type="date">. Works in `yyyy-MM-dd` date keys. */
export function DatePicker({
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const selectedDate = useMemo(() => new Date(`${value}T00:00:00`), [value]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(selectedDate);
  const ref = useCloseOnOutside(open, () => setOpen(false));

  useEffect(() => {
    if (open) setViewMonth(selectedDate);
  }, [open, selectedDate]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [viewMonth]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        className="field flex w-auto items-center gap-2 py-2 text-left text-[13px] font-semibold"
      >
        <CalendarIcon className="size-4 shrink-0 text-copper" />
        {format(selectedDate, 'EEE, MMM d, yyyy')}
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-1.5 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl shadow-ink/10">
          <div className="flex items-center justify-between pb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line-soft"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-bold text-ink">{format(viewMonth, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line-soft"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = isSameMonth(d, viewMonth);
              const selected = isSameDay(d, selectedDate);
              const today = isDateToday(d);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(dateKeyOf(d));
                    setOpen(false);
                  }}
                  className={`aspect-square rounded-lg text-[13px] font-medium transition ${
                    selected
                      ? 'bg-copper text-white'
                      : inMonth
                        ? 'text-ink hover:bg-line-soft'
                        : 'text-muted/50 hover:bg-line-soft'
                  } ${today && !selected ? 'ring-1 ring-inset ring-copper/50' : ''}`}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              onChange(dateKeyOf(today));
              setViewMonth(today);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg border border-line py-1.5 text-[12px] font-semibold text-copper transition hover:bg-copper-light"
          >
            Today
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- misc bits */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      {label || hint ? (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-semibold text-ink">{label}</span> : null}
          {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-copper' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function Avatar({ name, size = 'size-10' }: { name: string; size?: string }) {
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-copper-light font-bold text-copper`}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon className="size-8 text-muted" />
      <p className="font-semibold text-ink">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
    </div>
  );
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
