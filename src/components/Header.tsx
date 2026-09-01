import React, { useState, useEffect } from 'react';
import { UserProfile, TabType } from '../types';
import { QrCode, Scan } from 'lucide-react';

interface HeaderProps {
  user: UserProfile;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenBadge: () => void;
  onOpenScanner: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenBadge,
  onOpenScanner,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(
        d.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getSubNavTitle = (): string => {
    switch (activeTab) {
      case 'passport':
        return 'Dev Passport';
      case 'connections':
        return 'Network Graph';
      case 'feed':
        return 'Live Operations';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* 1. Global Nav: Ultra-thin True Black Bar (44px) */}
      <div className="w-full bg-apple-black text-white h-[44px] px-4 sm:px-8 flex items-center justify-between text-[12px] font-text tracking-[-0.01em]">
        <div className="max-w-[1024px] w-full mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onSelectTab('passport')}
              className="flex items-center gap-2 text-white font-display font-semibold hover:opacity-80 transition-opacity"
            >
              <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[11px] font-bold">
                ⚡
              </span>
              <span className="text-[13px] tracking-tight font-medium">Loopin</span>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 text-[#cccccc] text-[12px]">
              <button
                onClick={() => onSelectTab('passport')}
                className={`hover:text-white transition-colors ${activeTab === 'passport' ? 'text-white font-medium' : ''}`}
              >
                Passport
              </button>
              <button
                onClick={() => onSelectTab('connections')}
                className={`hover:text-white transition-colors ${activeTab === 'connections' ? 'text-white font-medium' : ''}`}
              >
                Network
              </button>
              <button
                onClick={() => onSelectTab('feed')}
                className={`hover:text-white transition-colors ${activeTab === 'feed' ? 'text-white font-medium' : ''}`}
              >
                Genesis Live Ops
              </button>
            </nav>
          </div>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3 text-[#cccccc] text-[12px]">
            <span className="hidden sm:inline text-[#86868b]">Genesis Hacks 2026</span>
            <span className="hidden sm:inline text-[#86868b]">•</span>
            <div className="flex items-center gap-1.5 text-white font-medium">
              <span className="w-2 h-2 rounded-full bg-[#30d158]" />
              <span>{timeStr || 'BLR'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-Nav: Frosted Glass Bar (52px) */}
      <div className="w-full frosted-nav border-b border-apple-hairline/80 h-[52px] px-4 sm:px-8">
        <div className="max-w-[1024px] w-full mx-auto h-full flex items-center justify-between">
          {/* Category Title */}
          <div className="flex items-center gap-3">
            <h2 className="text-[21px] font-semibold text-apple-ink tracking-[-0.015em] font-display">
              {getSubNavTitle()}
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white border border-apple-hairline text-[12px] text-apple-ink-muted-80 font-normal">
              {user.tier}
            </span>
          </div>

          {/* Persistent Action CTAs (Action Blue Pills) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenBadge}
              className="btn-apple px-3.5 py-1.5 rounded-full bg-white border border-apple-hairline text-[14px] text-apple-ink hover:bg-apple-pearl transition-colors flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-apple-blue" />
              <span>My Pass</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="btn-apple px-4 py-1.5 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[14px] font-normal transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Scan className="w-3.5 h-3.5 text-white" />
              <span>Scan Badge</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
