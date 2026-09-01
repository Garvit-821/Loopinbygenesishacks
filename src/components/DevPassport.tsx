import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { RadarChart } from './visualizations/RadarChart';
import { ActivityHeatmap } from './visualizations/ActivityHeatmap';
import { XpProgressBar } from './visualizations/XpProgressBar';
import { BadgeModal } from './BadgeModal';
import {
  QrCode,
  ShieldCheck,
  Award,
  Crown,
  Trophy,
  Github,
  Linkedin,
  GitBranch,
  MapPin,
  Calendar,
  CheckCircle2,
  Sparkles,
  Layers,
  MessageSquareQuote,
  Share2,
  Lock,
} from 'lucide-react';

interface DevPassportProps {
  user: UserProfile;
  onOpenScanner: () => void;
}

export const DevPassport: React.FC<DevPassportProps> = ({ user, onOpenScanner }) => {
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);

  // 3D Card Tilt state
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [glarePos, setGlarePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 8;
    const rotY = ((x - centerX) / centerX) * 8;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
    });
  };

  const handleMouseLeave = (): void => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos({ x: 50, y: 50 });
  };

  const getRankBadge = (rank: string) => {
    switch (rank) {
      case '1st':
        return {
          label: '1st Place',
          color: 'text-amber-300 border-amber-500/50 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
          icon: <Crown className="w-4 h-4 text-amber-400" />,
        };
      case '2nd':
        return {
          label: '2nd Place',
          color: 'text-slate-200 border-slate-400/50 bg-slate-800/40 shadow-[0_0_12px_rgba(203,213,225,0.3)]',
          icon: <Trophy className="w-4 h-4 text-slate-300" />,
        };
      case '3rd':
        return {
          label: '3rd Place',
          color: 'text-amber-600 border-amber-700/50 bg-amber-950/30',
          icon: <Trophy className="w-4 h-4 text-amber-600" />,
        };
      default:
        return {
          label: rank,
          color: 'text-purple-300 border-purple-500/50 bg-purple-950/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]',
          icon: <Sparkles className="w-4 h-4 text-purple-400" />,
        };
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* 3D Holographic Passport Card */}
      <div className="perspective-1000">
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transition: 'transform 0.15s ease-out',
          }}
          className="relative w-full rounded-2xl bg-gradient-to-br from-cyber-surface via-cyber-elevated to-cyber-bg border border-cyber-cyan/40 p-6 shadow-hologram overflow-hidden preserve-3d"
        >
          {/* Dynamic Glare & Hologram Sheen */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(0, 240, 255, 0.25) 0%, rgba(168, 85, 247, 0.15) 35%, transparent 70%)`,
            }}
          />
          
          {/* Top Telemetry Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-mono text-xs text-cyber-cyan font-bold tracking-wider">
                GENESIS DEV PASSPORT // VERIFIED ID
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/40 text-[11px] font-mono text-cyber-cyan font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DPDP ACT COMPLIANT</span>
            </div>
          </div>

          {/* User Bio & Avatar Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 my-2">
            <div className="relative">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-cyber-cyan shadow-neon-cyan"
              />
              <div className="absolute -bottom-2 -right-2 p-1 rounded-lg bg-cyber-bg border border-cyber-cyan text-cyber-cyan shadow-md">
                <Crown className="w-4 h-4 text-amber-400" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
                  {user.name}
                </h1>
                <span className="font-mono text-xs text-cyber-cyan font-semibold">
                  {user.handle}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold uppercase">
                  {user.tier}
                </span>
              </div>

              <div className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                {user.primaryRole}
              </div>

              <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                {user.bio}
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-3 mt-3 text-slate-400">
                {user.githubUsername && (
                  <a
                    href={`https://github.com/${user.githubUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-mono hover:text-cyber-cyan transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>{user.githubUsername}</span>
                  </a>
                )}
                {user.linkedinUrl && (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-mono hover:text-cyber-cyan transition-colors"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-cyber-border/80">
            <button
              onClick={() => setIsBadgeModalOpen(true)}
              className="py-2.5 px-3 rounded-xl bg-cyber-cyan/15 border border-cyber-cyan hover:bg-cyber-cyan/25 text-xs font-mono font-bold text-cyber-cyan flex items-center justify-center gap-2 transition-all active:scale-95 shadow-neon-cyan"
            >
              <QrCode className="w-4 h-4" />
              <span>SHOW QR BADGE</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="py-2.5 px-3 rounded-xl bg-cyber-purple/20 border border-cyber-purple hover:bg-cyber-purple/30 text-xs font-mono font-bold text-purple-300 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-neon-purple"
            >
              <Sparkles className="w-4 h-4" />
              <span>SCAN ATTENDEE</span>
            </button>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${user.name} // Loopin Dev Passport`,
                    text: `Check out ${user.name}'s verified hackathon portfolio and skill graph on Loopin by Genesis Hacks!`,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  setIsBadgeModalOpen(true);
                }
              }}
              className="col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl bg-cyber-elevated border border-cyber-border hover:border-slate-500 text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>SHARE PASSPORT</span>
            </button>
          </div>
        </div>
      </div>

      {/* XP Level & Trajectory Curve */}
      <XpProgressBar
        currentXp={user.xpPoints}
        nextTierXp={user.nextTierXp}
        tier={user.tier}
        rankPosition={user.rankPosition}
      />

      {/* Skill Radar & Competency Telemetry */}
      <div className="w-full bg-cyber-surface/70 border border-cyber-border rounded-xl p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white font-display tracking-wide">
                MULTI-AXIS SKILL GRAPH & TELEMETRY
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Cryptographically verified by commit diffs & judge scoring rubrics
            </p>
          </div>

          <div className="text-xs font-mono text-cyber-cyan font-bold">
            6 Core Vectors
          </div>
        </div>

        <RadarChart skills={user.radarSkills} size={330} className="my-2" />
      </div>

      {/* Activity Heatmap Grid */}
      <ActivityHeatmap activity={user.activityMatrix} />

      {/* Trophy Shelf & Podium Wins */}
      <div className="w-full bg-cyber-surface/70 border border-cyber-border rounded-xl p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-display tracking-wide">
              ORGANIZER-VERIFIED TROPHY SHELF
            </h3>
          </div>
          <span className="text-xs font-mono text-amber-400 font-bold">
            {user.trophies.length} Podiums
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {user.trophies.map((trophy) => {
            const badge = getRankBadge(trophy.rank);
            return (
              <div
                key={trophy.id}
                className="p-4 rounded-xl bg-cyber-elevated/70 border border-cyber-border hover:border-amber-400/40 transition-all flex items-start gap-3.5 group"
              >
                <div className="p-2.5 rounded-lg bg-black/50 border border-cyber-border group-hover:border-amber-400/50 transition-colors shrink-0">
                  {badge.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-white truncate font-display">
                      {trophy.eventName}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-xs text-cyber-cyan font-mono mt-1 truncate">
                    {trophy.trackName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Season {trophy.year} • Official Jury Stamped
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Travel Log: Visa Stamps */}
      <div className="w-full bg-cyber-surface/70 border border-cyber-border rounded-xl p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-cyber-cyan" />
            <h3 className="text-sm font-bold text-white font-display tracking-wide">
              IMMUTABLE DEV VISA STAMPS
            </h3>
          </div>
          <span className="text-xs font-mono text-cyber-cyan font-bold">
            {user.stamps.length} Stamps
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {user.stamps.map((stamp) => (
            <div
              key={stamp.id}
              className="relative p-4 rounded-xl bg-cyber-elevated/70 border border-cyber-border hover:border-cyber-cyan/50 transition-all overflow-hidden group"
            >
              {/* Subtle background stamp watermark */}
              <div className="absolute right-2 -bottom-2 opacity-10 pointer-events-none text-6xl font-bold font-mono text-cyber-cyan rotate-12 select-none">
                STAMP
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white font-display">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{stamp.eventName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {stamp.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {stamp.location}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan">
                  {stamp.roleTag}
                </span>
              </div>

              {/* Cryptographic Signature Hash */}
              <div className="mt-3 pt-2.5 border-t border-cyber-border/70 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span className="truncate max-w-[180px]">Signed: {stamp.organizerSignature}</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  VERIFIED
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Peer Vouches & Teammate Reviews */}
      <div className="w-full bg-cyber-surface/70 border border-cyber-border rounded-xl p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white font-display tracking-wide">
              VERIFIED TEAMMATE PEER VOUCHES
            </h3>
          </div>
          <span className="text-xs font-mono text-purple-400 font-bold">
            {user.vouches.length} Vouches
          </span>
        </div>

        <div className="space-y-3">
          {user.vouches.map((vouch) => (
            <div
              key={vouch.id}
              className="p-4 rounded-xl bg-cyber-elevated/70 border border-cyber-border space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={vouch.voucherAvatarUrl}
                    alt={vouch.voucherName}
                    className="w-8 h-8 rounded-full object-cover border border-purple-400"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">{vouch.voucherName}</div>
                    <div className="text-[11px] font-mono text-purple-400">{vouch.voucherHandle}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/40 border border-purple-500/30 text-purple-300">
                  {vouch.verifiedAt}
                </span>
              </div>

              <div className="text-xs font-mono text-cyber-cyan font-semibold flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                <span>Vouched Module: {vouch.moduleName}</span>
              </div>

              <p className="text-xs text-slate-300 italic font-sans leading-relaxed">
                "{vouch.comment}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic QR Badge Modal */}
      <BadgeModal
        user={user}
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
      />
    </div>
  );
};
