import React, { useState, useEffect, useRef } from 'react';
import { SkillVector } from '../../types';
import { ShieldCheck, GitCommit } from 'lucide-react';

interface RadarChartProps {
  skills: SkillVector[];
  size?: number;
  className?: string;
  showLabels?: boolean;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  skills,
  size = 320,
  className = '',
  showLabels = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [responsiveSize, setResponsiveSize] = useState<number>(size);
  const [activeSkill, setActiveSkill] = useState<SkillVector | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.parentElement?.clientWidth || window.innerWidth;
        const targetSize = Math.min(size, Math.max(260, parentWidth - 48));
        setResponsiveSize(targetSize);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size]);

  const currentSize = responsiveSize;
  const center = currentSize / 2;
  const radius = currentSize * 0.34;
  const numAxes = skills.length;

  const getCoordinates = (index: number, valueRatio: number, offsetRadius = radius): { x: number; y: number } => {
    const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
    const x = center + offsetRadius * valueRatio * Math.cos(angle);
    const y = center + offsetRadius * valueRatio * Math.sin(angle);
    return { x, y };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

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
    <div ref={containerRef} className={`relative flex flex-col items-center justify-center max-w-full overflow-visible ${className}`}>
      <div className="relative" style={{ width: currentSize, height: currentSize }}>
        <svg
          viewBox={`0 0 ${currentSize} ${currentSize}`}
          width={currentSize}
          height={currentSize}
          className="overflow-visible"
        >
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
                  fill={levelIdx === 0 ? 'rgba(0,0,0,0.015)' : 'none'}
                  stroke={level === 1.0 ? '#d2d2d7' : '#e5e5ea'}
                  strokeWidth="1"
                  strokeDasharray={level === 1.0 ? 'none' : '2 2'}
                />
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
                stroke="#e5e5ea"
                strokeWidth="1"
              />
            );
          })}

          {/* Core Data Polygon (Action Blue #0066cc) */}
          <path
            d={polygonPath}
            fill="rgba(0, 102, 204, 0.12)"
            stroke="#0066cc"
            strokeWidth="2"
            className="transition-all duration-300 ease-out"
          />

          {/* Center Point */}
          <circle cx={center} cy={center} r="2.5" fill="#0066cc" />

          {/* Interactive Corner Nodes */}
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
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#ffffff"
                  stroke="#0066cc"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}

          {/* Axis Labels (SF Pro Display & Text) */}
          {showLabels && skills.map((skill, i) => {
            const labelRadius = radius + 22;
            const { x, y } = getCoordinates(i, 1.0, labelRadius);
            const isLeft = x < center - 10;
            const isRight = x > center + 10;

            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
            if (isLeft) textAnchor = 'end';
            if (isRight) textAnchor = 'start';

            const isHovered = activeSkill?.category === skill.category;

            return (
              <g key={`label-${i}`} className="select-none">
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  fill={isHovered ? '#0066cc' : '#1d1d1f'}
                  fontSize={currentSize < 300 ? '9.5' : '11'}
                  fontWeight="600"
                  fontFamily="SF Pro Display, -apple-system, sans-serif"
                  letterSpacing="-0.01em"
                  className="transition-colors duration-150"
                >
                  {skill.category}
                </text>
                <text
                  x={x}
                  y={y + (currentSize < 300 ? 10 : 12)}
                  textAnchor={textAnchor}
                  fill="#86868b"
                  fontSize={currentSize < 300 ? '8.5' : '10'}
                  fontFamily="SF Pro Text, -apple-system, sans-serif"
                >
                  {skill.score}/{skill.maxScore}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Apple Tooltip Bubble */}
        {activeSkill && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3.5 py-2 bg-white border border-apple-hairline rounded-xl shadow-lg animate-in fade-in duration-100"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 8}px` }}
          >
            <div className="text-[13px] font-semibold text-apple-ink">
              {activeSkill.category}
            </div>
            <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-apple-ink-muted-80 font-text">
              <span className="text-apple-blue font-medium">
                {activeSkill.score} / {activeSkill.maxScore} pts
              </span>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-[#30d158]">
                <GitCommit className="w-3 h-3" />
                {activeSkill.verifiedCommits} commits
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Verified Footer Chip */}
      <div className="flex items-center gap-1.5 mt-3 px-3 py-1 bg-white border border-apple-hairline rounded-full text-[11px] sm:text-[12px] text-apple-ink-muted-80 font-text max-w-[90%] text-center">
        <ShieldCheck className="w-3.5 h-3.5 text-apple-blue shrink-0" />
        <span className="truncate">Verified by GitHub PR diffs & jury rubrics</span>
      </div>
    </div>
  );
};
