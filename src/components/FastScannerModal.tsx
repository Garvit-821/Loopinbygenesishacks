import React, { useState, useEffect, useRef } from 'react';
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

  const presetTags = ['AI/ML', 'Rust/Systems', 'Frontend & UI', 'High-Conviction', 'Potential Co-Founder', 'Genesis 2026'];

  const onDecodeCallback = (payload: QrPayload, latencyMs: number): void => {
    // Audio chirp simulation
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch affirmative beep
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // Audio not permitted or supported
    }

    // Trigger haptic vibration on mobile
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }

    setScanLatency(latencyMs);

    // If profile snapshot exists in payload, use it. Otherwise, look up or construct
    const mockPeers = store.getMockPeers();
    const matched = mockPeers.find((p) => p.handle === payload.handle || p.id === payload.userId);

    const peerProfile: UserProfile = payload.profileSnapshot
      ? (payload.profileSnapshot as UserProfile)
      : matched || {
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
  };

  const {
    videoRef,
    isScanning,
    hasFlash,
    isFlashOn,
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

  const isScanningRef = useRef(isScanning);
  isScanningRef.current = isScanning;

  useEffect(() => {
    if (isOpen && !scannedPeer) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, scannedPeer, startScanner, stopScanner]);

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
    }, 900);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-cyber-bg border border-cyber-cyan/40 rounded-2xl shadow-neon-cyan overflow-hidden my-auto">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-cyber-surface border-b border-cyber-border">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyber-cyan animate-ping" />
            <span className="font-mono text-xs font-bold tracking-widest text-cyber-cyan uppercase">
              {scannedPeer ? 'TARGET ACQUIRED // PROFILE DECODED' : 'SUB-400MS QR VIEWFINDER HUD'}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-cyber-cyan transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View 1: Scanning Viewfinder */}
        {!scannedPeer ? (
          <div className="relative flex flex-col items-center">
            {/* Viewfinder Window */}
            <div className="relative w-full aspect-square max-h-[380px] bg-slate-950 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* CRT Scanline Overlay */}
              <div className="absolute inset-0 scanline-overlay pointer-events-none" />

              {/* Animated HUD Sweep Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent shadow-[0_0_15px_#00f0ff] animate-scanline pointer-events-none" />

              {/* Cyber Reticle & Corner Brackets */}
              <div className="absolute inset-8 sm:inset-12 border-2 border-cyber-cyan/40 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-hud-glow">
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-t-2 border-l-2 border-cyber-cyan" />
                  <div className="w-5 h-5 border-t-2 border-r-2 border-cyber-cyan" />
                </div>
                {/* Center Crosshairs */}
                <div className="self-center flex items-center justify-center">
                  <div className="w-6 h-6 border border-cyber-cyan/30 rounded-full flex items-center justify-center animate-spin">
                    <div className="w-1.5 h-1.5 bg-cyber-cyan rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-b-2 border-l-2 border-cyber-cyan" />
                  <div className="w-5 h-5 border-b-2 border-r-2 border-cyber-cyan" />
                </div>
              </div>

              {/* Telemetry Status Inset */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-black/70 border border-cyber-border rounded-lg text-[11px] font-mono text-slate-300 backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
                  <span>Target: <span className="text-white font-bold">&lt;400ms</span> decode</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>FPS: <span className="text-emerald-400 font-bold">{telemetry?.fps || 60}</span></span>
                  <span>LATENCY: <span className="text-cyber-cyan font-bold">{telemetry?.latencyMs ? `${telemetry.latencyMs}ms` : 'READY'}</span></span>
                </div>
              </div>
            </div>

            {/* Hardware Controls */}
            <div className="w-full p-4 bg-cyber-surface/90 border-t border-cyber-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {hasFlash && (
                  <button
                    onClick={toggleFlash}
                    className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
                      isFlashOn
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-[0_0_10px_#f59e0b]'
                        : 'bg-cyber-elevated border-cyber-border text-slate-300 hover:border-cyber-cyan'
                    }`}
                  >
                    <Flashlight className="w-4 h-4" />
                    <span>{isFlashOn ? 'Torch ON' : 'Torch'}</span>
                  </button>
                )}

                <button
                  onClick={flipCamera}
                  className="p-2.5 rounded-xl bg-cyber-elevated border border-cyber-border hover:border-cyber-cyan text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-all"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span className="capitalize">{activeCamera}</span>
                </button>
              </div>

              {/* Quick Mock Scan Simulator */}
              <button
                onClick={() => simulateMockScan()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyber-cyan/20 to-cyber-purple/20 border border-cyber-cyan hover:bg-cyber-cyan/30 text-cyber-cyan font-mono text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-neon-cyan"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate Fast Scan</span>
              </button>
            </div>
          </div>
        ) : (
          /* View 2: Scanned Peer Exchange & Private Note Ingestion */
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Top Verification Telemetry Banner */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-xs font-mono text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>PASSPORT VERIFIED • NONCE VALID</span>
              </div>
              <span className="font-bold text-cyber-cyan">{scanLatency}ms</span>
            </div>

            {/* Profile Summary Card */}
            <div className="flex items-start gap-4 p-4 bg-cyber-elevated/80 border border-cyber-border rounded-xl">
              <img
                src={scannedPeer.avatarUrl}
                alt={scannedPeer.name}
                className="w-14 h-14 rounded-xl object-cover border-2 border-cyber-cyan shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-base font-bold text-white truncate font-display">
                    {scannedPeer.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-400/10 border border-amber-400/40 text-amber-300">
                    {scannedPeer.tier}
                  </span>
                </div>
                <div className="text-xs font-mono text-cyber-cyan">{scannedPeer.handle}</div>
                <div className="text-xs text-slate-300 font-medium mt-1">{scannedPeer.primaryRole}</div>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {scannedPeer.bio}
                </p>
              </div>
            </div>

            {/* Event Context Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>Event Context</span>
              </label>
              <input
                type="text"
                value={activeEventMet}
                onChange={(e) => setActiveEventMet(e.target.value)}
                className="w-full px-3 py-2 bg-cyber-surface border border-cyber-border rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            {/* Private Contextual Note (Encrypted / Local) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyber-purple" />
                  <span>Private Contextual Note</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  🔒 Strictly private to you
                </span>
              </div>
              <textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="e.g. Discussed Rust WebAssembly optimization for edge indexer. Looking to team up for Genesis Winter 2026."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-cyber-surface border border-cyber-border rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan resize-none font-sans"
              />
            </div>

            {/* Tagging System */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>Category Tags</span>
              </label>
              
              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {presetTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                        isSelected
                          ? 'bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan font-bold shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                          : 'bg-cyber-surface border border-cyber-border text-slate-400 hover:text-white'
                      }`}
                    >
                      +{tag}
                    </button>
                  );
                })}
              </div>

              {/* Custom Tag Input */}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Type custom tag and press Enter..."
                className="w-full px-3 py-1.5 bg-cyber-surface border border-cyber-border rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                onClick={handleSaveConnection}
                disabled={isSaved}
                className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-neon-cyan ${
                  isSaved
                    ? 'bg-emerald-500 text-black'
                    : 'bg-gradient-to-r from-cyber-cyan via-cyber-violet to-cyber-purple text-black hover:opacity-90 active:scale-98'
                }`}
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SAVED TO PASSPORT GRAPH!</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>CONFIRM & ADD TO DEV NETWORK</span>
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
