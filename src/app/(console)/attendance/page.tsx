'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays, subMonths } from 'date-fns';
import {
  CalendarX,
  CheckCircle2,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { Avatar, CenteredSpinner, DatePicker, EmptyState, Select, errMsg, useToast } from '@/components/ui';
import { listAssignableUsers, toDateKey, type AssignableUser } from '@/lib/assignments';
import { getPhotoUrls, listAdminAssignments } from '@/lib/visits';
import type { AdminAssignmentRow, LocationVisit } from '@/lib/types';

type Row = AdminAssignmentRow;

/**
 * How much to trust a visit's place, in one line. Since the place is normally
 * derived from the user's GPS fix, distance_m is near-zero by construction and
 * says little — what matters is how the place was obtained, how good the fix
 * was, and how long the user sat on it before submitting.
 */
function visitProvenance(v: LocationVisit): string {
  const parts: string[] = [];

  if (v.place_source === 'nearby') parts.push('auto-picked');
  else if (v.place_source === 'reverse_geocode') parts.push('address at GPS');
  else if (v.place_source === 'manual_search') parts.push('⚠ hand-searched');
  else parts.push(`${v.distance_m}m from address`); // pre-GPS-flow visit

  if (v.label_edited) parts.push('name edited');
  if (v.gps_accuracy_m !== null) parts.push(`±${Math.round(v.gps_accuracy_m)}m`);

  if (v.fetched_at) {
    const gapMin = Math.round(
      (new Date(v.submitted_at).getTime() - new Date(v.fetched_at).getTime()) / 60000
    );
    if (gapMin >= 10) parts.push(`⚠ submitted ${gapMin}m after fetch`);
  }

  return parts.join(' · ');
}

function photoCount(row: Row): number {
  return row.visits.reduce((sum, v) => sum + v.photos.length, 0);
}

function formatDuration(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * First and last visit logged under this area, and the span between them —
 * lets an admin see how long a user was active at a location without
 * expanding every individual visit. `row.visits` is pre-sorted ascending.
 */
function visitSpan(
  row: Row
): { first: string; last: string; minutes: number; durationLabel: string | null } | null {
  if (row.visits.length === 0) return null;
  const first = row.visits[0].submitted_at;
  const last = row.visits[row.visits.length - 1].submitted_at;
  const minutes = Math.round((new Date(last).getTime() - new Date(first).getTime()) / 60000);
  return { first, last, minutes, durationLabel: minutes <= 0 ? null : `${formatDuration(minutes)} span` };
}

export default function AttendancePage() {
  const toast = useToast();

  const [fromDate, setFromDate] = useState(() => toDateKey(new Date()));
  const [toDate, setToDate] = useState(() => toDateKey(new Date()));
  const [activePreset, setActivePreset] = useState<'1d' | '1w' | '1m' | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [rows, setRows] = useState<AdminAssignmentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<{ path: string; url: string }[] | null>(null);

  const todayKey = toDateKey(new Date());

  // Keep the range non-inverted without a separate validation error — picking
  // a "from" after the current "to" (or vice versa) just drags the other end.
  // A manual edit means the range no longer matches any preset, so clear the highlight.
  function onFromChange(v: string) {
    setFromDate(v);
    if (v > toDate) setToDate(v);
    setActivePreset(null);
  }
  function onToChange(v: string) {
    setToDate(v);
    if (v < fromDate) setFromDate(v);
    setActivePreset(null);
  }

  function applyPreset(preset: '1d' | '1w' | '1m') {
    const today = new Date();
    const start = preset === '1d' ? today : preset === '1w' ? subDays(today, 6) : subMonths(today, 1);
    setFromDate(toDateKey(start));
    setToDate(toDateKey(today));
    setActivePreset(preset);
  }

  function resetFilters() {
    const today = toDateKey(new Date());
    setFromDate(today);
    setToDate(today);
    setUserId('');
    setActivePreset(null);
  }

  const load = useCallback(async () => {
    try {
      setRows(await listAdminAssignments({ from: fromDate, to: toDate, userId: userId || undefined }));
    } catch (e) {
      toast('error', 'Could not load attendance', errMsg(e, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, userId, toast]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    listAssignableUsers()
      .then(setUsers)
      .catch(() => {});
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function viewPhotos(visit: LocationVisit) {
    if (visit.photos.length === 0) return;
    try {
      const paths = visit.photos.map((p) => p.photo_path);
      const urls = await getPhotoUrls(paths);
      const usable = paths
        .map((path, i) => ({ path, url: urls[i] }))
        .filter((p): p is { path: string; url: string } => !!p.url);
      // Every path came back unsigned — don't open an empty lightbox and leave
      // the admin wondering whether the click registered.
      if (usable.length === 0) {
        toast(
          'error',
          'Photos unavailable',
          'Storage returned no link for this visit’s photos. They may have been deleted, or predate the move to Google Cloud Storage.'
        );
        return;
      }
      setGallery(usable);
    } catch (e) {
      toast('error', 'Could not open photos', errMsg(e, 'Please try again.'));
    }
  }

  const stats = useMemo(() => {
    const totalAreas = rows.length;
    const visited = rows.filter((r) => r.visits.length > 0).length;
    const totalMinutes = rows.reduce((sum, r) => sum + (visitSpan(r)?.minutes ?? 0), 0);
    return [
      { icon: CheckCircle2, value: `${visited}/${totalAreas}`, label: 'Areas visited' },
      { icon: MapPin, value: rows.reduce((sum, r) => sum + r.visits.length, 0), label: 'Visits logged' },
      { icon: CalendarX, value: totalAreas - visited, label: 'Not visited' },
      { icon: ImageIcon, value: rows.reduce((sum, r) => sum + photoCount(r), 0), label: 'Photos captured' },
      { icon: Clock, value: formatDuration(totalMinutes), label: 'Total hours' },
    ];
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Every assigned area, whether it was visited, and the evidence behind it."
        actions={
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted">From</span>
              <DatePicker value={fromDate} onChange={onFromChange} ariaLabel="From date" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted">To</span>
              <DatePicker value={toDate} onChange={onToChange} ariaLabel="To date" />
            </div>
            <div className="flex rounded-xl border border-line bg-surface p-1">
              {(['1d', '1w', '1m'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
                    activePreset === preset
                      ? 'bg-copper text-white'
                      : 'text-ink-soft hover:bg-line-soft hover:text-ink'
                  }`}
                >
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>
            <Select
              value={userId}
              onChange={setUserId}
              options={[
                { value: '', label: 'All users' },
                ...users.map((u) => ({ value: u.id, label: u.display_name || u.email })),
              ]}
              placeholder="All users"
              ariaLabel="Filter by user"
              className="w-48"
            />
            <button className="btn-ghost" onClick={resetFilters}>
              <RotateCcw className="size-4" />
              Reset filters
            </button>
          </>
        }
      />

      <div className="space-y-5 p-5 sm:p-8">
        {!loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="card p-4">
                <Icon className="size-4.5 text-copper" />
                <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
                <p className="truncate text-xs text-ink-soft">{label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <CenteredSpinner />
        ) : rows.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={CalendarX}
              title={userId ? 'No assignments for this user in this range' : 'No assignments in this range'}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isPast = row.assigned_date < todayKey;
              const isOpen = expanded.has(row.id);
              const heading = row.profile?.display_name || row.profile?.email || 'Unknown user';
              const dateLabel = format(new Date(`${row.assigned_date}T00:00:00`), 'EEE, MMM d');
              const count = row.visits.length;
              const span = visitSpan(row);

              return (
                <div key={row.id} className="card overflow-hidden">
                  <button
                    onClick={() => toggleExpand(row.id)}
                    className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-line-soft"
                  >
                    <Avatar name={heading} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{heading}</p>
                      <p className="truncate text-[13px] text-ink-soft">
                        {row.area_label} · {dateLabel}
                      </p>
                      {span ? (
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {span.first === span.last
                            ? `Logged ${format(new Date(span.first), 'h:mm a')}`
                            : `${format(new Date(span.first), 'h:mm a')} – ${format(new Date(span.last), 'h:mm a')}${
                                span.durationLabel ? ` · ${span.durationLabel}` : ''
                              }`}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            count > 0
                              ? 'bg-ok/10 text-ok'
                              : isPast
                                ? 'bg-line-soft text-muted'
                                : 'bg-warn/10 text-warn'
                          }`}
                        >
                          {count > 0
                            ? `${count} visit${count === 1 ? '' : 's'}`
                            : isPast
                              ? 'No-show'
                              : 'Pending'}
                        </span>
                        {photoCount(row) > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-copper-light px-2 py-0.5 text-[11px] font-bold text-copper"
                            title={`${photoCount(row)} photo${photoCount(row) === 1 ? '' : 's'} uploaded`}
                          >
                            <ImageIcon className="size-3" />
                            {photoCount(row)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ChevronDown
                      className={`size-4.5 shrink-0 text-muted transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && count > 0 ? (
                    <div className="space-y-3 border-t border-line p-4">
                      {row.visits.map((v) => (
                        <div key={v.id} className="flex items-start gap-2.5">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-copper" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-ink">{v.place_label}</p>
                            {v.notes ? (
                              <p className="mt-0.5 text-xs text-ink-soft">{v.notes}</p>
                            ) : null}
                            <p className="mt-0.5 text-[11px] text-muted">
                              {format(new Date(v.submitted_at), 'MMM d, h:mm a')} ·{' '}
                              {visitProvenance(v)}
                            </p>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 inline-block text-[11px] font-semibold text-copper hover:underline"
                            >
                              View on map
                            </a>
                          </div>
                          {v.photos.length > 0 ? (
                            <button
                              onClick={() => void viewPhotos(v)}
                              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-bg px-2.5 py-1.5 text-xs font-semibold text-copper transition hover:bg-copper-light"
                            >
                              <ImageIcon className="size-3.5" />
                              {v.photos.length}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PhotoLightbox photos={gallery} onClose={() => setGallery(null)} />
    </>
  );
}
