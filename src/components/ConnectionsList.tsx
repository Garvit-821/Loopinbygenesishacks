import React, { useState, useMemo } from 'react';
import { Connection, UserProfile } from '../types';
import { store } from '../services/store';
import {
  Search,
  Users,
  Calendar,
  Tag,
  FileText,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  Check,
  Zap,
} from 'lucide-react';

interface ConnectionsListProps {
  connections: Connection[];
  onOpenScanner: () => void;
  onSelectPeer?: (peer: UserProfile) => void;
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  onOpenScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    connections.forEach((c) => {
      c.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [connections]);

  // Filter connections by search query and selected tag
  const filteredConnections = useMemo(() => {
    return connections.filter((c) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        c.peerProfile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.peerProfile.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.peerProfile.primaryRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.privateNotes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTag = !selectedTag || c.tags.includes(selectedTag);

      return matchSearch && matchTag;
    });
  }, [connections, searchQuery, selectedTag]);

  const toggleExpand = (id: string): void => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleStartEdit = (conn: Connection, e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingId(conn.id);
    setEditNotes(conn.privateNotes);
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    store.updateConnection(id, { privateNotes: editNotes });
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    if (window.confirm('Remove this developer from your verified network?')) {
      store.deleteConnection(id);
    }
  };

  const handleCopyContact = (conn: Connection, e: React.MouseEvent): void => {
    e.stopPropagation();
    const text = `${conn.peerProfile.name} (${conn.peerProfile.handle}) - ${conn.peerProfile.primaryRole}\nMet at: ${conn.eventMet}\nNotes: ${conn.privateNotes}`;
    navigator.clipboard.writeText(text);
    setCopiedId(conn.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = (): void => {
    const headers = 'Name,Handle,Role,Tier,EventMet,DateMet,Tags,PrivateNotes\n';
    const rows = connections
      .map((c) =>
        [
          `"${c.peerProfile.name}"`,
          `"${c.peerProfile.handle}"`,
          `"${c.peerProfile.primaryRole}"`,
          `"${c.peerProfile.tier}"`,
          `"${c.eventMet}"`,
          `"${new Date(c.timestamp).toLocaleDateString()}"`,
          `"${c.tags.join('; ')}"`,
          `"${c.privateNotes.replace(/"/g, '""')}"`,
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loopin-network-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="w-full bg-apple-parchment min-h-screen py-10 sm:py-16 px-4 sm:px-8">
      <div className="max-w-[980px] mx-auto">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[32px] sm:text-[40px] font-semibold text-apple-ink tracking-tight font-display">
              Network Graph.
            </h1>
            <p className="text-[17px] text-apple-ink-muted-80 font-normal mt-1">
              {connections.length} verified developer connections with contextual notes and private metadata.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="btn-apple px-4 py-2 rounded-full bg-white border border-apple-hairline text-[14px] text-apple-ink hover:bg-apple-pearl flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-apple-blue" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="btn-apple px-4 py-2 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[14px] font-normal flex items-center gap-1.5 shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Add Peer</span>
            </button>
          </div>
        </div>

        {/* Search Input (Apple Pill Shape) */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, role, tags, or private notes..."
            className="w-full h-[44px] pl-11 pr-4 bg-white border border-apple-hairline rounded-full text-[17px] text-apple-ink placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue shadow-sm"
          />
        </div>

        {/* Tag Filters (Apple Capsule Chips) */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 no-scrollbar">
            <button
              onClick={() => setSelectedTag(null)}
              className={`btn-apple px-3.5 py-1.5 rounded-full text-[13px] transition-all whitespace-nowrap ${
                selectedTag === null
                  ? 'bg-apple-ink text-white font-medium'
                  : 'bg-white border border-apple-hairline text-apple-ink hover:bg-apple-pearl'
              }`}
            >
              All ({connections.length})
            </button>

            {allTags.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`btn-apple px-3.5 py-1.5 rounded-full text-[13px] transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-apple-blue text-white font-medium'
                      : 'bg-white border border-apple-hairline text-apple-ink hover:bg-apple-pearl'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredConnections.length === 0 && (
          <div className="bg-white rounded-[22px] p-12 text-center border border-apple-hairline product-shadow my-8">
            <div className="w-14 h-14 rounded-full bg-apple-parchment flex items-center justify-center mx-auto text-apple-blue mb-4">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-[21px] font-semibold text-apple-ink font-display">
              No Connections Found
            </h3>
            <p className="text-[15px] text-[#86868b] mt-1 max-w-sm mx-auto">
              {searchQuery || selectedTag
                ? 'Try adjusting your search criteria or filter tags.'
                : 'Scan peer QR codes during hackathon demos to build your verified talent graph.'}
            </p>
            <button
              onClick={onOpenScanner}
              className="btn-apple mt-6 px-6 py-2.5 rounded-full bg-apple-blue text-white text-[14px] font-normal shadow-sm inline-flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Scan First Badge</span>
            </button>
          </div>
        )}

        {/* Store Utility Card Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredConnections.map((conn) => {
            const isExpanded = expandedId === conn.id;
            const isEditing = editingId === conn.id;

            return (
              <div
                key={conn.id}
                onClick={() => toggleExpand(conn.id)}
                className="bg-white rounded-[18px] border border-apple-hairline p-5 sm:p-6 product-shadow transition-all hover:border-apple-blue/30 cursor-pointer"
              >
                {/* Main Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Left: Avatar & Info */}
                  <div className="flex items-start gap-4">
                    <img
                      src={conn.peerProfile.avatarUrl}
                      alt={conn.peerProfile.name}
                      className="w-13 h-13 rounded-[12px] object-cover border border-apple-hairline shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[18px] font-semibold text-apple-ink font-display">
                          {conn.peerProfile.name}
                        </h3>
                        <span className="text-[13px] font-mono text-apple-blue">
                          {conn.peerProfile.handle}
                        </span>
                        <span className="px-2 py-0.2 bg-apple-parchment rounded-full text-[11px] font-semibold text-apple-ink border border-apple-hairline">
                          {conn.peerProfile.tier}
                        </span>
                      </div>

                      <p className="text-[14px] text-apple-ink-muted-80 font-normal mt-0.5">
                        {conn.peerProfile.primaryRole}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[12px] text-[#86868b]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-apple-blue" />
                          {conn.eventMet}
                        </span>
                        <span>•</span>
                        <span>{new Date(conn.timestamp).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-[#30d158] font-medium">{conn.scanLatencyMs || 280}ms scan</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Expand Toggle & Quick Action */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={(e) => handleCopyContact(conn, e)}
                      className="btn-apple p-2 rounded-full hover:bg-apple-parchment text-[#86868b] hover:text-apple-ink transition-colors"
                      title="Copy Card"
                    >
                      {copiedId === conn.id ? (
                        <Check className="w-4 h-4 text-[#30d158]" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                    </button>

                    <div className="p-1 rounded-full text-[#86868b]">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div
                    className="mt-5 pt-5 border-t border-apple-hairline space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Private Contextual Note */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-apple-blue" />
                          <span>Private Contextual Note</span>
                        </label>
                        {!isEditing && (
                          <button
                            onClick={(e) => handleStartEdit(conn, e)}
                            className="text-[12px] text-apple-blue hover:underline flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Note</span>
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="btn-apple px-3 py-1 text-[12px] rounded-full text-apple-ink bg-apple-parchment"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={(e) => handleSaveEdit(conn.id, e)}
                              className="btn-apple px-3.5 py-1 text-[12px] rounded-full bg-apple-blue text-white"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[14px] text-apple-ink leading-relaxed p-3 bg-apple-parchment rounded-xl border border-apple-hairline/60">
                          {conn.privateNotes || 'No notes added yet.'}
                        </p>
                      )}
                    </div>

                    {/* Tag Badges */}
                    {conn.tags && conn.tags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[12px] font-semibold text-apple-ink flex items-center gap-1">
                          <Tag className="w-3 h-3 text-apple-blue" />
                          <span>Tags</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {conn.tags.map((t) => (
                            <span
                              key={t}
                              className="px-2.5 py-0.5 rounded-full bg-white border border-apple-hairline text-[11px] text-apple-ink"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-3 border-t border-apple-hairline text-[13px]">
                      <div className="flex items-center gap-3">
                        <a
                          href={`https://github.com/${conn.peerProfile.handle.replace('@', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-apple-blue hover:underline flex items-center gap-1"
                        >
                          <span>GitHub Profile</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <button
                        onClick={(e) => handleDelete(conn.id, e)}
                        className="btn-apple text-[#ff3b30] hover:bg-[#ff3b30]/10 px-3 py-1 rounded-full text-[12px] flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
