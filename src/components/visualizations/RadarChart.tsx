import React, { useState } from 'react';
import { SkillVector } from '../../types';
import { ShieldCheck, GitCommit, Sparkles } from 'lucide-react';

interface RadarChartProps {
  skills: SkillVector[];
  size?: number;
  className?: string;
  showLabels?: boolean;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  skills,
  size = 340,
  className = '',
  showLabels = true,
}) => {
  const [activeSkill, setActiveSkill] = useState<SkillVector | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const center = size / 2;
  const radius = size * 0.36;
  const numAxes = skills.length;

  // Calculate coordinates on a polygon for a specific axis and value (0..1)
  const getCoordinates = (index: number, valueRatio: number, offsetRadius = radius): { x: number; y: number } => {
    // Start from top (-90 degrees)
    const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
    const x = center + offsetRadius * valueRatio * Math.cos(angle);
    const y = center + offsetRadius * valueRatio * Math.sin(angle);
    return { x, y };
  };

  // Concentric grid levels (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Polygon path for data points
  const dataPoints = skills.map((skill, i) => {
    const ratio = Math.min(1, Math.max(0.1, skill.score / skill.maxScore));
    return getCoordinates(i, ratio);
  });

  const polygonPath = dataPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`).join(' ') + ' Z';

  const handleNodeInteraction = (skill: SkillVector, coords: { x: number; y: number }): void => {
    setActiveSkill(skill);
    setTooltipPos(coords);
  };

  const handleMouseLeave = (): void => {
    setActiveSkill(null);
    setTooltipPos(null);
  };

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="overflow-visible"
        >
          <defs>
            {/* Cyberpunk Gradient for skill polygon */}
            <linearGradient id="radarAreaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.38" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.30" />
            </linearGradient>

            {/* Glowing neon stroke filter */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="axisLineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Background Concentric Polygon Grids */}
          {gridLevels.map((level, levelIdx) => {
            const levelPoints = skills.map((_, i) => {
              const { x, y } = getCoordinates(i, level);
              return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
            }).join(' ') + ' Z';

            return (
              <g key={`grid-level-${levelIdx}`}>
                <path
                  d={levelPoints}
                  fill={levelIdx === gridLevels.length - 1 ? 'rgba(15, 23, 42, 0.4)' : 'none'}
                  stroke={level === 1.0 ? 'rgba(0, 240, 255, 0.28)' : 'rgba(51, 65, 85, 0.35)'}
                  strokeWidth={level === 1.0 ? '1.5' : '1'}
                  strokeDasharray={level === 1.0 ? 'none' : '3 3'}
                  className="transition-all duration-300"
                />
                {/* Level Percentage Tag */}
                <text
                  x={center + 4}
                  y={center - radius * level + 10}
                  fill="rgba(148, 163, 184, 0.45)"
                  fontSize="9"
                  fontFamily="monospace"
                  className="select-none"
                >
                  {Math.round(level * 100)}%
                </text>
              </g>
            );
          })}

          {/* Radial Axis Lines */}
          {skills.map((_, i) => {
            const { x, y } = getCoordinates(i, 1.0);
            return (
              <line
                key={`axis-line-${i}`}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="rgba(30, 41, 59, 0.8)"
                strokeWidth="1.2"
              />
            );
          })}

          {/* Core Data Polygon with Glow */}
          <path
            d={polygonPath}
            fill="url(#radarAreaGradient)"
            stroke="#00f0ff"
            strokeWidth="2.5"
            filter="url(#neonGlow)"
            className="transition-all duration-500 ease-out"
          />

          {/* Center Point Indicator */}
          <circle cx={center} cy={center} r="3" fill="#00f0ff" className="animate-pulse" />

          {/* Corner Interactive Nodes */}
          {skills.map((skill, i) => {
            const pt = dataPoints[i];
            const isHovered = activeSkill?.category === skill.category;

            return (
              <g
                key={`node-${i}`}
                className="cursor-pointer"
                onMouseEnter={() => handleNodeInteraction(skill, pt)}
                onMouseLeave={handleMouseLeave}
                onTouchStart={() => handleNodeInteraction(skill, pt)}
              >
                {/* Outer halo */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 8 : 5}
                  fill={isHovered ? '#00f0ff' : '#0d131f'}
                  stroke={isHovered ? '#ffffff' : '#00f0ff'}
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
                {/* Inner dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 4 : 2}
                  fill={isHovered ? '#080b11' : '#a855f7'}
                />
              </g>
            );
          })}

          {/* Axis Category Labels */}
          {showLabels && skills.map((skill, i) => {
            const labelRadius = radius + 28;
            const { x, y } = getCoordinates(i, 1.0, labelRadius);
            const isTop = y < center - 10;
            const isBottom = y > center + 10;
            const isLeft = x < center - 10;
            const isRight = x > center + 10;

            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
            if (isLeft && !isTop && !isBottom) textAnchor = 'end';
            if (isRight && !isTop && !isBottom) textAnchor = 'start';

            const isHovered = activeSkill?.category === skill.category;

            return (
              <g key={`label-${i}`} className="select-none">
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  fill={isHovered ? '#00f0ff' : '#94a3b8'}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="Space Grotesk, sans-serif"
                  className="transition-colors duration-200"
                >
                  {skill.category}
                </text>
                <text
                  x={x}
                  y={y + 11}
                  textAnchor={textAnchor}
                  fill="#00f0ff"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {skill.score} / {skill.maxScore}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {activeSkill && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 bg-cyber-elevated/95 border border-cyber-cyan/50 rounded-lg shadow-neon-cyan backdrop-blur-md transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 12}px` }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>{activeSkill.category}</span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1 text-[11px] font-mono text-slate-300">
              <span className="text-cyber-cyan font-bold">
                {activeSkill.score} <span className="text-slate-500">/ {activeSkill.maxScore} pts</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <GitCommit className="w-3 h-3" />
                {activeSkill.verifiedCommits} commits
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer verified badge */}
      <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-cyber-surface/60 border border-cyber-border rounded-full text-[11px] font-mono text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-cyber-cyan" />
        <span>Telemetry verified by GitHub PRs & Organizer Judges</span>
      </div>
    </div>
  );
};
