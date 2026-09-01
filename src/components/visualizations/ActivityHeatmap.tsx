import React, { useState, useMemo } from 'react';
import { ActivityNode } from '../../types';
import { Flame, Calendar, GitCommit } from 'lucide-react';

interface ActivityHeatmapProps {
  activity: ActivityNode[];
  className?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  activity,
  className = '',
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    eventId?: string;
    x: number;
    y: number;
  } | null>(null);

  // Generate 52 weeks x 7 days dataset
  const { weeks, totalContributions, maxStreak, activeDays } = useMemo(() => {
    // Map activity by date
    const activityMap = new Map<string, { count: number; eventId?: string }>();
    activity.forEach(a => activityMap.set(a.date, { count: a.count, eventId: a.eventId }));

    const today = new Date();
    // 52 weeks * 7 days = 364 days ago
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (52 * 7 - 1));

    const generatedWeeks: Array<Array<{ date: string; count: number; eventId?: string; dayOfWeek: number }>> = [];
    let currentWeek: Array<{ date: string; count: number; eventId?: string; dayOfWeek: number }> = [];

    let total = 0;
    let streak = 0;
    let currentStreak = 0;
    let active = 0;

    for (let i = 0; i < 52 * 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const match = activityMap.get(dateStr);
      const count = match ? match.count : 0;
      const eventId = match?.eventId;

      total += count;
      if (count > 0) {
        active++;
        currentStreak++;
        if (currentStreak > streak) streak = currentStreak;
      } else {
        currentStreak = 0;
      }

      currentWeek.push({
        date: dateStr,
        count,
        eventId,
        dayOfWeek: d.getDay(),
      });

      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      generatedWeeks.push(currentWeek);
    }

    return {
      weeks: generatedWeeks,
      totalContributions: total,
      maxStreak: streak,
      activeDays: active,
    };
  }, [activity]);

  // Color intensity mapper
  const getCellColor = (count: number): string => {
    if (count === 0) return 'bg-slate-900 border-slate-800/80 hover:border-slate-600';
    if (count <= 3) return 'bg-emerald-950/80 border-emerald-800/60 hover:border-emerald-500';
    if (count <= 7) return 'bg-emerald-700/90 border-emerald-600 hover:border-emerald-300';
    if (count <= 12) return 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
    return 'bg-cyber-cyan border-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.7)]';
  };

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className={`w-full bg-cyber-surface/70 border border-cyber-border rounded-xl p-4 backdrop-blur-sm ${className}`}>
      {/* Header Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-cyber-border/70">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyber-cyan" />
            <h4 className="text-sm font-semibold tracking-wide text-slate-100 font-display">
              HACKATHON SPRINT VELOCITY MATRIX
            </h4>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            52-week verified commit & submission cadence
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1 text-slate-300">
            <GitCommit className="w-3.5 h-3.5 text-cyber-cyan" />
            <span className="font-bold text-white">{totalContributions.toLocaleString()}</span> commits
          </div>
          <div className="flex items-center gap-1 text-amber-400">
            <Flame className="w-3.5 h-3.5" />
            <span className="font-bold">{maxStreak}d</span> sprint streak
          </div>
        </div>
      </div>

      {/* Responsive Grid Container */}
      <div className="relative overflow-x-auto no-scrollbar pb-1">
        {/* Month Markers */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1 px-5 min-w-[640px]">
          {monthLabels.map((m, idx) => (
            <span key={`month-${idx}`}>{m}</span>
          ))}
        </div>

        <div className="flex gap-1 min-w-[640px]">
          {/* Day of Week Labels */}
          <div className="flex flex-col justify-between text-[9px] font-mono text-slate-500 pr-2 py-0.5 select-none">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
            <span>Sun</span>
          </div>

          {/* 52 Columns */}
          <div className="flex gap-[3px] flex-1">
            {weeks.map((week, weekIdx) => (
              <div key={`week-${weekIdx}`} className="flex flex-col gap-[3px]">
                {week.map((day, dayIdx) => (
                  <div
                    key={`day-${weekIdx}-${dayIdx}`}
                    className={`w-[10px] h-[10px] rounded-[2px] border transition-all duration-150 cursor-pointer ${getCellColor(
                      day.count
                    )}`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredCell({
                        date: day.date,
                        count: day.count,
                        eventId: day.eventId,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                    onTouchStart={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredCell({
                        date: day.date,
                        count: day.count,
                        eventId: day.eventId,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-slate-400">
          <span>{activeDays} active hack days recorded</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Less</span>
            <div className="w-2.5 h-2.5 rounded-[2px] bg-slate-900 border border-slate-800" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-950 border border-emerald-800" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700 border border-emerald-600" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-cyber-cyan shadow-[0_0_6px_#00f0ff]" />
            <span className="text-[10px] text-slate-500">More</span>
          </div>
        </div>
      </div>

      {/* Floating Inspection Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 px-3 py-1.5 bg-cyber-surface/95 border border-cyber-cyan/60 rounded-md shadow-neon-cyan backdrop-blur-md text-xs font-mono animate-in fade-in zoom-in-95"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 8}px`,
          }}
        >
          <div className="text-slate-200 font-semibold">{hoveredCell.date}</div>
          <div className="text-cyber-cyan font-bold">
            {hoveredCell.count === 0 ? 'No commits' : `${hoveredCell.count} verified commits`}
          </div>
          {hoveredCell.eventId && (
            <div className="text-emerald-400 text-[10px] mt-0.5 font-sans">
              🏆 {hoveredCell.eventId}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
