import React, { useState } from 'react';
import { EventFeedItem } from '../types';
import { store } from '../services/store';
import {
  Radio,
  AlertTriangle,
  Bell,
  Calendar,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Users,
} from 'lucide-react';

interface CommunityFeedProps {
  feedItems: EventFeedItem[];
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ feedItems }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { key: 'all', label: 'All Operations' },
    { key: 'alert', label: 'Urgent Alerts' },
    { key: 'announcement', label: 'Venue Announcements' },
    { key: 'event', label: 'Upcoming Hackathons' },
  ];

  const filteredFeed = feedItems.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.type === selectedCategory;
  });

  const handleToggleRsvp = (id: string): void => {
    store.toggleRsvp(id);
  };

  return (
    <div className="space-y-5 pb-28">
      {/* Live Operations Banner */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-r from-cyber-surface via-cyber-elevated to-cyber-surface border border-cyber-cyan/30 overflow-hidden shadow-hud-glow">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Radio className="w-5 h-5 text-cyber-cyan animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display tracking-wide">
                GENESIS LIVE OPERATIONS // BROADCAST
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Sub-second FCM event streams • Bengaluru Venue
              </p>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>SOCKET LIVE</span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  : 'bg-cyber-surface border border-cyber-border text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Timeline Feed Cards */}
      <div className="space-y-3.5">
        {filteredFeed.map((item) => {
          const isAlert = item.type === 'alert';
          const isEvent = item.type === 'event';

          return (
            <div
              key={item.id}
              className={`relative p-5 rounded-2xl border transition-all overflow-hidden ${
                isAlert
                  ? 'bg-rose-950/20 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                  : isEvent
                  ? 'bg-cyber-surface/90 border-purple-500/40 hover:border-purple-500/70'
                  : 'bg-cyber-surface/80 border-cyber-border hover:border-cyber-cyan/40'
              }`}
            >
              {/* Alert Indicator Strip */}
              {isAlert && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse" />
              )}

              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {isAlert ? (
                    <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  ) : isEvent ? (
                    <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-lg bg-cyber-cyan/15 text-cyber-cyan">
                      <Bell className="w-4 h-4" />
                    </div>
                  )}

                  <span className="text-[11px] font-mono text-slate-400">
                    {item.timestamp}
                  </span>
                </div>

                {item.venue && (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyber-elevated border border-cyber-border text-[10px] font-mono text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyber-cyan" />
                    <span>{item.venue}</span>
                  </span>
                )}
              </div>

              {/* Title & Body */}
              <h4 className="text-sm sm:text-base font-bold text-white font-display tracking-tight leading-snug">
                {item.title}
              </h4>

              <p className="text-xs text-slate-300 font-sans mt-2 leading-relaxed">
                {item.content}
              </p>

              {/* Event Specific Card Footer (RSVP & Dates) */}
              {isEvent && (
                <div className="mt-4 pt-3 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                    {item.eventDate && (
                      <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        {item.eventDate}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Users className="w-3.5 h-3.5 text-cyber-cyan" />
                      <span className="text-white font-bold">{item.rsvpCount}</span> spots claimed
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleRsvp(item.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                      item.isRsvpd
                        ? 'bg-emerald-500 text-black shadow-neon-emerald'
                        : 'bg-purple-600/30 border border-purple-400 text-purple-200 hover:bg-purple-600/50'
                    }`}
                  >
                    {item.isRsvpd ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>PASSPORT RSVP CONFIRMED</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>CLAIM RESIDENCY PASS</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Action Button for Announcements/Alerts */}
              {!isEvent && item.actionLabel && (
                <div className="mt-3.5 pt-2.5 border-t border-cyber-border flex justify-end">
                  <a
                    href={item.actionUrl || '#'}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-cyan hover:underline"
                  >
                    <span>{item.actionLabel}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
