import { Outlet } from 'react-router-dom';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { PendingConnectGate } from '@/features/exchange/PendingConnectGate';
import { useFlushConnectionDrafts } from '@/features/network/api';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';

/** Signed-in chrome: TopBar + TabBar on phones, Sidebar from md. Also syncs leftover drafts and resumes a pending connect. */
export function AppShell() {
  useFlushConnectionDrafts();

  return (
    <div className="min-h-dvh bg-canvas md:pl-64">
      <Sidebar />
      <TopBar />
      <OfflineBanner />
      <main id="main" tabIndex={-1} className="pb-safe-offset-20 outline-none md:pb-16">
        <Outlet />
      </main>
      <TabBar />
      <PendingConnectGate />
    </div>
  );
}
