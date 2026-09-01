import React, { useState, useEffect, useCallback } from 'react';
import { TabType, UserProfile, Connection, EventFeedItem } from './types';
import { store } from './services/store';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DevPassport } from './components/DevPassport';
import { ConnectionsList } from './components/ConnectionsList';
import { CommunityFeed } from './components/CommunityFeed';
import { FastScannerModal } from './components/FastScannerModal';
import { BadgeModal } from './components/BadgeModal';
import { CheckCircle2, X } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('passport');
  const [user, setUser] = useState<UserProfile>(() => store.getUser());
  const [connections, setConnections] = useState<Connection[]>(() => store.getConnections());
  const [feed, setFeed] = useState<EventFeedItem[]>(() => store.getFeed());
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle: string } | null>(null);

  // Sync state with reactive store
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUser(store.getUser());
      setConnections(store.getConnections());
      setFeed(store.getFeed());
    });
    return unsubscribe;
  }, []);

  const showToast = useCallback((title: string, subtitle: string): void => {
    setToastMessage({ title, subtitle });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const handleConnectionAdded = (peer: UserProfile): void => {
    showToast(
      '⚡ CONNECTION ESTABLISHED',
      `Added ${peer.name} (${peer.handle}) to your verified Dev Passport network.`
    );
  };

  const hasUrgentAlert = feed.some((f) => f.urgent);

  return (
    <div className="min-h-screen bg-cyber-bg bg-grid-cyber bg-radial-vignette text-slate-100 flex flex-col selection:bg-cyber-cyan selection:text-black">
      {/* Sticky Top Telemetry Bar */}
      <Header
        user={user}
        onOpenBadge={() => setIsBadgeModalOpen(true)}
      />

      {/* Main Responsive Content Viewport */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5">
        {activeTab === 'passport' && (
          <DevPassport
            user={user}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {activeTab === 'connections' && (
          <ConnectionsList
            connections={connections}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {activeTab === 'feed' && (
          <CommunityFeed feedItems={feed} />
        )}
      </main>

      {/* Floating Glassmorphism Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        connectionsCount={connections.length}
        hasUrgentAlert={hasUrgentAlert}
      />

      {/* Sub-400ms High Speed QR Scanner HUD */}
      <FastScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onConnectionAdded={handleConnectionAdded}
      />

      {/* User's Dynamic QR Badge Modal */}
      <BadgeModal
        user={user}
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
      />

      {/* Global Cyber Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="p-4 bg-cyber-surface/95 border border-cyber-cyan rounded-2xl shadow-neon-cyan backdrop-blur-xl flex items-start gap-3 pointer-events-auto">
            <div className="p-2 rounded-xl bg-cyber-cyan/20 text-cyber-cyan shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-mono font-bold text-cyber-cyan uppercase tracking-wider">
                {toastMessage.title}
              </h5>
              <p className="text-xs text-slate-300 font-sans mt-0.5 leading-relaxed">
                {toastMessage.subtitle}
              </p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
