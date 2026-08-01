'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { CenteredSpinner } from '@/components/ui';

/** Entry point: bounce to the console or the sign-in page once auth resolves. */
export default function Home() {
  const router = useRouter();
  const { loading, session, isAdmin } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(session && isAdmin ? '/overview' : '/login');
  }, [loading, session, isAdmin, router]);

  return <CenteredSpinner />;
}
