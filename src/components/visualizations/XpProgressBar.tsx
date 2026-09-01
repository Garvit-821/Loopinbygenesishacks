import React from 'react';
import { HackerTier } from '../../types';
import { Zap, Crown, Award, ChevronRight } from 'lucide-react';

interface XpProgressBarProps {
  currentXp: number;
  nextTierXp: number;
  tier: HackerTier;
  rankPosition: number;
  className?: string;
}

export const XpProgressBar: React.FC<XpProgressBarProps> = ({
  currentXp,
  nextTierXp,
  tier,
  rankPosition,
  className = '',
}) => {
  const percentage = Math.min(100, Math.round((currentXp / nextTierXp) * 100));

  const getTierColor = (t: HackerTier): string => {
    switch (t) {
      case 'Grandmaster':
        return 'from-amber-400 via-rose-500 to-cyber-cyan';
      case 'Veteran':
        return 'from-purple-500 via-violet-400 to-cyber-cyan';
      case 'Builder':
        return 'from-cyber-cyan to-emerald-400';
      default:
        return 'from-slate-500 to-cyber-cyan';
    }
  };

  const getTierBadgeClass = (t: HackerTier): string => {
    switch (t) {
      case 'Grandmaster':
        return 'text-amber-300 border-amber-500/40 bg-amber-950/30';
      case 'Veteran':
        return 'text-purple-300 border-purple-500/40 bg-purple-950/30';
      case 'Builder':
        return 'text-cyan-300 border-cyan-500/40 bg-cyan-950/30';
      default:
        return 'text-slate-300 border-slate-700 bg-slate-900';
    }
  };

  const getNextTierName = (t: HackerTier): string => {
    switch (t) {
      case 'Explorer': return 'Builder';
      case 'Builder': return 'Veteran';
      case 'Veteran': return 'Grandmaster';
      case 'Grandmaster': return 'Ecosystem Legend';
    }
  };

  return (
    <div className={`w-full bg-cyber-surface/60 border border-cyber-border rounded-xl p-4 backdrop-blur-sm ${className}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-slate-200">
              REPUTATION XP TRAJECTORY
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Global Rank <span className="text-cyber-cyan font-bold">#{rankPosition}</span> / 4,820 Active Hackers
            </div>
          </div>
        </div>

        <div className={`px-2.5 py-1 rounded-md border text-xs font-mono font-bold flex items-center gap-1.5 ${getTierBadgeClass(tier)}`}>
          {tier === 'Grandmaster' ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Award className="w-3.5 h-3.5 text-cyber-cyan" />}
          <span>{tier}</span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative w-full h-3.5 bg-slate-900/90 rounded-full border border-cyber-border overflow-hidden p-0.5 shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getTierColor(tier)} transition-all duration-700 ease-out shadow-[0_0_12px_rgba(0,240,255,0.6)]`}
          style={{ width: `${percentage}%` }}
        />
        {/* Animated Scanline Shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-sheen pointer-events-none" />
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between mt-2.5 text-xs font-mono">
        <div className="text-slate-300 font-semibold">
          <span className="text-cyber-cyan font-bold">{currentXp.toLocaleString()}</span>
          <span className="text-slate-500"> / {nextTierXp.toLocaleString()} XP</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>Target: {getNextTierName(tier)}</span>
          <ChevronRight className="w-3.5 h-3.5 text-cyber-cyan" />
          <span className="text-cyber-cyan font-bold">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};
