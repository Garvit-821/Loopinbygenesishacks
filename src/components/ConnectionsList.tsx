import React, { useState, useMemo } from 'react';
import { Connection } from '../types';
import { store } from '../services/store';
import {
  Search,
  Users,
  Zap,
  Github,
  Linkedin,
  FileText,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  Share2,
  Download,
} from 'lucide-react';

interface ConnectionsListProps {
  connections: Connection[];
  onOpenScanner: () => void;
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  onOpenScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filterTabs = ['All', 'AI/ML', 'Rust/Systems', 'Frontend & UI', 'High-Conviction', 'Genesis 2026'];

  // Filtered & Searched Connections
  const filteredConnections = useMemo(() => {
    return connections.filter((conn) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        conn.peerProfile.name.toLowerCase().includes(q) ||
        conn.peerProfile.handle.toLowerCase().includes(q) ||
        conn.peerProfile.primaryRole.toLowerCase().includes(q) ||
        conn.privateNotes.toLowerCase().includes(q) ||
        conn.tags.some((t) => t.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedFilter === 'All') return true;
      if (selectedFilter === 'High-Conviction') return conn.tags.includes('High-Conviction');
      if (selectedFilter === 'AI/ML') return conn.tags.includes('AI/ML') || conn.peerProfile.primaryRole.includes('AI') || conn.peerProfile.primaryRole.includes('ML');
      if (selectedFilter === 'Rust/Systems') return conn.tags.includes('Rust/Systems') || conn.peerProfile.primaryRole.includes('Systems');
      if (selectedFilter === 'Frontend & UI') return conn.tags.includes('Frontend & UI') || conn.peerProfile.primaryRole.includes('UI') || conn.peerProfile.primaryRole.includes('Design');
      if (selectedFilter === 'Genesis 2026') return conn.tags.includes('Genesis 2026') || conn.eventMet.includes('Genesis');

      return true;
    });
  }, [connections, searchQuery, selectedFilter]);

  // Telemetry Aggregates
  const { avgLatency, highConvictionCount } = useMemo(() => {
    if (connections.length === 0) return { avgLatency: 0, highConvictionCount: 0 };
    const totalLat = connections.reduce((acc, c) => acc + (c.scanLatencyMs || 300), 0);
    const hc = connections.filter((c) => c.tags.includes('High-Conviction')).length;
    return {
      avgLatency: Math.round(totalLat / connections.length),
      highConvictionCount: hc,
    };
  }, [connections]);

  const handleStartEditNote = (conn: Connection): void => {
    setEditingNoteId(conn.id);
    setNoteDraft(conn.privateNotes);
  };

  const handleSaveNote = (id: string): void => {
    store.updateConnection(id, { privateNotes: noteDraft });
    setEditingNoteId(null);
  };

  const handleDelete = (id: string): void => {
    if (window.confirm('Remove this developer connection from your passport graph?')) {
      store.deleteConnection(id);
    }
  };

  const handleCopyProfile = (handle: string, id: string): void => {
    navigator.clipboard.writeText(`https://loopin.genesishacks.dev/p/${handle.replace('@', '')}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportAsJson = (): void => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(connections, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `loopin_connections_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-5 pb-28">
      {/* Header Telemetry Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 bg-cyber-surface/70 border border-cyber-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Users className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>Connections</span>
          </div>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {connections.length}
          </div>
        </div>

        <div className="p-3.5 bg-cyber-surface/70 border border-cyber-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Avg Scan</span>
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {avgLatency}ms
          </div>
        </div>

        <div className="p-3.5 bg-cyber-surface/70 border border-cyber-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>High Signal</span>
          </div>
          <div className="text-xl font-bold text-purple-400 font-mono mt-1">
            {highConvictionCount}
          </div>
        </div>
      </div>

      {/* Search & Export Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, role, private note or tag..."
            className="w-full pl-10 pr-4 py-2.5 bg-cyber-surface border border-cyber-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
          />
        </div>

        <button
          onClick={exportAsJson}
          className="px-3.5 py-2.5 rounded-xl bg-cyber-surface border border-cyber-border hover:border-cyber-cyan text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition-all shrink-0"
          title="Export Network Graph (JSON)"
        >
          <Download className="w-4 h-4 text-cyber-cyan" />
          <span>Export Graph</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {filterTabs.map((tab) => {
          const isActive = selectedFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  : 'bg-cyber-surface border border-cyber-border text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Connections List */}
      {filteredConnections.length === 0 ? (
        <div className="text-center py-12 px-4 bg-cyber-surface/50 border border-cyber-border rounded-2xl">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-200 font-display">No Connections Found</h4>
          <p className="text-xs text-slate-400 font-mono mt-1 max-w-xs mx-auto">
            {searchQuery
              ? 'No matching peers found for your search query.'
              : 'Start scanning attendee QR badges to build your verified developer graph.'}
          </p>
          <button
            onClick={onOpenScanner}
            className="mt-4 px-4 py-2 rounded-xl bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan text-xs font-mono font-bold hover:bg-cyber-cyan/30 transition-all shadow-neon-cyan"
          >
            Launch Instant Scanner
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConnections.map((conn) => {
            const isExpanded = expandedId === conn.id;
            const peer = conn.peerProfile;

            return (
              <div
                key={conn.id}
                className="bg-cyber-surface/80 border border-cyber-border hover:border-cyber-cyan/40 rounded-xl transition-all overflow-hidden"
              >
                {/* Primary Card Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : conn.id)}
                  className="p-4 flex items-start gap-3.5 cursor-pointer select-none"
                >
                  <img
                    src={peer.avatarUrl}
                    alt={peer.name}
                    className="w-12 h-12 rounded-xl object-cover border border-cyber-border shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 truncate">
                        <h4 className="text-sm font-bold text-white truncate font-display">
                          {peer.name}
                        </h4>
                        <span className="text-xs font-mono text-cyber-cyan">{peer.handle}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-400/10 border border-amber-400/30 text-amber-300 shrink-0">
                        {peer.tier}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-medium mt-0.5 truncate">
                      {peer.primaryRole}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {conn.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyber-elevated border border-cyber-border text-slate-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-slate-500 pt-1 shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expandable Context & Private Notes Panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-cyber-border/70 bg-cyber-elevated/40 space-y-3.5 animate-in fade-in duration-150">
                    {/* Bio */}
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {peer.bio}
                    </p>

                    {/* Metadata Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        Met at {conn.eventMet} ({new Date(conn.timestamp).toLocaleDateString()})
                      </span>
                      <span className="text-cyber-cyan font-semibold">
                        ⚡ Scanned in {conn.scanLatencyMs}ms
                      </span>
                    </div>

                    {/* Private Contextual Note Section */}
                    <div className="p-3 bg-cyber-surface border border-cyber-border rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-cyber-purple font-semibold flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          PRIVATE CONTEXTUAL NOTE (ONLY VISIBLE TO YOU)
                        </span>
                        {editingNoteId !== conn.id && (
                          <button
                            onClick={() => handleStartEditNote(conn)}
                            className="text-[11px] font-mono text-cyber-cyan hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {editingNoteId === conn.id ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            rows={2}
                            className="w-full p-2 bg-cyber-elevated border border-cyber-border rounded-lg text-xs text-white focus:outline-none focus:border-cyber-cyan resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveNote(conn.id)}
                              className="px-3 py-1 rounded bg-cyber-cyan text-black font-bold text-xs font-mono"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 italic">
                          {conn.privateNotes || 'No notes added yet.'}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        {peer.githubUsername && (
                          <a
                            href={`https://github.com/${peer.githubUsername}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-cyber-surface border border-cyber-border hover:border-cyber-cyan text-slate-300 hover:text-cyber-cyan transition-all"
                            title="GitHub"
                          >
                            <Github className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {peer.linkedinUrl && (
                          <a
                            href={peer.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-cyber-surface border border-cyber-border hover:border-cyber-cyan text-slate-300 hover:text-cyber-cyan transition-all"
                            title="LinkedIn"
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleCopyProfile(peer.handle, conn.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-cyber-surface border border-cyber-border hover:border-cyber-cyan text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-all"
                        >
                          {copiedId === conn.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                          <span>{copiedId === conn.id ? 'Copied' : 'Share'}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="p-2 rounded-lg bg-cyber-surface border border-cyber-border hover:border-rose-500/50 text-slate-500 hover:text-rose-400 transition-all"
                        title="Delete connection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
