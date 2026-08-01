'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  MapPin,
  MapPinned,
  RefreshCw,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar, CenteredSpinner, EmptyState, errMsg, useToast } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { listAssignableUsers, toDateKey } from '@/lib/assignments';
import { listAdminAssignmentsForDate } from '@/lib/visits';
import { getFieldForm } from '@/lib/settings';
import type { AdminAssignmentRow } from '@/lib/types';

export default function OverviewPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<AdminAssignmentRow[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [fieldFormSet, setFieldFormSet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayKey = toDateKey(new Date());

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const [assignments, users] = await Promise.all([
          listAdminAssignmentsForDate(todayKey),
          listAssignableUsers(),
        ]);
        setRows(assignments);
        setUserCount(users.length);
      } catch (e) {
        toast('error', 'Could not load today’s activity', errMsg(e, 'Please try again.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
      // Independent of the numbers above — a missing default form is a setup
      // warning, not a stat, so a failure here must not blank the dashboard.
      getFieldForm()
        .then((f) => setFieldFormSet(!!f))
        .catch(() => setFieldFormSet(null));
    },
    [todayKey, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const visited = rows.filter((r) => r.visits.length > 0).length;
    const totalVisits = rows.reduce((sum, r) => sum + r.visits.length, 0);
    const totalPhotos = rows.reduce(
      (sum, r) => sum + r.visits.reduce((n, v) => n + v.photos.length, 0),
      0
    );
    const activeUsers = new Set(rows.filter((r) => r.visits.length > 0).map((r) => r.user_id)).size;
    return { areas: rows.length, visited, totalVisits, totalPhotos, activeUsers };
  }, [rows]);

  // Newest visits across everyone assigned today.
  const recentVisits = useMemo(
    () =>
      rows
        .flatMap((r) =>
          r.visits.map((v) => ({
            visit: v,
            who: r.profile?.display_name || r.profile?.email || 'Unknown user',
            area: r.area_label,
          }))
        )
        .sort(
          (a, b) =>
            new Date(b.visit.submitted_at).getTime() - new Date(a.visit.submitted_at).getTime()
        )
        .slice(0, 8),
    [rows]
  );

  const firstName = (profile?.display_name || profile?.email || '').split(/[\s@]/)[0];

  const cards = [
    { icon: MapPinned, value: stats.areas, label: 'Areas assigned today', href: '/assignments' },
    {
      icon: CheckCircle2,
      value: stats.visited,
      label: `Areas visited of ${stats.areas}`,
      href: '/attendance',
    },
    { icon: MapPin, value: stats.totalVisits, label: 'Visits logged today', href: '/attendance' },
    {
      icon: Clock,
      value: stats.areas - stats.visited,
      label: 'Still pending',
      href: '/attendance',
    },
    { icon: ImageIcon, value: stats.totalPhotos, label: 'Photos captured', href: '/attendance' },
    { icon: Users, value: userCount, label: 'Field users', href: '/team' },
  ];

  return (
    <>
      <PageHeader
        title={firstName ? `Good day, ${firstName}` : 'Overview'}
        subtitle={format(new Date(), 'EEEE, d MMMM yyyy')}
        actions={
          <button className="btn-ghost" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="space-y-5 p-5 sm:p-8">
        {fieldFormSet === false ? (
          <div className="rounded-xl border border-warn/40 bg-warn/5 p-4">
            <p className="text-sm font-semibold text-ink">No default field form set</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Field users won&apos;t get a form after logging a visit unless an area has its own
              override.{' '}
              <Link href="/forms" className="font-semibold text-copper hover:underline">
                Star a form
              </Link>{' '}
              to fix this.
            </p>
          </div>
        ) : null}

        {loading ? (
          <CenteredSpinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {cards.map(({ icon: Icon, value, label, href }) => (
                <Link key={label} href={href} className="card p-4 transition hover:border-copper">
                  <Icon className="size-4.5 text-copper" />
                  <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
                  <p className="text-xs leading-snug text-ink-soft">{label}</p>
                </Link>
              ))}
            </div>

            <div className="card">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="font-bold text-ink">Latest visits today</h2>
                <Link href="/attendance" className="text-[13px] font-semibold text-copper hover:underline">
                  View all
                </Link>
              </div>
              {recentVisits.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No visits logged yet today"
                  body={
                    stats.areas === 0
                      ? 'Nothing is assigned for today — start in Assignments.'
                      : 'Assigned areas are still pending.'
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {recentVisits.map(({ visit, who, area }) => (
                    <li key={visit.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Avatar name={who} size="size-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {visit.place_label}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {who} · {area}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-ink-soft">
                          {format(new Date(visit.submitted_at), 'h:mm a')}
                        </p>
                        {visit.photos.length > 0 ? (
                          <p className="text-[11px] text-muted">
                            {visit.photos.length} photo{visit.photos.length === 1 ? '' : 's'}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
