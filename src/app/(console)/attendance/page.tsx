'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  Map,
  MapPin,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { Avatar, CenteredSpinner, DatePicker, EmptyState, Select, errMsg, useToast } from '@/components/ui';
import { listAssignableUsers, toDateKey, type AssignableUser } from '@/lib/assignments';
import { getPhotoUrls, listAdminAssignmentsForDate, listAdminAssignmentsForUser } from '@/lib/visits';
import type { AdminAssignmentRow, AssignmentWithVisits, LocationVisit } from '@/lib/types';

type ViewMode = 'date' | 'user';
type Row = AdminAssignmentRow | AssignmentWithVisits;

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

export default function AttendancePage() {
  const toast = useToast();
  const [mode, setMode] = useState<ViewMode>('date');

  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [dateRows, setDateRows] = useState<AdminAssignmentRow[]>([]);

  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userRows, setUserRows] = useState<AssignmentWithVisits[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<{ path: string; url: string }[] | null>(null);

  const todayKey = toDateKey(new Date());

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        if (mode === 'date') {
          setDateRows(await listAdminAssignmentsForDate(dateKey));
        } else if (selectedUserId) {
          setUserRows(await listAdminAssignmentsForUser(selectedUserId));
        }
      } catch (e) {
        toast('error', 'Could not load attendance', errMsg(e, 'Please try again.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, dateKey, selectedUserId, toast]
  );

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

  const dateStats = useMemo(() => {
    const totalAreas = dateRows.length;
    const visited = dateRows.filter((r) => r.visits.length > 0).length;
    return {
      totalAreas,
      visited,
      totalVisits: dateRows.reduce((sum, r) => sum + r.visits.length, 0),
      totalPhotos: dateRows.reduce((sum, r) => sum + photoCount(r), 0),
      isPast: dateKey < todayKey,
    };
  }, [dateRows, dateKey, todayKey]);

  const userStats = useMemo(
    () => ({
      totalDays: userRows.length,
      daysVisited: userRows.filter((r) => r.visits.length > 0).length,
      totalVisits: userRows.reduce((sum, r) => sum + r.visits.length, 0),
      totalPhotos: userRows.reduce((sum, r) => sum + photoCount(r), 0),
    }),
    [userRows]
  );

  const stats =
    mode === 'date'
      ? [
          { icon: Map, value: dateStats.totalAreas, label: 'Areas assigned' },
          {
            icon: CheckCircle2,
            value: dateStats.visited,
            label: `Visited of ${dateStats.totalAreas}`,
          },
          { icon: MapPin, value: dateStats.totalVisits, label: 'Visits logged' },
          {
            icon: dateStats.isPast ? XCircle : Clock,
            value: dateStats.totalAreas - dateStats.visited,
            label: dateStats.isPast ? 'No-shows' : 'Pending',
          },
          { icon: ImageIcon, value: dateStats.totalPhotos, label: 'Photos captured' },
        ]
      : [
          { icon: CalendarDays, value: userStats.totalDays, label: 'Days assigned' },
          {
            icon: CheckCircle2,
            value: userStats.daysVisited,
            label: `Days visited of ${userStats.totalDays}`,
          },
          { icon: MapPin, value: userStats.totalVisits, label: 'Visits logged' },
          { icon: ImageIcon, value: userStats.totalPhotos, label: 'Photos captured' },
        ];

  const rows: Row[] = mode === 'date' ? dateRows : userRows;
  const showStats = mode === 'date' || !!selectedUserId;

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Every assigned area, whether it was visited, and the evidence behind it."
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-surface p-1">
              {(['date', 'user'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    mode === m ? 'bg-copper text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  By {m === 'date' ? 'date' : 'user'}
                </button>
              ))}
            </div>
            {mode === 'date' ? (
              <DatePicker value={dateKey} onChange={setDateKey} ariaLabel="Attendance date" />
            ) : (
              <Select
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={users.map((u) => ({ value: u.id, label: u.display_name || u.email }))}
                placeholder="Choose a user…"
                ariaLabel="Choose a user"
                className="w-56"
              />
            )}
            <button className="btn-ghost" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      <div className="space-y-5 p-5 sm:p-8">
        {showStats && !loading ? (
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
        ) : mode === 'user' && !selectedUserId ? (
          <div className="card">
            <EmptyState
              icon={CalendarDays}
              title="Choose a user"
              body="Pick someone above to see their assignment and visit history."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={CalendarX}
              title={mode === 'date' ? 'No assignments for this date' : 'No assignments for this user yet'}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isPast = mode === 'date' ? dateKey < todayKey : row.assigned_date < todayKey;
              const isOpen = expanded.has(row.id);
              const profile = 'profile' in row ? row.profile : null;
              const heading =
                mode === 'date'
                  ? profile?.display_name || profile?.email || 'Unknown user'
                  : format(new Date(`${row.assigned_date}T00:00:00`), 'EEE, MMM d, yyyy');
              const count = row.visits.length;

              return (
                <div key={row.id} className="card overflow-hidden">
                  <button
                    onClick={() => toggleExpand(row.id)}
                    className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-line-soft"
                  >
                    {mode === 'date' ? <Avatar name={heading} /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{heading}</p>
                      <p className="truncate text-[13px] text-ink-soft">{row.area_label}</p>
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
