import { Capacitor } from '@capacitor/core';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router-dom';
import { PwaUpdater } from '@/components/common/PwaUpdater';
import { Toaster } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { persistOptions, queryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/lib/theme';
import { router } from './router';

const isNative = Capacitor.isNativePlatform();

export default function App() {
  return (
    <ThemeProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
      {/* Top-center with the safe-area mobile offset built in (see components/ui/toaster.tsx). */}
      <Toaster />
      {isNative ? null : <PwaUpdater />}
    </ThemeProvider>
  );
}
