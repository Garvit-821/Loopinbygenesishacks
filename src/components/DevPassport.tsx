import React, { useState } from 'react';
import { UserProfile } from '../types';
import { RadarChart } from './visualizations/RadarChart';
import { ActivityHeatmap } from './visualizations/ActivityHeatmap';
import { XpProgressBar } from './visualizations/XpProgressBar';
import {
  ShieldCheck,
  QrCode,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
  Award,
  CheckCircle2,
  Lock,
  MessageSquare,
  Copy,
  Check,
  Sparkles,
  Edit3,
} from 'lucide-react';

interface DevPassportProps {
  user: UserProfile;
  onOpenBadge: () => void;
  onOpenScanner: () => void;
  onOpenEditProfile: () => void;
}

export const DevPassport: React.FC<DevPassportProps> = ({
  user,
  onOpenBadge,
  onOpenScanner,
  onOpenEditProfile,
}) => {
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [activeTabSection, setActiveTabSection] = useState<'skills' | 'stamps' | 'trophies' | 'vouches'>('skills');

  const handleCopyHash = (): void => {
    navigator.clipboard.writeText(user.badgeHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="w-full flex flex-col">
      {/* ========================================================================= */}
      {/* TILE 1: LIGHT HERO CANVAS (White #ffffff) */}
      {/* ========================================================================= */}
      <section className="w-full bg-apple-canvas py-10 sm:py-20 px-3 sm:px-8 border-b border-apple-hairline">
        <div className="max-w-[980px] mx-auto flex flex-col items-center text-center">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-apple-parchment border border-apple-hairline text-[11px] sm:text-[12px] text-apple-ink font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-apple-blue" />
            <span>Immutable Developer Passport</span>
          </div>

          {/* Hero Headline (SF Pro Display 600 with negative tracking) */}
          <h1 className="text-[28px] sm:text-[40px] md:text-[52px] font-semibold text-apple-ink tracking-tight leading-[1.08] font-display max-w-2xl px-2">
            {user.name}
          </h1>

          {/* Lead Subtitle (SF Pro Text 17px) */}
          <p className="text-[15px] sm:text-[18px] md:text-[21px] text-apple-ink-muted-80 font-normal mt-2 max-w-xl leading-snug px-4">
            {user.primaryRole}
          </p>

          <div className="flex items-center gap-2 mt-2 text-[13px] text-[#86868b] font-mono">
            <span>{user.handle}</span>
            <span>•</span>
            <span className="text-apple-blue font-semibold">{user.tier} Rank #{user.rankPosition}</span>
          </div>

          {/* CTAs: Action Blue Pill + Secondary Ghost Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-6">
            <button
              onClick={onOpenBadge}
              className="btn-apple px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[15px] sm:text-[17px] font-normal transition-all flex items-center gap-2 shadow-sm"
            >
              <QrCode className="w-4 h-4 text-white" />
              <span>Show Verified Pass</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="btn-apple px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-apple-blue text-[15px] sm:text-[17px] font-normal border border-apple-hairline transition-all flex items-center gap-2"
            >
              <span>Scan Peer</span>
            </button>

            <button
              onClick={onOpenEditProfile}
              className="btn-apple px-4 py-2.5 sm:py-3 rounded-full bg-white hover:bg-apple-pearl text-apple-ink text-[14px] sm:text-[15px] font-normal border border-apple-hairline transition-all flex items-center gap-1.5"
              title="Edit Profile"
            >
              <Edit3 className="w-4 h-4 text-apple-blue" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* PHYSICAL PASSPORT ARTIFACT (Museum Gallery presentation with Apple Product Shadow) */}
          <div className="relative mt-10 sm:mt-12 w-full max-w-md mx-auto">
            <div className="relative bg-white rounded-[22px] border border-apple-hairline/90 p-5 sm:p-6 product-shadow overflow-hidden text-left">
              {/* Subtle top brand bar */}
              <div className="flex items-center justify-between pb-3.5 border-b border-apple-hairline">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-apple-black text-white flex items-center justify-center text-[10px] sm:text-[12px] font-bold">
                    ⚡
                  </div>
                  <span className="text-[12px] sm:text-[13px] font-semibold tracking-tight text-apple-ink">
                    GENESIS VERIFIED PASSPORT
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-[#30d158] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
                  <span>ORGANIZER SIGNED</span>
                </div>
              </div>

              {/* Passport Body */}
              <div className="flex items-start gap-3.5 sm:gap-4 mt-4 sm:mt-5">
                <div className="relative shrink-0">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-[12px] sm:rounded-[14px] object-cover border border-apple-hairline"
                  />
                  <div className="absolute -bottom-1 -right-1 p-0.5 bg-white rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-apple-blue fill-white" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[16px] sm:text-[18px] font-semibold text-apple-ink truncate font-display">
                    {user.name}
                  </div>
                  <div className="text-[12px] sm:text-[13px] text-apple-blue font-mono">{user.handle}</div>
                  <p className="text-[12px] sm:text-[13px] text-apple-ink-muted-80 mt-1 line-clamp-2 leading-relaxed">
                    {user.bio}
                  </p>
                </div>
              </div>

              {/* XP Progress inside Passport */}
              <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-apple-hairline">
                <XpProgressBar
                  currentXp={user.xpPoints}
                  nextTierXp={user.nextTierXp}
                  tier={user.tier}
                  rankPosition={user.rankPosition}
                />
              </div>

              {/* Social & Hash Links */}
              <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-apple-hairline flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2 text-apple-ink">
                  {user.githubUsername && (
                    <a
                      href={`https://github.com/${user.githubUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 sm:p-2 rounded-full hover:bg-apple-parchment transition-colors text-apple-ink"
                      title="GitHub Profile"
                    >
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {user.linkedinUrl && (
                    <a
                      href={user.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 sm:p-2 rounded-full hover:bg-apple-parchment transition-colors text-apple-ink"
                      title="LinkedIn"
                    >
                      <Linkedin className="w-4 h-4 text-apple-blue" />
                    </a>
                  )}
                  {user.portfolioUrl && (
                    <a
                      href={user.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 sm:p-2 rounded-full hover:bg-apple-parchment transition-colors text-apple-ink"
                      title="Portfolio"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <button
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-[#86868b] hover:text-apple-ink transition-colors"
                >
                  <Lock className="w-3 h-3 text-apple-blue" />
                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{user.badgeHash.substring(0, 14)}...</span>
                  {copiedHash ? <Check className="w-3 h-3 text-[#30d158]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TILE 2: DARK TILE (Near-Black #272729) - RADAR CAPABILITY MATRIX */}
      {/* ========================================================================= */}
      <section className="w-full bg-apple-tile-1 text-white py-12 sm:py-20 px-3 sm:px-8 overflow-hidden">
        <div className="max-w-[980px] mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8 sm:mb-12 px-2">
            <h2 className="text-[26px] sm:text-[34px] md:text-[40px] font-semibold text-white tracking-tight leading-tight font-display">
              Verified Capability Matrix.
            </h2>
            <p className="text-[14px] sm:text-[17px] text-[#cccccc] font-normal mt-2 max-w-lg mx-auto leading-relaxed">
              Multi-dimensional skill vector verified across hackathon codebases, judge scoring rubrics, and pull request diffs.
            </p>
          </div>

          {/* Radar Visualization Card */}
          <div className="bg-apple-tile-2 rounded-[20px] sm:rounded-[22px] p-4 sm:p-10 border border-white/10 product-shadow-dark flex flex-col items-center">
            <RadarChart skills={user.radarSkills} size={320} />

            {/* Skill Vector Chips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/10">
              {user.radarSkills.map((skill) => (
                <div
                  key={skill.category}
                  className="p-3 sm:p-3.5 rounded-[12px] sm:rounded-[14px] bg-white/5 border border-white/5 flex flex-col justify-between"
                >
                  <div className="text-[11px] sm:text-[13px] text-[#cccccc] font-medium font-display truncate">
                    {skill.category}
                  </div>
                  <div className="flex items-baseline justify-between mt-1.5 sm:mt-2">
                    <span className="text-[16px] sm:text-[20px] font-semibold text-white font-display">
                      {skill.score}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#2997ff] font-text">
                      {skill.verifiedCommits} commits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TILE 3: PARCHMENT CANVAS (#f5f5f7) - 52-WEEK ACTIVITY MATRIX */}
      {/* ========================================================================= */}
      <section className="w-full bg-apple-parchment py-12 sm:py-20 px-3 sm:px-8 border-b border-apple-hairline overflow-hidden">
        <div className="max-w-[980px] mx-auto">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8 px-1">
            <div>
              <h2 className="text-[26px] sm:text-[34px] md:text-[40px] font-semibold text-apple-ink tracking-tight leading-tight font-display">
                Proof of Work.
              </h2>
              <p className="text-[14px] sm:text-[17px] text-apple-ink-muted-80 font-normal mt-1">
                52-week activity telemetry with synchronized hackathon sprint markers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] sm:text-[14px] text-[#86868b]">
                {user.totalHackathonsAttended} Hackathons Attended
              </span>
            </div>
          </div>

          {/* Activity Matrix Card */}
          <div className="bg-white rounded-[20px] sm:rounded-[22px] p-4 sm:p-8 border border-apple-hairline product-shadow overflow-hidden">
            <ActivityHeatmap activityMatrix={user.activityMatrix} />
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TILE 4: STORE UTILITY CARDS GRID (White Canvas #ffffff) - PODIUMS & STAMPS */}
      {/* ========================================================================= */}
      <section className="w-full bg-apple-canvas py-12 sm:py-20 px-3 sm:px-8 border-b border-apple-hairline">
        <div className="max-w-[980px] mx-auto">
          
          {/* Category Filter Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 px-1">
            <div>
              <h2 className="text-[26px] sm:text-[34px] md:text-[40px] font-semibold text-apple-ink tracking-tight font-display">
                Credentials & Podiums.
              </h2>
              <p className="text-[14px] sm:text-[17px] text-apple-ink-muted-80 mt-1">
                Cryptographically attested podium finishes, organizer stamps, and vouches.
              </p>
            </div>

            {/* Segmented Pill Switcher */}
            <div className="inline-flex p-1 rounded-full bg-apple-parchment border border-apple-hairline text-[12px] sm:text-[14px] self-start sm:self-auto">
              <button
                onClick={() => setActiveTabSection('skills')}
                className={`btn-apple px-3 sm:px-4 py-1.5 rounded-full transition-all ${
                  activeTabSection === 'skills'
                    ? 'bg-white text-apple-ink font-semibold shadow-sm'
                    : 'text-[#86868b] hover:text-apple-ink'
                }`}
              >
                Trophies ({user.trophies.length})
              </button>
              <button
                onClick={() => setActiveTabSection('stamps')}
                className={`btn-apple px-3 sm:px-4 py-1.5 rounded-full transition-all ${
                  activeTabSection === 'stamps'
                    ? 'bg-white text-apple-ink font-semibold shadow-sm'
                    : 'text-[#86868b] hover:text-apple-ink'
                }`}
              >
                Visas ({user.stamps.length})
              </button>
              <button
                onClick={() => setActiveTabSection('vouches')}
                className={`btn-apple px-3 sm:px-4 py-1.5 rounded-full transition-all ${
                  activeTabSection === 'vouches'
                    ? 'bg-white text-apple-ink font-semibold shadow-sm'
                    : 'text-[#86868b] hover:text-apple-ink'
                }`}
              >
                Vouches ({user.vouches.length})
              </button>
            </div>
          </div>

          {/* Content Sub-views */}
          {activeTabSection === 'skills' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {user.trophies.map((trophy) => (
                <div
                  key={trophy.id}
                  className="bg-apple-parchment rounded-[18px] p-5 sm:p-6 border border-apple-hairline hover:border-apple-blue/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-white border border-apple-hairline text-[11px] sm:text-[12px] font-semibold text-apple-ink flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-[#ff9500]" />
                        <span>{trophy.rank} Podium</span>
                      </span>
                      <span className="text-[12px] sm:text-[13px] font-mono text-[#86868b]">{trophy.year}</span>
                    </div>

                    <h3 className="text-[18px] sm:text-[21px] font-semibold text-apple-ink mt-3.5 font-display">
                      {trophy.eventName}
                    </h3>
                    <p className="text-[14px] text-apple-ink-muted-80 mt-1">
                      Track: <span className="font-medium text-apple-ink">{trophy.trackName}</span>
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-apple-hairline/80 flex items-center justify-between text-[12px] sm:text-[13px]">
                    <span className="text-[#30d158] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified on-chain
                    </span>
                    <span className="text-apple-blue hover:underline cursor-pointer flex items-center gap-1">
                      <span>View Submission</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTabSection === 'stamps' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {user.stamps.map((stamp) => (
                <div
                  key={stamp.id}
                  className="bg-white rounded-[18px] p-5 sm:p-6 border border-apple-hairline product-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20 text-[11px] sm:text-[12px] font-semibold">
                        OFFICIAL VISA STAMP
                      </span>
                      <span className="text-[11px] sm:text-[12px] font-mono text-[#86868b]">{stamp.date}</span>
                    </div>

                    <h3 className="text-[18px] sm:text-[21px] font-semibold text-apple-ink mt-3 font-display">
                      {stamp.eventName}
                    </h3>
                    <p className="text-[13px] text-[#86868b] mt-0.5">{stamp.location}</p>

                    <div className="mt-3 px-3 py-1.5 bg-apple-parchment rounded-[10px] text-[12px] sm:text-[13px] text-apple-ink font-medium">
                      Role: {stamp.roleTag}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-apple-hairline flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#86868b]">
                    <span>Sig: {stamp.organizerSignature}</span>
                    <span className="text-[#30d158] font-bold">VERIFIED</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTabSection === 'vouches' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {user.vouches.map((vouch) => (
                <div
                  key={vouch.id}
                  className="bg-apple-parchment rounded-[18px] p-5 sm:p-6 border border-apple-hairline flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <img
                        src={vouch.voucherAvatarUrl}
                        alt={vouch.voucherName}
                        className="w-10 h-10 rounded-full object-cover border border-apple-hairline"
                      />
                      <div>
                        <div className="text-[14px] sm:text-[15px] font-semibold text-apple-ink font-display">
                          {vouch.voucherName}
                        </div>
                        <div className="text-[12px] text-apple-blue font-mono">
                          {vouch.voucherHandle}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 px-2.5 py-0.5 rounded-full bg-white border border-apple-hairline text-[11px] font-medium text-apple-ink-muted-80 w-fit">
                      Module: {vouch.moduleName}
                    </div>

                    <p className="text-[13px] sm:text-[14px] text-apple-ink italic mt-3 leading-relaxed">
                      "{vouch.comment}"
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-apple-hairline flex items-center justify-between text-[11px] sm:text-[12px] text-[#86868b]">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-apple-blue" />
                      {vouch.verifiedAt}
                    </span>
                    <span className="text-[#30d158] font-medium">Co-builder Vouch</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TILE 5: DARK TILE 3 (Near-Black #252527) - PRIVACY & DPDP CRYPTOGRAPHY */}
      {/* ========================================================================= */}
      <section className="w-full bg-apple-tile-3 text-white py-12 sm:py-16 px-4 sm:px-8">
        <div className="max-w-[720px] mx-auto text-center space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] sm:text-[12px] font-mono">
            <Sparkles className="w-3 h-3 text-[#2997ff]" />
            <span>DPDP 2023 COMPLIANT PRIVACY ARCHITECTURE</span>
          </div>

          <h3 className="text-[24px] sm:text-[30px] md:text-[34px] font-semibold text-white font-display tracking-tight">
            Ephemeral Proof. Zero Identity Leakage.
          </h3>

          <p className="text-[14px] sm:text-[15px] text-[#cccccc] font-normal leading-relaxed">
            Loopin generates rotating, single-use cryptographic tokens. Your phone number and private contact details remain securely sealed behind verifiable proof of skill.
          </p>
        </div>
      </section>
    </div>
  );
};
