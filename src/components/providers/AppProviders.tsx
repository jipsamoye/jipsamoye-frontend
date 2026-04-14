'use client';

import { AuthProvider } from '@/components/providers/AuthProvider';
import NotificationProvider from '@/components/providers/NotificationProvider';
import NavigationGuardProvider from '@/components/providers/NavigationGuard';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <NavigationGuardProvider>
          {children}
        </NavigationGuardProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
