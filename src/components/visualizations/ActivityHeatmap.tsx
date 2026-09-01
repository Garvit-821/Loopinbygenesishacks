import React, { useState } from 'react';
import { ActivityNode } from '../../types';
import { Flame, Calendar, Award } from 'lucide-react';

interface ActivityHeatmapProps {
  activityMatrix: ActivityNode[];
  className?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  activityMatrix,
  className = '',
}) => {
  const [hoveredNode, setHoveredNode] = useState<ActivityNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Group 364/365 nodes into 52 columns of 7 days (Sunday - Saturday)
  const columns: ActivityNode[][] = [];
  const chunkSize = 7;
  for (let i = 0; i < activityMatrix.length; i += chunkSize) {
    columns.push(activityMatrix.slice(i, i + chunkSize));
  }

  // Apple-toned intensity levels
  const getColorForCount = (count: number, hasEvent?: boolean): string => {
    if (hasEvent) return '#0066cc'; // Signature Action Blue for hackathon sprints
    if (count === 0) return '#e5e5ea'; // Apple subtle gray cell
    if (count <= 2) return '#c7c7cc';
    if (count <= 5) return '#8e8e93';
    if (count <= 9) return '#48484a';
    return '#1d1d1f'; // Apple ink for high-intensity commit days
  };

  const totalCommits = activityMatrix.reduce((acc, curr) => acc + curr.count, 0);
  const hackathonsFound = activityMatrix.filter((n) => n.eventId).length;

  const handleCellHover = (node: ActivityNode, e: React.MouseEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredNode(node);
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metrics Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[14px] font-text">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[28px] font-semibold text-apple-ink font-display tracking-tight">
              {totalCommits.toLocaleString()}
            </span>
            <span className="text-[13px] text-[#86868b] ml-1.5 font-normal">commits in 2026</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white border border-apple-hairline rounded-full text-[12px] text-apple-ink">
            <Flame className="w-3.5 h-3.5 text-apple-blue" />
            <span className="font-semibold text-apple-blue">{hackathonsFound}</span>
            <span className="text-apple-ink-muted-80">Hackathon Sprints</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#e5e5ea]" />
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#c7c7cc]" />
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#8e8e93]" />
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#1d1d1f]" />
          <div className="w-2.5 h-2.5 rounded-[3px] bg-apple-blue" />
          <span>More / Event</span>
        </div>
      </div>

      {/* 52-Week Matrix Grid */}
      <div className="overflow-x-auto pb-2 no-scrollbar">
        <div className="flex gap-[3px] min-w-[720px]">
          {columns.map((col, colIdx) => (
            <div key={`col-${colIdx}`} className="flex flex-col gap-[3px]">
              {col.map((node, dayIdx) => {
                const isHovered = hoveredNode?.date === node.date;
                const cellBg = getColorForCount(node.count, Boolean(node.eventId));

                return (
                  <div
                    key={`node-${colIdx}-${dayIdx}`}
                    onMouseEnter={(e) => handleCellHover(node, e)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="w-[11px] h-[11px] rounded-[2.5px] cursor-pointer transition-transform duration-100 hover:scale-125 hover:z-10"
                    style={{
                      backgroundColor: cellBg,
                      outline: isHovered ? '1.5px solid #0066cc' : 'none',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Floating Tooltip */}
      {hoveredNode && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-1.5 bg-white border border-apple-hairline rounded-xl shadow-lg text-[12px] font-text animate-in fade-in duration-100"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="font-semibold text-apple-ink">
            {hoveredNode.count} contributions
          </div>
          <div className="text-[11px] text-[#86868b] flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{hoveredNode.date}</span>
          </div>
          {hoveredNode.eventId && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-apple-blue font-medium">
              <Award className="w-3 h-3" />
              <span>{hoveredNode.eventId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
