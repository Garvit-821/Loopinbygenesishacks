import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile, QrPayload } from '../types';
import { store } from '../services/store';
import { X, ShieldCheck, RefreshCw, Copy, Check, Sparkles } from 'lucide-react';

interface BadgeModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ user, isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [tokenTimeLeft, setTokenTimeLeft] = useState<number>(60);
  const [payload, setPayload] = useState<QrPayload>(() => store.generateQrPayload(user));

  // Ephemeral Time-Decay Token Rotation (DPDP Compliant)
  useEffect(() => {
    if (!isOpen) return;

    // Reset token upon modal open
    setPayload(store.generateQrPayload(user));
    setTokenTimeLeft(60);

    const interval = setInterval(() => {
      setTokenTimeLeft((prev) => {
        if (prev <= 1) {
          // Regenerate dynamic cryptographic payload
          setPayload(store.generateQrPayload(user));
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, user]);

  const handleCopyLink = (): void => {
    navigator.clipboard.writeText(`https://loopin.genesishacks.dev/p/${user.handle.replace('@', '')}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualRefresh = (): void => {
    setPayload(store.generateQrPayload(user));
    setTokenTimeLeft(60);
  };

  if (!isOpen) return null;

  const payloadString = JSON.stringify(payload);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-cyber-surface border border-cyber-cyan/40 rounded-2xl p-6 shadow-neon-cyan overflow-hidden">
        {/* Top ambient lights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-emerald rounded-full blur-sm" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-white hover:border-cyber-cyan transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs font-mono mb-2">
            <Sparkles className="w-3 h-3" />
            <span>DYNAMIC DEV PASSPORT BADGE</span>
          </div>
          <h3 className="text-lg font-bold text-white font-display tracking-tight">
            {user.name}
          </h3>
          <p className="text-xs font-mono text-slate-400">
            {user.handle} • <span className="text-amber-400 font-semibold">{user.tier} Tier</span>
          </p>
        </div>

        {/* High-Contrast QR Code Card */}
        <div className="relative flex flex-col items-center justify-center p-5 bg-white rounded-xl shadow-2xl mx-auto w-fit">
          <QRCodeSVG
            value={payloadString}
            size={200}
            level="H"
            includeMargin={false}
            fgColor="#05070a"
            bgColor="#ffffff"
          />

          {/* Central Logo Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-lg bg-cyber-bg border-2 border-cyber-cyan flex items-center justify-center shadow-lg">
              <span className="font-mono font-bold text-cyber-cyan text-xs">L⚡P</span>
            </div>
          </div>
        </div>

        {/* Time-decay rotation countdown */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <RefreshCw className={`w-3.5 h-3.5 text-cyber-cyan ${tokenTimeLeft <= 10 ? 'animate-spin' : ''}`} />
              Token Rotation
            </span>
            <span className={`font-bold ${tokenTimeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-cyber-cyan'}`}>
              {tokenTimeLeft}s remaining
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-purple transition-all duration-1000 ease-linear"
              style={{ width: `${(tokenTimeLeft / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Hash & Verification Footer */}
        <div className="mt-4 pt-4 border-t border-cyber-border space-y-3">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-cyber-elevated/70 border border-cyber-border rounded-lg text-[11px] font-mono text-slate-400">
            <span className="truncate max-w-[190px]">{user.badgeHash}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyber-elevated border border-cyber-border hover:border-cyber-cyan/50 text-xs font-mono text-slate-200 transition-all active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share Link'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/40 hover:bg-cyber-cyan/20 text-xs font-mono text-cyber-cyan font-bold transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rotate Nonce</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
