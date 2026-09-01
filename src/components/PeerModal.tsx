import React, { useState } from 'react';
import { UserProfile, Connection } from '../types';
import { RadarChart } from './visualizations/RadarChart';
import { downloadVCard } from '../utils/vcard';
import {
  X,
  Github,
  Linkedin,
  Globe,
  Award,
  CheckCircle2,
  Calendar,
  Download,
  Share2,
  Check,
  Tag,
  FileText,
} from 'lucide-react';

interface PeerModalProps {
  peer: UserProfile | null;
  connection?: Connection | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PeerModal: React.FC<PeerModalProps> = ({
  peer,
  connection,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'radar' | 'trophies' | 'notes'>('radar');

  if (!isOpen || !peer) return null;

  const handleCopyLink = (): void => {
    navigator.clipboard.writeText(`https://loopin.genesishacks.dev/p/${peer.handle.replace('@', '')}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadVCard = (): void => {
    downloadVCard(
      peer,
      connection?.eventMet || 'Genesis Hacks 2026',
      connection?.privateNotes || ''
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-[24px] border border-apple-hairline product-shadow overflow-hidden my-auto text-apple-ink">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apple-hairline">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#30d158]" />
            <span className="text-[13px] font-semibold text-apple-ink font-display">
              Verified Peer Passport
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-[#86868b] hover:text-apple-ink flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto font-text">
          
          {/* Peer Hero Info */}
          <div className="flex items-start gap-4 p-4 bg-apple-parchment rounded-[18px] border border-apple-hairline">
            <div className="relative shrink-0">
              <img
                src={peer.avatarUrl}
                alt={peer.name}
                className="w-16 h-16 rounded-[14px] object-cover border border-apple-hairline"
              />
              <div className="absolute -bottom-1 -right-1 p-0.5 bg-white rounded-full">
                <CheckCircle2 className="w-4 h-4 text-apple-blue fill-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <h3 className="text-[18px] font-semibold text-apple-ink truncate font-display">
                  {peer.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-apple-hairline text-apple-ink">
                  {peer.tier}
                </span>
              </div>
              <div className="text-[13px] font-mono text-apple-blue">{peer.handle}</div>
              <div className="text-[14px] text-apple-ink-muted-80 font-normal mt-1">{peer.primaryRole}</div>
              {peer.bio && (
                <p className="text-[13px] text-[#86868b] line-clamp-3 mt-1.5 leading-relaxed">
                  {peer.bio}
                </p>
              )}
            </div>
          </div>

          {/* Social Links Row */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              {peer.githubUsername && (
                <a
                  href={`https://github.com/${peer.githubUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-apple px-3 py-1.5 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-apple-ink text-[12px] flex items-center gap-1.5"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>
              )}
              {peer.linkedinUrl && (
                <a
                  href={peer.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-apple px-3 py-1.5 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-apple-ink text-[12px] flex items-center gap-1.5"
                >
                  <Linkedin className="w-3.5 h-3.5 text-apple-blue" />
                  <span>LinkedIn</span>
                </a>
              )}
              {peer.portfolioUrl && (
                <a
                  href={peer.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-apple px-3 py-1.5 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-apple-ink text-[12px] flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Web</span>
                </a>
              )}
            </div>

            <button
              onClick={handleCopyLink}
              className="btn-apple text-[12px] text-apple-blue hover:underline flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center justify-center">
            <div className="inline-flex p-1 rounded-full bg-apple-parchment border border-apple-hairline text-[13px]">
              <button
                onClick={() => setActiveTab('radar')}
                className={`btn-apple px-3.5 py-1 rounded-full transition-all ${
                  activeTab === 'radar'
                    ? 'bg-white text-apple-ink font-semibold shadow-sm'
                    : 'text-[#86868b] hover:text-apple-ink'
                }`}
              >
                Skills Radar
              </button>
              <button
                onClick={() => setActiveTab('trophies')}
                className={`btn-apple px-3.5 py-1 rounded-full transition-all ${
                  activeTab === 'trophies'
                    ? 'bg-white text-apple-ink font-semibold shadow-sm'
                    : 'text-[#86868b] hover:text-apple-ink'
                }`}
              >
                Podiums ({peer.trophies?.length || 0})
              </button>
              {connection && (
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`btn-apple px-3.5 py-1 rounded-full transition-all ${
                    activeTab === 'notes'
                      ? 'bg-white text-apple-ink font-semibold shadow-sm'
                      : 'text-[#86868b] hover:text-apple-ink'
                  }`}
                >
                  Private Notes
                </button>
              )}
            </div>
          </div>

          {/* Tab View 1: Radar Chart */}
          {activeTab === 'radar' && (
            <div className="p-4 bg-apple-parchment rounded-[18px] border border-apple-hairline flex flex-col items-center">
              {peer.radarSkills && peer.radarSkills.length > 0 ? (
                <RadarChart skills={peer.radarSkills} size={280} />
              ) : (
                <div className="py-8 text-center text-[14px] text-[#86868b]">
                  Skill vectors being indexed from hackathon submissions.
                </div>
              )}
            </div>
          )}

          {/* Tab View 2: Podiums & Trophies */}
          {activeTab === 'trophies' && (
            <div className="space-y-3">
              {peer.trophies && peer.trophies.length > 0 ? (
                peer.trophies.map((trophy) => (
                  <div
                    key={trophy.id}
                    className="p-3.5 bg-apple-parchment rounded-[14px] border border-apple-hairline flex items-center justify-between"
                  >
                    <div>
                      <div className="text-[14px] font-semibold text-apple-ink font-display">
                        {trophy.eventName}
                      </div>
                      <div className="text-[12px] text-[#86868b] mt-0.5">
                        Track: {trophy.trackName}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-apple-hairline text-[11px] font-semibold text-apple-ink flex items-center gap-1">
                      <Award className="w-3 h-3 text-[#ff9500]" />
                      {trophy.rank}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[14px] text-[#86868b]">
                  No public podiums recorded yet.
                </div>
              )}
            </div>
          )}

          {/* Tab View 3: Private Notes & Metadata */}
          {activeTab === 'notes' && connection && (
            <div className="space-y-3">
              <div className="p-4 bg-apple-parchment rounded-[14px] border border-apple-hairline space-y-2">
                <div className="text-[12px] font-semibold text-apple-ink flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-apple-blue" />
                  <span>Your Private Notes</span>
                </div>
                <p className="text-[14px] text-apple-ink leading-relaxed">
                  {connection.privateNotes || 'No notes added yet.'}
                </p>
              </div>

              {connection.tags && connection.tags.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[12px] font-semibold text-apple-ink flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-apple-blue" />
                    <span>Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {connection.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-0.5 rounded-full bg-apple-parchment border border-apple-hairline text-[11px] text-apple-ink"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
                <Calendar className="w-3.5 h-3.5 text-apple-blue" />
                <span>Met at {connection.eventMet} on {new Date(connection.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {/* Bottom Native Contact Action */}
          <div className="pt-2 border-t border-apple-hairline">
            <button
              onClick={handleDownloadVCard}
              className="btn-apple w-full py-3 px-4 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[15px] font-normal flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Save to Phone Contacts (.vcf)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
