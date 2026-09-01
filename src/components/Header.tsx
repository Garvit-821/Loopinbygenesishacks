import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { QrCode } from 'lucide-react';

interface HeaderProps {
  user: UserProfile;
  onOpenBadge: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onOpenBadge }) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(
        d.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-cyber-bg/90 backdrop-blur-xl border-b border-cyber-border/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo & Event Tag */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyber-cyan via-cyber-violet to-cyber-purple p-[1.5px] shadow-neon-cyan shrink-0">
            <div className="w-full h-full bg-cyber-bg rounded-[10px] flex items-center justify-center">
              <span className="font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-purple-400 text-sm">
                L⚡P
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-white text-base tracking-tight">
                LOOPIN
              </span>
              <span className="text-[10px] font-mono font-bold text-cyber-cyan px-1.5 py-0.2 rounded bg-cyber-cyan/10 border border-cyber-cyan/30">
                GENESIS
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                BLR_NODE_01
              </span>
              <span>•</span>
              <span className="text-slate-500">{timeStr || 'LIVE'}</span>
            </div>
          </div>
        </div>

        {/* Right Actions: QR Badge Trigger & Quick Avatar */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenBadge}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyber-surface border border-cyber-cyan/40 hover:bg-cyber-cyan/15 text-xs font-mono text-cyber-cyan font-bold transition-all active:scale-95 shadow-neon-cyan"
            title="Display QR Badge"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MY BADGE</span>
          </button>

          <div
            onClick={onOpenBadge}
            className="relative cursor-pointer group"
          >
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-lg object-cover border border-cyber-cyan/60 group-hover:border-cyber-cyan transition-all"
            />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-cyber-bg" />
          </div>
        </div>
      </div>
    </header>
  );
};
