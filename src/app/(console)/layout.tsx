'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Avatar, CenteredSpinner } from '@/components/ui';

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/assignments', label: 'Assignments', icon: MapPinned },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/forms', label: 'Forms', icon: FileText },
  { href: '/team', label: 'Team', icon: Users },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { loading, session, isAdmin, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session || !isAdmin) router.replace('/login');
  }, [loading, session, isAdmin, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Wait for the profile too: `session && !isAdmin` is also the state of a
  // signed-in admin whose profile row hasn't loaded yet, and rendering the
  // console for a beat before redirecting would flash admin chrome at a field user.
  if (loading || !session || !profile) return <CenteredSpinner />;
  if (!isAdmin) return <CenteredSpinner />;

  const name = profile.display_name || profile.email;

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="text-ink">
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-bold text-ink">The Nucleus · Admin</span>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-copper">
              The Nucleus
            </p>
            <p className="mt-1 text-sm font-semibold text-white">Admin Console</p>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            className="text-white/60 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? 'bg-copper text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="size-4.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} size="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{name}</p>
              <p className="truncate text-xs text-white/40">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4.5" />
            Sign out
          </button>
        </div>
      </aside>

      {navOpen ? (
        <div
          className="fixed inset-0 z-30 bg-ink/50 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      ) : null}

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
