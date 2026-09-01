import React from 'react';
import { HackerTier } from '../../types';
import { Sparkles, Trophy } from 'lucide-react';

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
        return 'text-[#ff9500]';
      case 'Veteran':
        return 'text-apple-blue';
      case 'Builder':
        return 'text-[#30d158]';
      default:
        return 'text-[#8e8e93]';
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between text-[14px] font-text">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#86868b]">Ecosystem Rank</span>
          <span className="px-2.5 py-0.5 rounded-full bg-white border border-apple-hairline text-[12px] font-semibold text-apple-ink flex items-center gap-1">
            <Trophy className="w-3 h-3 text-[#ff9500]" />
            #{rankPosition}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`font-semibold ${getTierColor(tier)}`}>
            {tier} Tier
          </span>
          <span className="text-[13px] text-[#86868b]">
            ({currentXp.toLocaleString()} / {nextTierXp.toLocaleString()} XP)
          </span>
        </div>
      </div>

      {/* Pill Progress Track */}
      <div className="relative w-full h-2.5 bg-[#e5e5ea] rounded-full overflow-hidden">
        <div
          className="h-full bg-apple-blue rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Progress Footer */}
      <div className="flex items-center justify-between text-[12px] text-[#86868b] font-text">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-apple-blue" />
          <span>{(nextTierXp - currentXp).toLocaleString()} XP to Next Milestone</span>
        </span>
        <span className="font-medium text-apple-ink">{percentage}%</span>
      </div>
    </div>
  );
};
