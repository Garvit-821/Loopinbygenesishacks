import { useState, useEffect } from 'react';
import { UserProfile, Connection, EventFeedItem, TabType } from './types';
import { store } from './services/store';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DevPassport } from './components/DevPassport';
import { ConnectionsList } from './components/ConnectionsList';
import { CommunityFeed } from './components/CommunityFeed';
import { BadgeModal } from './components/BadgeModal';
import { FastScannerModal } from './components/FastScannerModal';
import { CheckCircle2, Shield } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('passport');
  const [user, setUser] = useState<UserProfile>(() => store.getUser());
  const [connections, setConnections] = useState<Connection[]>(() => store.getConnections());
  const [feed, setFeed] = useState<EventFeedItem[]>(() => store.getFeed());
  
  // Modals
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to reactive store
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUser(store.getUser());
      setConnections(store.getConnections());
      setFeed(store.getFeed());
    });
    return unsubscribe;
  }, []);

  const showToast = (msg: string): void => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleConnectionAdded = (peer: UserProfile): void => {
    showToast(`Added ${peer.name} (${peer.handle}) to your verified network graph`);
  };

  return (
    <div className="min-h-screen bg-apple-parchment text-apple-ink font-text flex flex-col selection:bg-apple-blue selection:text-white">
      {/* Top Fixed Header with Global Nav and Sub-Nav */}
      <Header
        user={user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBadge={() => setIsBadgeModalOpen(true)}
        onOpenScanner={() => setIsScannerModalOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-24 md:pb-12">
        {activeTab === 'passport' && (
          <DevPassport
            user={user}
            onOpenBadge={() => setIsBadgeModalOpen(true)}
            onOpenScanner={() => setIsScannerModalOpen(true)}
          />
        )}

        {activeTab === 'connections' && (
          <ConnectionsList
            connections={connections}
            onOpenScanner={() => setIsScannerModalOpen(true)}
          />
        )}

        {activeTab === 'feed' && (
          <CommunityFeed feed={feed} />
        )}
      </main>

      {/* Apple Dynamic Island / Capsule Pill Toast */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="px-5 py-2.5 rounded-full bg-apple-ink text-white shadow-xl flex items-center gap-2.5 text-[14px] font-text border border-white/10">
            <CheckCircle2 className="w-4 h-4 text-[#30d158] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Mobile Floating Bottom Nav */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => setIsScannerModalOpen(true)}
        connectionsCount={connections.length}
        hasUrgentAlert={feed.some((f) => f.urgent)}
      />

      {/* Modals */}
      <BadgeModal
        user={user}
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
      />

      <FastScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onConnectionAdded={handleConnectionAdded}
      />

      {/* Apple Museum Gallery Footer */}
      <footer className="w-full bg-apple-parchment border-t border-apple-hairline py-16 px-4 sm:px-8 text-apple-ink-muted-80 text-[12px] font-text">
        <div className="max-w-[980px] mx-auto space-y-8">
          {/* Top disclaimer */}
          <div className="text-[12px] text-apple-ink-muted-48 leading-relaxed border-b border-apple-hairline pb-6 space-y-2">
            <p>
              1. Dev Passport identity verification, podium attestation, and commit telemetry are sealed using SHA-256 and Ed25519 signature schemes.
            </p>
            <p>
              2. Ephemeral QR tokens rotate on a 60-second time-decay window compliant with the Digital Personal Data Protection (DPDP) Act 2023. Private notes and tags are stored strictly in local device storage.
            </p>
          </div>

          {/* Nav link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-[14px]">
            <div>
              <h4 className="font-semibold text-apple-ink text-[14px] mb-3 font-display">
                Dev Passport
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><button onClick={() => setActiveTab('passport')} className="hover:text-apple-ink">Passport Overview</button></li>
                <li><button onClick={() => setIsBadgeModalOpen(true)} className="hover:text-apple-ink">Dynamic Badge</button></li>
                <li><a href="#trophies" className="hover:text-apple-ink">Podium Shelf</a></li>
                <li><a href="#skills" className="hover:text-apple-ink">Capability Matrix</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-apple-ink text-[14px] mb-3 font-display">
                Network Graph
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><button onClick={() => setActiveTab('connections')} className="hover:text-apple-ink">Connections ({connections.length})</button></li>
                <li><button onClick={() => setIsScannerModalOpen(true)} className="hover:text-apple-ink">Camera Viewfinder</button></li>
                <li><a href="#export" className="hover:text-apple-ink">Export CSV</a></li>
                <li><a href="#security" className="hover:text-apple-ink">Private Notes</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-apple-ink text-[14px] mb-3 font-display">
                Genesis Hacks
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><button onClick={() => setActiveTab('feed')} className="hover:text-apple-ink">Live Operations</button></li>
                <li><a href="#" className="hover:text-apple-ink">Genesis Winter 2026</a></li>
                <li><a href="#" className="hover:text-apple-ink">Main Arena Schedule</a></li>
                <li><a href="#" className="hover:text-apple-ink">Mentor Office Hours</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-apple-ink text-[14px] mb-3 font-display">
                Ecosystem
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-apple-ink">GitHub Integration</a></li>
                <li><a href="#" className="hover:text-apple-ink">DPDP Architecture</a></li>
                <li><a href="#" className="hover:text-apple-ink">Sub-400ms QR Engine</a></li>
                <li><a href="#" className="hover:text-apple-ink">Genesis Core Team</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom copyright row */}
          <div className="pt-6 border-t border-apple-hairline flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-apple-ink-muted-48">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-apple-blue" />
              <span>Copyright © 2026 Genesis Hacks. Engineered with Apple Design System precision.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-apple-ink">Privacy Policy</a>
              <a href="#" className="hover:text-apple-ink">Terms of Use</a>
              <a href="#" className="hover:text-apple-ink">Cryptographic Attestation</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
