import React, { useState, useEffect } from 'react';
import { UserProfile, TabType } from '../types';
import { QrCode, Scan, Edit3, LogIn, LogOut, Users } from 'lucide-react';

interface HeaderProps {
  user: UserProfile;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenBadge: () => void;
  onOpenScanner: () => void;
  onOpenEditProfile: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenBadge,
  onOpenScanner,
  onOpenEditProfile,
  onOpenAuth,
  onLogout,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

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
    <header className="sticky top-0 z-40 w-full select-none">
      {/* 1. Global Nav: Ultra-thin True Black Bar (44px + Safe Area Top) */}
      <div className="w-full bg-apple-black text-white h-[44px] px-3 sm:px-8 flex items-center justify-between text-[12px] font-text tracking-[-0.01em]">
        <div className="max-w-[1024px] w-full mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-4 sm:gap-6">
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

          {/* Right Status & Account Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 text-[#cccccc] text-[12px] relative">
            <span className="hidden sm:inline text-[#86868b]">Genesis Hacks 2026</span>
            <span className="hidden sm:inline text-[#86868b]">•</span>
            <div className="flex items-center gap-1.5 text-white font-medium">
              <span className="w-2 h-2 rounded-full bg-[#30d158]" />
              <span className="font-mono text-[11px] sm:text-[12px]">{timeStr || 'BLR'}</span>
            </div>

            {/* User Avatar Menu Trigger */}
            <div className="relative ml-1">
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="w-6 h-6 rounded-full border border-white/20 overflow-hidden hover:opacity-80 transition-opacity flex items-center justify-center bg-white/10"
                title="Account Settings"
              >
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              </button>

              {/* Account Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-8 z-50 w-56 bg-white rounded-[18px] border border-apple-hairline product-shadow p-2 text-apple-ink animate-in fade-in duration-100">
                    <div className="px-3 py-2 border-b border-apple-hairline">
                      <div className="text-[13px] font-semibold font-display truncate">
                        {user.name}
                      </div>
                      <div className="text-[11px] font-mono text-apple-blue truncate">
                        {user.handle}
                      </div>
                      <div className="text-[10px] text-[#86868b] mt-0.5">
                        {user.tier} Tier • Rank #{user.rankPosition}
                      </div>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenEditProfile();
                        }}
                        className="btn-apple w-full px-3 py-1.5 rounded-lg text-left text-[12px] text-apple-ink hover:bg-apple-parchment flex items-center gap-2"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-apple-blue" />
                        <span>Edit Passport</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenAuth();
                        }}
                        className="btn-apple w-full px-3 py-1.5 rounded-lg text-left text-[12px] text-apple-ink hover:bg-apple-parchment flex items-center gap-2"
                      >
                        <Users className="w-3.5 h-3.5 text-apple-blue" />
                        <span>Switch Account / Sign In</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="btn-apple w-full px-3 py-1.5 rounded-lg text-left text-[12px] text-[#ff3b30] hover:bg-[#ff3b30]/10 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-Nav: Frosted Glass Bar (52px) */}
      <div className="w-full frosted-nav border-b border-apple-hairline/80 h-[52px] px-3 sm:px-8">
        <div className="max-w-[1024px] w-full mx-auto h-full flex items-center justify-between">
          {/* Category Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-[18px] sm:text-[21px] font-semibold text-apple-ink tracking-tight font-display truncate">
              {getSubNavTitle()}
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white border border-apple-hairline text-[11px] text-apple-ink-muted-80 font-normal shrink-0">
              {user.tier}
            </span>
          </div>

          {/* Persistent Action CTAs (Action Blue Pills) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={onOpenAuth}
              className="btn-apple px-2.5 sm:px-3 py-1.5 rounded-full bg-white border border-apple-hairline text-[12px] sm:text-[13px] text-apple-ink hover:bg-apple-pearl transition-colors flex items-center gap-1"
              title="Sign In / Register"
            >
              <LogIn className="w-3.5 h-3.5 text-apple-blue" />
              <span className="hidden sm:inline">Account</span>
            </button>

            <button
              onClick={onOpenBadge}
              className="btn-apple px-2.5 sm:px-3.5 py-1.5 rounded-full bg-white border border-apple-hairline text-[13px] sm:text-[14px] text-apple-ink hover:bg-apple-pearl transition-colors flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-apple-blue" />
              <span>Pass</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="btn-apple px-3 sm:px-4 py-1.5 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[13px] sm:text-[14px] font-normal transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Scan className="w-3.5 h-3.5 text-white" />
              <span>Scan</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
