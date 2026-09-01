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
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 pointer-events-none">
      <nav className="max-w-md mx-auto h-16 rounded-2xl bg-cyber-surface/90 border border-cyber-border/90 backdrop-blur-2xl px-4 flex items-center justify-between shadow-2xl pointer-events-auto relative">
        {/* Tab 1: Dev Passport */}
        <button
          onClick={() => onSelectTab('passport')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'passport'
              ? 'text-cyber-cyan font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Shield className="w-5 h-5" />
            {activeTab === 'passport' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-cyber-cyan rounded-full shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight">Passport</span>
        </button>

        {/* Center: Elevated Scan Trigger */}
        <div className="flex-1 flex items-center justify-center relative">
          <button
            onClick={onOpenScanner}
            className="absolute -top-7 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyber-cyan via-cyber-violet to-cyber-purple p-[2px] shadow-neon-cyan active:scale-95 transition-all group"
            title="Launch Sub-400ms QR Scanner"
          >
            <div className="w-full h-full bg-cyber-bg rounded-[14px] flex flex-col items-center justify-center group-hover:bg-cyber-surface transition-colors">
              <Scan className="w-6 h-6 text-cyber-cyan group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-mono font-bold text-cyber-cyan uppercase tracking-tighter">
                SCAN
              </span>
            </div>
          </button>
        </div>

        {/* Tab 2: Connections */}
        <button
          onClick={() => onSelectTab('connections')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'connections'
              ? 'text-cyber-cyan font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {connectionsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 bg-cyber-cyan text-black font-mono text-[9px] font-bold rounded-full">
                {connectionsCount}
              </span>
            )}
            {activeTab === 'connections' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-cyber-cyan rounded-full shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight">Network</span>
        </button>

        {/* Tab 3: Live Ops Feed */}
        <button
          onClick={() => onSelectTab('feed')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'feed'
              ? 'text-cyber-cyan font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Radio className="w-5 h-5" />
            {hasUrgentAlert && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
            {activeTab === 'feed' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-cyber-cyan rounded-full shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight">Live Ops</span>
        </button>
      </nav>
    </div>
  );
};
