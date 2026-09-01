import React, { useState, useEffect, useCallback } from 'react';
import { useScanner } from '../hooks/useScanner';
import { QrPayload, UserProfile } from '../types';
import { store } from '../services/store';
import {
  X,
  Zap,
  Flashlight,
  SwitchCamera,
  CheckCircle2,
  Tag,
  FileText,
  UserCheck,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface FastScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionAdded: (peer: UserProfile) => void;
}

export const FastScannerModal: React.FC<FastScannerModalProps> = ({
  isOpen,
  onClose,
  onConnectionAdded,
}) => {
  const [scannedPeer, setScannedPeer] = useState<UserProfile | null>(null);
  const [scanLatency, setScanLatency] = useState<number>(0);
  const [privateNote, setPrivateNote] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [activeEventMet, setActiveEventMet] = useState<string>('Genesis Hacks 2026');

  const presetTags = ['AI/ML Systems', 'Rust/Systems', 'Frontend & UI', 'High-Conviction', 'Potential Co-Founder', 'Genesis 2026'];

  const onDecodeCallback = useCallback((payload: QrPayload, latencyMs: number): void => {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {
      // Audio fallback
    }

    if (navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }

    setScanLatency(latencyMs);

    const mockPeers = store.getMockPeers();
    const matched = mockPeers.find((p) => p.handle === payload.handle || p.id === payload.userId);

    const peerProfile: UserProfile = matched || {
      id: payload.userId,
      handle: payload.handle,
      name: payload.name,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      bio: 'Verified Genesis Hacker. Passionate about high-speed software and AI infrastructure.',
      primaryRole: payload.primaryRole || 'Full-Stack Developer',
      githubUsername: payload.handle.replace('@', ''),
      linkedinUrl: 'https://linkedin.com',
      portfolioUrl: 'https://github.com',
      tier: payload.tier || 'Builder',
      xpPoints: 12400,
      nextTierXp: 15000,
      rankPosition: 42,
      totalHackathonsAttended: 5,
      badgeHash: payload.badgeHash,
      radarSkills: [
        { category: 'AI/ML Systems', score: 85, maxScore: 100, verifiedCommits: 140 },
        { category: 'Systems & Rust', score: 80, maxScore: 100, verifiedCommits: 110 },
        { category: 'Frontend & UI', score: 90, maxScore: 100, verifiedCommits: 220 },
        { category: 'Distributed Sys', score: 75, maxScore: 100, verifiedCommits: 90 },
        { category: 'Web3 & Security', score: 70, maxScore: 100, verifiedCommits: 60 },
        { category: 'DevOps & Cloud', score: 80, maxScore: 100, verifiedCommits: 85 },
      ],
      activityMatrix: [],
      stamps: [],
      trophies: [],
      vouches: [],
    };

    setScannedPeer(peerProfile);
    setSelectedTags(['Genesis 2026', peerProfile.primaryRole]);
    setIsSaved(false);
  }, []);

  const {
    videoRef,
    hasCamera,
    hasFlash,
    isFlashOn,
    isSecureContext,
    errorMessage,
    telemetry,
    activeCamera,
    startScanner,
    stopScanner,
    toggleFlash,
    flipCamera,
    simulateMockScan,
  } = useScanner({
    onDecode: onDecodeCallback,
  });

  useEffect(() => {
    if (isOpen && !scannedPeer && hasCamera && isSecureContext) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, scannedPeer, hasCamera, isSecureContext, startScanner, stopScanner]);

  const handleSaveConnection = (): void => {
    if (!scannedPeer) return;

    store.addConnection(
      scannedPeer,
      privateNote,
      selectedTags,
      scanLatency || 280,
      activeEventMet
    );

    setIsSaved(true);
    onConnectionAdded(scannedPeer);

    setTimeout(() => {
      handleClose();
    }, 800);
  };

  const handleClose = (): void => {
    setScannedPeer(null);
    setPrivateNote('');
    setSelectedTags([]);
    setIsSaved(false);
    onClose();
  };

  const toggleTag = (tag: string): void => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!selectedTags.includes(tagInput.trim())) {
        setSelectedTags([...selectedTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xl animate-in fade-in duration-200 p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-[24px] border border-apple-hairline product-shadow overflow-hidden my-auto text-apple-ink">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apple-hairline">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-apple-blue" />
            <span className="text-[13px] font-semibold text-apple-ink font-display">
              {scannedPeer ? 'Profile Verified' : 'High-Speed QR Scanner'}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-[#86868b] hover:text-apple-ink flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View 1: Scanning Viewfinder */}
        {!scannedPeer ? (
          <div className="flex flex-col items-center">
            {/* Viewfinder Window */}
            <div className="relative w-full aspect-square max-h-[360px] bg-apple-black flex items-center justify-center overflow-hidden">
              {hasCamera && isSecureContext ? (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              ) : (
                /* Non-HTTPS / Simulation View */
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Sparkles className="w-6 h-6 text-[#2997ff]" />
                  </div>
                  <div>
                    <h4 className="text-[17px] font-semibold text-white font-display">
                      {errorMessage || 'Sub-400ms Camera Scanner'}
                    </h4>
                    <p className="text-[13px] text-[#cccccc] mt-1 max-w-xs leading-relaxed">
                      Instant cryptographic scanner engine active. Test immediate credential exchange using simulator.
                    </p>
                  </div>
                  <button
                    onClick={() => simulateMockScan()}
                    className="btn-apple px-5 py-2.5 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[14px] font-normal shadow-sm"
                  >
                    Simulate Fast Scan
                  </button>
                </div>
              )}

              {/* Minimalist Apple Reticle (Corner Brackets) */}
              <div className="absolute inset-10 sm:inset-14 border border-white/20 rounded-[20px] pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
                </div>
              </div>

              {/* Bottom Telemetry Chip */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between px-3.5 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[12px] font-text text-white">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#30d158]" />
                  <span>Sub-400ms Hardware Decode</span>
                </div>
                <div className="flex items-center gap-2 text-[#cccccc]">
                  <span>FPS: {telemetry?.fps || 60}</span>
                  <span>•</span>
                  <span className="text-white font-medium">
                    {telemetry?.latencyMs ? `${telemetry.latencyMs}ms` : 'Ready'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Scanner Toolbar */}
            <div className="w-full p-4 bg-apple-parchment border-t border-apple-hairline flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {hasFlash && (
                  <button
                    onClick={toggleFlash}
                    className={`btn-apple px-3.5 py-2 rounded-full border text-[13px] flex items-center gap-1.5 transition-all ${
                      isFlashOn
                        ? 'bg-apple-ink text-white border-apple-ink'
                        : 'bg-white border-apple-hairline text-apple-ink'
                    }`}
                  >
                    <Flashlight className="w-3.5 h-3.5" />
                    <span>{isFlashOn ? 'Torch On' : 'Torch'}</span>
                  </button>
                )}

                {hasCamera && isSecureContext && (
                  <button
                    onClick={flipCamera}
                    className="btn-apple px-3.5 py-2 rounded-full bg-white border border-apple-hairline text-[13px] text-apple-ink flex items-center gap-1.5"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span className="capitalize">{activeCamera}</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => simulateMockScan()}
                className="btn-apple px-4 py-2 rounded-full bg-white border border-apple-hairline text-apple-blue hover:bg-apple-pearl text-[13px] font-medium flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate Scan</span>
              </button>
            </div>
          </div>
        ) : (
          /* View 2: Scanned Peer Exchange & Private Note */
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Decoded Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-apple-parchment rounded-xl text-[13px] text-apple-ink font-text">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#30d158]" />
                <span className="font-semibold">Passport Signature Verified</span>
              </div>
              <span className="font-mono text-apple-blue font-semibold">{scanLatency}ms</span>
            </div>

            {/* Peer Card */}
            <div className="flex items-start gap-4 p-4 bg-apple-parchment rounded-[18px] border border-apple-hairline">
              <img
                src={scannedPeer.avatarUrl}
                alt={scannedPeer.name}
                className="w-14 h-14 rounded-[12px] object-cover border border-apple-hairline shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-[17px] font-semibold text-apple-ink truncate font-display">
                    {scannedPeer.name}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-apple-hairline text-apple-ink">
                    {scannedPeer.tier}
                  </span>
                </div>
                <div className="text-[13px] font-mono text-apple-blue">{scannedPeer.handle}</div>
                <div className="text-[14px] text-apple-ink-muted-80 font-normal mt-1">{scannedPeer.primaryRole}</div>
                <p className="text-[13px] text-[#86868b] line-clamp-2 mt-1 leading-relaxed">
                  {scannedPeer.bio}
                </p>
              </div>
            </div>

            {/* Event Context Selection */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-apple-blue" />
                <span>Event Met</span>
              </label>
              <input
                type="text"
                value={activeEventMet}
                onChange={(e) => setActiveEventMet(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue"
              />
            </div>

            {/* Private Contextual Note */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-apple-blue" />
                  <span>Private Contextual Note</span>
                </label>
                <span className="text-[11px] text-[#86868b]">
                  🔒 Stored locally & private to you
                </span>
              </div>
              <textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="e.g. Discussed edge indexer optimizations. Teaming up for Genesis Winter."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue resize-none"
              />
            </div>

            {/* Tagging System */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-apple-blue" />
                <span>Tags</span>
              </label>
              
              <div className="flex flex-wrap gap-1.5">
                {presetTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`btn-apple px-3 py-1 rounded-full text-[12px] transition-all ${
                        isSelected
                          ? 'bg-apple-blue text-white font-medium'
                          : 'bg-apple-parchment border border-apple-hairline text-apple-ink hover:bg-[#e5e5ea]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Type custom tag and press Enter..."
                className="w-full px-3.5 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink placeholder-[#86868b] focus:outline-none focus:border-apple-blue"
              />
            </div>

            {/* Save Button (Action Blue Pill) */}
            <div className="pt-2">
              <button
                onClick={handleSaveConnection}
                disabled={isSaved}
                className={`btn-apple w-full py-3 px-4 rounded-full text-[17px] font-normal transition-all flex items-center justify-center gap-2 ${
                  isSaved
                    ? 'bg-[#30d158] text-white'
                    : 'bg-apple-blue hover:bg-apple-blue-focus text-white shadow-sm'
                }`}
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>Added to Network Graph</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5 text-white" />
                    <span>Save to Contacts & Network</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
