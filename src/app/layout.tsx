import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: 'The Nucleus - Marketing — Admin Console',
  description: 'Manage field team, area assignments, attendance and forms.',
};

export const viewport: Viewport = {
  themeColor: '#1a1612',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
