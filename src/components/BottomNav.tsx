import React from 'react';
import { TabType } from '../types';
import { Shield, Users, Radio, Scan } from 'lucide-react';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenScanner: () => void;
  connectionsCount: number;
  hasUrgentAlert?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenScanner,
  connectionsCount,
  hasUrgentAlert = true,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-5 pt-2 pointer-events-none md:hidden">
      <nav className="max-w-sm mx-auto h-[60px] rounded-full frosted-nav border border-black/10 shadow-lg px-6 flex items-center justify-between pointer-events-auto relative">
        {/* Tab 1: Passport */}
        <button
          onClick={() => onSelectTab('passport')}
          className={`btn-apple flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'passport' ? 'text-apple-blue font-medium' : 'text-[#86868b] hover:text-apple-ink'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="text-[11px] tracking-tight">Passport</span>
        </button>

        {/* Center: Primary Scan Pill */}
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenScanner}
            className="btn-apple w-11 h-11 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white flex items-center justify-center shadow-md shadow-apple-blue/30 active:scale-95 transition-all"
            title="Scan Badge"
          >
            <Scan className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tab 2: Connections */}
        <button
          onClick={() => onSelectTab('connections')}
          className={`btn-apple flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
            activeTab === 'connections' ? 'text-apple-blue font-medium' : 'text-[#86868b] hover:text-apple-ink'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {connectionsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-apple-blue text-white text-[9px] font-semibold rounded-full">
                {connectionsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] tracking-tight">Network</span>
        </button>

        {/* Tab 3: Feed */}
        <button
          onClick={() => onSelectTab('feed')}
          className={`btn-apple flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
            activeTab === 'feed' ? 'text-apple-blue font-medium' : 'text-[#86868b] hover:text-apple-ink'
          }`}
        >
          <div className="relative">
            <Radio className="w-5 h-5" />
            {hasUrgentAlert && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#ff3b30] rounded-full" />
            )}
          </div>
          <span className="text-[11px] tracking-tight">Live Ops</span>
        </button>
      </nav>
    </div>
  );
};
