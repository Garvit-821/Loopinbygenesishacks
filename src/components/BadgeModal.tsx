import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile, QrPayload } from '../types';
import { store } from '../services/store';
import { X, ShieldCheck, RefreshCw, Copy, Check, Lock } from 'lucide-react';

interface BadgeModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ user, isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [tokenTimeLeft, setTokenTimeLeft] = useState<number>(60);
  const [payload, setPayload] = useState<QrPayload>(() => store.generateQrPayload(user));

  useEffect(() => {
    if (!isOpen) return;

    setPayload(store.generateQrPayload(user));
    setTokenTimeLeft(60);

    const interval = setInterval(() => {
      setTokenTimeLeft((prev) => {
        if (prev <= 1) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-[24px] p-6 sm:p-7 border border-apple-hairline product-shadow overflow-hidden text-center">
        
        {/* Close Button (Circular Utility Capsule) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-[#86868b] hover:text-apple-ink flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-apple-parchment border border-apple-hairline text-apple-blue text-[12px] font-medium mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-apple-blue" />
            <span>DPDP ROTATING BADGE</span>
          </div>
          <h3 className="text-[24px] font-semibold text-apple-ink tracking-tight font-display">
            {user.name}
          </h3>
          <p className="text-[14px] text-[#86868b] font-mono mt-0.5">
            {user.handle} • <span className="text-apple-ink font-semibold">{user.tier} Tier</span>
          </p>
        </div>

        {/* QR Code Presentation */}
        <div className="relative p-5 bg-white rounded-[18px] border border-apple-hairline/80 shadow-sm mx-auto w-fit">
          <QRCodeSVG
            value={payloadString}
            size={200}
            level="M"
            includeMargin={false}
            fgColor="#1d1d1f"
            bgColor="#ffffff"
          />

          {/* Center Apple-styled Badge Icon */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white border border-apple-hairline shadow-sm flex items-center justify-center text-apple-blue font-display font-bold text-[14px]">
              ⚡
            </div>
          </div>
        </div>

        {/* Rotation Countdown */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-[13px] font-text text-[#86868b]">
            <span className="flex items-center gap-1.5 text-apple-ink-muted-80">
              <RefreshCw className={`w-3.5 h-3.5 text-apple-blue ${tokenTimeLeft <= 10 ? 'animate-spin' : ''}`} />
              Token Lifetime
            </span>
            <span className={`font-semibold ${tokenTimeLeft <= 10 ? 'text-[#ff3b30]' : 'text-apple-blue'}`}>
              {tokenTimeLeft}s remaining
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#e5e5ea] rounded-full overflow-hidden">
            <div
              className="h-full bg-apple-blue transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(tokenTimeLeft / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer Cryptographic Hash */}
        <div className="mt-6 pt-4 border-t border-apple-hairline space-y-3">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-apple-parchment rounded-lg text-[11px] font-mono text-[#86868b]">
            <span className="truncate max-w-[200px]">{user.badgeHash}</span>
            <Lock className="w-3.5 h-3.5 text-apple-blue shrink-0" />
          </div>

          {/* Action CTAs */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleCopyLink}
              className="btn-apple py-2.5 px-3 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] border border-apple-hairline text-[14px] text-apple-ink font-normal flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              className="btn-apple py-2.5 px-3 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[14px] font-normal flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rotate Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
