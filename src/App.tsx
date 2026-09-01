import { useState, useEffect } from 'react';
import { UserProfile, Connection, EventFeedItem, TabType } from './types';
import { store } from './services/store';
import { api } from './services/api';
import { Header } from './components/Header';
import FloatingNavbar from '@/components/ui/floating-navbar';
import { DevPassport } from './components/DevPassport';
import { ConnectionsList } from './components/ConnectionsList';
import { CommunityFeed } from './components/CommunityFeed';
import { BadgeModal } from './components/BadgeModal';
import { FastScannerModal } from './components/FastScannerModal';
import { EditProfileModal } from './components/EditProfileModal';
import { PeerModal } from './components/PeerModal';
import { AuthModal } from './components/AuthModal';
import { CheckCircle2, Shield } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('passport');
  const [user, setUser] = useState<UserProfile>(() => store.getUser());
  const [connections, setConnections] = useState<Connection[]>(() => store.getConnections());
  const [feed, setFeed] = useState<EventFeedItem[]>(() => store.getFeed());
  
  // Modals
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [selectedPeerData, setSelectedPeerData] = useState<{ peer: UserProfile; connection?: Connection | null } | null>(null);
  
  // Dynamic Island Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to reactive store
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUser(store.getUser());
      setConnections(store.getConnections());
      setFeed(store.getFeed());
    });

    // Background sync with API
    api.getProfile().catch(() => {});
    api.getConnections().catch(() => {});
    api.getFeed().catch(() => {});

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

  const handleSelectPeer = (peer: UserProfile, connection?: Connection): void => {
    setSelectedPeerData({ peer, connection });
  };

  const handleAuthenticated = (authenticatedUser: UserProfile): void => {
    setUser(authenticatedUser);
    showToast(`Welcome back, ${authenticatedUser.name} (${authenticatedUser.handle})`);
  };

  const handleLogout = (): void => {
    store.logout();
    showToast('Signed out of developer passport');
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
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-24 md:pb-12">
        {activeTab === 'passport' && (
          <DevPassport
            user={user}
            onOpenBadge={() => setIsBadgeModalOpen(true)}
            onOpenScanner={() => setIsScannerModalOpen(true)}
            onOpenEditProfile={() => setIsEditProfileOpen(true)}
          />
        )}

        {activeTab === 'connections' && (
          <ConnectionsList
            connections={connections}
            onOpenScanner={() => setIsScannerModalOpen(true)}
            onSelectPeer={handleSelectPeer}
          />
        )}

        {activeTab === 'feed' && (
          <CommunityFeed feed={feed} />
        )}
      </main>

      {/* Apple Dynamic Island / Capsule Pill Toast */}
      {toastMessage && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none px-4 w-full max-w-sm">
          <div className="px-4 py-2.5 rounded-full bg-apple-ink text-white shadow-xl flex items-center justify-center gap-2 text-[13px] sm:text-[14px] font-text border border-white/10 text-center">
            <CheckCircle2 className="w-4 h-4 text-[#30d158] shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Floating Navbar (Shadcn + Apple Design System) */}
      <FloatingNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => setIsScannerModalOpen(true)}
        onOpenBadge={() => setIsBadgeModalOpen(true)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
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

      <EditProfileModal
        user={user}
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSaved={() => showToast('Developer passport profile updated')}
      />

      <PeerModal
        peer={selectedPeerData?.peer || null}
        connection={selectedPeerData?.connection || null}
        isOpen={Boolean(selectedPeerData)}
        onClose={() => setSelectedPeerData(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />

      {/* Apple Museum Gallery Footer */}
      <footer className="w-full bg-apple-parchment border-t border-apple-hairline py-12 sm:py-16 px-4 sm:px-8 text-apple-ink-muted-80 text-[12px] font-text">
        <div className="max-w-[980px] mx-auto space-y-8">
          {/* Top disclaimer */}
          <div className="text-[11px] sm:text-[12px] text-apple-ink-muted-48 leading-relaxed border-b border-apple-hairline pb-6 space-y-2">
            <p>
              1. Dev Passport identity verification, podium attestation, and commit telemetry are sealed using SHA-256 and Ed25519 cryptographic signature schemes.
            </p>
            <p>
              2. Ephemeral QR tokens rotate on a 60-second time-decay window compliant with the Digital Personal Data Protection (DPDP) Act 2023. Private notes and tags are stored strictly on-device.
            </p>
          </div>

          {/* Nav link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-[13px] sm:text-[14px]">
            <div>
              <h4 className="font-semibold text-apple-ink mb-2.5 sm:mb-3 font-display">
                Dev Passport
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><button onClick={() => setActiveTab('passport')} className="hover:text-apple-ink">Passport Overview</button></li>
                <li><button onClick={() => setIsBadgeModalOpen(true)} className="hover:text-apple-ink">Dynamic Badge</button></li>
                <li><button onClick={() => setIsEditProfileOpen(true)} className="hover:text-apple-ink">Edit Profile</button></li>
                <li><button onClick={() => setIsAuthModalOpen(true)} className="hover:text-apple-ink">Account & Sign In</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-apple-ink mb-2.5 sm:mb-3 font-display">
                Network Graph
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><button onClick={() => setActiveTab('connections')} className="hover:text-apple-ink">Connections ({connections.length})</button></li>
                <li><button onClick={() => setIsScannerModalOpen(true)} className="hover:text-apple-ink">Camera Viewfinder</button></li>
                <li><a href="#export" className="hover:text-apple-ink">Export CSV / vCard</a></li>
                <li><a href="#security" className="hover:text-apple-ink">Private Notes</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-apple-ink mb-2.5 sm:mb-3 font-display">
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
              <h4 className="font-semibold text-apple-ink mb-2.5 sm:mb-3 font-display">
                Ecosystem
              </h4>
              <ul className="space-y-2 text-apple-ink-muted-80">
                <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-apple-ink">GitHub Integration</a></li>
                <li><a href="#" className="hover:text-apple-ink">DPDP Architecture</a></li>
                <li><a href="#" className="hover:text-apple-ink">Sub-400ms QR Engine</a></li>
                <li><a href="#" className="hover:text-apple-ink">Railway & Capacitor Ready</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom copyright row */}
          <div className="pt-6 border-t border-apple-hairline flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-[12px] text-apple-ink-muted-48">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-apple-blue" />
              <span>Copyright © 2026 Genesis Hacks. Production-ready release.</span>
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
