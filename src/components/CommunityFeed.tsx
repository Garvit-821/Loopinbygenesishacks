import React, { useState } from 'react';
import { EventFeedItem } from '../types';
import { store } from '../services/store';
import {
  AlertCircle,
  Bell,
  Calendar,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface CommunityFeedProps {
  feed: EventFeedItem[];
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ feed }) => {
  const [filterType, setFilterType] = useState<'all' | 'alert' | 'announcement' | 'event'>('all');

  const filteredFeed = feed.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const handleToggleRsvp = (id: string): void => {
    store.toggleRsvp(id);
  };

  return (
    <div className="w-full bg-apple-parchment min-h-screen py-10 sm:py-16 px-4 sm:px-8">
      <div className="max-w-[980px] mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-apple-hairline text-[12px] text-apple-ink font-medium mb-3">
              <span className="w-2 h-2 rounded-full bg-[#30d158] animate-pulse" />
              <span>Genesis Hacks 2026 Telemetry</span>
            </div>
            <h1 className="text-[32px] sm:text-[40px] font-semibold text-apple-ink tracking-tight font-display">
              Live Operations & Updates.
            </h1>
            <p className="text-[17px] text-apple-ink-muted-80 font-normal mt-1">
              Real-time organizer push broadcasts, demo schedules, food drops, and residency invitations.
            </p>
          </div>

          {/* Segmented Filter Pills */}
          <div className="inline-flex p-1 rounded-full bg-white border border-apple-hairline text-[14px]">
            <button
              onClick={() => setFilterType('all')}
              className={`btn-apple px-3.5 py-1.5 rounded-full transition-all ${
                filterType === 'all'
                  ? 'bg-apple-ink text-white font-medium'
                  : 'text-[#86868b] hover:text-apple-ink'
              }`}
            >
              All ({feed.length})
            </button>
            <button
              onClick={() => setFilterType('alert')}
              className={`btn-apple px-3.5 py-1.5 rounded-full transition-all ${
                filterType === 'alert'
                  ? 'bg-apple-ink text-white font-medium'
                  : 'text-[#86868b] hover:text-apple-ink'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setFilterType('announcement')}
              className={`btn-apple px-3.5 py-1.5 rounded-full transition-all ${
                filterType === 'announcement'
                  ? 'bg-apple-ink text-white font-medium'
                  : 'text-[#86868b] hover:text-apple-ink'
              }`}
            >
              Announcements
            </button>
            <button
              onClick={() => setFilterType('event')}
              className={`btn-apple px-3.5 py-1.5 rounded-full transition-all ${
                filterType === 'event'
                  ? 'bg-apple-ink text-white font-medium'
                  : 'text-[#86868b] hover:text-apple-ink'
              }`}
            >
              Events
            </button>
          </div>
        </div>

        {/* Feed Cards Stack */}
        <div className="space-y-4">
          {filteredFeed.map((item) => {
            const isUrgent = item.urgent;
            const isEvent = item.type === 'event';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-[20px] p-6 sm:p-7 border transition-all product-shadow ${
                  isUrgent ? 'border-[#ff3b30]/40' : 'border-apple-hairline hover:border-apple-blue/30'
                }`}
              >
                {/* Top Badge & Time */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {isUrgent ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20 text-[12px] font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>URGENT DIRECTIVE</span>
                      </span>
                    ) : isEvent ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue border border-apple-blue/20 text-[12px] font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>INVITATIONAL EVENT</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-apple-parchment text-apple-ink border border-apple-hairline text-[12px] font-semibold">
                        <Bell className="w-3.5 h-3.5 text-apple-blue" />
                        <span>ORGANIZER DISPATCH</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[13px] text-[#86868b] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{item.timestamp}</span>
                  </span>
                </div>

                {/* Main Content */}
                <h3 className="text-[21px] sm:text-[24px] font-semibold text-apple-ink tracking-tight font-display">
                  {item.title}
                </h3>

                <p className="text-[17px] text-apple-ink-muted-80 font-normal mt-2 leading-relaxed">
                  {item.content}
                </p>

                {/* Venue & Date Details */}
                {(item.venue || item.eventDate) && (
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-apple-hairline text-[14px] text-[#86868b]">
                    {item.venue && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-apple-blue" />
                        <span className="text-apple-ink font-medium">{item.venue}</span>
                      </span>
                    )}
                    {item.eventDate && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-apple-blue" />
                        <span className="text-apple-ink font-medium">{item.eventDate}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Action CTAs */}
                <div className="mt-5 pt-4 border-t border-apple-hairline flex items-center justify-between flex-wrap gap-3">
                  {isEvent ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleRsvp(item.id)}
                        className={`btn-apple px-5 py-2 rounded-full text-[14px] font-normal transition-all flex items-center gap-2 ${
                          item.isRsvpd
                            ? 'bg-[#30d158] text-white shadow-sm'
                            : 'bg-apple-blue hover:bg-apple-blue-focus text-white shadow-sm'
                        }`}
                      >
                        {item.isRsvpd ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>RSVP Confirmed</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Reserve Free Spot</span>
                          </>
                        )}
                      </button>

                      <span className="text-[13px] text-[#86868b]">
                        {item.rsvpCount || 0} builders attending
                      </span>
                    </div>
                  ) : item.actionUrl ? (
                    <a
                      href={item.actionUrl}
                      className="btn-apple px-5 py-2 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[14px] font-normal inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{item.actionLabel || 'Learn More'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-[13px] text-[#86868b]">Verified by Genesis Core Team</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
